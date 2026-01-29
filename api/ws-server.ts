import { WebSocket, WebSocketServer } from 'ws';
import { mClient, mRebaseClient } from './local';
import { PermissionsBitField, User } from 'discord.js';

type SubClient = {
    socket: WebSocket;
    guild_id: string;
    channel_id: string;
};

const live_port = 5099;
const wss = new WebSocketServer({ port: live_port });
console.log(`[LIVE] WebSocket server running on ws://localhost:${live_port}`);

const clients = new Set<SubClient>();
const onlineUsers = new Map<
  string, // guild_id
  Map<
    string, // user_id
    {
      roles: string[];
      channels: { id: string; name: string; type: number }[];
      user: {
        id: string;
        display_name: string;
		username: string;
        icon: string;
        status: string;
        statusText: string;
      };
    }
  >
>();

wss.on('connection', (socket: WebSocket) => {
    let guild_id: string | null = null;
    let channel_id: string | null = null;

    socket.on('message', async (data) => {
		try {
			const payload = JSON.parse(data.toString()) as {
				channel_id: string;
				guild_id: string;
			};

			if (!payload.guild_id || !payload.channel_id) return;

			guild_id = payload.guild_id;
			channel_id = payload.channel_id;
			clients.add({ socket, guild_id, channel_id });
			console.log(`[LIVE] Subscribed client to guild ${guild_id}, channel ${channel_id}`);

			// ====== send presence ======
			let online = onlineUsers.get(guild_id);
			if (!online) {
				const guild = mClient?.guilds.cache.get(guild_id);
				if (guild) {
					try {
						console.log(`[LIVE] Fetching members for guild ${guild_id}...`);
						await guild.members.fetch({ withPresences: true });

						online = new Map();
						guild.members.cache.forEach((member) => {
							if (!member.presence || member.presence.status === 'offline') return;

							const role_ids = member.roles.cache.map(r => r.id);
							const accessible_channels = guild.channels.cache
								.filter(c => c.permissionsFor(member).has(PermissionsBitField.Flags.ViewChannel))
								.map(c => ({ id: c.id, name: c.name, type: c.type }));

							const activities = member.presence.activities;
							const custom_status = activities.find(a => a.type === 4);
							const rich_presence = activities.find(a => [0, 2, 3].includes(a.type));

							let rich_status_text = '';
							if (rich_presence?.name) {
								const prefix = ['Playing', '', 'Listening to', 'Watching'][rich_presence.type];
								rich_status_text = `${prefix} ${rich_presence.name}`.trim();
							}

							const user_info = {
								id: member.id,
								display_name: member.nickname || member.displayName || member.user.displayName || member.user.globalName || member.user.username,
								username: member.user.username,
								icon: member.displayAvatarURL({ size: 512 }),
								status: member.presence.status,
								statusText: custom_status?.state || rich_status_text || ''
							};

							online?.set(member.id, {
								roles: role_ids,
								channels: accessible_channels,
								user: user_info
							});
						});

						onlineUsers.set(guild_id, online);
						console.log(`[LIVE] Cached ${online.size} online users for guild ${guild_id}`);
					} catch (err) {
						console.error(`[LIVE] Failed to fetch guild members:`, err);
						online = undefined;
					}
				}
			}

			if (online) {
				socket.send(JSON.stringify({
					payload: 'presence',
					data: Array.from(online.values()).map(info => ({
						user: info.user,
						role_ids: info.roles,
						accessible_channels: info.channels
					}))
				}));
			}

			// ====== send last 100 messages ======
			const channel = mClient?.channels.cache.get(channel_id);
			if (channel?.isTextBased?.()) {
				try {
					const messages = await channel.messages.fetch({ limit: 100 });
					const sorted = [...messages.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);

					const message_list = [];

					for (const message of sorted) {
						const replied_to_raw = message.reference?.messageId
							? await message.channel.messages.fetch(message.reference.messageId).catch(() => null)
							: null;

						const attachments = message.attachments.map(att => ({
							id: att.id,
							name: att.name,
							url: att.url,
							contentType: att.contentType,
							size: att.size
						}));

						let final_content = message.content ?? '';
						if (!final_content.trim()) {
							final_content = attachments.map(a => a.url).join('\n');
						}

						// ✅ add reactions
						const reactions = await Promise.all(
							message.reactions.cache.map(async (reaction) => {
								// eslint-disable-next-line @typescript-eslint/no-explicit-any
								let users: string | any[];
								try {
									const fetchedUsers = await reaction.users.fetch();
									users = fetchedUsers.map(user => ({
										id: user.id,
										displayname: message.guild?.members.cache.get(user.id)?.nickname || user.displayName || user.globalName || user.username
									}));
								} catch (err) {
									console.warn('[LIVE] Failed to fetch users for reaction:', err);
									users = [];
								}

								return {
									users,
									emoji: {
										id: reaction.emoji.id,
										name: reaction.emoji.name,
										animated: reaction.emoji.animated ?? false
									},
									amount: reaction.count ?? users.length
								};
							})
						);

						
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
							content: final_content,
							timestamp: message.createdAt,
							author_id: message.author.id,
							author_displayname: message.member?.nickname || message.member?.displayName || message.author.globalName || message.author.displayName || message.author.username,
							author_pfp: message.author.displayAvatarURL({ size: 1024 }),
							bot: message.author.bot,
							attachments,
							edited_at: message.editedAt ?? null,
							hasEmbed: embeds.length > 0,
							embeds,
							replied_to: replied_to_raw
								? {
									message_id: replied_to_raw.id,
									author_id: replied_to_raw.author.id,
									displayname: replied_to_raw.member?.nickname || replied_to_raw.member?.displayName || replied_to_raw.author.globalName || replied_to_raw.author.displayName || replied_to_raw.author.username,
									content: replied_to_raw.content,
									pfp: replied_to_raw.author.displayAvatarURL({ size: 512 })
								}
								: null,
							reactions // 🧠 now this is included in each message
						});
					}

					for (const msg of message_list) {
						socket.send(JSON.stringify({
							payload: 'message',
							...msg
						}));
					}
				} catch (err) {
					console.error(`[LIVE] Failed to fetch messages for channel ${channel_id}:`, err);
				}
			}
		} catch {
			console.warn('[LIVE] invalid payload received');
		}
	});

    socket.on('close', () => {
        for (const client of clients) {
            if (client.socket === socket) clients.delete(client);
        }
    });
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sendReactionUpdate(reaction: any) {
    if (reaction.partial) {
        try {
            await reaction.fetch();
        } catch (err) {
            console.warn('[LIVE] Failed to fetch partial reaction:', err);
            return;
        }
    }

    const message = reaction.message;

    if (!message || !message.channel) {
        console.warn('[LIVE] Reaction message or channel missing, skipping...');
        return;
    }

    try {
        if (message.partial) await message.fetch();
    } catch (err) {
        console.warn('[LIVE] Failed to fetch partial message:', err);
        return;
    }

    const channel_id = message.channel.id;
    const reactions = message.reactions.cache;

    const final_reactions = await Promise.all([...reactions.values()].map(async (r) => {
        try {
            const fetchedUsers = await r.users.fetch();
            return {
                users: fetchedUsers.map((user: User) => ({
                    id: user.id,
                    displayname: message.guild?.members.cache.get(user.id)?.nickname || user.globalName || user.displayName || user.username
                })),
                emoji: {
                    id: r.emoji.id,
                    name: r.emoji.name,
                    animated: r.emoji.animated ?? false
                },
                amount: r.count ?? fetchedUsers.size
            };
        } catch (err) {
            console.warn('[LIVE] Failed to fetch users for emoji', r.emoji.name, err);
            return null;
        }
    }));

    const payload = {
        payload: 'reaction_update',
        message_id: message.id,
        channel_id,
        reactions: final_reactions.filter(Boolean)
    };

    for (const client of clients) {
        if (client.channel_id === channel_id && client.socket.readyState === WebSocket.OPEN) {
            client.socket.send(JSON.stringify(payload));
        }
    }
}

async function waitForClientAndStart() {
    let retries = 0;
    const max_retries = 10;

    while (!mClient && retries < max_retries) {
        console.log(`[LIVE] Waiting for mClient... (${retries + 1}/${max_retries})`);
        await new Promise((r) => setTimeout(r, 500));
        retries++;

        if (!mClient && retries === 3) {
            console.log('[LIVE] Attempting mRebaseClient()...');
            await mRebaseClient();
        }
    }

    if (!mClient) {
        console.error('[LIVE] Failed to initialize mClient after retries');
        return;
    }

    console.log('[LIVE] mClient ready, binding listeners');

    mClient.on('presenceUpdate', async (_, newPresence) => {
		const guild = newPresence.guild;
		if (!guild) return;

		// update the member's entry in the onlineUsers map
		const user_id = newPresence.userId;
		const member = newPresence.member;
		if (!member) return;

		const isOnline = newPresence.status !== 'offline';
		const role_ids = member.roles.cache.map(r => r.id);

		const all_channels = guild.channels.cache;
		const accessible_channels = all_channels
			.filter(channel => channel.permissionsFor(member).has(PermissionsBitField.Flags.ViewChannel))
			.map(channel => ({
				id: channel.id,
				name: channel.name,
				type: channel.type,
			}));

		const activities = newPresence.activities;
		const custom_status = activities.find(a => a.type === 4);
		const rich_presence = activities.find(a => a.type === 0 || a.type === 2 || a.type === 3);

		let rich_status_text = '';
		if (rich_presence?.name) {
			switch (rich_presence.type) {
				case 0:
					rich_status_text = `Playing ${rich_presence.name}`;
					break;
				case 2:
					rich_status_text = `Listening to ${rich_presence.name}`;
					break;
				case 3:
					rich_status_text = `Watching ${rich_presence.name}`;
					break;
			}
		}

		const status_text = custom_status?.state || rich_status_text || '';
		const user_info = {
			id: user_id,
			display_name: member.nickname || member.user.username,
			username: member.user.username,
			icon: member.displayAvatarURL({ size: 512 }),
			status: newPresence.status,
			statusText: status_text,
		};

		let guildMap = onlineUsers.get(guild.id);
		if (!guildMap) {
			guildMap = new Map();
			onlineUsers.set(guild.id, guildMap);
		}

		if (isOnline) {
			guildMap.set(user_id, {
				roles: role_ids,
				channels: accessible_channels,
				user: user_info,
			});
		} else {
			guildMap.delete(user_id);
		}

		// 🧠 rebuild the full list from onlineUsers
		const entries = Array.from(guild.members.cache.values())
			.filter(member => {
				const presence = member.presence;
				return presence && presence.status !== 'offline';
			})
			.map(member => {
				const presence = member.presence!;
				const activities = presence.activities;
				const custom_status = activities.find(a => a.type === 4);
				const rich_presence = activities.find(a => a.type === 0 || a.type === 2 || a.type === 3);

				let rich_status_text = '';
				if (rich_presence?.name) {
					switch (rich_presence.type) {
						case 0:
							rich_status_text = `Playing ${rich_presence.name}`;
							break;
						case 2:
							rich_status_text = `Listening to ${rich_presence.name}`;
							break;
						case 3:
							rich_status_text = `Watching ${rich_presence.name}`;
							break;
					}
				}

				const status_text = custom_status?.state || rich_status_text || '';
				return {
					user: {
						id: member.id,
						display_name: member.nickname || member.displayName || member.user.displayName || member.user.globalName || member.user.username,
						username: member.user.username,
						icon: member.displayAvatarURL({ size: 512 }),
						status: presence.status,
						statusText: status_text,
					},
					role_ids: member.roles.cache.map(r => r.id),
					accessible_channels: guild.channels.cache
						.filter(channel => {
							const perms = channel.permissionsFor(member);
							return perms?.has(PermissionsBitField.Flags.ViewChannel);
						})
						.map(channel => ({
							id: channel.id,
							name: channel.name,
							type: channel.type,
						})),
				};
			});

		// 🚀 broadcast that fresh rebuilt list
		for (const client of clients) {
			if (client.guild_id === guild.id && client.socket.readyState === WebSocket.OPEN) {
				client.socket.send(
					JSON.stringify({
						payload: 'presence',
						data: entries,
					})
				);
			}
		}
	});

    mClient.on('messageCreate', async (msg) => {
		const channel_id = msg.channelId;

		let replied_to = null;
		if (msg.reference?.messageId) {
			try {
				const ref = await msg.channel.messages.fetch(msg.reference.messageId);
				const member = await msg.guild?.members.fetch(ref.author.id);
				replied_to = {
					message_id: ref.id,
					author_id: ref.author.id,
					displayname: ref.member?.nickname || ref.member?.displayName || ref.author.globalName || ref.author.displayName || ref.author.username,
					content: ref.content,
					pfp: member?.displayAvatarURL({ size: 512 }) ?? ref.author.displayAvatarURL({ size: 512 })
				};
			} catch { /* empty */ }
		}

		const attachments = msg.attachments.map(att => ({
			id: att.id,
			name: att.name,
			url: att.url,
			contentType: att.contentType,
			size: att.size
		}));

		let final_content = msg.content ?? '';
		if (!final_content.trim()) {
			final_content = attachments.map(att => att.url).join('\n');
		}

		const reactions = msg.reactions.cache.map(reaction => {
			const users = reaction.users.cache.map(user => ({
				id: user.id,
				displayname: msg.guild?.members.cache.get(user.id)?.nickname || user.displayName || user.globalName || user.username
			}));

			return {
				users,
				emoji: {
					id: reaction.emoji.id,
					name: reaction.emoji.name,
					animated: reaction.emoji.animated ?? false
				},
				amount: reaction.count ?? users.length
			};
		});

		const embeds = msg.embeds.map(embed => ({
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

		const payload = {
			payload: 'message',
			message_id: msg.id,
			content: final_content,
			timestamp: msg.createdAt,
			author_id: msg.author.id,
			author_displayname: msg.member?.nickname || msg.member?.displayName || msg.author.displayName || msg.author.globalName || msg.author.username,
			author_pfp: msg.member?.displayAvatarURL({ size: 1024 }) ?? msg.author.displayAvatarURL({ size: 1024 }),
			bot: msg.author.bot,
			attachments,
			replied_to,
			reactions,
			hasEmbed: embeds.length > 0,
			embeds
		};

		for (const client of clients) {
			if (client.channel_id === channel_id && client.socket.readyState === client.socket.OPEN) {
				client.socket.send(JSON.stringify(payload));
			}
		}
	});

	mClient.on('messageUpdate', async (oldMsg, newMsg) => {
		if (newMsg.partial) return;
		
		const embeds = newMsg.embeds.map(embed => ({
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

		const attachments = newMsg.attachments.map(att => ({
			id: att.id,
			name: att.name,
			url: att.url,
			contentType: att.contentType,
			size: att.size
		}));

		let final_content = newMsg.content ?? '';
		if (!final_content.trim()) {
			final_content = attachments.map(att => att.url).join('\n');
		}

		const payload = {
			payload: 'message_edit',
			message_id: newMsg.id,
			new_content: final_content,
			edited_at: newMsg.editedAt,
			hasEmbed: embeds.length > 0,
			attachments,
			embeds
		};

		for (const client of clients) {
			if (client.channel_id === newMsg.channelId && client.socket.readyState === client.socket.OPEN) {
				client.socket.send(JSON.stringify(payload));
			}
		}
	});

	mClient.on('messageDelete', (msg) => {
		const payload = {
			payload: 'message_delete',
			message_id: msg.id,
			deleted_at: new Date()
		};

		for (const client of clients) {
			if (client.channel_id === msg.channelId && client.socket.readyState === client.socket.OPEN) {
				client.socket.send(JSON.stringify(payload));
			}
		}
	});

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	mClient.on('messageReactionAdd', async (reaction, _user) => {
		await sendReactionUpdate(reaction);
	});

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	mClient.on('messageReactionRemove', async (reaction, _user) => {
		await sendReactionUpdate(reaction);
	});

	mClient.on('messageReactionRemoveAll', async (message) => {
		// optionally wipe all reactions for a message
		const payload = {
			payload: 'reaction_clear',
			message_id: message.id,
			channel_id: message.channel.id
		};

		for (const client of clients) {
			if (client.channel_id === message.channel.id && client.socket.readyState === WebSocket.OPEN) {
				client.socket.send(JSON.stringify(payload));
			}
		}
	});
}

waitForClientAndStart();
