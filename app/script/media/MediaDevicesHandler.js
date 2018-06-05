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

'use strict';

window.z = window.z || {};
window.z.media = z.media || {};

z.media.MediaDevicesHandler = class MediaDevicesHandler {
  /**
   * Construct a new MediaDevices handler.
   * @param {z.media.MediaRepository} mediaRepository - Media repository referencing the other handlers
   */
  constructor(mediaRepository) {
    this.mediaRepository = mediaRepository;
    this.logger = new z.util.Logger('z.media.MediaDevicesHandler', z.config.LOGGER.OPTIONS);

    this.available_devices = {
      audio_input: ko.observableArray([]),
      audio_output: ko.observableArray([]),
      screen_input: ko.observableArray([]),
      video_input: ko.observableArray([]),
    };

    this.current_device_id = {
      audio_input: ko.observable(),
      audio_output: ko.observable(),
      screen_input: ko.observable(),
      video_input: ko.observable(),
    };

    this.current_device_index = {
      audio_input: ko.observable(0),
      audio_output: ko.observable(0),
      screen_input: ko.observable(0),
      video_input: ko.observable(0),
    };

    this.has_camera = ko.pureComputed(() => this.available_devices.video_input().length > 0);
    this.has_microphone = ko.pureComputed(() => this.available_devices.audio_input().length > 0);

    this.initialize_media_devices();
  }

  /**
   * Initialize the list of MediaDevices and subscriptions.
   * @returns {undefined} No return value
   */
  initialize_media_devices() {
    if (!z.media.MediaRepository.supportsMediaDevices()) {
      return;
    }

    this.get_media_devices().then(() => {
      this._set_current_devices();
      this._subscribe_to_observables();
      this._subscribe_to_devices();
    });
  }

  /**
   * Set current media device IDs.
   * @returns {undefined} No return value
   */
  _set_current_devices() {
    this.current_device_id.audio_input(z.util.StorageUtil.getValue(z.media.MediaDeviceType.AUDIO_INPUT) || 'default');
    this.current_device_id.audio_output(z.util.StorageUtil.getValue(z.media.MediaDeviceType.AUDIO_OUTPUT) || 'default');
    this.current_device_id.video_input(z.util.StorageUtil.getValue(z.media.MediaDeviceType.VIDEO_INPUT));

    if (!this.current_device_id.video_input() && this.available_devices.video_input().length) {
      const default_device_index = this.available_devices.video_input().length - 1;
      this.current_device_id.video_input(this.available_devices.video_input()[default_device_index].deviceId);
      this.current_device_index.video_input(default_device_index);
    }

    this.logger.info('Set selected MediaDevice IDs');
  }

  /**
   * Subscribe to MediaDevices updates if available.
   * @returns {undefined} No return value
   */
  _subscribe_to_devices() {
    if (navigator.mediaDevices.ondevicechange) {
      navigator.mediaDevices.ondevicechange = () => {
        this.logger.info('List of available MediaDevices has changed');
        this.get_media_devices();
      };
    }
  }

  /**
   * Subscribe to Knockout observables.
   * @returns {undefined} No return value
   */
  _subscribe_to_observables() {
    this.available_devices.audio_input.subscribe(mediaDevices => {
      if (mediaDevices.length) {
        this._update_current_index_from_devices(z.media.MediaDeviceType.AUDIO_INPUT, mediaDevices);
      }
    });

    this.available_devices.audio_output.subscribe(mediaDevices => {
      if (mediaDevices.length) {
        this._update_current_index_from_devices(z.media.MediaDeviceType.AUDIO_OUTPUT, mediaDevices);
      }
    });

    this.available_devices.screen_input.subscribe(mediaDevices => {
      if (mediaDevices.length) {
        this._update_current_index_from_devices(z.media.MediaDeviceType.SCREEN_INPUT, mediaDevices);
      }
    });

    this.available_devices.video_input.subscribe(mediaDevices => {
      if (mediaDevices.length) {
        this._update_current_index_from_devices(z.media.MediaDeviceType.VIDEO_INPUT, mediaDevices);
      }
    });

    this.current_device_id.audio_input.subscribe(media_device_id => {
      z.util.StorageUtil.setValue(z.media.MediaDeviceType.AUDIO_INPUT, media_device_id);
      if (media_device_id && this.mediaRepository.streamHandler.localMediaStream()) {
        this.mediaRepository.streamHandler.replaceInputSource(z.media.MediaType.AUDIO);
        this._update_current_index_from_id(z.media.MediaDeviceType.AUDIO_INPUT, media_device_id);
      }
    });

    this.current_device_id.audio_output.subscribe(media_device_id => {
      z.util.StorageUtil.setValue(z.media.MediaDeviceType.AUDIO_OUTPUT, media_device_id);
      if (media_device_id) {
        this.mediaRepository.elementHandler.switchMediaElementOutput(media_device_id);
        this._update_current_index_from_id(z.media.MediaDeviceType.AUDIO_OUTPUT, media_device_id);
      }
    });

    this.current_device_id.screen_input.subscribe(media_device_id => {
      if (
        media_device_id &&
        this.mediaRepository.streamHandler.localMediaStream() &&
        this.mediaRepository.streamHandler.local_media_type() === z.media.MediaType.SCREEN
      ) {
        this.mediaRepository.streamHandler.replaceInputSource(z.media.MediaType.SCREEN);
        this._update_current_index_from_id(z.media.MediaDeviceType.SCREEN_INPUT, media_device_id);
      }
    });

    this.current_device_id.video_input.subscribe(media_device_id => {
      z.util.StorageUtil.setValue(z.media.MediaDeviceType.VIDEO_INPUT, media_device_id);
      if (
        media_device_id &&
        this.mediaRepository.streamHandler.localMediaStream() &&
        this.mediaRepository.streamHandler.local_media_type() === z.media.MediaType.VIDEO
      ) {
        this.mediaRepository.streamHandler.replaceInputSource(z.media.MediaType.VIDEO);
        this._update_current_index_from_id(z.media.MediaDeviceType.VIDEO_INPUT, media_device_id);
      }
    });
  }

  /**
   * Update list of available MediaDevices.
   * @returns {Promise} Resolves with all MediaDevices when the list has been updated
   */
  get_media_devices() {
    return navigator.mediaDevices
      .enumerateDevices()
      .catch(error => {
        this.logger.error(`Failed to update MediaDevice list: ${error.message}`, error);
        throw error;
      })
      .then(mediaDevices => {
        this._remove_all_devices();

        if (mediaDevices) {
          const audio_input_devices = [];
          const audio_output_devices = [];
          const video_input_devices = [];

          mediaDevices.forEach(media_device => {
            switch (media_device.kind) {
              case z.media.MediaDeviceType.AUDIO_INPUT:
                audio_input_devices.push(media_device);
                break;
              case z.media.MediaDeviceType.AUDIO_OUTPUT:
                audio_output_devices.push(media_device);
                break;
              case z.media.MediaDeviceType.VIDEO_INPUT:
                video_input_devices.push(media_device);
                break;
              default:
                throw new z.media.MediaError(z.media.MediaError.TYPE.UNHANDLED_MEDIA_TYPE);
            }
          });

          z.util.koArrayPushAll(this.available_devices.audio_input, audio_input_devices);
          z.util.koArrayPushAll(this.available_devices.audio_output, audio_output_devices);
          z.util.koArrayPushAll(this.available_devices.video_input, video_input_devices);

          this.logger.info('Updated MediaDevice list', mediaDevices);
          return mediaDevices;
        }
        throw new z.media.MediaError(z.media.MediaError.TYPE.NO_MEDIA_DEVICES_FOUND);
      });
  }

  /**
   * Update list of available Screens.
   * @returns {Promise} resolves with all screen sources when the list has been updated
   */
  get_screen_sources() {
    return new Promise((resolve, reject) => {
      const options = {
        thumbnailSize: {
          height: 176,
          width: 312,
        },
        types: [z.media.MediaConstraintsHandler.CONFIG.SCREEN_CONSTRAINTS.SOURCE_TYPE],
      };

      return window.desktopCapturer.getSources(options, (error, screen_sources) => {
        if (error) {
          return reject(error);
        }

        this.logger.info(
          `Detected '${screen_sources.length}' sources for screen sharing from Electron`,
          screen_sources
        );
        this.available_devices.screen_input(screen_sources);
        if (screen_sources.length === 1) {
          const [first_screen_source] = screen_sources;
          this.current_device_id.screen_input('');
          this.logger.info(`Selected '${first_screen_source.name}' for screen sharing`, first_screen_source);
          this.current_device_id.screen_input(first_screen_source.id);
        }
        return resolve(screen_sources);
      });
    });
  }

  /**
   * Toggle between the available cameras.
   * @returns {Promise} Resolves when camera has been toggled.
   */
  toggle_next_camera() {
    return this.get_media_devices().then(() => {
      const {current_device} = this._get_current_device(
        this.available_devices.video_input(),
        this.current_device_id.video_input()
      );
      const next_device = this.available_devices.video_input()[
        z.util.ArrayUtil.iterateIndex(this.available_devices.video_input(), this.current_device_index.video_input()) ||
          0
      ];

      this.current_device_id.video_input(next_device.deviceId);

      const current_device_name = current_device ? current_device.label || current_device.deviceId : undefined;
      this.logger.info(
        `Switching the active camera from '${current_device_name}' to '${next_device.label || next_device.deviceId}'`
      );
    });
  }

  /**
   * Toggle between the available screens.
   * @returns {Promise} Resolves when screen has been toggled.
   */
  toggle_next_screen() {
    return this.get_screen_sources().then(() => {
      const {current_device} = this._get_current_device(
        this.available_devices.screen_input(),
        this.current_device_id.screen_input()
      );
      const next_device = this.available_devices.screen_input()[
        z.util.ArrayUtil.iterateIndex(
          this.available_devices.screen_input(),
          this.current_device_index.screen_input()
        ) || 0
      ];

      this.current_device_id.screen_input(next_device.id);

      const current_device_name = current_device ? current_device.name || current_device.id : undefined;
      this.logger.info(
        `Switching the active screen from '${current_device_name}' to '${next_device.name || next_device.id}'`
      );
    });
  }

  /**
   * Check for availability of selected devices.
   * @param {boolean} video_send - Also check for video devices
   * @returns {Promise} Resolves when the current device has been updated
   */
  update_current_devices(video_send) {
    return this.get_media_devices().then(() => {
      const _check_device = (mediaType, deviceType) => {
        deviceType = this._type_conversion(deviceType);

        const deviceIdObservable = this.current_device_id[`${deviceType}`];
        const mediaDevices = this.available_devices[`${deviceType}`]();
        const {current_device: mediaDevice} = this._get_current_device(mediaDevices, deviceIdObservable());

        if (!mediaDevice) {
          const [updated_device] = this.available_devices[`${deviceType}`]();

          if (updated_device) {
            const id = updated_device.label || updated_device.deviceId;
            const log = `Selected '${mediaType}' device '${deviceIdObservable()}' not found and replaced by '${id}'`;
            this.logger.warn(log, mediaDevices);
            return deviceIdObservable(updated_device.deviceId);
          }

          const logMessage = `Selected '${mediaType}' device '${deviceIdObservable()}' not found and reset'`;
          this.logger.warn(logMessage, mediaDevices);
          return deviceIdObservable('');
        }
      };

      _check_device(z.media.MediaType.AUDIO, z.media.MediaDeviceType.AUDIO_INPUT);
      if (video_send) {
        _check_device(z.media.MediaType.VIDEO, z.media.MediaDeviceType.VIDEO_INPUT);
      }
    });
  }

  /**
   * Get the currently selected MediaDevice.
   *
   * @param {Array} mediaDevices - Array of MediaDevices
   * @param {string} current_device_id - ID of selected MediaDevice
   * @returns {Object} Selected MediaDevice and its array index
   */
  _get_current_device(mediaDevices, current_device_id) {
    for (const [index, media_device] of mediaDevices.entries()) {
      if (media_device.deviceId === current_device_id || media_device.id === current_device_id) {
        return {current_device: media_device, current_device_index: index};
      }
    }

    return {current_device_index: 0};
  }

  /**
   * Remove all known MediaDevices from the lists.
   * @private
   * @returns {undefined} No return value
   */
  _remove_all_devices() {
    this.available_devices.audio_input.removeAll();
    this.available_devices.audio_output.removeAll();
    this.available_devices.video_input.removeAll();
  }

  /**
   * Add underscore to MediaDevice types.
   * @private
   * @param {z.media.MediaDeviceType} device_type - Device type string to update
   * @returns {string} Updated device type
   */
  _type_conversion(device_type) {
    return device_type.replace('input', '_input').replace('output', '_output');
  }

  /**
   * Update the current index by searching for the current device.
   *
   * @private
   * @param {ko.observable} index_observable - Observable containing the current index
   * @param {Array} available_devices - Array of MediaDevices
   * @param {string} current_device_id - Current device ID to look for
   * @returns {undefined} No return value
   */
  _update_current_device_index(index_observable, available_devices, current_device_id) {
    const {current_device_index} = this._get_current_device(available_devices, current_device_id);

    if (_.isNumber(current_device_index)) {
      index_observable(current_device_index);
    }
  }

  /**
   * Update the index for current device after the list of devices changed.
   * @private
   * @param {z.media.MediaDeviceType} device_type - MediaDeviceType to be updates
   * @param {Array} available_devices - Array of MediaDevices
   * @returns {undefined} No return value
   */
  _update_current_index_from_devices(device_type, available_devices) {
    device_type = this._type_conversion(device_type);
    this._update_current_device_index(
      this.current_device_index[`${device_type}`],
      available_devices,
      this.current_device_id[`${device_type}`]()
    );
  }

  /**
   * Update the index for current device after the current device changed.
   * @private
   * @param {z.media.MediaDeviceType} device_type - MediaDeviceType to be updates
   * @param {string} selected_input_device_id - ID of selected input device
   * @returns {undefined} No return value
   */
  _update_current_index_from_id(device_type, selected_input_device_id) {
    device_type = this._type_conversion(device_type);
    this._update_current_device_index(
      this.current_device_index[`${device_type}`],
      this.available_devices[`${device_type}`](),
      selected_input_device_id
    );
  }
};
