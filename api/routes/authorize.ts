import { status } from 'elysia';
import type { Route } from '../exports/routes';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import { Client } from 'discord.js';
import { mSetClient, mSetToken } from '../local';

export default {
	path: '/authorize/bot',
	type: 'POST',
	run: async ({
		body: {
			token
		}
	}: {
		body: {
			token?: string
		}
	}) => {
		if (!token) return status('Bad Request', {
			actions: [
				{
					event: 'auth-test-stable',
					message: 'Unaccessable data from the request\'s body.',
				}
			],
			timestamp: Date.now(),
			reason: ReasonPhrases.BAD_REQUEST,
			code: StatusCodes.BAD_REQUEST,
			message: 'Please fill all of the required data into the request before sending.'
		});

		const lTempClient = new Client({
			intents: [
				'Guilds',
				'GuildMembers',
				'GuildMessages',
				'GuildMessageReactions',
				'GuildEmojisAndStickers',
				'GuildVoiceStates',
				'GuildPresences',
				'GuildInvites',
				'GuildModeration',
				'MessageContent',
				'DirectMessages',
				'DirectMessageTyping',
				'GuildMessageTyping'
			]
		});

		return lTempClient.login(token).then(() => {
			mSetClient(lTempClient);
			mSetToken(token);
			return status('OK', {
				actions: [
					{
						event: 'auth-test-stable',
						message: 'Authorized using lTempClient.test',
						state: true
					}
				],
				data: {
					id: String(lTempClient.user?.id),
				},
				timestamp: Date.now(),
				reason: ReasonPhrases.OK,
				code: StatusCodes.OK,
				message: 'Authorized into bot.'
			});
		}).catch(err => {
			return status('Internal Server Error', {
				actions: [
					{
						event: 'auth-test-stable',
						message: 'lTempClient failed to login into authorization token.',
						state: false
					}
				],
				timestamp: Date.now(),
				reason: ReasonPhrases.INTERNAL_SERVER_ERROR,
				code: StatusCodes.INTERNAL_SERVER_ERROR,
				message: err
			});
		});
	},
} as Route;