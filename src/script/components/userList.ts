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

import ko from 'knockout';

import {ConversationRepository} from '../conversation/ConversationRepository';
import {Conversation} from '../entity/Conversation';
import {User} from '../entity/User';
import {SearchRepository} from '../search/SearchRepository';
import {TeamRepository} from '../team/TeamRepository';
import {validateHandle} from '../user/UserHandleGenerator';

import 'Components/list/participantItem';

export enum UserlistMode {
  COMPACT = 'UserlistMode.COMPACT',
  DEFAULT = 'UserlistMode.DEFAULT',
  OTHERS = 'UserlistMode.OTHERS',
}

interface UserListParams {
  click: (userEntity: User, event: MouseEvent) => void;
  filter: ko.Observable<string>;
  selected: ko.ObservableArray<User>;
  searchRepository: SearchRepository;
  teamRepository: TeamRepository;
  conversationRepository: ConversationRepository;
  user: ko.Observable<User[]>;
  infos: Record<string, string>;
  highlightedUsers: () => User[];
  noUnderline: boolean;
  arrow: boolean;
  mode: UserlistMode;
  conversation: ko.Observable<Conversation>;
  truncate: boolean;
  maxVisibleUsers: number;
  reducedUserCount: number;
  showEmptyAdmin: boolean;
  selfFirst: boolean;
  noSelfInteraction: boolean;
}

const listTemplate = (dataObservable: string, uieName: string = ''): string => `
  <div class="search-list" data-bind="css: cssClasses(), foreach: {data: ${dataObservable}(), as: 'user', noChildContext: true }" data-uie-name="${uieName}>
    <!-- ko if: noSelfInteraction && user.is_me -->
      <participant-item
        params="participant: user, customInfo: infos && infos()[user.id], canSelect: isSelectEnabled, isSelected: isSelected(user), mode: mode, external: teamRepository.isExternal(user.id), selfInTeam: selfInTeam"
        data-bind="css: {'no-underline': noUnderline, 'highlighted': highlightedUserIds.includes(user.id), 'no-interaction': true}">
      </participant-item>
    <!-- /ko -->
    <!-- ko ifnot: noSelfInteraction && user.is_me -->
      <participant-item
        params="participant: user, customInfo: infos && infos()[user.id], canSelect: isSelectEnabled, isSelected: isSelected(user), mode: mode, external: teamRepository.isExternal(user.id), selfInTeam: selfInTeam"
        data-bind="click: (viewmodel, event) => onUserClick(user, event), css: {'no-underline': noUnderline, 'show-arrow': arrow, 'highlighted': highlightedUserIds.includes(user.id)}">
      </participant-item>
    <!-- /ko -->
  </div>
`;

ko.components.register('user-list', {
  template: `
    <!-- ko if: showRoles() -->
      <!-- ko if: adminUsers().length > 0 || showEmptyAdmin -->
        <div class="user-list__header" data-bind="text: t('searchListAdmins')" data-uie-name="label-conversation-admins"></div>
        <!-- ko if: adminUsers().length > 0 -->
          ${listTemplate('adminUsers', 'list-admins')}
        <!-- /ko -->
        <!-- ko ifnot: adminUsers().length > 0 -->
          <div class="user-list__no-admin" data-bind="text: t('searchListNoAdmins')" data-uie-name="status-no-admins"></div>
        <!-- /ko -->
      <!-- /ko -->
      <!-- ko if: memberUsers().length > 0 -->
        <div class="user-list__header" data-bind="text: t('searchListMembers')" data-uie-name="label-conversation-members"></div>
        ${listTemplate('memberUsers', 'list-members')}
      <!-- /ko -->
    <!-- /ko -->
    <!-- ko ifnot: showRoles() -->
    ${listTemplate('filteredUserEntities')}
    <!-- /ko -->

    <!-- ko if: typeof filter === 'function' -->
      <!-- ko if: userEntities().length === 0 -->
        <div class="user-list__no-results" data-bind="text: t('searchListEveryoneParticipates')"></div>
      <!-- /ko -->

      <!-- ko if: userEntities().length > 0 && filteredUserEntities().length === 0 -->
        <div class="usert-list__no-results" data-bind="text: t('searchListNoMatches')" data-uie-name="status-no-matches"></div>
      <!-- /ko -->
    <!-- /ko -->
  `,
  viewModel: function({
    click,
    filter = ko.observable(''),
    selected: selectedUsers,
    searchRepository,
    teamRepository,
    conversationRepository,
    user: userEntities,
    infos,
    highlightedUsers = () => [],
    noUnderline = false,
    arrow = false,
    mode = UserlistMode.DEFAULT,
    conversation,
    truncate = false,
    maxVisibleUsers = 7,
    reducedUserCount = 5,
    showEmptyAdmin = false,
    selfFirst = true,
    noSelfInteraction = false,
  }: UserListParams): void {
    this.filter = filter;
    this.mode = mode;
    this.teamRepository = teamRepository;
    this.userEntities = userEntities;
    this.infos = infos;
    this.highlightedUserIds = highlightedUsers().map(user => user.id);
    this.isSelectEnabled = typeof selectedUsers === 'function';
    this.noUnderline = noUnderline;
    this.arrow = arrow;
    this.selfInTeam = teamRepository.selfUser().inTeam();
    this.showRoles = ko.pureComputed(() => !!conversation);
    this.showEmptyAdmin = showEmptyAdmin;
    this.noSelfInteraction = noSelfInteraction;

    const isCompactMode = mode === UserlistMode.COMPACT;

    this.cssClasses = ko.pureComputed(() => (isCompactMode ? 'search-list-sm' : 'search-list-lg'));

    this.onUserClick = (userEntity: User, event: MouseEvent) => {
      if (this.isSelectEnabled) {
        if (this.isSelected(userEntity)) {
          selectedUsers.remove(userEntity);
        } else {
          selectedUsers.push(userEntity);
        }
      }
      if (typeof click === 'function') {
        click(userEntity, event);
      }
    };

    // Filter all list items if a filter is provided
    this.filteredUserEntities = ko.pureComputed(() => {
      const connectedUsers = conversationRepository.connectedUsers();
      let resultUsers: User[] = userEntities();
      const normalizedQuery = SearchRepository.normalizeQuery(filter());
      if (normalizedQuery) {
        const SEARCHABLE_FIELDS = SearchRepository.CONFIG.SEARCHABLE_FIELDS;
        const trimmedQuery = filter().trim();
        const isHandle = trimmedQuery.startsWith('@') && validateHandle(normalizedQuery);
        const properties = isHandle ? [SEARCHABLE_FIELDS.USERNAME] : undefined;
        const searchResults = searchRepository.searchUserInSet(normalizedQuery, userEntities(), properties);
        resultUsers = searchResults.filter(
          user =>
            connectedUsers.includes(user) ||
            teamRepository.isSelfConnectedTo(user.id) ||
            user.username() === normalizedQuery,
        );
      } else {
        resultUsers = userEntities().filter(
          user => connectedUsers.includes(user) || teamRepository.isSelfConnectedTo(user.id),
        );
      }

      if (!selfFirst) {
        return resultUsers;
      }

      // make sure the self user is the first one in the list
      const selfUser = resultUsers.filter(user => user.is_me);
      const otherUsers = resultUsers.filter(user => !user.is_me);
      return selfUser.concat(otherUsers);
    });

    this.isSelected = (userEntity: User) => {
      if (this.isSelectEnabled) {
        return selectedUsers().includes(userEntity);
      }
      return false;
    };

    this.memberUsers = ko.observable<User[]>([]);
    this.adminUsers = ko.observable<User[]>([]);
    this.users = ko.observable<User[]>([]);

    const filteredUsersSubscription = ko.computed(() => {
      const users = this.filteredUserEntities();
      if (conversation && conversation()) {
        const members: User[] = [];
        const admins: User[] = [];
        users.forEach((userEntity: User) => {
          if (userEntity.isService) {
            return;
          }
          if (conversation().creator === userEntity.id) {
            admins.push(userEntity);
          } else {
            members.push(userEntity);
          }
        });

        if (truncate && admins.length + members.length > maxVisibleUsers) {
          this.adminUsers(admins.slice(0, reducedUserCount));
          this.memberUsers(members.slice(0, reducedUserCount - admins.length));
        } else {
          this.adminUsers(admins);
          this.memberUsers(members);
        }
      } else if (truncate && users.length > maxVisibleUsers) {
        this.users(users.slice(0, reducedUserCount));
      } else {
        this.users(users);
      }
    });

    this.dispose = () => {
      filteredUsersSubscription.dispose();
    };
  },
});
