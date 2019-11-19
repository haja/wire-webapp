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

import {Message} from '../entity/message/Message';
import {MentionEntity} from '../message/MentionEntity';

/**
 * Checks if two arrays with mentions contain different values.
 *
 * @param originalMessageEntity - Message entity
 * @param updatedMentions Updated mentions
 * @returns Are the mentions different from each other
 */
export function areMentionsDifferent(originalMessageEntity: Message, updatedMentions: MentionEntity[]): boolean {
  const flattenToUserId = (mentions: MentionEntity[]): string[] => mentions.map(mention => mention.userId).sort();

  const existingMentions = flattenToUserId((originalMessageEntity as any).get_first_asset().mentions());
  const userIds = flattenToUserId(updatedMentions);

  const hasDifferentAmount = existingMentions.length !== userIds.length;
  const hasDifferentUserIDs = existingMentions.some((userId, index) => userId !== userIds[index]);

  return hasDifferentAmount || hasDifferentUserIDs;
}

/**
 * Checks if a given text is different from an already existing text on the message entity.
 *
 * @param originalMessageEntity Message entity
 * @param textMessage Message to compare with
 * @returns Are message and text the same
 */
export function isTextDifferent(originalMessageEntity: Message, textMessage: string): boolean {
  return textMessage !== (originalMessageEntity as any).get_first_asset().text;
}
