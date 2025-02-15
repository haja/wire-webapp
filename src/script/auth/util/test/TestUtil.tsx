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

import {RecursivePartial} from '@wireapp/commons/dist/commonjs/util/TypeUtil';
import {StyledApp} from '@wireapp/react-ui-kit';
import {mount} from 'enzyme';
import React from 'react';
import {IntlProvider} from 'react-intl';
import {Provider} from 'react-redux';
import {HashRouter} from 'react-router-dom';
import {AnyAction} from 'redux';
import {MockStoreEnhanced} from 'redux-mock-store';
import {ThunkDispatch} from 'redux-thunk';
import {Api, RootState} from '../../module/reducer';

export const withStore = (
  children: React.ReactNode,
  store: MockStoreEnhanced<RecursivePartial<RootState>, ThunkDispatch<RootState, Api, AnyAction>>,
) => <Provider store={store}>{children}</Provider>;

export const withIntl = (component: React.ReactNode) => (
  <IntlProvider locale="en">
    <HashRouter hashType="noslash">{component}</HashRouter>
  </IntlProvider>
);

export const withTheme = (component: React.ReactNode) => <StyledApp>{component}</StyledApp>;

export const mountComponent = (
  component: React.ReactNode,
  store: MockStoreEnhanced<RecursivePartial<RootState>, ThunkDispatch<RootState, Api, AnyAction>>,
) => mount(withTheme(withStore(withIntl(component), store)));
