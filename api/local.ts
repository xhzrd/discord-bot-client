import { Client } from "discord.js";

export let mClient: Client | null = null;
export let mToken: string | undefined | null = import.meta.env.DISCORD_TOKEN;
export const mSetClient = async (client: Client | null) => {
	mClient = client;
}
export const mSetToken = async (token: string | null) => {
	mToken = token;
	mClient = new Client({
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

	if (token)
		mClient.login(token);
}

export const mRebaseClient = async () => {
	mClient = new Client({
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

	if (mToken)
		mClient.login(mToken);
}