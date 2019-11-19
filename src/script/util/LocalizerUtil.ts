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

import {escape} from 'underscore';

import {User} from '../entity/User';
import {getSelfName} from './SanitizationUtil';
import {sortByPriority} from './StringUtil';

type Substitute = Record<string, string> | string | number;

export const DEFAULT_LOCALE = 'en';

let locale = DEFAULT_LOCALE;
let strings: Record<string, Record<string, string>> = {};

const isStringOrNumber = (toTest: any): toTest is string => typeof toTest === 'string' || typeof toTest === 'number';

const replaceSubstituteEscaped = (string: string, regex: RegExp | string, substitute: Substitute) => {
  if (isStringOrNumber(substitute)) {
    return string.replace(regex, escape(substitute.toString()));
  }
  return string.replace(regex, (found: string, content: string) =>
    substitute.hasOwnProperty(content) ? escape((substitute as Record<string, string>)[content]) : found,
  );
};

const replaceSubstitute = (string: string, regex: RegExp | string, substitute: Substitute) => {
  if (isStringOrNumber(substitute)) {
    return substitute;
  }
  return string.replace(regex, (found: string, content: string) =>
    substitute.hasOwnProperty(content) ? (substitute as Record<string, string>)[content] : found,
  );
};

export const LocalizerUtil = {
  joinNames: (userEntities: User[], declension = Declension.ACCUSATIVE, skipAnd = false, boldNames = false) => {
    const containsSelfUser = userEntities.some(userEntity => userEntity.is_me);
    if (containsSelfUser) {
      userEntities = userEntities.filter(userEntity => !userEntity.is_me);
    }

    const firstNames = userEntities
      .map(userEntity => {
        const firstName = userEntity.first_name();
        return boldNames ? `[bold]${firstName}[/bold]` : firstName;
      })
      .sort((userNameA, userNameB) => sortByPriority(userNameA, userNameB));

    if (containsSelfUser) {
      firstNames.push(getSelfName(declension));
    }

    const numberOfNames = firstNames.length;
    const joinByAnd = !skipAnd && numberOfNames >= 2;
    if (joinByAnd) {
      const [secondLastName, lastName] = firstNames.splice(firstNames.length - 2, 2);

      const exactlyTwoNames = numberOfNames === 2;
      const additionalNames = exactlyTwoNames
        ? `${secondLastName} ${t('and')} ${lastName}`
        : `${secondLastName}${t('enumerationAnd')}${lastName}`;
      firstNames.push(additionalNames);
    }

    return firstNames.join(', ');
  },

  translate: (
    identifier: string,
    substitution: Substitute = {},
    dangerousSubstitutions: Record<string, string> = {},
    skipEscape: boolean = false,
  ) => {
    const localeValue = strings[locale] && strings[locale][identifier];
    const defaultValue =
      strings[DEFAULT_LOCALE] && strings[DEFAULT_LOCALE].hasOwnProperty(identifier)
        ? strings[DEFAULT_LOCALE][identifier]
        : identifier;
    const value = localeValue || defaultValue;

    const replaceDangerously = {
      '/bold': '</strong>',
      '/italic': '</i>',
      bold: '<strong>',
      italic: '<i>',
      ...dangerousSubstitutions,
    };

    const substitutedEscaped = skipEscape
      ? replaceSubstitute(value, /{{(.+?)}}/g, substitution)
      : replaceSubstituteEscaped(value, /{{(.+?)}}/g, substitution);
    const substituted = replaceSubstitute(substitutedEscaped, /\[(.+?)\]/g, replaceDangerously);

    return substituted;
  },
};

export const Declension = {
  ACCUSATIVE: 'accusative',
  DATIVE: 'dative',
  NOMINATIVE: 'nominative',
};

export const setLocale = (newLocale: string): void => {
  locale = newLocale;
};

export const setStrings = (newStrings: Record<string, Record<string, string>>): void => {
  strings = newStrings;
};

export function t(
  identifier: string,
  substitution?: Substitute,
  dangerousSubstitutions?: Record<string, string>,
  skipEscape: boolean = false,
): string {
  return LocalizerUtil.translate(identifier, substitution, dangerousSubstitutions, skipEscape);
}

export const joinNames = LocalizerUtil.joinNames;

window.t = LocalizerUtil.translate;
