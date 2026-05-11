/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2022 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { findGroupChildrenByChildId, NavContextMenuPatchCallback } from "@api/ContextMenu";
import { fetchUserProfile, getCurrentChannel } from "@utils/discord";
import definePlugin from "@utils/types";
import { Guild, User } from "@vencord/discord-types";
import { findByPropsLazy } from "@webpack";
import { FluxDispatcher, GuildChannelStore, Menu, NavigationRouter, UserProfileStore } from "@webpack/common";
import { ReactElement } from "react";

const SidebarUtils = findByPropsLazy("openGuildSidebar");

function buildContextMenuItem(user: User, mutualGuildsWithPerms: Guild[]) {
    return <Menu.MenuItem
        id="mutual-mod-view"
        label="See Mod View For"
        onClose={() => FluxDispatcher.dispatch({ type: "CONTEXT_MENU_CLOSE" })}
    >
        {mutualGuildsWithPerms.map(guild => (
            <Menu.MenuItem
                id={`open-mutual-mod-view-in-guild-${guild.id}`}
                key={guild.id}
                label={guild.name}
                action={() => {
                    NavigationRouter.transitionToGuild(guild.id);
                    const currentChannel = getCurrentChannel();

                    if (!currentChannel) return;

                    SidebarUtils.openGuildSidebar(
                        {
                            guildId: guild.id,
                            baseChannelId: currentChannel.id,
                            sidebarType: 4,
                            details: {
                                guildId: guild.id,
                                modViewPanel: 1,
                                moderatorReportId: undefined,
                                sourceLocation: {
                                    object: "Context Menu",
                                },
                                type: "guild-member-mod-view",
                                userId: user.id,
                            }
                        }
                    );
                }}
            />
        ))}
    </Menu.MenuItem>;
}

const patchUserContextMenu: NavContextMenuPatchCallback = (children, { user }: { user: User; }) => {
    const modViewGroup = findGroupChildrenByChildId("mod-view", children);
    const appsGroup = findGroupChildrenByChildId("apps", children) ?? children;

    let targetGroup: Array<ReactElement<any> | null | undefined>;
    let targetIndex: number;

    if (modViewGroup) {
        targetGroup = modViewGroup;
        targetIndex = modViewGroup.findIndex(child => child?.props?.id === "mod-view") + 1;
    } else {
        targetGroup = appsGroup;
        targetIndex = appsGroup.findIndex(child => child?.props?.id === "invite-to-server") + 1;
    }

    const mutualGuilds = UserProfileStore.getMutualGuilds(user.id);

    // we might not know their mutual guilds yet; try to fetch that.
    if (mutualGuilds === undefined) {
        fetchUserProfile(user.id, { with_mutual_guilds: true });
    }

    if (mutualGuilds === undefined || mutualGuilds.length === 0) return; // ok we actually have no mutuals
    const mutualGuildsWithPerms = mutualGuilds
        .map(mutualGuild => mutualGuild.guild)
        // only include guilds we can actually SEE mod view in -- presumably should integrate fine with showHiddenThings?
        .filter(guild => GuildChannelStore.hasElevatedPermissions(guild.id));

    targetGroup.splice(targetIndex, 0, buildContextMenuItem(user, mutualGuildsWithPerms));
};

export default definePlugin({
    name: "MutualModView",
    description: "Open users in Mod View when they're mutually in a server you're a moderator in anywhere.",
    authors: [{
        name: "peeblyweeb",
        id: 904032786854346795n,
    }],
    dependencies: ["ContextMenuAPI"],
    contextMenus: {
        "user-context": patchUserContextMenu
    },
});
