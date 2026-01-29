 
import { status } from 'elysia';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import type { Route } from '../../exports/routes';
import { mClient, mRebaseClient } from '../../local';

export default {
    path: '/data/fetch/guild/users',
    type: 'POST',
    run: async ({
        body: { guild_id }
    }: {
        body: {
            guild_id?: string
        }
    }) => {
        if (!mClient) await mRebaseClient();

        if (!guild_id) {
            return status('Bad Request', {
                message: 'Missing guild_id in body.',
                code: StatusCodes.BAD_REQUEST,
            });
        }

        try {
            const guild = await mClient?.guilds.fetch(guild_id);
            if (!guild) throw new Error('Guild not found');

            await guild.members.fetch(); // pull all members

            const users = guild.members.cache.map(member => ({
                user_id: member.id,
                role_ids: member.roles.cache.map(role => role.id),
            }));

            return status('OK', {
                actions: [
                    {
                        event: 'guild-users-fetch',
                        message: 'Fetched simplified user list',
                        state: true,
                    },
                ],
                data: users,
                timestamp: Date.now(),
                reason: ReasonPhrases.OK,
                code: StatusCodes.OK,
                message: `Fetched role data for ${users.length} users in ${guild.name}`,
            });

        } catch {
            return status('Not Found', {
                message: 'Guild not found or inaccessible.',
                code: StatusCodes.NOT_FOUND,
                reason: ReasonPhrases.NOT_FOUND,
                timestamp: Date.now(),
            });
        }
    },
} as Route;
