/* eslint-disable @typescript-eslint/no-explicit-any */
import { Component, createRef, memo, type ChangeEvent, type PropsWithChildren, type ReactNode, type RefObject } from 'react';
import { Anchor, ArrowDown, ChevronRight, Hash, Heart, Mic, Send, Star, X } from 'react-feather';
import { Button } from '../../components/Button/export';
import { GuildChannelsComponent } from '../../components/ChannelList/export';
import { Input } from '../../components/Input/export';
import { MessageComponent } from '../../components/Message/export';
import { getContrastColor, isOnlyEmojis } from '../../components/Message/functions';
import { UserListComponent } from '../../components/UserPresence/export';
import type { DeepKeys, DeepValue } from '../../safestate';
import { API, type AttachmentInfo, type EmbedInfo, type GuildChannel, type GuildFullInfo, type MessageInfo, type MessageReaction, type RepliedMessageInfo, type RoleInfo } from '../../util/api';
import { CookiesManager } from '../../util/class-manager';
import { merge } from '../../util/class-merge';
import { MediaModal } from '../../components/MediaModal/export';

const MESSAGE_STACK_TIME_MS = 13 * 60 * 1000; // 13 minutes

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

function similarity(a: string, b: string): number {
	a = a.toLowerCase();
	b = b.toLowerCase();

	if (a === b) return 1;
	if (!a.length || !b.length) return 0;

	// if b doesn't start with a, punish hard
	if (!b.startsWith(a)) return 0;

	let score = 0;
	let aIndex = 0;

	for (let i = 0; i < a.length; i++) {
		const char = a[i];
		const foundAt = b.indexOf(char, aIndex);
		if (foundAt !== -1) {
			score++;
			aIndex = foundAt + 1;
		}
	}

	return score / b.length;
}

function find_in_nested_channels(channels: any[], id: string): any | null {
    if (!channels) return null;

    for (const c of channels) {
        if (c.id === id) return c;

        // if c.channels is an array, recurse inside
        if (Array.isArray(c.channels)) {
            const found = find_in_nested_channels(c.channels, id);
            if (found) return found;
        }
    }
    return null;
}

interface UserData {
	id: string
	display_name: string
	icon: string
	status: string
	statusText: string
}

interface EmojiData {
	id: string
	name: string
	animated: boolean
	url: string
}

interface RoleData {
	id: string
	name: string
	color: string
	position: number
	icon: string
}

interface ChannelData {
	id: string
	name: string
	type: number
}

interface AutocompleteInfo {
	match_type?: 'channel' | 'user' | 'role' | 'emoji'
	result?: string
	data?: UserData | EmojiData | RoleData | ChannelData
	score?: number
	part?: string
}

export class GuildLayoutComponent extends Component<PropsWithChildren & { children?: ReactNode }> {
	private liveSocket: WebSocket | null = null;
	state = {
		guildId: null as string | null,
		guild: null as GuildFullInfo | null,
		currentChannel: null as string | null,
		currentChannelID: null as string | null,
		channelContent: null as MessageInfo[] | null,

		usersPresence: [] as { 
			user: {
				id: string
				display_name: string
				username: string
				icon: string
				status: string
				statusText: string
			}
			role_ids: string[]
			accessible_channels: { id: string; name: string; type: number }[]
		}[] | null,
		guildRoles: [] as RoleInfo[] | null,

		replyingToMessageIndex: null as number | null,
		replyingToMessage: null as string | null,

		autocompleteBarVisible: null as boolean | null,
		autocompleteInfo: null as AutocompleteInfo[] | null,
		currentHighestScore: null as number | null,
		currentAutocompleteIndex: null as number | null,
		emojiBarVisible: null as boolean | null,
		emojis: null as {
			id: string
			name: string
			animated: boolean
			src: string
		}[] | null,

		glowingMessageId: null as string | null,
		boundingWidth: 0,
		messageBarHeight: 0,

		mediaModal: {
			visible: null as boolean | null,
			url: null as string | null
		},

		isLiveConnected: false,
		isSeeingOldMessages: false,
		id: null as string | null,
	};

	containerRef = createRef<HTMLDivElement>();
	messageInputRef: RefObject<Input | null> | null = createRef();
	messageBarRef: RefObject<HTMLDivElement | null> | null = createRef();
	messageContent: string = '';
	messageRefs: Record<string, HTMLDivElement> = {};

	debouncerTimeout: number = 0;
	debounceChangeEvent(e: ChangeEvent<HTMLInputElement>) {
		clearTimeout(this.debouncerTimeout);
		this.debouncerTimeout = setTimeout(() => {
			const text = e.target.value.trim();
			const trigger = text.match(/(@:r:[\w\d_-]+|@[\w\d_]+|#[\w\d_-]+|:[\w\d_]+)$/);
			if (!trigger) {
				this.setTypedState('currentAutocompleteIndex', null);
				this.setTypedState('currentHighestScore', null);
				this.setTypedState('autocompleteBarVisible', false);
				this.setTypedState('autocompleteInfo', null);
				return;
			}

			const [full] = trigger;
			let type: 'user' | 'channel' | 'role' | 'emoji' | null = null;
			let query = '';

			if (full.startsWith('@:r:')) {
				type = 'role';
				query = full.slice(4); // remove "@:r:"
			} else if (full.startsWith('@')) {
				type = 'user';
				query = full.slice(1);
			} else if (full.startsWith('#')) {
				type = 'channel';
				query = full.slice(1);
			} else if (full.startsWith(':')) {
				type = 'emoji';
				query = full.slice(1);
			}

			let entries: { match_type: string, result: string, score: number, part: string }[] = [];
			const matchedQuery = full;

			if (type === 'user') {
				const pres = this.state.usersPresence ?? [];
				entries = pres.map(u => {
					const nameScore = similarity(query, u.user.display_name);
					const usernameScore = similarity(query, u.user.username);
					const score = Math.max(nameScore, usernameScore);

					return {
						match_type: 'user',
						data: u,
						result: `<@${u.user.id}>`,
						score,
						part: matchedQuery
					};
				});
			}

			if (type === 'channel') {
				if (!this.state.guild) return;
				const flattenChannels = (chs: GuildChannel[]): GuildChannel[] =>
					chs.flatMap(ch => [ch, ...flattenChannels(ch.channels ?? [])]);

				entries = flattenChannels(this.state.guild.channels).map(ch => ({
					match_type: 'channel',
					result: `<#${ch.id}>`,
					data: {
						id: ch.id,
						name: ch.name,
						type: ch.type
					},
					score: similarity(query, ch.name),
					part: matchedQuery
				}));
			}

			if (type === 'role') {
				if (!this.state.guildRoles) return;
				entries = this.state.guildRoles.map(r => {
					const name = r.name.toLowerCase();
					const q = query.toLowerCase();

					let baseScore = similarity(q, name);
					if (name.includes(q) && !name.startsWith(q)) baseScore *= 0.95; // small penalty
					else if (!name.includes(q)) baseScore *= 0.7; // bigger penalty

					return {
						match_type: 'role',
						result: `<@&${r.id}>`,
						data: r,
						score: baseScore,
						part: matchedQuery
					};
				});
			}

			if (type === 'emoji') {
				if (!this.state.guild) return;
				entries = this.state.guild.emojis.map(e => ({
					match_type: 'emoji',
					result: `<${e.animated ? 'a' : ''}:${e.name}:${e.id}>`,
					data: e,
					score: similarity(query, e.name),
					part: matchedQuery
				}));
			}

			const topMatches = entries
				.filter(e => e.score >= 0.1)
				.sort((a, b) => (a.score ?? 0) - (b.score ?? 0))
				.slice(0, 6);

			// check for same top score
			if (topMatches.length >= 2) {
				const maxScore = topMatches[0].score;
				const sameScoreItems = topMatches.filter(e => e.score === maxScore);
				const q = query.toLowerCase();

				// Look for any whose result includes the query more directly
				const betterOne = sameScoreItems.find(e =>
					e.result.toLowerCase().includes(q) || e.part?.toLowerCase() === q
				);

				if (betterOne) {
					betterOne.score += 1;
				} else {
					const lastIdx = topMatches.lastIndexOf(sameScoreItems[sameScoreItems.length - 1]);
					topMatches[lastIdx].score += 1;
				}
			}

			if (topMatches.length > 0) {
				this.setTypedState('autocompleteBarVisible', true);
				this.setTypedState('autocompleteInfo', topMatches as unknown as AutocompleteInfo[]);
				this.setTypedState('currentHighestScore', Math.max(...(this.state.autocompleteInfo?.map(i => i.score ?? 0) || [])));
				this.setTypedState('currentAutocompleteIndex', topMatches.length - 1);
			} else {
				this.setTypedState('autocompleteInfo', null);
				this.setTypedState('currentAutocompleteIndex', null);
				this.setTypedState('currentHighestScore', null);
				this.setTypedState('autocompleteBarVisible', false);
			}
		}, 500);
	}

	constructor(props: PropsWithChildren & { children: ReactNode }) {
		super(props);
	}

	setBoundingClient() {
		if (!this.containerRef.current) return;
		this.setTypedState('boundingWidth', this.containerRef.current.getBoundingClientRect().width - 48);
	}

	setBoundingBarHeight(): void {
		const height = (this.messageBarRef?.current?.getBoundingClientRect().height || 0) + 14;
		this.setTypedState('messageBarHeight', height);
	}

	componentDidMount(): void {
		const resize = () => this.setBoundingClient();
		const resize_2 = () => this.setBoundingBarHeight();
		resize();
		resize_2();
		window.addEventListener('resize', () => {
			resize();
			resize_2();
		});

		this.runAsync();

		setTimeout(() => {
			this.setBoundingClient();
		}, 512);
	}

	setupLiveSocket(channel_id?: string) {
		this.setBoundingClient();
		if (!channel_id && !this.state.currentChannelID) return;
		if (!this.state.guildId) return;

		const chnl = channel_id || this.state.currentChannelID;
		const socket = new WebSocket('ws://localhost:5099');

		socket.onopen = () => {
			socket.send(JSON.stringify({ guild_id: this.state.guildId, channel_id: chnl }));
			this.setTypedState('isLiveConnected', true);
		};

		socket.onmessage = (event) => {
			const incoming = JSON.parse(event.data);

			switch (incoming.payload) {
				case 'message': {
					const parsed: MessageInfo = {
						message_id: incoming.message_id,
						content: incoming.content,
						timestamp: new Date(incoming.timestamp),
						author_id: incoming.author_id,
						author_displayname: incoming.author_displayname,
						author_pfp: incoming.author_pfp,
						bot: incoming.bot,
						attachments: incoming.attachments,
						replied_to: incoming.replied_to,
						reactions: incoming.reactions ?? null,
						edited: incoming.edited_at ? {
							at: incoming.edited_at,
							state: incoming.edited_at ? true : false
						} : undefined,
						hasEmbed: incoming.hasEmbed,
						embeds: incoming.embeds ?? null
					};

					const old_messages = this.state.channelContent || [];

					if (!old_messages.some(msg => msg.message_id === parsed.message_id)) {
						this.setTypedState('channelContent', [...old_messages, parsed]);
					}

					requestAnimationFrame(() => {
						requestAnimationFrame(() => {
							const el = this.containerRef.current;
							if (!el) return;

							const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
							if (distanceFromBottom <= 700 && !this.state.replyingToMessage && !this.state.replyingToMessageIndex) {
								el.scrollTo({
									top: el.scrollHeight,
									behavior: 'smooth',
								});
							}
						});
					});

					setTimeout(async () => {
						await this.setBoundingBarHeight();
					}, 60);

					break;
				}

				case 'message_edit': {
					const old = this.state.channelContent || [];
					const updated = old.map(msg => {
						if (msg.message_id !== incoming.message_id) return msg;

						return {
							...msg,
							content: incoming.new_content ?? msg.content,
							edited: {
								at: incoming.edited_at,
								state: true
							},
							attachments: incoming.attachments ?? msg.attachments,
							hasEmbed: incoming.hasEmbed,
							embeds: incoming.embeds ?? []
						};
					});

					this.setTypedState('channelContent', updated);
					break;
				}

				case 'message_delete': {
					const old = this.state.channelContent || [];
					const updated = old.filter(msg => msg.message_id !== incoming.message_id);
					this.setTypedState('channelContent', updated);
					break;
				}

				case 'presence': {
					const old_users = this.state.usersPresence || [];
					const new_users = incoming.data;

					const merged_users = new_users.map((new_user: any) => {
						const existing = old_users.find(old_user => old_user.user.id === new_user.user.id);
						return existing
							? { ...existing, ...new_user } // update fields (can be smarter here if needed)
							: new_user;
					});

					// optionally filter out old users that are no longer in new_users (i.e. they went offline)
					const final_users = merged_users.filter((u: any) =>
						new_users.some((nu: any) => nu.user.id === u.user.id)
					);

					this.setTypedState('usersPresence', final_users);
					break;
				}

				case 'reaction_update': {
					const { message_id, reactions } = incoming;

					this.setTypedState('channelContent', (this.state.channelContent || []).map(msg => {
						if (msg.message_id === message_id) {
							return reactions ? {
								...msg,
								reactions
							} : msg;
						}
						return msg;
					}));

					if (
						(this.state.channelContent?.[this.state.channelContent.length - 1]?.message_id === message_id) &&
						!this.state.replyingToMessage &&
						!this.state.replyingToMessageIndex
					) {
						requestAnimationFrame(() => {
							requestAnimationFrame(() => {
								const el = this.containerRef.current;
								if (!el) return;

								const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
								if (distanceFromBottom <= 700) {
									el.scrollTo({
										top: el.scrollHeight,
										behavior: 'smooth',
									});
								}
							});
						});
					}

					break;
				}

				case 'reaction_clear': {
					const { message_id } = incoming;

					this.setTypedState('channelContent', (this.state.channelContent || []).map(msg => {
						if (msg.message_id === message_id) {
							// eslint-disable-next-line @typescript-eslint/no-unused-vars
							const { reactions, ...rest } = msg;
							return rest;
						}
						return msg;
					}));
					break;
				}
			}
		};

		socket.onerror = () => {
			this.setTypedState('isLiveConnected', false);
		};

		socket.onclose = () => {
			this.setTypedState('isLiveConnected', false);
		};

		this.liveSocket = socket;
	}

	fetchRoles = async () => {
		const pathname = window.location.pathname.split('/');
		const guild_id = pathname[pathname.length - 1];

		const roles_request = await API.User.GuildRoles(guild_id);
		if (roles_request.data.code != 200) return;

		const roles_r: RoleInfo[] | null = (roles_request.data as {
			data: null | RoleInfo[]
		}).data;

		const roles = roles_r as unknown as RoleInfo[];
		this.setTypedState('guildRoles', roles);
	}

	runAsync = async () => {
		const pathname = window.location.pathname.split('/');
		const guild_id = pathname[pathname.length - 1];

		this.setTypedState('guildId', guild_id);

		const guild_request = await API.User.Guild(guild_id);
		if (guild_request.data.code != 200) return;

		const guild: GuildFullInfo[] | null = (guild_request.data as {
			data: null | GuildFullInfo[]
		}).data;

		const server = guild as unknown as GuildFullInfo;
		this.setTypedState('guild', server);
		this.setTypedState('emojis', server.emojis.map(e => ({
			id: e.id,
			name: e.name,
			animated: e.animated,
			src: e.url
		})));

		setTimeout(async () => {
			this.fetchRoles();
		}, 2000);

		const id: string | null = CookiesManager.get_cookie('imp.local.id');
		if (!id) {
			CookiesManager.clear_all_cookies();
			window.location.href = '/';
			return;
		}

		this.setTypedState('id', id.replaceAll('\'', ''));

		const cacheInfo = CookiesManager.get_cookie('imp.cache.guild') as {
			id: string
			channel_name: string
			channel_id: string
		} | null | undefined;

		setTimeout(() => {
			requestAnimationFrame(() => {
				if (cacheInfo) {
					this.setTypedState('currentChannelID', cacheInfo.channel_id);
					this.setTypedState('currentChannel', cacheInfo.channel_name);
					this.fetchChannel(cacheInfo.channel_name, cacheInfo.channel_id);
					this.getChannelMessages(cacheInfo.channel_name, cacheInfo.channel_id);
				}

				requestAnimationFrame(() => {
					const el = this.containerRef.current;
					if (!el) return;
					const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
					if (distanceFromBottom <= 60) {
						el.scrollTo({
							top: el.scrollHeight,
							behavior: 'smooth',
						});
					}
				});

				this.setBoundingBarHeight();
			});
		}, 256);
	}

	private setBoundingFirstUpdate: boolean = false;
	componentDidUpdate(_p: any, prevState: Readonly<typeof this.state>): void {
		if (
			this.setBoundingFirstUpdate ||
			!prevState.channelContent ||
			!this.state.channelContent ||
			!this.containerRef.current
		) return;

		const width = this.containerRef.current.getBoundingClientRect().width - 48;
		if (this.state.boundingWidth !== width) {
			this.setBoundingClient();
		}

		this.setBoundingFirstUpdate = true;
	}

	insertAutocompleteResult(index: number) {
		const info = this.state.autocompleteInfo?.[index];
		if (!info) return;

		const mir = this.messageInputRef?.current;
		const input = mir?.InputRef.current;
		if (!input) return;

		if (info.part)
			input.value = input.value.replace(info.part, '');

		input.value += info.result + ' ';
		this.messageContent = input.value;
		input.focus();

		this.setTypedState('currentAutocompleteIndex', null);
		this.setTypedState('currentHighestScore', null);
		this.setTypedState('autocompleteBarVisible', false);
		this.setTypedState('autocompleteInfo', null);
	}

	componentWillUnmount() {
		if (this.liveSocket && this.liveSocket.readyState === WebSocket.OPEN) {
			this.liveSocket.close();
		}
	}

	fetchChannel = async (chnl_name: string, channel_id: string) => {
		CookiesManager.set_cookie('imp.cache.guild', {
			id: this.state.guildId,
			channel_name: chnl_name,
			channel_id: channel_id
		}, 60);

		this.setTypedState('currentChannel', chnl_name);
		this.setTypedState('currentChannelID', channel_id);

		setTimeout(() => {
			this.setBoundingClient();
			if (!this.containerRef.current) return;
			this.containerRef.current.scrollTop = this.containerRef.current.scrollHeight;
		}, 256);
	}

	getChannelMessages = async (chnl_name: string, chnl_id: string) => {
		this.setBoundingBarHeight();

		this.setTypedState('currentChannel', chnl_name);
		this.setTypedState('currentChannelID', chnl_id);

		if (this.liveSocket && this.liveSocket.readyState === WebSocket.OPEN) {
			this.liveSocket.close();
		}
		this.setupLiveSocket(chnl_id);

		const request = await API.User.GuildChannel(chnl_id);
		if (request.data.code != 200) return;

		const channel: MessageInfo[] | null = (request.data as {
			data: null | MessageInfo[]
		}).data;

		this.setTypedState('channelContent', channel as unknown as MessageInfo[]);

		this.setBoundingClient();
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				const el = this.containerRef.current;
				if (!el) return;

				el.scrollTo({
					top: el.scrollHeight,
					behavior: 'smooth',
				});
				this.setBoundingBarHeight();
			});
		});
	}

	setTypedState<K extends DeepKeys<typeof this.state>>(key: K, value: Partial<DeepValue<typeof this.state, K>>) {
		this.setState((prevState) => {
			const keys = (typeof key == 'string' ? key : '').split('.') as string[];
			// eslint-disable-next-line prefer-const
			let newState: any = structuredClone(prevState);

			let current: any = newState;
			for (let i = 0; i < keys.length - 1; i++) {
				current[keys[i]] = { ...current[keys[i]] };
				current = current[keys[i]];
			}
			current[keys[keys.length - 1]] = value;

			return newState;
		});
	}

	SendMessage() {
		if (!this.state.guildId || !this.state.currentChannelID || !this.messageContent) return; 
		const cleaned_content = this.messageContent.replace(/\\n/g, '\n');
		API.User.SendMessage(this.state.guildId, this.state.currentChannelID, cleaned_content);

		const mir = this.messageInputRef?.current;
		if (mir && mir.InputRef.current?.value) {
			mir.InputRef.current.value = '';
			this.messageContent = '';
		}

		this.setTypedState('autocompleteInfo', null);
		this.setTypedState('currentAutocompleteIndex', null);
		this.setTypedState('currentHighestScore', null);
		this.setTypedState('autocompleteBarVisible', false);

		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				const el = this.containerRef.current;
				if (!el) return;
				el.scrollTo({
					top: el.scrollHeight,
					behavior: 'smooth',
				});
			})
		})
	}

	async SendMessageCheckReply() {
		if (!this.state.replyingToMessage) {
			this.ToggleEmojiBar(false);
			return this.SendMessage();
		}

		this.ToggleEmojiBar(false);
		if (!this.state.guildId || !this.state.currentChannelID || !this.messageContent || !this.state.replyingToMessage) return; 
		const cleaned_content = this.messageContent.replace(/\\n/g, '\n');
		API.User.SendMessageWithReply(this.state.guildId, this.state.currentChannelID, cleaned_content, this.state.replyingToMessage);

		const mir = this.messageInputRef?.current;
		if (mir && mir.InputRef.current?.value) {
			mir.InputRef.current.value = '';
			this.messageContent = '';
		}
		this.setTypedState('replyingToMessageIndex', null);
		this.setTypedState('replyingToMessage', null);

		this.setTypedState('autocompleteInfo', null);
		this.setTypedState('currentAutocompleteIndex', null);
		this.setTypedState('currentHighestScore', null);
		this.setTypedState('autocompleteBarVisible', false);

		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				const el = this.containerRef.current;
				if (!el) return;
				el.scrollTo({
					top: el.scrollHeight,
					behavior: 'smooth',
				});
			})
		})
	}

	async ToggleEmojiBar(state?: boolean) {
		this.setTypedState('emojiBarVisible', state != undefined && state != null ? state : this.state.emojiBarVisible != null ? !this.state.emojiBarVisible : true);
	}

	async ToggleMediaModel(state?: boolean, url?: string) {
		this.setTypedState('mediaModal.visible', state != undefined && state != null ? state : this.state.mediaModal.visible != null ? !this.state.mediaModal.visible : true);
		if(url) this.setTypedState('mediaModal.url', url);
	}

	render() {
		const { guild } = this.state;

		// group channels under categories
		const grouped_channels: Record<string, GuildChannel[]> = {};
		let current_category = 'Uncategorized';

		guild?.channels.forEach((channel) => {
			if (channel.name.startsWith('─')) {
				current_category = channel.name;
				if (!grouped_channels[current_category]) grouped_channels[current_category] = [];
			} else {
				if (!grouped_channels[current_category]) grouped_channels[current_category] = [];
				grouped_channels[current_category].push(channel);
			}
		});

		const stackedMessages: {
			replied_to_id: RepliedMessageInfo | null;
            author_id: string;
            author_displayname: string;
            author_pfp: string;
			message_id: string;
            timestamp: Date;
            contents: string[];
			bot: boolean;
            attachments: AttachmentInfo[];
			reactions?: MessageReaction[];
			hasEmbed?: boolean;
			embeds?: EmbedInfo[];
			edited?: {
				at: Date;
				state: boolean;
			}
        }[] = [];

		if (this.state.channelContent)
			for (let i = 0; i < this.state.channelContent.length; i++) {
				const msg = this.state.channelContent[i];
				const last = stackedMessages[stackedMessages.length - 1];

				if (
					last &&
					last.author_id === msg.author_id &&
					new Date(msg.timestamp).getTime() - new Date(last.timestamp).getTime() <= MESSAGE_STACK_TIME_MS &&
					!(
						(!last.replied_to_id && msg.replied_to) ||
						(last.replied_to_id && msg.replied_to && last.replied_to_id !== msg.replied_to)
					)
				) {
					if (msg.edited)
						last.edited = msg.edited;

					last.timestamp = msg.timestamp;

					last.contents.push(
						msg.content.replace(
							/https?:\/\/[^\s]+\.(png|jpe?g|gif|webp|mp4|webm|mov|mkv|ogg|mp3)(\?[^\s]*)?/gi,
							''
						)
					);

					if (msg.embeds && msg.embeds.length > 0) {
						if (!Array.isArray(last.embeds)) last.embeds = [];

						for (const embed of msg.embeds) {
							const already_exists = last.embeds.some(e =>
								JSON.stringify(e) === JSON.stringify(embed)
							);

							if (!already_exists) last.embeds.push(embed);
						}

						if (last.embeds.length > 0) last.hasEmbed = true;
					}

					if (!last.replied_to_id && msg.replied_to)
						last.replied_to_id = msg.replied_to;
				} else {
					stackedMessages.push({
						replied_to_id: msg.replied_to,
						message_id: msg.message_id,
						author_id: msg.author_id,
						author_displayname: msg.author_displayname,
						author_pfp: msg.author_pfp,
						timestamp: msg.timestamp,
						contents: [msg.content.replace(/https?:\/\/[^\s]+\.(png|jpe?g|gif|webp|mp4|webm|mov|mkv|ogg|mp3)(\?[^\s]*)?/gi, '')],
						attachments: msg.attachments,
						bot: msg.bot,
						reactions: msg.reactions,
						edited: msg.edited ?? undefined,
						hasEmbed: msg.hasEmbed,
						embeds: msg.embeds ?? null
					});
				}
			}

		const replyingMessage = stackedMessages.find(e => e.message_id == this.state.replyingToMessage);

		const groupedEmojis: Record<string, typeof this.state.emojis> = {};

		this.state.emojis?.forEach(emoji => {
			const letter = (emoji.name?.[0] || '').toUpperCase();
			if (!/[A-Z0-9]/.test(letter)) return;
			if (!groupedEmojis[letter]) groupedEmojis[letter] = [];
			groupedEmojis[letter].push(emoji);
		});

		const { usersPresence, guildRoles, currentChannelID } = this.state;

		// sort roles descending by position (highest first)
		const sorted_roles = guildRoles ? [...guildRoles].sort((a, b) => b.position - a.position) : [];

		// map userId to their highest role position so we know who is pinned where
		const user_highest_role_map = new Map<string, RoleInfo>();

		// build the map: for each user, find highest role by position
		usersPresence?.forEach(user => {
			const roles = guildRoles?.filter(r => user.role_ids.includes(r.id));
			if (roles?.length === 0) return; // no role

			const highest_role = roles?.reduce((prev, curr) =>
				curr.position > prev.position ? curr : prev
			);

			if (highest_role) 
				user_highest_role_map.set(user.user.id, highest_role);
		});

		// now group users by their highest role id
		const users_grouped_by_role = new Map<string, UserPresence[]>();

		usersPresence?.forEach(user => {
			const highest_role = user_highest_role_map.get(user.user.id);
			if (!highest_role) return; // skip users with no roles

			if (!users_grouped_by_role.has(highest_role.id)) {
				users_grouped_by_role.set(highest_role.id, []);
			}
			users_grouped_by_role.get(highest_role.id)!.push(user);
		});

		const sorted = [...(this.state.autocompleteInfo || [])];
		const infoIndex = this.state.currentAutocompleteIndex;

		const Entry = memo(function Entry({
			info,
			idx,
			isSelected,
			onClick,
		}: {
			info: any;
			idx: number;
			isSelected: boolean;
			onClick: () => void;
		}) {
			const base = 'inline-flex gap-2 items-center w-full max-w-full transition-all duration-150 ease-in-out';
			const classes = merge(
				base,
				'rounded-lg select-none border-2 cursor-pointer px-2 py-1.5 hover:bg-neutral-700 min-w-0',
				isSelected ? 'bg-neutral-700 border-neutral-500 opacity-100' : 'hover:opacity-100 border-transparent opacity-80'
			);

			const key = `info-${info.match_type}-${idx}`;

			if (info.match_type === 'user') {
				const user = info.data.user;
				return (
					<span className={classes} onClick={onClick} key={key}>
						<img src={user.icon} className='w-8 h-8 rounded-full' />
						<div className='flex flex-col gap-0 my-0.5'>
							<p className='text-neutral-300 text-base/4'>{user.display_name}</p>
							<p className='text-neutral-500 text-sm/4 truncate'>{user.statusText}</p>
						</div>
					</span>
				);
			}

			if (info.match_type === 'emoji') {
				const emoji = info.data;
				return (
					<span className={classes} onClick={onClick} key={key}>
						<img src={emoji.url} className='w-8 h-8 rounded-lg' />
						<p className='text-neutral-300 text-base/4 truncate'>{emoji.name}</p>
					</span>
				);
			}

			if (info.match_type === 'channel') {
				const chan = info.data;
				const icon =
					chan.type === 0 ? <Hash size={16} /> :
					chan.type === 2 ? <Mic size={16} /> :
					<Anchor size={16} />;

				return (
					<span className={merge(classes, 'h-8 text-neutral-300')} onClick={onClick} key={key}>
						{icon}
						<p className='text-base/4 truncate'>{chan.name}</p>
					</span>
				);
			}

			if (info.match_type === 'role') {
				const role = info.data;
				return (
					<span className={classes} onClick={onClick} key={key}>
						<img src={role.icon} className='w-8 h-8 rounded-full' />
						<div className='flex flex-col gap-0 my-0.5'>
							<p className='text-neutral-300 text-base/4'>{role.name}</p>
							<span className='inline-flex gap-1 items-center'>
								<span
									className='w-3 h-3 my-0.5 rounded-md'
									style={{ backgroundColor: `${role.color || '#d4d4d4'}` }}
								></span>
								<p className='text-neutral-500 text-sm/4 truncate'>{role.color}</p>
							</span>
						</div>
					</span>
				);
			}

			return null;
		});

		const AutocompleteBox = memo(function AutocompleteBox({
			visible,
			children,
		}: {
			visible?: boolean | null;
			children: React.ReactNode;
		}) {
			return (
				<div className={merge(
					'rounded-2xl h-max max-h-[44vh] p-4 justify-self-end w-full max-w-full transition-[transform,opacity,height] duration-300 ease-in-out',
					'bg-neutral-900 placeholder:text-white/70 text-white flex flex-col h-max',
					visible ? '-translate-y-3 opacity-100 pointer-events-auto' :
					'translate-y-8 opacity-0 pointer-events-none hidden'
				)}>
					<p className='select-none text-neutral-300 inline-flex gap-1 items-center mb-1'>
						Auto-complete <Star fill='currentColor' size={16} />
					</p>
					<div className='w-full max-w-full flex-1 flex flex-col gap-1'>
						{children}
					</div>
				</div>
			);
		});

		return (
			<div className={merge('inline-flex gap-2 w-full flex-1 h-full max-h-full overflow-hidden')}>
				{
					guild && this.state.currentChannelID ?
						<GuildChannelsComponent
							guild={guild}
							channelId={this.state.currentChannelID}
							onChannelClick={(channel_name, channel_id) => {
								this.fetchChannel(channel_name, channel_id);
								this.getChannelMessages(channel_name, channel_id);
							}}
						/>
					: null
				}

				<div className='flex flex-col gap-1 w-full max-w-full max-h-full overflow-hidden flex-1 rounded-2xl bg-neutral-800 relative'>
					{
						this.state.channelContent && this.state.guild && this.state.id 
						&& stackedMessages.length > 0 && <>
							<div className='flex flex-col gap-0 relative max-w-full w-full'>
								<span className='px-4 gap-2 w-full h-10 rounded-t-xl text-base font-medium py-3 inline-flex text-start items-center text-neutral-300 justify-start truncate'>
									<Hash size={16} />
									<p className='truncate'>{this.state.currentChannel}</p>
								</span>
							</div>
							<div
								ref={this.containerRef}
								className={merge(
									'flex flex-col gap-1 max-h-[calc(100%-26px)] overflow-y-auto relative',
									'transition-all duration-150 ease-in-out flex-1 max-w-full',
									this.state.replyingToMessage ? null : 'pb-[72px]'
								)}
								style={this.state.replyingToMessage ? {
									paddingBottom: `${this.state.messageBarHeight}px`
								} : {}}
								onScroll={() => {
									const el = this.containerRef.current;
									if (!el) return;

									const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
									this.setTypedState('isSeeingOldMessages', distanceFromBottom > 860);
								}}
							>
								{stackedMessages.map((message, idx) => this.state.guild && (
									<MessageComponent
										key={message.message_id}
										messageRefs={this.messageRefs}
										messageIndex={idx}
										userId={this.state.id ?? ''}
										authorId={message.author_id}
										authorProfilePicture={message.author_pfp ?? ''}
										authorRelativeName={message.author_displayname ?? ''}
										authorIsBot={message.bot}
										messageId={message.message_id}
										messageContents={message.contents}
										messageGuild={this.state.guild}
										messageGuildRoles={this.state.guildRoles}
										messageEdited={message.edited}
										messageTimestamp={message.timestamp}
										messageAttachments={message.attachments}
										messageHasEmbed={message.hasEmbed}
										messageEmbeds={message.embeds}
										messageReactions={message.reactions}
										userPresences={this.state.usersPresence}
										repliedToId={message.replied_to_id}
										replyToMessageIndex={this.state.replyingToMessageIndex}
										replyingToMessageId={this.state.replyingToMessage}
										groupedMessages={this.state.channelContent?.filter(m =>
											m.author_id === message.author_id &&
											message.contents.includes(m.content)
										)}
										glowingMessageId={this.state.glowingMessageId}
										isGlowingRelevant={this.state.channelContent?.some(m =>
											message.contents.includes(m.content) &&
											m.author_id === message.author_id &&
											m.message_id === this.state.glowingMessageId
										)}
										maxWidthSpace={this.state.boundingWidth}
										setInputMention={(mention) => {
											const mir = this.messageInputRef?.current;
											if (mir && mir.InputRef.current) {
												mir.InputRef.current.value += mention;
												this.messageContent = mir.InputRef.current.value;
												mir.InputRef.current.focus();
											}
										}}
										setGlowingMessage={(id) => this.setTypedState('glowingMessageId', id)}
										setReplyingMessage={(id, index) => {
											this.setTypedState('replyingToMessage', id);
											this.setTypedState('replyingToMessageIndex', index);
										}}
										setContainerRef={() => {
											const el = this.containerRef?.current;
											return el ? true : false;
										}}
										scrollContainerToEnd={() => {
											const el = this.containerRef.current;
											if (!el) return;

											el.scrollTo({
												top: el.scrollHeight,
												behavior: 'smooth',
											});
										}}
										onChannelClick={(name, id) => this.getChannelMessages(name, id)}
										setMessageBarHeight={() => this.setBoundingBarHeight()}
										reflectDOMReplyBarSize={async () => {
											await new Promise(res => requestAnimationFrame(res));
											await this.setBoundingBarHeight();
										}}
										focusOnMessageInput={() => {
											const mir = this.messageInputRef?.current;
											if (mir?.InputRef.current) mir.InputRef.current.focus();
										}}
										onMediaClick={(url) => {
											this.ToggleMediaModel(true, url);
										}}
									/>
								))}
							</div>
						</>
					}
					{
						guild && this.state.currentChannel && this.state.currentChannelID && this.state.usersPresence ?
							<div className={merge(
								'w-[96%] absolute left-1/2 -translate-x-1/2',
								'bottom-2'
							)} ref={this.messageBarRef}>
								<div className={merge(
									'flex flex-col w-full',
									'rounded-2xl h-max mb-2 items-center justify-center relative'
								)}>
									<Button className={merge(
										'bg-neutral-900/80 min-w-max w-max border border-neutral-800 backdrop-blur-lg rounded-2xl select-none',
										'text-neutral-300 inline-flex gap-2 items-center justify-center',
										'absolute left-1/2 -translate-x-1/2 bottom-16 transition-all duration-300 ease-in-out hover:bg-neutral-500/80',
										this.state.isSeeingOldMessages ? 'opacity-100 pointer-events-auto translate-y-0' :
																		'opacity-0 pointer-events-none translate-y-8'
									)} onClick={() => {
										const el = this.containerRef.current;
										if (!el) return;

										el.scrollTo({
											top: el.scrollHeight,
											behavior: 'smooth',
										});
									}}>
										<p>Jump to new messages</p>
										<ArrowDown size={16}/>
									</Button>
									{/* Auto-complete Smartbar */}
									<AutocompleteBox visible={this.state.autocompleteBarVisible}>
										{sorted.map((info, idx) => (
											<Entry
												key={`entry-${info.match_type}-${idx}`}
												info={info}
												idx={idx}
												isSelected={idx === infoIndex}
												onClick={() => this.insertAutocompleteResult(idx)}
											/>
										))}
									</AutocompleteBox>
									<div className={merge(
										'rounded-t-2xl h-max p-3 pt-2 pb-6 w-full transition-all duration-300 ease-in-out',
										'bg-neutral-900/80 placeholder:text-white/70 text-white backdrop-blur-sm',
										replyingMessage ? 'translate-y-3 opacity-100 pointer-events-auto h-max flex flex-col' :
										'translate-y-20 opacity-0 pointer-events-none hidden'
									)}>
										<span className='inline-flex justify-between w-full items-center'>
											<span className='inline-flex items-center gap-1 select-none'>
												<p className='text-sm'>Replying to</p>
												<ChevronRight size={12} className='mx-0.5 text-neutral-400'/>
												<span className='inline-flex items-center gap-1 p-1 px-1.5 rounded-xl bg-neutral-700'>
													<img src={replyingMessage?.author_pfp} className='w-5 h-5 text-sm rounded-full'/>
													<p className='ml-1 select-none text-sm truncate'>{replyingMessage?.author_displayname}</p>
												</span>
											</span>
											<Button
												onClick={() => {
													this.setTypedState('replyingToMessageIndex', null);
													this.setTypedState('replyingToMessage', null);
												}}
												className={merge(
													'px-0.5 py-0.5 w-6 h-6 transition-all rounded-2xl bg-neutral-800',
													'hover:bg-neutral-600 hover:text-neutral-300'
												)}
											>
												<X className='min-w-[14px] min-h-[14px]' size={14} />
											</Button>
										</span>
										<div className='select-none'>
											{replyingMessage?.contents.map((rawContent, i) => {
													const onlyEmojis = isOnlyEmojis(rawContent);
													const parts: (ReactNode | string)[] = [];

													const pattern = /<(@&|@|#)(\d+)>|<a?:([a-zA-Z0-9_]+):(\d+)>/g;
													let lastIndex = 0;
													let match;

													while ((match = pattern.exec(rawContent)) !== null) {
														const [fullMatch, mentionType, mentionId, emojiName, emojiId] = match;
														const before = rawContent.slice(lastIndex, match.index);
														if (before) parts.push(before);

														if (mentionType && mentionId) {
															if (mentionType === '@') {
																const found = this.state.usersPresence?.find(m => m.user.id === mentionId);
																parts.push(
																	<p
																		onClick={() => navigator.clipboard.writeText(`<@${found?.user.id || 'unknown-user'}>`)}
																		key={`${i}-mention-${match.index}`}
																		className='px-1 py-[1px] select-none transition-all hover:bg-blue-700 cursor-pointer rounded-xl bg-blue-600 text-blue-200 inline-flex'
																	>
																		@{found ? (found.user.display_name || found.user.username) : 'unknown-user'}
																	</p>
																);
															} else if (mentionType === '@&') {
																const found = this.state.guildRoles?.find(r => r.id == mentionId);
																parts.push(
																	<p
																		onClick={() => navigator.clipboard.writeText(`<@&${found?.id || 'unknown-role'}>`)}
																		key={`${i}-mention-role-${match.index}`}
																		className={merge(
																			'px-1 py-[1px] select-none transition-all hover:bg-blue-700 cursor-pointer rounded-xl inline-flex items-center gap-1',
																			found?.color ? 'border-2 border-transparent hover:border-neutral-500' : 'bg-blue-600 text-blue-200'
																		)}
																		style={found?.color ? {
																			backgroundColor: `${found.color}66`,
																			color: getContrastColor(found.color)
																		} : {}}
																	>
																		{found ? found.icon.length > 1 ?
																			<img className='w-5 h-5' src={found.icon}/>	: '@'
																			: '@'
																		}
																		{found ? found.name : 'unknown-role'}
																	</p>
																);
															} else if (mentionType === '#') {
																const found = this.state.guild?.channels ? find_in_nested_channels(this.state.guild?.channels, mentionId) : false;
																parts.push(
																	<p
																		onClick={() => found && this.getChannelMessages(found.name, found.id)}
																		key={`${i}-channel-${match.index}`}
																		className='p-1 py-0.5 select-none hover:bg-neutral-800 hover:text-neutral-300 transition-all cursor-pointer rounded-xl bg-fuchsia-600 text-neutral-900 inline-flex'
																	>
																		#{found ? found.name : 'unknown-channel'}
																	</p>
																);
															}
														} else if (emojiName && emojiId) {
															const isAnimated = fullMatch.startsWith('<a:');
															parts.push(
																<img
																	key={`emoji-${i}-${match.index}`}
																	src={`https://cdn.discordapp.com/emojis/${emojiId}.${isAnimated ? 'gif' : 'webp'}`}
																	alt={emojiName}
																	title={emojiName}
																	className={merge(
																		"inline-flex self-center",
																		onlyEmojis ? "min-w-10 min-h-10 max-h-10 max-w-10 rounded-lg" : "min-w-6 max-w-6 min-h-6 max-h-6 rounded-sm"
																	)}
																/>
															);
														}

														lastIndex = match.index + fullMatch.length;
													}

													if (lastIndex < rawContent.length) {
														parts.push(rawContent.slice(lastIndex));
													}

													// markdown-style formatting
													const formatted = parts.map((chunk, idx) => {
														if (typeof chunk !== 'string') return chunk;

														// multiline code block
														if (chunk.startsWith("```") && chunk.endsWith("```")) {
															return (
																<pre key={idx} className='font-ubuntu-mono bg-neutral-900 rounded p-2 text-sm w-full whitespace-pre-wrap'>
																	{chunk.slice(3, -3)}
																</pre>
															);
														}

														// blockquote
														if (/^>\s?/.test(chunk)) {
															return (
																<p key={idx} className='border-l-4 rounded-l-2xl border-l-neutral-600 pl-2'>
																	{chunk.replace(/^>\s?/, '')}
																</p>
															);
														}

														// headings
														if (/^-#\s+/.test(chunk)) return <p key={idx} className='text-xs font-medium text-neutral-500'>{chunk.replace(/^-#\s+/, '')}</p>;
														if (/^###\s+/.test(chunk)) return <p key={idx} className='text-base font-medium'>{chunk.replace(/^###\s+/, '')}</p>;
														if (/^##\s+/.test(chunk)) return <p key={idx} className='text-lg font-medium'>{chunk.replace(/^##\s+/, '')}</p>;
														if (/^#\s+/.test(chunk)) return <p key={idx} className='text-xl font-medium'>{chunk.replace(/^#\s+/, '')}</p>;

														// inline formatting
														const inline = chunk
															.replace(/``(.*?)``/g, (_, m) => `<code2>${m}</code2>`)
															.replace(/`(.*?)`/g, (_, m) => `<code1>${m}</code1>`)
															.replace(/\*\*\*(.*?)\*\*\*/g, (_, m) => `<bi>${m}</bi>`)
															.replace(/\*\*(.*?)\*\*/g, (_, m) => `<b>${m}</b>`)
															.replace(/\*(.*?)\*/g, (_, m) => `<i>${m}</i>`)
															.replace(/~~(.*?)~~/g, (_, m) => `<s>${m}</s>`)
															.replace(/__(.*?)__/g, (_, m) => `<u>${m}</u>`)
															.replace(/_(.*?)_/g, (_, m) => `<i>${m}</i>`);

														const html = inline
															.replace(/<code2>(.*?)<\/code2>/g, (_, m) => `<span class="font-ubuntu-mono bg-neutral-900 px-1 py-0.5 rounded">${m}</span>`)
															.replace(/<code1>(.*?)<\/code1>/g, (_, m) => `<span class="font-ubuntu-mono bg-neutral-900 px-1 py-0.5 rounded">${m}</span>`)
															.replace(/<bi>(.*?)<\/bi>/g, (_, m) => `<b><i>${m}</i></b>`)
															.replace(/<b>(.*?)<\/b>/g, (_, m) => `<b>${m}</b>`)
															.replace(/<i>(.*?)<\/i>/g, (_, m) => `<i>${m}</i>`)
															.replace(/<s>(.*?)<\/s>/g, (_, m) => `<s>${m}</s>`)
															.replace(/<u>(.*?)<\/u>/g, (_, m) => `<u>${m}</u>`)
															.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, text, url) =>
																`<a href="${url}" target="_blank" rel="noopener noreferrer" class="hover:underline transition-all text-blue-600 hover:text-blue-700">${text}</a>`
															);

														return <span key={idx} dangerouslySetInnerHTML={{ __html: html }} />;
													});

													return (
														<p
															key={i}
															className='flex flex-wrap items-center gap-1'
															style={{ whiteSpace: 'pre-wrap' }}
														>
															{formatted}
														</p>
													);
												})}
										</div>
									</div>
									<div className={merge(
										'rounded-2xl h-max max-h-[44vh] p-4 justify-self-end absolute right-0 bottom-10 w-[60%] transition-[transform,opacity,height] duration-300 ease-in-out',
										'bg-neutral-900/80 placeholder:text-white/70 text-white backdrop-blur-sm flex flex-col h-max',
										this.state.emojiBarVisible ? '-translate-y-3 opacity-100 pointer-events-auto' :
										'translate-y-8 opacity-0 pointer-events-none'
									)}>
										<p className='select-none text-neutral-300 mb-0.5'>Guild Emojis</p>
										<div className='flex flex-wrap gap-2 overflow-y-auto'>
											{Object.entries(groupedEmojis).sort().map(([letter, emojis]) => (
												<div key={letter} className='mb-3'>
													<p className='select-none text-neutral-500 font-medium uppercase text-sm mb-1'>{letter}</p>
													<div className='flex flex-wrap gap-2'>
														{emojis?.map((emoji, idx) => (
															<span
																key={`${letter}-${idx}`}
																className={merge(
																	'w-11 h-11 rounded-md select-none cursor-pointer p-1',
																	'hover:bg-neutral-700 transition-all inline-flex justify-center items-center'
																)}
																onClick={(e) => {
																	if (!e.shiftKey) this.ToggleEmojiBar();

																	const mir = this.messageInputRef?.current;
																	if (mir?.InputRef.current) {
																		// directly append emoji to DOM value
																		mir.InputRef.current.value += `<${emoji.animated ? 'a' : ''}:${emoji.name}:${emoji.id}> `;
																		this.messageContent = mir.InputRef.current.value;
																		mir?.InputRef.current.focus();
																	}
																}}
															>
																<img
																	src={emoji.src || `https://cdn.discordapp.com/emojis/${emoji.id}.${emoji.animated ? 'gif' : 'webp'}`}
																	alt={emoji.name}
																	title={emoji.name}
																	className="w-full h-full"
																/>
															</span>
														))}
													</div>
												</div>
											))}
										</div>
									</div>
									<Input
										ref={this.messageInputRef}
										placeholder={`Message #${this.state.currentChannel}`}
										className={merge(
											'rounded-2xl w-full min-h-12 h-36 placeholder:text-white/70 text-white',
											replyingMessage ? 'bg-neutral-900' : 'bg-neutral-900/80 backdrop-blur-sm'
										)}
										onChange={(event) => {
											this.messageContent = event.currentTarget.value;
											this.debounceChangeEvent(event);
										}}
										onKeyDown={(kbd) => {
											const key = kbd.key.toLowerCase();
											const keys = ['tab', 'arrowup', 'escape', 'arrowdown'];
											if (!keys.includes(key)) return;
											if (!this.state.autocompleteBarVisible) return;
											kbd.preventDefault();
										}}
										onKeyUp={(kbd) => {
											const acceptAutoComplete = (index: number) => {
												const list = this.state.autocompleteInfo;
												const match = list?.[index];
												if (!match) return false;

												const mir = this.messageInputRef?.current;
												const input = mir?.InputRef.current;
												if (!input) return false;

												if (match.part)
													input.value = input.value.replace(match.part, '');
												input.value += match.result + ' ';
												this.messageContent = input.value;
												input.focus();

												this.setTypedState('autocompleteInfo', null);
												this.setTypedState('currentAutocompleteIndex', null);
												this.setTypedState('currentHighestScore', null);
												this.setTypedState('autocompleteBarVisible', false);
												return true;
											}

											switch (kbd.key.toLowerCase()) {
												case 'enter': {
													const index = this.state.currentAutocompleteIndex ?? 0;
													const success = acceptAutoComplete(index);
													if (!success) this.SendMessageCheckReply();
													break;
												}

																							
												case 'tab': {
													const index = this.state.currentAutocompleteIndex ?? 0;
													const success = acceptAutoComplete(index);
													if (!success) kbd.preventDefault();
													break;
												}

												case 'arrowup': {
													kbd.preventDefault();
													const list = this.state.autocompleteInfo;
													if (!list?.length || !this.state.autocompleteBarVisible) return;

													const index = this.state.currentAutocompleteIndex ?? 0;
													const prevIndex = index > 0 ? index - 1 : list.length - 1;
													this.setTypedState('currentAutocompleteIndex', prevIndex);
													this.setTypedState('currentHighestScore', list[prevIndex].score || 0);
													break;
												}

												case 'arrowdown': {
													kbd.preventDefault();
													const list = this.state.autocompleteInfo;
													if (!list?.length || !this.state.autocompleteBarVisible) return;

													const index = this.state.currentAutocompleteIndex ?? -1;
													const nextIndex = index < list.length - 1 ? index + 1 : 0;
													this.setTypedState('currentAutocompleteIndex', nextIndex);
													this.setTypedState('currentHighestScore', list[nextIndex].score || 0);
													break;
												}

												case 'escape': {
													this.setTypedState('currentAutocompleteIndex', null);
													this.setTypedState('currentHighestScore', null);
													this.setTypedState('autocompleteBarVisible', false);
													this.setTypedState('autocompleteInfo', null);
													break;
												}

												default:
													break;
											}
										}}
										endContent={<span className='inline-flex items-center gap-2'>
											<Button onClick={() => {
												this.ToggleEmojiBar();
											}} className={merge(
												'bg-transparent hover:bg-neutral-800 hover:text-neutral-200 transition-all rounded-2xl inline-flex justify-center items-center p-2'
											)}>
												<Heart size={16}/>
											</Button>
											<Button onClick={() => {
												this.SendMessageCheckReply();
											}} className={merge(
												'bg-transparent hover:bg-neutral-800 hover:text-neutral-200 transition-all rounded-2xl inline-flex justify-center items-center p-2'
											)}>
												<Send size={16}/>
											</Button>
										</span>}
									/>
								</div>
							</div>
						: null
					}
				</div>

				{
					currentChannelID ?
						<UserListComponent
							channelId={currentChannelID}
							groupedUsers={users_grouped_by_role}
							sortedRoles={sorted_roles}
							setInputMention={(mention) => {
								const mir = this.messageInputRef?.current;
								if (mir && mir.InputRef.current) {
									mir.InputRef.current.value += mention;
									this.messageContent = mir.InputRef.current.value;
									mir.InputRef.current.focus();
								}
							}}
						/>
					: null
				}

				<MediaModal
					isVisible={this.state.mediaModal.visible}
					onClose={() => this.ToggleMediaModel(false, undefined)}
					mediaUrl={this.state.mediaModal.url ?? ''}
				/>
			</div>
		);
	}
};