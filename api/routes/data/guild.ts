import { status } from 'elysia';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import type { Route } from '../../exports/routes';
import { mClient, mRebaseClient } from '../../local';

export default {
	path: '/data/fetch/guilds',
	type: 'POST',
	run: async () => {
		if (!mClient) await mRebaseClient();

		const guilds = await mClient?.guilds.fetch();
		const fetched_guilds = guilds?.map(guild => {
			return {
				name: guild.name,
				acronym: guild.nameAcronym,
				icon: guild.iconURL({
					extension: guild.icon?.startsWith('a_') ? 'gif' : 'webp',
					size: 1024
				}),
				owner: guild.owner,
				partnered: guild.partnered,
				verified: guild.partnered,
				id: guild.id
			};
		});

		return status('OK', {
			actions: [
				{
					event: 'guild-fetch',
					message: 'Fetched all guilds',
					state: true
				}
			],
			data: fetched_guilds,
			timestamp: Date.now(),
			reason: ReasonPhrases.OK,
			code: StatusCodes.OK,
			message: 'Authorized into bot.'
		});
	},
} as Route;