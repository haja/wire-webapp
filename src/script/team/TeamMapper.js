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

import {getLogger} from 'Util/Logger';

import {roleFromTeamPermissions} from './../user/UserPermission';
import {TeamEntity} from './TeamEntity';
import {TeamMemberEntity} from './TeamMemberEntity';

export class TeamMapper {
  constructor() {
    this.logger = getLogger('TeamMapper');
  }

  mapTeamFromObject(data) {
    return this.updateTeamFromObject(data);
  }

  updateTeamFromObject(teamData, teamEntity = new TeamEntity()) {
    if (teamData) {
      const {creator, icon, icon_key: iconKey, id, name} = teamData;

      if (creator) {
        teamEntity.creator = creator;
      }

      if (icon) {
        teamEntity.icon = icon;
      }

      if (iconKey) {
        teamEntity.iconKey = iconKey;
      }

      if (id) {
        teamEntity.id = id;
      }

      if (name) {
        teamEntity.name(name);
      }

      return teamEntity;
    }
  }

  mapMemberFromArray(membersData) {
    return membersData.map(data => this.updateMemberFromObject(data));
  }

  mapMemberFromObject(data) {
    return this.updateMemberFromObject(data);
  }

  mapRole(userEntity, permissions) {
    if (permissions) {
      const teamRole = roleFromTeamPermissions(permissions);
      this.logger.info(`Identified user '${userEntity.id}' as '${teamRole}'`, permissions);
      userEntity.teamRole(teamRole);
    }
  }

  updateMemberFromObject(memberData, memberEntity = new TeamMemberEntity()) {
    if (memberData) {
      const {created_by, permissions, user, legalhold_status} = memberData;
      if (created_by) {
        memberEntity.invitedBy = created_by;
      }
      if (permissions) {
        memberEntity.permissions = permissions;
      }
      if (legalhold_status) {
        memberEntity.legalholdStatus = legalhold_status;
      }
      if (user) {
        memberEntity.userId = user;
      }

      return memberEntity;
    }
  }
}
