/*
 * Wire
 * Copyright (C) 2018 Wire Swiss GmbH
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see http://www.gnu.org/licenses/.
 *
 */

import {PromiseQueue} from 'Util/PromiseQueue';
import {TIME_IN_MILLIS} from 'Util/TimeUtil';
import {isValidApiPath} from 'Util/ValidationUtil';

import {AuthRepository} from '../auth/AuthRepository';
import {QUEUE_STATE} from '../service/QueueState';
import {WebAppEvents} from '../event/WebApp';

import {BackendClientError} from '../error/BackendClientError';

export class BackendClient {
  static get CONFIG() {
    return {
      CONNECTIVITY_CHECK: {
        INITIAL_TIMEOUT: 0,
        RECHECK_TIMEOUT: TIME_IN_MILLIS.SECOND * 2,
        REQUEST_TIMEOUT: TIME_IN_MILLIS.SECOND * 0.5,
      },
      QUEUE_CHECK_TIMEOUT: TIME_IN_MILLIS.MINUTE,
    };
  }

  static get CONNECTIVITY_CHECK_TRIGGER() {
    return {
      ACCESS_TOKEN_REFRESH: 'BackendClient.CONNECTIVITY_CHECK_TRIGGER.ACCESS_TOKEN_REFRESH',
      ACCESS_TOKEN_RETRIEVAL: 'BackendClient.CONNECTIVITY_CHECK_TRIGGER.ACCESS_TOKEN_RETRIEVAL',
      APP_INIT_RELOAD: '.BackendClient.CONNECTIVITY_CHECK_TRIGGER.APP_INIT_RELOAD',
      CONNECTION_REGAINED: 'BackendClient.CONNECTIVITY_CHECK_TRIGGER.CONNECTION_REGAINED',
      LOGIN_REDIRECT: 'BackendClient.CONNECTIVITY_CHECK_TRIGGER.LOGIN_REDIRECT',
      REQUEST_FAILURE: 'BackendClient.CONNECTIVITY_CHECK_TRIGGER.REQUEST_FAILURE',
      UNKNOWN: 'BackendClient.CONNECTIVITY_CHECK_TRIGGER.UNKNOWN',
    };
  }

  static get IGNORED_BACKEND_ERRORS() {
    return [
      BackendClientError.STATUS_CODE.BAD_GATEWAY,
      BackendClientError.STATUS_CODE.CONFLICT,
      BackendClientError.STATUS_CODE.CONNECTIVITY_PROBLEM,
      BackendClientError.STATUS_CODE.INTERNAL_SERVER_ERROR,
      BackendClientError.STATUS_CODE.NOT_FOUND,
      BackendClientError.STATUS_CODE.PRECONDITION_FAILED,
      BackendClientError.STATUS_CODE.REQUEST_TIMEOUT,
      BackendClientError.STATUS_CODE.REQUEST_TOO_LARGE,
      BackendClientError.STATUS_CODE.TOO_MANY_REQUESTS,
    ];
  }

  static get IGNORED_BACKEND_LABELS() {
    return [
      BackendClientError.LABEL.INVALID_CREDENTIALS,
      BackendClientError.LABEL.PASSWORD_EXISTS,
      BackendClientError.LABEL.TOO_MANY_CLIENTS,
      BackendClientError.LABEL.TOO_MANY_MEMBERS,
      BackendClientError.LABEL.UNKNOWN_CLIENT,
    ];
  }

  /**
   * Construct a new client.
   * @param {Logger} logger - app logger
   */
  constructor(logger) {
    this.logger = logger;

    this.connectivityTimeout = undefined;
    this.connectivityQueue = new PromiseQueue({name: 'BackendClient.Connectivity'});

    this.requestQueue = new PromiseQueue({concurrent: 4, name: 'BackendClient.Request'});
    this.queueState = ko.observable(QUEUE_STATE.READY);
    this.queueTimeout = undefined;

    this.accessToken = '';
    this.accessTokenType = '';

    this.numberOfRequests = ko.observable(0);
    this.numberOfRequests.subscribe(newValue => amplify.publish(WebAppEvents.TELEMETRY.BACKEND_REQUESTS, newValue));

    // Only allow JSON response by default
    $.ajaxSetup({
      contents: {javascript: false},
      dataType: 'json',
    });

    // http://stackoverflow.com/a/18996758/451634
    $.ajaxPrefilter((options, originalOptions, jqXHR) => {
      jqXHR.wireRequest = {
        originalRequestOptions: originalOptions,
        requestDate: new Date(),
        requestId: this.numberOfRequests(),
      };
    });
  }

  /**
   *
   * @param {Object} settings - Settings for different backend environments
   * @param {string} settings.restUrl - Backend REST URL
   * @param {string} settings.webSocketUrl - Backend WebSocket URL
   * @returns {void}
   */
  setSettings(settings) {
    this.restUrl = settings.restUrl;
    this.webSocketUrl = settings.webSocketUrl;
  }

  /**
   * Create a request URL.
   * @param {string} path - API endpoint path to be suffixed to REST API environment
   * @returns {string} REST API endpoint URL
   */
  createUrl(path) {
    isValidApiPath(path);
    return `${this.restUrl}${path}`;
  }

  /**
   * Request backend status.
   * @returns {$.Promise} jQuery AJAX promise
   */
  status() {
    return $.ajax({
      headers: {
        Authorization: `${this.accessTokenType} ${window.decodeURIComponent(this.accessToken)}`,
      },
      timeout: BackendClient.CONFIG.CONNECTIVITY_CHECK.REQUEST_TIMEOUT,
      type: 'GET',
      url: this.createUrl('/self'),
    });
  }

  /**
   * Delay a function call until backend connectivity is guaranteed.
   * @param {BackendClient.CONNECTIVITY_CHECK_TRIGGER} [source=BackendClient.CONNECTIVITY_CHECK_TRIGGER.UNKNOWN] - Trigger that requested connectivity check
   * @returns {Promise} Resolves once the connectivity is verified
   */
  executeOnConnectivity(source = BackendClient.CONNECTIVITY_CHECK_TRIGGER.UNKNOWN) {
    this.logger.info(`Connectivity check requested by '${source}'`);
    const {INITIAL_TIMEOUT, RECHECK_TIMEOUT} = BackendClient.CONFIG.CONNECTIVITY_CHECK;

    const _resetQueue = () => {
      if (this.connectivityTimeout) {
        window.clearTimeout(this.connectivityTimeout);
        this.connectivityQueue.pause(false);
      }
      this.connectivityTimeout = undefined;
    };

    const _checkStatus = () => {
      return this.status()
        .done(jqXHR => {
          this.logger.info('Connectivity verified', jqXHR);
          _resetQueue();
        })
        .fail(jqXHR => {
          if (jqXHR.readyState === 4) {
            this.logger.info(`Connectivity verified by server error '${jqXHR.status}'`, jqXHR);
            _resetQueue();
          } else {
            this.logger.warn('Connectivity could not be verified... retrying');
            this.connectivityQueue.pause();
            this.connectivityTimeout = window.setTimeout(_checkStatus, RECHECK_TIMEOUT);
          }
        });
    };

    this.connectivityQueue.pause();
    const queuedPromise = this.connectivityQueue.push(() => Promise.resolve());
    if (!this.connectivityTimeout) {
      this.connectivityTimeout = window.setTimeout(_checkStatus, INITIAL_TIMEOUT);
    }

    return queuedPromise;
  }

  /**
   * Execute queued requests.
   * @returns {undefined} No return value
   */
  executeRequestQueue() {
    this.queueState(QUEUE_STATE.READY);
    if (this.accessToken && this.requestQueue.getLength()) {
      this.logger.info(`Executing '${this.requestQueue.getLength()}' queued requests`);
      this.requestQueue.resume();
    }
  }

  clearQueueUnblockTimeout() {
    if (this.queueTimeout) {
      window.clearTimeout(this.queueTimeout);
      this.queueTimeout = undefined;
    }
  }

  scheduleQueueUnblock() {
    this.clearQueueUnblockTimeout();
    this.queueTimeout = window.setTimeout(() => {
      const isRefreshingToken = this.queueState() === QUEUE_STATE.ACCESS_TOKEN_REFRESH;
      if (isRefreshingToken) {
        this.logger.log(`Unblocked queue on timeout during '${this.queueState()}'`);
        this.queueState(QUEUE_STATE.READY);
      }
    }, BackendClient.CONFIG.QUEUE_CHECK_TIMEOUT);
  }

  /**
   * Send jQuery AJAX request with compressed JSON body.
   *
   * @note ContentType will be overwritten with 'application/json; charset=utf-8'
   * @see sendRequest for valid parameters
   *
   * @param {Object} config - AJAX request configuration
   * @returns {Promise} Resolves when the request has been executed
   */
  sendJson(config) {
    const jsonConfig = {
      contentType: 'application/json; charset=utf-8',
      data: config.data ? JSON.stringify(config.data) : undefined,
      processData: false,
    };

    return this.sendRequest($.extend(config, jsonConfig, true));
  }

  /**
   * Queue jQuery AJAX request.
   * @param {Object} config - AJAX request configuration
   * @returns {Promise} Resolves when the request has been executed
   */
  sendRequest(config) {
    if (this.queueState() !== QUEUE_STATE.READY) {
      const logMessage = `Adding '${config.type}' request to '${config.url}' to queue due to '${this.queueState()}'`;
      this.logger.info(logMessage, config);
    }

    return this.requestQueue.push(() => this._sendRequest(config));
  }

  _prependRequestQueue(config, resolveFn, rejectFn) {
    this.requestQueue.pause().unshift(() => {
      return this._sendRequest(config)
        .then(resolveFn)
        .catch(rejectFn);
    });
  }

  /**
   * Send jQuery AJAX request.
   *
   * @see http://api.jquery.com/jquery.ajax/#jQuery-ajax-settings
   *
   * @private
   * @param {Object} config - Request configuration
   * @param {string} config.contentType - Request content type
   * @param {boolean} config.crossDomain - Cross domain request
   * @param {Object} config.data - Request data payload
   * @param {Object} config.headers - Request headers
   * @param {boolean} config.processData - Process data before sending
   * @param {number} config.timeout - Request timeout
   * @param {string} config.type - Request type
   * @param {string} config.url - Request URL
   * @param {boolean} config.withCredentials - Request send with credentials
   * @returns {Promise} Resolves when the request has been executed
   */
  _sendRequest(config) {
    const {cache, contentType, crossDomain, data, headers, processData, timeout, type, url, withCredentials} = config;
    const ajaxConfig = {cache, contentType, crossDomain, data, headers, processData, timeout, type};

    if (this.accessToken) {
      const authorizationHeader = `${this.accessTokenType} ${window.decodeURIComponent(this.accessToken)}`;
      ajaxConfig.headers = Object.assign({}, headers, {Authorization: authorizationHeader});
    }

    if (url) {
      ajaxConfig.url = this.createUrl(url);
    }

    if (withCredentials) {
      ajaxConfig.xhrFields = {withCredentials: true};
    }

    this.numberOfRequests(this.numberOfRequests() + 1);

    return new Promise((resolve, reject) => {
      $.ajax(ajaxConfig)
        .done(responseData => resolve(responseData))
        .fail(({responseJSON: response, status: statusCode, wireRequest}) => {
          switch (statusCode) {
            case BackendClientError.STATUS_CODE.CONNECTIVITY_PROBLEM: {
              this.queueState(QUEUE_STATE.CONNECTIVITY_PROBLEM);
              this._prependRequestQueue(config, resolve, reject);

              return this.executeOnConnectivity().then(() => this.executeRequestQueue());
            }

            case BackendClientError.STATUS_CODE.FORBIDDEN: {
              if (response) {
                const errorLabel = response.label;
                const errorMessage = `Server request forbidden: ${errorLabel}`;

                if (BackendClient.IGNORED_BACKEND_LABELS.includes(errorLabel)) {
                  this.logger.warn(errorMessage);
                } else {
                  const requestId = wireRequest ? wireRequest.requestId : undefined;
                  const customData = {
                    endpoint: config.url,
                    method: config.type,
                    requestId,
                  };

                  Raygun.send(new Error(errorMessage), customData);
                }
              }
              break;
            }

            case BackendClientError.STATUS_CODE.ACCEPTED:
            case BackendClientError.STATUS_CODE.CREATED:
            case BackendClientError.STATUS_CODE.NO_CONTENT:
            case BackendClientError.STATUS_CODE.OK: {
              // Prevent empty valid response from being rejected
              if (!response) {
                return resolve({});
              }
              break;
            }

            case BackendClientError.STATUS_CODE.UNAUTHORIZED: {
              if (!config.skipRetry) {
                this._prependRequestQueue(config, resolve, reject);

                const trigger = AuthRepository.ACCESS_TOKEN_TRIGGER.UNAUTHORIZED_REQUEST;
                return amplify.publish(WebAppEvents.CONNECTION.ACCESS_TOKEN.RENEW, trigger);
              }
            }

            default: {
              if (!BackendClient.IGNORED_BACKEND_ERRORS.includes(statusCode)) {
                const requestId = wireRequest ? wireRequest.requestId : undefined;
                const customData = {
                  endpoint: config.url,
                  method: config.type,
                  requestId,
                };

                Raygun.send(new Error(`Server request failed: ${statusCode}`), customData);
              }
            }
          }

          reject(response || new BackendClientError(statusCode));
        });
    });
  }
}
