import { status } from 'elysia';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import type { Route } from '../../exports/routes';
import { mClient, mRebaseClient } from '../../local';

export default {
    path: '/data/fetch/guild/roles',
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

			const gr = await guild.roles.fetch();
            const roles = gr.filter(role => role.hoist === true) // only roles displayed separately
			.map(role => ({
				id: role.id,
				name: role.name,
				color: role.hexColor,
				position: role.position,
				icon: role.iconURL({
					size: 256
				})
			}));

            return status('OK', {
                actions: [
                    {
                        event: 'guild-roles-fetch',
                        message: 'Fetched guild roles',
                        state: true,
                    },
                ],
                data: roles,
                timestamp: Date.now(),
                reason: ReasonPhrases.OK,
                code: StatusCodes.OK,
                message: `Fetched roles for guild ${guild.name}`,
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
