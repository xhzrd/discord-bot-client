/* eslint-disable @typescript-eslint/no-unused-vars */
import { status } from 'elysia';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import type { Route } from '../../exports/routes';
import { mClient, mRebaseClient } from '../../local';

export default {
    path: '/data/fetch/messages',
    type: 'POST',
    run: async ({
        body: { channel_id }
    }: {
        body: { channel_id?: string };
    }) => {
        if (!mClient) await mRebaseClient();

        if (!channel_id) {
            return status('Bad Request', {
                message: 'Missing channel_id in body.',
                code: StatusCodes.BAD_REQUEST,
            });
        }

        try {
            const channel = await mClient?.channels.fetch(channel_id);
            if (!channel || !channel.isTextBased()) {
                return status('Bad Request', {
                    message: 'Channel is not a valid text channel.',
                    code: StatusCodes.BAD_REQUEST,
                });
            }

            const messages = await channel.messages.fetch({ limit: 100 }); // adjust limit as needed
            const message_list = [];

            for (const [, message] of messages) {
				const author = message.author;
				const member = message.member;
				const replied_to = message.reference?.messageId
					? await message.channel.messages.fetch(message.reference.messageId).catch(() => null)
					: null;

				const attachments = message.attachments.map(att => ({
					id: att.id,
					name: att.name,
					url: att.url,
					contentType: att.contentType,
					size: att.size
				}));

				const reactions = [];

				for (const [, reaction] of message.reactions.cache) {
					const emoji = reaction.emoji;
					const users = await reaction.users.fetch();

					const user_list = users.map(u => ({
						id: u.id,
						displayname: message.guild?.members.cache.get(u.id)?.nickname || u.globalName || u.displayName || u.username
					}));

					reactions.push({
						users: user_list,
						emoji: {
							id: emoji.id ?? null,
							name: emoji.name,
							animated: emoji.animated ?? false
						},
						amount: reaction.count ?? users.size
					});
				}

				const embeds = message.embeds.map(embed => ({
					title: embed.title || '',
					description: embed.description || '',
					fields: embed.fields?.map(f => ({
						name: f.name,
						value: f.value,
						inline: f.inline
					})) || [],
					image: embed.image,
					video: embed.video,
					url: embed.url,
					footer: embed.footer?.text || '',
					timestamp: embed.timestamp || null,
					color: embed.color ?? null
				}));

				message_list.push({
					message_id: message.id,
					content: message.content,
					timestamp: message.createdAt,
					author_id: author.id,
					author_displayname: member?.nickname || member?.displayName || author.globalName || author.displayName || author.username,
					author_pfp: member?.displayAvatarURL({ size: 1024 }) ?? author.displayAvatarURL({ size: 1024 }),
					bot: author.bot,
					attachments,
					reactions, // 🔥 injected here
					edited: message.editedAt ? {
						at: message.editedAt,
						state: true
					} : null,
					hasEmbed: embeds.length > 0,
					embeds: embeds ?? [],
					replied_to: replied_to
						? {
							message_id: replied_to.id,
							author_id: replied_to.author.id,
							displayname: replied_to.member?.nickname || replied_to.member?.displayName || replied_to.author.globalName || replied_to.author.displayName || replied_to.author.username,
							content: replied_to.content,
							pfp: replied_to.member?.displayAvatarURL({ size: 512 }) ?? replied_to.author.displayAvatarURL({ size: 512 })
						}
						: null
				});
			}

            return status('OK', {
                actions: [
                    {
                        event: 'channel-messages-fetch',
                        message: 'Fetched messages from channel',
                        state: true,
                    },
                ],
                data: message_list.reverse(),
                timestamp: Date.now(),
                reason: ReasonPhrases.OK,
                code: StatusCodes.OK,
                message: `Fetched ${message_list.length} messages from channel`,
            });
        } catch (err) {
            return status('Not Found', {
                message: 'Channel not found or error fetching messages.',
                code: StatusCodes.NOT_FOUND,
                reason: ReasonPhrases.NOT_FOUND,
                timestamp: Date.now(),
            });
        }
    }
} as Route;
