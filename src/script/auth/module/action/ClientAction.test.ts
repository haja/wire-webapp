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

import {actionRoot} from '.';
import {mockStoreFactory} from '../../util/test/mockStoreFactory';
import {CLIENT_ACTION, ClientActionCreator} from '../action/creator/';

describe('ClientAction', () => {
  it(`creates '${CLIENT_ACTION.CLIENTS_FETCH_START}' and '${CLIENT_ACTION.CLIENTS_FETCH_SUCCESS}' when successfully fetching all clients`, async () => {
    const mockedActions = {};
    const mockedApiClient = {
      client: {api: {getClients: () => Promise.resolve([])}},
    };
    const mockedCore = {};

    const store = mockStoreFactory({
      actions: mockedActions,
      apiClient: mockedApiClient,
      core: mockedCore,
    })({});
    await store.dispatch(actionRoot.clientAction.doGetAllClients());
    expect(store.getActions()).toEqual([
      ClientActionCreator.startGetAllClients(),
      ClientActionCreator.successfulGetAllClients([]),
    ]);
  });

  it(`creates '${CLIENT_ACTION.CLIENTS_FETCH_START}' and '${CLIENT_ACTION.CLIENTS_FETCH_FAILED}' when fetching all clients fails`, async () => {
    const backendError = new Error() as any;
    backendError.code = 403;
    backendError.label = 'invalid-credentials';
    backendError.message = 'Authentication failed.';
    const mockedActions = {};
    const mockedApiClient = {
      client: {api: {getClients: () => Promise.reject(backendError)}},
    };
    const mockedCore = {};

    const store = mockStoreFactory({
      actions: mockedActions,
      apiClient: mockedApiClient,
      core: mockedCore,
    })({});
    try {
      await store.dispatch(actionRoot.clientAction.doGetAllClients());
      fail();
    } catch (expectedError) {
      expect(expectedError).toBeDefined();
      expect(expectedError.message).toEqual(backendError.message);
      expect(expectedError.code).toEqual(backendError.code);
      expect(expectedError.label).toEqual(backendError.label);
      expect(store.getActions()).toEqual([
        ClientActionCreator.startGetAllClients(),
        ClientActionCreator.failedGetAllClients(backendError),
      ]);
    }
  });

  it(`creates '${CLIENT_ACTION.CLIENT_REMOVE_START}' and '${CLIENT_ACTION.CLIENT_REMOVE_SUCCESS}' when successfully removing a client`, async () => {
    const clientId = 'clientId';
    const password = 'password';
    const mockedActions = {};
    const mockedApiClient = {
      client: {api: {deleteClient: () => Promise.resolve()}},
    };
    const mockedCore = {};

    const store = mockStoreFactory({
      actions: mockedActions,
      apiClient: mockedApiClient,
      core: mockedCore,
    })({});
    await store.dispatch(actionRoot.clientAction.doRemoveClient(clientId, password));
    expect(store.getActions()).toEqual([
      ClientActionCreator.startRemoveClient(),
      ClientActionCreator.successfulRemoveClient(clientId),
    ]);
  });

  it(`creates '${CLIENT_ACTION.CLIENTS_FETCH_START}' and '${CLIENT_ACTION.CLIENT_REMOVE_FAILED}' when removing a client fails`, async () => {
    const clientId = 'clientId';
    const password = 'password';
    const backendError = new Error() as any;
    backendError.code = 403;
    backendError.label = 'invalid-credentials';
    backendError.message = 'Authentication failed.';
    const mockedActions = {};
    const mockedApiClient = {
      client: {api: {deleteClient: () => Promise.reject(backendError)}},
    };
    const mockedCore = {};

    const store = mockStoreFactory({
      actions: mockedActions,
      apiClient: mockedApiClient,
      core: mockedCore,
    })({});
    try {
      await store.dispatch(actionRoot.clientAction.doRemoveClient(clientId, password));
      fail();
    } catch (expectedError) {
      expect(expectedError).toBeDefined();
      expect(expectedError.message).toEqual(backendError.message);
      expect(expectedError.code).toEqual(backendError.code);
      expect(expectedError.label).toEqual(backendError.label);
      expect(store.getActions()).toEqual([
        ClientActionCreator.startRemoveClient(),
        ClientActionCreator.failedRemoveClient(backendError),
      ]);
    }
  });
});
