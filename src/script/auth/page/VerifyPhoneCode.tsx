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

import {CodeInput, ContainerXS, ErrorMessage, H1, Link} from '@wireapp/react-ui-kit';
import React, {useState} from 'react';

import {parseError} from '../util/errorUtil';

import Page from './Page';

const VerifyPhone = () => {
  //const {formatMessage: _} = useIntl();
  const [error /*, setError*/] = useState();

  const verifyCode = () => {};
  const resendCode = () => {};
  return (
    <Page hasAccountData>
      <ContainerXS
        centerText
        verticalCenter
        style={{display: 'flex', flexDirection: 'column', height: 428, justifyContent: 'space-between'}}
      >
        <div>
          <H1 center>{'headline'}</H1>
          <CodeInput autoFocus style={{marginTop: 10}} onCodeComplete={verifyCode} data-uie-name="enter-code" />
          <ErrorMessage data-uie-name="error-message">{parseError(error)}</ErrorMessage>
        </div>
        <div>
          <Link onClick={resendCode} data-uie-name="do-resend-code">
            {'resend'}
          </Link>
          {/*
          <RouterLink to={changeEmailRedirect[currentFlow]} style={{marginLeft: 35}} data-uie-name="go-change-email">
            {_(verifyStrings.changeEmail)}
          </RouterLink>
          */}
        </div>
      </ContainerXS>
    </Page>
  );
};

export default VerifyPhone;
