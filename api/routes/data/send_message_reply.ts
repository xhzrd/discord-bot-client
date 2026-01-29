/* eslint-disable @typescript-eslint/no-unused-vars */
import { status } from 'elysia';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import type { Route } from '../../exports/routes';
import { mClient, mRebaseClient } from '../../local';

export default {
    path: '/data/send/message/reply',
    type: 'POST',
    run: async ({
        body: {
            guild_id,
            channel_id,
            message_content,
			replying_to_id
        }
    }: {
        body: {
            guild_id?: string;
            channel_id?: string;
            message_content?: string;
			replying_to_id?: string;
        }
    }) => {
        if (!mClient) await mRebaseClient();

        if (!guild_id || !channel_id || !message_content || !replying_to_id) {
            return status('Bad Request', {
                message: 'Missing one or more of: guild_id, channel_id, replying_to_id, message_content',
                code: StatusCodes.BAD_REQUEST,
                reason: ReasonPhrases.BAD_REQUEST,
                timestamp: Date.now()
            });
        }

        try {
            const guild = await mClient?.guilds.fetch(guild_id);
            const channel = await guild?.channels.fetch(channel_id);

            if (!channel || !channel.isTextBased()) {
                return status('Bad Request', {
                    message: 'Provided channel is not a text-based channel or does not exist.',
                    code: StatusCodes.BAD_REQUEST,
                    reason: ReasonPhrases.BAD_REQUEST,
                    timestamp: Date.now()
                });
            }

			const replyingTo = await channel.messages.fetch(replying_to_id);
			const sent = await replyingTo.reply(message_content);

            return status('OK', {
                actions: [
                    {
                        event: 'message-sent',
                        message: 'Message sent to channel',
                        state: true,
                    }
                ],
                data: {
                    id: sent?.id,
                    content: sent?.content,
                    author_id: sent?.author.id,
                    channel_id: sent?.channelId,
                    guild_id: sent?.guildId,
                    timestamp: sent?.createdTimestamp
                },
                timestamp: Date.now(),
                reason: ReasonPhrases.OK,
                code: StatusCodes.OK,
                message: 'Message successfully sent.'
            });

        } catch (err) {
            return status('Internal Server Error', {
                message: 'Failed to send message. Guild/Channel might be invalid or bot lacks permission.',
                code: StatusCodes.INTERNAL_SERVER_ERROR,
                reason: ReasonPhrases.INTERNAL_SERVER_ERROR,
                timestamp: Date.now()
            });
        }
    }
} as Route;
