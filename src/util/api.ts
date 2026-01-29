const API_URI: string = import.meta.env.VITE_API_URI;

import axios, { type AxiosRequestConfig } from 'axios';

type RequestType = 'get' | 'post' | 'put' | 'delete';

export interface GuildChannel {
	id: string;
	name: string;
	type: number;
	parent: string | null;
	position: number;
	channels: GuildChannel[];
};

export interface GuildFullInfo {
    id: string;
    name: string;
    acronym: string;
    description: string | null;
    icon: string | null;
    banner: string | null;
    owner_id: string;
    partnered: boolean;
    verified: boolean;
    member_count: number;
    presences: {
        online: number;
        idle: number;
        dnd: number;
        offline: number;
    };
    channels: GuildChannel[];
    roles: {
        id: string;
        name: string;
        color: string;
        position: number;
    }[];
	emojis: {
		id: string;
		name: string;
		animated: boolean;
		url: string;
	}[];
};

export type Guild = {
	name: string
	acronym: string
	icon: string
	owner: string
	partnered: boolean
	verified: boolean
	id: string
};

export type UserDirect = {
	direct_id: string
	user_id: string
	displayname: string
	status: string
	pfp: string
};
export async function AxiosCall(
    route: string,
    request_type: RequestType,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data?: Record<string, any>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<{ status: number; data: any }> {
    const max_retries = 5;

    for (let attempt = 1; attempt <= max_retries; attempt++) {
        try {
            const config: AxiosRequestConfig = {
                method: request_type,
                url: API_URI + route,
            };

            if (request_type === 'get' && data) {
                config.params = data;
            } else if (data) {
                config.data = data;
            }

            const response = await axios(config);

            return {
                status: response.status,
                data: response.data,
            };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
            const isLastAttempt = attempt === max_retries;

            if (isLastAttempt) {
                return {
                    status: err.response?.status || 500,
                    data: err.response?.data || err.message || 'Unknown error',
                };
            }

            const delay = attempt * 3000;
            await new Promise(res => setTimeout(res, delay));
        }
    }

    // shouldn't reach here, but typescript happy ending
    return {
        status: 500,
        data: 'Unexpected failure',
    };
}

export interface ReactionUser {
    id: string;
    displayname: string;
}

export interface ReactionEmoji {
    id: string | null;
    name: string;
    animated: boolean;
}

export interface MessageReaction {
    users: ReactionUser[];
    emoji: ReactionEmoji;
    amount: number;
}

export interface ReactionUpdatePayload {
    payload: 'reaction_update';
    message_id: string;
    channel_id: string;
    reactions: MessageReaction[];
}

export interface ReactionClearPayload {
    payload: 'reaction_clear';
    message_id: string;
    channel_id: string;
}

export interface EmbedField {
    name: string;
    value: string;
    inline: boolean;
}

export interface EmbedAssetData {
	/**
	 * Source url of image (only supports http(s) and attachments)
	 */
	url: string;
	/**
	 * A proxied url of the image
	 */
	proxy_url?: string;
	/**
	 * Height of image
	 */
	height?: number;
	/**
	 * Width of image
	 */
	width?: number;
}

export interface EmbedInfo {
    title: string;
    description: string;
	image?: EmbedAssetData;
	video?: EmbedAssetData;
	url?: string;
    fields: EmbedField[];
    footer: string;
    timestamp: string | null;
    color: number | null;
}

export interface MessageInfo {
    message_id: string;
    content: string;
    timestamp: Date;
    author_id: string;
    author_displayname: string;
    author_pfp: string;
    bot: boolean;
    attachments: AttachmentInfo[];
    replied_to: RepliedMessageInfo | null;
    reactions?: MessageReaction[];
    hasEmbed: boolean;
	edited?: {
		at: Date;
		state: boolean
	}
    embeds: EmbedInfo[];
}

export interface UserPresence {
	user: {
		id: string;
		display_name: string;
		username: string;
		icon: string;
		status: string;
		statusText: string;
	};
	role_ids: string[];
	accessible_channels: {
		id: string;
		name: string;
		type: number;
	}[];
}

export interface MessageUpdateInfo {
    message_id: string;
    new_content: string | null;
    edited_at: Date | null;
    hasEmbed: boolean;
    embeds: EmbedInfo[];
}

export interface MessageDeleteInfo {
    message_id: string;
    deleted_at: Date;
}

export interface AttachmentInfo {
    id: string;
    name: string;
    url: string;
    contentType: string | null;
    size: number;
}

export interface RepliedMessageInfo {
    message_id: string;
    author_id: string;
    displayname: string;
    content: string;
    pfp: string;
}

export interface RoleInfo {
	id: string;
	name: string;
	color: string;
	position: number;
	icon: string;
};

interface MainScheme {
	timestamp: number
	message: string
	reason: string
	code: number
	actions: {
		event: string
		message: string | object,
		state?: boolean | object
	}[]
}

const API = {
    User: {
        Authenticate: async (token: string) => {
            const request = await AxiosCall(
                '/authorize/bot', 'post',
                { token }
            );

            return request as {
                status: number,
                data: MainScheme & { id: string }
            };
        },

        Guilds: async () => {
            const request = await AxiosCall(
                '/data/fetch/guilds', 'post', {}
            );

            return request as {
                status: number,
                data: MainScheme & { data: Guild[] } | MainScheme
            };
        },

        Directs: async () => {
            const request = await AxiosCall(
                '/data/fetch/directs', 'post', {}
            );

            return request as {
                status: number,
                data: MainScheme & { data: UserDirect[] } | MainScheme
            };
        },

        Guild: async (guild_id: string) => {
            const request = await AxiosCall(
                '/data/fetch/guild/full', 'post',
                { guild_id }
            );

            return request as {
                status: number,
                data: MainScheme & { data: GuildFullInfo[] } | MainScheme
            };
        },

        GuildChannel: async (channel_id: string) => {
            const request = await AxiosCall(
                '/data/fetch/messages', 'post',
                { channel_id }
            );

            return request as {
                status: number,
                data: MainScheme & { data: MessageInfo[] } | MainScheme
            };
        },

        SendMessage: async (guild_id: string, channel_id: string, message_content: string) => {
            const request = await AxiosCall(
                '/data/send/message', 'post',
                { guild_id, channel_id, message_content }
            );

            return request as {
                status: number,
                data: MainScheme
            };
        },

        SendMessageWithReply: async (
            guild_id: string,
            channel_id: string,
            message_content: string,
            replying_to_id: string
        ) => {
            const request = await AxiosCall(
                '/data/send/message/reply', 'post',
                { guild_id, channel_id, message_content, replying_to_id }
            );

            return request as {
                status: number,
                data: MainScheme
            };
        },

        GuildRoles: async (guild_id: string) => {
            const request = await AxiosCall(
                '/data/fetch/guild/roles', 'post',
                { guild_id }
            );

            return request as {
                status: number,
                data: MainScheme & {
                    data: RoleInfo[]
                }
            };
        },

        GuildUsers: async (guild_id: string) => {
            const request = await AxiosCall(
                '/data/fetch/guild/users', 'post',
                { guild_id }
            );

            return request as {
                status: number,
                data: MainScheme & {
                    data: {
                        user_id: string;
                        role_ids: string[];
                    }[]
                }
            };
        }
    }
};

export {
	API
};

