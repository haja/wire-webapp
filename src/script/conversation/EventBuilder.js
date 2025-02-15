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

import {createRandomUuid} from 'Util/util';

import {ClientEvent} from '../event/Client';
import {BackendEvent} from '../event/Backend';

import {VerificationMessageType} from '../message/VerificationMessageType';
import {StatusType} from '../message/StatusType';

window.z = window.z || {};
window.z.conversation = z.conversation || {};

z.conversation.EventBuilder = {
  build1to1Creation(conversationEntity, timestamp) {
    const {creator: creatorId, id} = conversationEntity;
    const isoDate = new Date(timestamp || 0).toISOString();

    return {
      conversation: id,
      data: {
        userIds: conversationEntity.participating_user_ids(),
      },
      from: creatorId,
      id: createRandomUuid(),
      time: isoDate,
      type: ClientEvent.CONVERSATION.ONE2ONE_CREATION,
    };
  },
  buildAllVerified(conversationEntity, currentTimestamp) {
    return {
      conversation: conversationEntity.id,
      data: {
        type: VerificationMessageType.VERIFIED,
      },
      from: conversationEntity.selfUser().id,
      id: createRandomUuid(),
      time: conversationEntity.get_next_iso_date(currentTimestamp),
      type: ClientEvent.CONVERSATION.VERIFICATION,
    };
  },
  buildAssetAdd(conversationEntity, data, currentTimestamp) {
    return {
      conversation: conversationEntity.id,
      data: data,
      from: conversationEntity.selfUser().id,
      status: StatusType.SENDING,
      time: conversationEntity.get_next_iso_date(currentTimestamp),
      type: ClientEvent.CONVERSATION.ASSET_ADD,
    };
  },
  buildCalling(conversationEntity, callMessage, userId, clientId) {
    return {
      content: callMessage,
      conversation: conversationEntity.id,
      from: userId,
      sender: clientId,
      type: ClientEvent.CALL.E_CALL,
    };
  },
  buildDegraded(conversationEntity, userIds, type, currentTimestamp) {
    return {
      conversation: conversationEntity.id,
      data: {
        type: type,
        userIds: userIds,
      },
      from: conversationEntity.selfUser().id,
      id: createRandomUuid(),
      time: conversationEntity.get_next_iso_date(currentTimestamp),
      type: ClientEvent.CONVERSATION.VERIFICATION,
    };
  },
  buildDelete(conversationId, messageId, time, deletedMessageEntity) {
    return {
      conversation: conversationId,
      data: {
        deleted_time: time,
      },
      from: deletedMessageEntity.from,
      id: messageId,
      time: new Date(deletedMessageEntity.timestamp()).toISOString(),
      type: ClientEvent.CONVERSATION.DELETE_EVERYWHERE,
    };
  },
  buildGroupCreation(conversationEntity, isTemporaryGuest = false, timestamp) {
    const {creator: creatorId, id} = conversationEntity;
    const selfUserId = conversationEntity.selfUser().id;
    const isoDate = new Date(timestamp || 0).toISOString();

    const userIds = conversationEntity.participating_user_ids().slice();
    const createdBySelf = creatorId === selfUserId || isTemporaryGuest;
    if (!createdBySelf) {
      userIds.push(selfUserId);
    }

    return {
      conversation: id,
      data: {
        allTeamMembers: conversationEntity.withAllTeamMembers(),
        name: conversationEntity.name(),
        userIds: userIds,
      },
      from: isTemporaryGuest ? selfUserId : creatorId,
      id: createRandomUuid(),
      time: isoDate,
      type: ClientEvent.CONVERSATION.GROUP_CREATION,
    };
  },
  buildIncomingMessageTooBig(event, messageError, errorCode) {
    const {conversation: conversationId, data: eventData, from, time} = event;

    return {
      conversation: conversationId,
      error: `${messageError.message} (${eventData.sender})`,
      error_code: `${errorCode} (${eventData.sender})`,
      from: from,
      id: createRandomUuid(),
      time: time,
      type: ClientEvent.CONVERSATION.INCOMING_MESSAGE_TOO_BIG,
    };
  },
  buildLegalHoldMessage(conversationId, userId, timestamp, legalHoldStatus, beforeMessage) {
    return {
      conversation: conversationId,
      data: {
        legal_hold_status: legalHoldStatus,
      },
      from: userId,
      id: createRandomUuid(),
      time: new Date(new Date(timestamp).getTime() + (beforeMessage ? -1 : 1)).toISOString(),
      type: ClientEvent.CONVERSATION.LEGAL_HOLD_UPDATE,
    };
  },
  buildMemberJoin(conversationEntity, sender, joiningUserIds, timestamp) {
    timestamp = timestamp ? timestamp : conversationEntity.get_last_known_timestamp() + 1;
    const isoDate = new Date(timestamp).toISOString();

    return {
      conversation: conversationEntity.id,
      data: {
        user_ids: joiningUserIds,
      },
      from: sender,
      time: isoDate,
      type: BackendEvent.CONVERSATION.MEMBER_JOIN,
    };
  },
  buildMemberLeave(conversationEntity, userId, removedBySelfUser, currentTimestamp) {
    return {
      conversation: conversationEntity.id,
      data: {
        user_ids: [userId],
      },
      from: removedBySelfUser ? conversationEntity.selfUser().id : userId,
      time: conversationEntity.get_next_iso_date(currentTimestamp),
      type: BackendEvent.CONVERSATION.MEMBER_LEAVE,
    };
  },
  buildMessageAdd(conversationEntity, currentTimestamp) {
    return {
      conversation: conversationEntity.id,
      data: {},
      from: conversationEntity.selfUser().id,
      status: StatusType.SENDING,
      time: conversationEntity.get_next_iso_date(currentTimestamp),
      type: ClientEvent.CONVERSATION.MESSAGE_ADD,
    };
  },
  buildMissed(conversationEntity, currentTimestamp) {
    return {
      conversation: conversationEntity.id,
      from: conversationEntity.selfUser().id,
      id: createRandomUuid(),
      time: conversationEntity.get_next_iso_date(currentTimestamp),
      type: ClientEvent.CONVERSATION.MISSED_MESSAGES,
    };
  },
  buildTeamMemberLeave(conversationEntity, userEntity, isoDate) {
    return {
      conversation: conversationEntity.id,
      data: {
        name: userEntity.name(),
        user_ids: [userEntity.id],
      },
      from: userEntity.id,
      id: createRandomUuid(),
      time: isoDate,
      type: ClientEvent.CONVERSATION.TEAM_MEMBER_LEAVE,
    };
  },
  buildUnableToDecrypt(event, decryptionError, errorCode) {
    const {conversation: conversationId, data: eventData, from, time} = event;

    return {
      conversation: conversationId,
      error: `${decryptionError.message} (${eventData.sender})`,
      error_code: `${errorCode} (${eventData.sender})`,
      from: from,
      id: createRandomUuid(),
      time: time,
      type: ClientEvent.CONVERSATION.UNABLE_TO_DECRYPT,
    };
  },
  buildVoiceChannelActivate(conversationId, userId, time, protocolVersion) {
    return {
      conversation: conversationId,
      from: userId,
      id: createRandomUuid(),
      protocol_version: protocolVersion,
      time: time,
      type: ClientEvent.CONVERSATION.VOICE_CHANNEL_ACTIVATE,
    };
  },
  buildVoiceChannelDeactivate(conversationId, userId, duration, reason, time, protocolVersion) {
    return {
      conversation: conversationId,
      data: {
        duration,
        reason: reason,
      },
      from: userId,
      id: createRandomUuid(),
      protocol_version: protocolVersion,
      time: time,
      type: ClientEvent.CONVERSATION.VOICE_CHANNEL_DEACTIVATE,
    };
  },
};

export const EventBuilder = z.conversation.EventBuilder;
