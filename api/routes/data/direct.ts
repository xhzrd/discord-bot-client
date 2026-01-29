/* eslint-disable @typescript-eslint/no-unused-vars */
import { status } from 'elysia';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import type { Route } from '../../exports/routes';
import { mClient, mRebaseClient } from '../../local';

export default {
    path: '/data/fetch/directs',
    type: 'POST',
    run: async () => {
        if (!mClient) await mRebaseClient();

        const directs = [];

        // fetch all users from mutual guilds
        const user_ids = new Set<string>();
        for (const [, guild] of (mClient?.guilds.cache || [])) {
            const members = await guild.members.fetch(); // fetch all members
            for (const [, member] of members) {
                if (!member.user.bot) {
                    user_ids.add(member.user.id);
                }
            }
        }

        // loop through each known user
        for (const user_id of user_ids) {
            try {
                const user = await mClient?.users.fetch(user_id);
                const dm = await user?.createDM();

                let status = 'offline';

                // check presence
                for (const [, guild] of (mClient?.guilds.cache || [])) {
                    try {
                        const member = await guild.members.fetch(user?.id || '');
                        if (member?.presence) {
                            status = member.presence.status;
                            break;
                        }
                    } catch (_) {
                        // skip
                    }
                }

                directs.push({
                    direct_id: dm?.id,
                    user_id: user?.id,
                    displayname: user?.username,
                    status,
                    pfp: user?.displayAvatarURL({
                        extension: user?.avatar?.startsWith('a_') ? 'gif' : 'webp',
                        size: 1024,
                    }),
                });

            } catch (err) {
                // user can't be DMed or doesn't exist
                continue;
            }
        }

        return status('OK', {
            actions: [
                {
                    event: 'direct-fetch',
                    message: 'Fetched all DMs',
                    state: true,
                },
            ],
            data: directs,
            timestamp: Date.now(),
            reason: ReasonPhrases.OK,
            code: StatusCodes.OK,
            message: 'Fetched DM conversations successfully.',
        });
    },
} as Route;
