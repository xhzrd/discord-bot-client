import { Button } from '@headlessui/react';
import { Component, type ReactNode } from 'react';
import { CornerDownRight, Link } from 'react-feather';
import type { AttachmentInfo, EmbedInfo, GuildFullInfo, MessageInfo, MessageReaction, RepliedMessageInfo, RoleInfo, UserPresence } from '../../util/api';
import { merge } from '../../util/class-merge';
import { Tooltip } from '../Tooltip/export';
import { find_in_nested_channels, format_discord_timestamp, getContrastColor, isOnlyEmojis, parseEmbedAttachments, parseEmbedField, parseRepliedContent } from './functions';

interface MessageProps {
	userId: string;
	authorId: string;
	authorProfilePicture: string;
	authorIsBot?: boolean;
	authorRelativeName: string;

	messageId: string;
	messageIndex: number;
	messageContents: string[];
	messageGuild: GuildFullInfo;
	messageGuildRoles?: RoleInfo[] | null;
	messageEdited?: {
		at: Date;
		state: boolean
	};
	messageTimestamp: Date;
	messageAttachments: AttachmentInfo[];
	messageHasEmbed?: boolean;
	messageEmbeds?: EmbedInfo[];
	messageReactions?: MessageReaction[];
	
	userPresences?: UserPresence[] | null;
	repliedToId?: RepliedMessageInfo | null;
	replyingToMessageId?: string | null;
	replyToMessageIndex?: number | null;
	groupedMessages?: MessageInfo[];
	glowingMessageId?: string | null;
	isGlowingRelevant?: boolean | null;

	maxWidthSpace: number;
	
	setInputMention: (content: string) => void;
	setGlowingMessage: (message_id: string | null) => void;
	setReplyingMessage: (
		message_id: string | null, 
		message_index: number | null
	) => void;
	setContainerRef: () => boolean;
	scrollContainerToEnd: () => void;
	onChannelClick: (channel_name: string, channel_id: string) => void;
	setMessageBarHeight: () => void | Promise<void>;
	reflectDOMReplyBarSize: () => void | Promise<void>;
	focusOnMessageInput: () => void | Promise<void>;
	onMediaClick: (media_url: string) => void | Promise<void>;

	messageRefs: Record<string, HTMLDivElement>;
}

export class MessageComponent extends Component<MessageProps> {
	constructor(props: MessageProps) {
		super(props);
	}

	debouncedGlowingMessageTimeout: number = 0;

	render() {
		return (
			<div ref={el => {
				if (!el) return;

				// always track the stacked message id
				this.props.messageRefs[this.props.messageId] = el;

				// now, also try to find actual messages in channelContent
				const grouped = this.props.groupedMessages;
				if (!grouped) return;

				for (const m of grouped) {
					this.props.messageRefs[m.message_id] = el;
				}
			}} className={merge(
				this.props.repliedToId ? null : 'p-2',
				'border-y-2 border-transparent animate-fade-in h-max',
				'px-4 flex flex-col relative gap-0 group transition-all hover:bg-neutral-700 w-full flex-1',
					this.props.glowingMessageId === this.props.messageId ||
					this.props.isGlowingRelevant
				? 'bg-neutral-900 border-y-neutral-600' : null,
				this.props.repliedToId?.author_id == this.props.userId || 
				this.props.messageContents?.some?.(c => c.includes(`<@${this.props.userId}>`)) ?
					'bg-neutral-900 border-l-4 border-l-blue-600 hover:border-l-neutral-600' : null
			)}>
				{
					this.props.repliedToId ?
					<span style={{
						minWidth: 0,
						maxWidth: this.props.maxWidthSpace + 'px'
					}} className='inline-flex gap-2 items-start p-2 translate-x-2.5 translate-y-2.5 h-max'>
						<div className='w-7 h-8 rounded-tl-xl border-t-4 border-l-4 border-neutral-600'></div>
						<span className='flex items-center gap-2 flex-1 overflow-hidden relative h-max -translate-y-[13px] -translate-x-2'>
							<span className='inline-flex items-center gap-1 p-1 px-1.5 rounded-xl bg-neutral-600 min-w-max w-max'>
								<img src={this.props.repliedToId?.pfp} className='w-5 h-5 text-sm rounded-full'/>
								<p className='ml-1 select-none text-sm truncate max-w-[10rem]'>{this.props.repliedToId?.displayname}</p>
							</span> 
							<span onClick={() => {
								if (this.props.repliedToId?.message_id)
								{
									const target = this.props.messageRefs[this.props.repliedToId?.message_id];
									if (target) {
										target.scrollIntoView({ behavior: 'smooth', block: 'center' });
									}

									this.props.setGlowingMessage(this.props.repliedToId.message_id);
									clearTimeout(this.debouncedGlowingMessageTimeout);
									this.debouncedGlowingMessageTimeout = setTimeout(() => {
										this.props.setGlowingMessage(null);
									}, 2024);
								}
							}} className='select-none truncate relative h-full overflow-hidden max-h-full rounded-2xl transition-all hover:bg-neutral-800 px-2 py-0.5 -translate-x-1 cursor-pointer inline-flex items-center gap-1'>
								{this.props.messageGuild && (
									parseRepliedContent(this.props.repliedToId.content, this.props.messageGuild).length > 0 ? 
									parseRepliedContent(this.props.repliedToId.content, this.props.messageGuild, this.props.messageGuildRoles || undefined, this.props.userPresences || undefined) :
									'An attachment.'
								)}
							</span>
						</span>
					</span> : null
				}
				<span className={merge(
					'inline-flex gap-3 items-start relative',
					this.props.repliedToId ? '-translate-y-2' : 'pt-1'
				)}>
					<img src={this.props.authorProfilePicture} className='w-10 h-10 rounded-full' />
					<div className='w-full flex-1 flex flex-col gap-0 max-w-full' style={{
						minWidth: 0,
						maxWidth: (this.props.maxWidthSpace - 100) + 'px'
					}}>
						<div className='inline-flex gap-1 items-center self-start'>
							<p onClick={() => {
								this.props.setInputMention(`<@${this.props.authorId}> `);
							}} className='select-none hover:underline transition-all cursor-pointer'>{this.props.authorRelativeName}</p>
							{
								this.props.authorIsBot ?
									<p className='px-1 mx-0.5 py-0 rounded-md select-none bg-neutral-400 text-neutral-900 font-ubuntu-mono text-sm'>BOT</p>
								: null
							}
							{
								this.props.messageEdited && (() => {
									const d = typeof this.props.messageEdited?.at == 'string' ? new Date(this.props.messageEdited?.at) : this.props.messageEdited?.at;
									return d && d.getFullYear() > 1971;
								})() ? (
									<p className='inline-flex gap-1 items-center opacity-50 text-sm cursor-default'>
										<p className='font-medium'>Edited</p>{' '}{format_discord_timestamp(this.props.messageEdited.at)}
									</p>
								) : <p className='opacity-50 text-sm cursor-default'>{format_discord_timestamp(this.props.messageTimestamp)}</p>
							}
						</div>
						{this.props.messageContents.map((rawContent, i) => {
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
										const found = this.props.userPresences?.find(m => m.user.id === mentionId);
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
										const found = this.props.messageGuildRoles?.find(r => r.id == mentionId);
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
										const found = this.props.messageGuild?.channels ? find_in_nested_channels(this.props.messageGuild?.channels, mentionId) : false;
										parts.push(
											<p
												onClick={() => found ? this.props.onChannelClick?.(found.name, found.id) : null}
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

								if (chunk.startsWith("```") && chunk.endsWith("```")) {
									return (
										<pre key={idx} className='font-ubuntu-mono bg-neutral-900 rounded-2xl transition-all duration-500 ease-in-out hover:bg-neutral-950 p-2 text-sm w-full whitespace-pre-wrap mb-1'>
											{chunk.trim().slice(4, -3)}
										</pre>
									);
								}

								if (/^> /.test(chunk)) {
									return (
										<div key={`${idx}-bq-line-${i}`} className='flex gap-2 items-start'>
											<div className="bg-neutral-600 rounded-md h-full w-[4px] min-h-[24px]"></div>
											<p className='whitespace-pre-wrap'>
												{chunk.replace(/^> /, '')}
											</p>
										</div>
									);
								}

								if (/^-#\s+/.test(chunk)) return <p key={idx} className='text-xs font-medium text-neutral-500'>{chunk.replace(/^-#\s+/, '')}</p>;
								if (/^###\s+/.test(chunk)) return <p key={idx} className='text-base font-medium'>{chunk.replace(/^###\s+/, '')}</p>;
								if (/^##\s+/.test(chunk)) return <p key={idx} className='text-lg font-medium'>{chunk.replace(/^##\s+/, '')}</p>;
								if (/^#\s+/.test(chunk)) return <p key={idx} className='text-xl font-medium'>{chunk.replace(/^#\s+/, '')}</p>;

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

								const forceBreak = chunk.length > 80 && !chunk.includes(' ');

								return (
									<span
										key={idx}
										className={merge(
											'whitespace-pre-wrap break-words max-w-full',
											forceBreak ? 'break-all w-full' : ''
										)}
										dangerouslySetInnerHTML={{ __html: html }}
									/>
								);
							});

							return (
								<span
									key={`formatted-content-${i}`}
									className="inline-flex flex-wrap items-center gap-1 max-w-full whitespace-pre-wrap break-words"
								>
									{formatted}
								</span>
							);
						})}
						{this.props.messageAttachments?.length > 0 && (() => {
							const count = this.props.messageAttachments.length;

							const containerClass =
								count === 1
								? 'w-[40%]'
								: count === 2
									? 'w-[40%] h-64 grid grid-cols-2 gap-1'
									: 'grid grid-cols-3 auto-rows-auto max-w-[50%]';

							return (
								<div className={`mt-2 bg-neutral-900 rounded-2xl overflow-hidden ${containerClass}`}>
								{this.props.messageAttachments.map((att, i) => {
									const clean_url = att.url.split('?')[0];
									const isImage = /\.(png|jpe?g|gif|webp)$/i.test(clean_url);
									const isVideo = /\.(mp4|mov|mkv|webm)$/i.test(clean_url);
									const isAudio = /\.(ogg|mp3)$/i.test(clean_url);

									const total = this.props.messageAttachments.length;
									const remainder = total % 3;
									const isInLastRow = i >= total - remainder;

									let colSpanClass = '';
									if (count >= 3 && remainder !== 0 && isInLastRow) {
										colSpanClass = `col-span-${remainder}`;
									}

									const cellClass = `w-full h-full overflow-hidden object-cover cursor-pointer ${colSpanClass}`;

									if (isImage) {
										return (
											<div onClick={() => this.props.onMediaClick(att.url)} key={`att-image-${i}`} className={cellClass}>
											<img
												src={att.url}
												alt={att.name}
												className='aspect-square object-cover w-full h-full'
											/>
											</div>
										);
									} else if (isVideo) {
										return (
											<div onClick={() => {
												if (count > 1)
													this.props.onMediaClick(att.url)
											}} key={`att-video-${i}`} className={merge(
												cellClass.replace('cursor-pointer ', ''),
												count > 1 ? 'cursor-pointer' : null
											)}>
											<video
												src={att.url}
												className={merge(
													'aspect-square object-cover w-full h-full',
													count > 1 ? 'pointer-events-none' : null
												)}
											/>
											</div>
										);
									} else if (isAudio) {
										return (
											<div key={`att-audio-${i}`} className={cellClass}>
												<audio
													src={att.url}
													controls
													className='w-full'
												/>
											</div>
										);
									} else {
										return (
											<div key={`att-file-${i}`} className='px-3 py-1 col-span-3'>
												<a
													href={att.url}
													download
													className='text-neutral-300 inline-flex items-center gap-1 hover:text-blue-500 font-medium text-sm'
												>
													<Link size={16}/>
													{att.name}
												</a>
											</div>
										);
									}
								})}
								</div>
							);
						})()}
						{
							this.props.messageHasEmbed ? this.props.messageEmbeds?.map((embed, idx) => (embed.title || embed.description || embed.footer) && (
								<div className={merge(
									'flex flex-col w-max flex-1 px-4 py-3 rounded-2xl transition-all gap-0 text-neutral-200 mb-1',
									this.props.repliedToId?.author_id == this.props.userId || 
									this.props.messageContents?.some?.(c => c.includes(`<@${this.props.userId}>`)) ? 'bg-neutral-800 hover:bg-neutral-900' : 
									'bg-neutral-950 border-2 border-transparent hover:border-neutral-800',
									embed.color ? 'border-l-4' : null
								)} style={embed.color ? {
									borderLeftColor: `#${embed.color.toString(16).padStart(6, '0')}`,
									minWidth: 0,
									maxWidth: (this.props.maxWidthSpace - 260) + 'px'
								} : {
									minWidth: 0,
									maxWidth: (this.props.maxWidthSpace - 260) + 'px'
								}} key={`message-embed-${idx}`}>
									{
										embed.title || embed.description || embed.fields.length > 0 ?
										<div className='flex flex-col gap-0 cursor-default w-max flex-1 max-w-full mb-1.5' style={{ whiteSpace: 'pre-wrap' }}>
											{
												embed.title ?
												<span>{this.props.messageGuild && (
													parseEmbedField(embed.title, this.props.messageGuild).length > 0 ? 
													parseEmbedField(embed.title, this.props.messageGuild, this.props.messageGuildRoles || undefined, this.props.userPresences || undefined) :
													embed.title
												)}</span> : null
											}
											{
												embed.description ? 
												<div className={merge(
													'whitespace-pre-wrap w-max max-w-full inline',
												)}>
													{parseEmbedField(
														embed.description,
														this.props.messageGuild,
														this.props.messageGuildRoles || undefined,
														this.props.userPresences || undefined,
														embed
													)}
												</div> :
												null
											}
										</div> : null
									}
									{
										(embed.image || embed.video) && parseEmbedAttachments(embed).length > 0 ?
										<div className='flex flex-col gap-0 w-max max-w-full'>
											{
												parseEmbedAttachments(embed, this.props.onMediaClick)
											}
										</div> : null
									}
									{
										embed.fields ?
										<div className='flex flex-col gap-0 whitespace-pre-wrap w-max flex-1 max-w-full'>
											{
												embed.fields.map((field, idx_f) => {
													return (
														<div className={merge(
															field.inline ? 'inline-flex gap-1 items-center w-full' : 'flex flex-col gap-0'
														)} key={`embed-field-${idx}-${idx_f}`} style={{ whiteSpace: 'pre-wrap' }}>
															<p className='font-medium text-neutral-200'>{this.props.messageGuild && (
																parseEmbedField(field.name.trim(), this.props.messageGuild).length > 0 ?
																parseEmbedField(field.name.trim(), this.props.messageGuild, this.props.messageGuildRoles || undefined, this.props.userPresences || undefined) :
																field.name
															)}</p>
															{this.props.messageGuild && (
																parseEmbedField(field.value.trim(), this.props.messageGuild).length > 0 ? 
																parseEmbedField(field.value.trim(), this.props.messageGuild, this.props.messageGuildRoles || undefined, this.props.userPresences || undefined) :
																field.value
															)}
														</div>
													)
												})
											}
										</div>
										: null
									}
									{
										embed.footer ?
										<span className='inline-flex items-center gap-1 w-max flex-1 max-w-full'>
											<p className='text-neutral-500 text-sm/5'>{this.props.messageGuild && (
												parseEmbedField(embed.footer, this.props.messageGuild).length > 0 ? 
												parseEmbedField(embed.footer, this.props.messageGuild, this.props.messageGuildRoles || undefined, this.props.userPresences || undefined) :
												embed.footer
											)}</p>
										</span>
										: null
									}
								</div>
							)) : null
						}
						{
							this.props.messageReactions &&
							this.props.messageReactions.length > 0 && (
								<div
									className='flex flex-wrap gap-2 items-center mt-1.5 min-h-max'
									style={{ maxWidth: `${this.props.maxWidthSpace - 100}px` }}
								>
									{this.props.messageReactions.map((reaction, idx) => {
										const emoji_url = reaction.emoji.id
											? `https://cdn.discordapp.com/emojis/${reaction.emoji.id}${reaction.emoji.animated ? '.gif' : '.png'}`
											: null;

										const max_display = 5;
										const user_names = reaction.users.map(u => u.displayname);
										const shown_names = user_names.slice(0, max_display);
										const hidden_count = user_names.length - max_display;
										const emoji_name = /^[\w]+$/.test(reaction.emoji.name) ? `:${reaction.emoji.name}:` : reaction.emoji.name;

										const tooltip_text =
											user_names.length > max_display
												? `${shown_names.join(', ')}, and ${hidden_count} more reacted with ${emoji_name}`
												: `${shown_names.join(', ')} reacted with ${emoji_name}`;

										return (
											<Tooltip
												key={`${idx}-tooltip-${this.props.messageId}`}
												label={tooltip_text}
												align='top'
												distance={6}
												interactive
											>
												<span
													key={`${idx}-${this.props.messageId}`}
													className={merge(
														'p-1 px-2.5 pr-3.5 h-7 min-w-12 rounded-xl gap-1 inline-flex justify-center items-center',
														'transition-all',
														this.props.repliedToId?.author_id == this.props.userId || 
														this.props.messageContents?.some?.(c => c.includes(`<@${this.props.userId}>`)) ? 'bg-neutral-800 hover:bg-neutral-900' : 
														'bg-neutral-950 border-2 border-transparent hover:border-neutral-800',
														'select-none cursor-pointer',
														reaction.users.find(e => e.id == this.props.userId) ? 'bg-blue-600 border-2 border-blue-700' : null
													)}
												>
													{emoji_url ? (
														<img src={emoji_url} className='min-w-4 max-w-4 min-h-4 max-h-4' />
													) : (
														<span className='text-base'>{reaction.emoji.name}</span>
													)}
													<p className='text-white/90 text-sm'>{reaction.amount}</p>
												</span>
											</Tooltip>
										);
									})}
								</div>
							)
						}
					</div>
					<Button
						onClick={async () => {
							// wait until the next frame where DOM reflects new reply bar
							this.props.reflectDOMReplyBarSize();

							const isSame = this.props.replyingToMessageId === this.props.messageId;

							if (isSame) {
								this.props.setReplyingMessage(null, null);
								await this.props.reflectDOMReplyBarSize();
								return;
							}

							this.props.setReplyingMessage(this.props.messageId, this.props.messageIndex);
							await this.props.reflectDOMReplyBarSize();

							requestAnimationFrame(() => {
								requestAnimationFrame(async () => {
									const target = this.props.messageRefs[this.props.messageId];
									if (target) {
										this.props.setContainerRef();
										if (this.props.messageIndex == this.props.replyToMessageIndex) {
											await this.props.setMessageBarHeight();
											requestAnimationFrame(() => {
												this.props.setMessageBarHeight();
												setTimeout(() => {
													this.props.scrollContainerToEnd();
												}, 64);
											});
										} else
											target.scrollIntoView({
												behavior: 'smooth',
												block: 'center',
											});
									}

									this.props.focusOnMessageInput();
								})
							})

							this.props.focusOnMessageInput();
						}}
						className={merge(
							'absolute right-0 top-0 p-3 py-1.5 text-sm inline-flex justify-center text-neutral-300 items-center gap-1 transition-all rounded-2xl',
							this.props.replyingToMessageId == this.props.messageId ? 
								'bg-neutral-700' :
								'opacity-0 group-hover:opacity-100 hover:bg-neutral-800 bg-neutral-900'
						)}
					>
						<CornerDownRight size={14} />
						<p>{this.props.replyingToMessageId == this.props.messageId ? 'Replying' : 'Reply'}</p>
					</Button>
				</span>
			</div>
		)
	}
};