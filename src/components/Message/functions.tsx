import type { ReactNode } from "react";
import type { EmbedInfo, GuildFullInfo, RoleInfo, UserPresence } from "../../util/api";
import { merge } from "../../util/class-merge";
import { EmbedImage } from "../EmbedImage/export";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

function getContrastColor(hex: string): string {
	const r = parseInt(hex.slice(1, 3), 16);
	const g = parseInt(hex.slice(3, 5), 16);
	const b = parseInt(hex.slice(5, 7), 16);

	// Calculate luminance
	const luminance = 0.299 * r + 0.587 * g + 0.114 * b;

	return luminance > 186 ? "#000000" : "#ffffff";
}

function parseRepliedContent(rawContent: string, guild: GuildFullInfo | null, guildRoles?: RoleInfo[], usersPresence?: UserPresence[]): ReactNode[] {
	const parts: (ReactNode | string)[] = [];

	const mentionRegex = /<(@&|@|#)(\d+)>/g;
	let lastIndex = 0;
	let match;

	while ((match = mentionRegex.exec(rawContent)) !== null) {
		const [fullMatch, type, id] = match;
		const before = rawContent.slice(lastIndex, match.index);
		if (before) parts.push(before);

		if (type === '@') {
			const found = usersPresence?.find(m => m.user.id === id);
			parts.push(
				<p
					onClick={() => navigator.clipboard.writeText(`<@${found?.user.id || 'unknown-user'}>`)}
					className='px-1 py-[1px] select-none transition-all hover:bg-blue-700 cursor-pointer rounded-xl bg-blue-600 text-blue-200 inline-flex'
				>
					@{found ? (found.user.display_name || found.user.username) : 'unknown-user'}
				</p>
			);
		} else if (type === '@&') {
			const found = guildRoles?.find(r => r.id == id);
			parts.push(
				<p
					onClick={() => navigator.clipboard.writeText(`<@&${found?.id || 'unknown-user'}>`)}
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
		} else if (type === '#') {
			const found = guild?.channels.find(c => c.id === id);
			parts.push(
				<p
					key={`channel-${match.index}`}
					className='p-1 py-0.5 my-[1px] select-none hover:bg-neutral-800 hover:text-neutral-300 transition-all cursor-pointer rounded-xl bg-fuchsia-600 text-neutral-900 inline-flex'
				>
					#{found ? found.name : 'unknown-channel'}
				</p>
			);
		}

		lastIndex = match.index + fullMatch.length;
	}

	const remaining = rawContent.slice(lastIndex);
	const emojiRegex = /<a?:([a-zA-Z0-9_]+):(\d+)>/g;
	let emojiLastIndex = 0;
	let emojiMatch;

	while ((emojiMatch = emojiRegex.exec(remaining)) !== null) {
		const [full, name, id] = emojiMatch;
		const before = remaining.slice(emojiLastIndex, emojiMatch.index);
		if (before) parts.push(before);

		const isAnimated = full.startsWith('<a:');
		parts.push(
			<img
				src={`https://cdn.discordapp.com/emojis/${id}.${isAnimated ? 'gif' : 'webp'}`}
				alt={name}
				title={name}
				className={merge(
					"inline-flex self-center",
					"min-w-6 max-w-6 min-h-6 max-h-6 rounded-sm"
				)}
			/>
		);

		emojiLastIndex = emojiMatch.index + full.length;
	}
	if (emojiLastIndex < remaining.length) {
		parts.push(remaining.slice(emojiLastIndex));
	}


	// markdown-style formatting pass
	return parts.map((chunk, idx) => {
		if (typeof chunk !== 'string') return chunk;

		if (chunk.startsWith("```") && chunk.endsWith("```")) {
			return (
				<span key={idx} className='font-ubuntu-mono bg-neutral-900 rounded p-2 text-sm inline-flex truncate gap-1 items-center w-full max-h-[28px]'>
					{chunk.slice(3, -3)}
				</span>
			);
		}

		if (/^> /.test(chunk)) {
			return (
				<div className='flex gap-2 items-start'>
					<div className="bg-neutral-600 rounded-md h-full w-[4px] min-h-[24px]"></div>
					<p className='whitespace-pre-wrap'>
						{chunk.replace(/^> /, '')}
					</p>
				</div>
			);
		}

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
			.replace(/<u>(.*?)<\/u>/g, (_, m) => `<u>${m}</u>`);

		return <span className='truncate max-w-full min-w-0' key={idx} dangerouslySetInnerHTML={{ __html: html }} />;
	});
}

function parseEmbedAttachments(
    embed: EmbedInfo,
    doFunc?: (media_url: string) => void | Promise<void>
) {
    const parts: (ReactNode | string)[] = [];

    if (embed?.image?.url) {
        parts.push(
            <EmbedImage
                onClick={() => embed.image?.url ? doFunc?.(embed.image.url!) : () => {}}
                key="embed-image"
                src={embed.image.url}
            />
        );
    }

    if (embed?.video?.url) {
        parts.push(
            <div key="embed-video"
				onClick={() => embed.image?.url ? doFunc?.(embed.image.url!) : () => {}}
				className="rounded-2xl w-[20rem] h-auto max-h-[20rem] cursor-pointer"
			>
                <video
                    src={embed.video.url}
                    className="w-auto h-auto pointer-events-none"
                />
            </div>
        );
    }

	return parts.map((chunk, idx) => {
		if (typeof chunk !== 'string') return chunk;

		const inline = chunk
			.replace(/``(.*?)``/g, (_, m) => `<code2>${m}</code2>`)
			.replace(/`(.*?)`/g, (_, m) => `<code1>${m}</code1>`)
			.replace(/\*\*\*(.*?)\*\*\*/g, (_, m) => `<bi>${m}</bi>`)
			.replace(/\*\*(.*?)\*\*/g, (_, m) => `<b>${m}</b>`)
			.replace(/\*(.*?)\*/g, (_, m) => `<i>${m}</i>`)
			.replace(/~~(.*?)~~/g, (_, m) => `<s>${m}</s>`)
			.replace(/__(.*?)__/g, (_, m) => `<u>${m}</u>`)
			.replace(/_(.*?)_/g, (_, m) => `<i>${m}</i>`);

		const allUrls: string[] = [];
		if (embed?.image?.url) allUrls.push(embed.image.url);
		if (embed?.video?.url) allUrls.push(embed.video.url);

		allUrls.forEach((url, i) => {
			if (url.match(/\.(png|jpe?g|webp|gif)(?:[?#][^\s]*)?$/i)) {
				parts.push(
					<div key={`embed-img-${i}`} className="flex flex-col w-[12rem] min-w-0 rounded-2xl overflow-hidden">
						<img src={url} className="rounded-2xl object-cover w-full h-auto" />
					</div>
				);
			}
		});

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
}

function parseMarkdownInline(str: string): string {
	str = str.trim().replace(/^> (.*)$/gm, (_, content) => {
		return `
		<div class='flex gap-2 items-start'>
			<div class="bg-neutral-600 rounded-md h-full w-[4px] min-h-[24px]"></div>
			<p class='whitespace-pre-wrap'>${content}</p>
		</div>`;
	});


    // escape raw HTML chars first
    str = str
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');

    // code blocks (inline) first — these shouldn't get further formatting
    str = str.replace(/``(.*?)``/g, (_, m) => `<code2>${m}</code2>`);
    str = str.replace(/`([^`]+?)`/g, (_, m) => `<code1>${m}</code1>`);

    // bold+italic (***text***)
    str = str.replace(/\*\*\*(.*?)\*\*\*/g, (_, m) => `<bi>${m}</bi>`);

    // bold (**text**)
    str = str.replace(/\*\*(.*?)\*\*/g, (_, m) => `<b>${m}</b>`);

    // italic (*text*)
    str = str.replace(/\*(.*?)\*/g, (_, m) => `<i>${m}</i>`);

    // underline (__text__)
    str = str.replace(/__(.*?)__/g, (_, m) => `<u>${m}</u>`);

    // italic (_text_)
    str = str.replace(/_(.*?)_/g, (_, m) => `<i>${m}</i>`);

    // strikethrough (~~text~~)
    str = str.replace(/~~(.*?)~~/g, (_, m) => `<s>${m}</s>`);

    // links [text](url)
	str = str.replace(/\[([^\]]+?)\]\((https?:\/\/[^\s()]+(?:\([^\s()]*\)[^\s()]*)*)\)/g, (_, text, url) => {
		return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="hover:underline transition-all text-blue-600 hover:text-blue-700">${text}</a>`;
	});

    // blockquote style `> text`
    str = str.replace(/^>\s?(.*)$/gm, (_, content) => {
        return `
        <div class='flex gap-2 items-start'>
            <div class="bg-neutral-600 rounded-md h-full w-[4px] min-h-[24px]"></div>
            <p class='whitespace-pre-wrap'>${content}</p>
        </div>`;
    });

    // final replacements for custom tags
    return str
        .replace(/<code2>(.*?)<\/code2>/g, (_, m) => `<span class="font-ubuntu-mono bg-neutral-900 px-1 py-0.5 rounded">${m}</span>`)
        .replace(/<code1>(.*?)<\/code1>/g, (_, m) => `<span class="font-ubuntu-mono bg-neutral-900 px-1 py-0.5 rounded">${m}</span>`)
        .replace(/<bi>(.*?)<\/bi>/g, (_, m) => `<b><i>${m}</i></b>`)
        .replace(/<b>(.*?)<\/b>/g, (_, m) => `<b>${m}</b>`)
        .replace(/<i>(.*?)<\/i>/g, (_, m) => `<i>${m}</i>`)
        .replace(/<s>(.*?)<\/s>/g, (_, m) => `<s>${m}</s>`)
        .replace(/<u>(.*?)<\/u>/g, (_, m) => `<u>${m}</u>`);
}

function parseEmbedField(rawContent: string, guild: GuildFullInfo | null, guildRoles?: RoleInfo[], usersPresence?: UserPresence[], embed?: EmbedInfo): ReactNode[] {
	const parts: (ReactNode | string)[] = [];

	const mentionRegex = /<(@&|@|#)(\d+)>/g;
	let lastIndex = 0;
	let match;

	while ((match = mentionRegex.exec(rawContent)) !== null) {
		const [fullMatch, type, id] = match;
		const before = rawContent.slice(lastIndex, match.index);
		if (before) parts.push(before);

		if (type === '@') {
			const found = usersPresence?.find(m => m.user.id === id);
			parts.push(
				<button
					onClick={() => navigator.clipboard.writeText(`<@${found?.user.id || 'unknown-user'}>`)}
					className='px-1 py-[1px] select-none transition-all hover:bg-blue-700 cursor-pointer rounded-xl bg-blue-600 text-blue-200 inline-flex'
				>
					@{found ? (found.user.display_name || found.user.username) : 'unknown-user'}
				</button>
			);
		} else if (type === '@&') {
			const found = guildRoles?.find(r => r.id == id);
			parts.push(
				<span
					onClick={() => navigator.clipboard.writeText(`<@&${found?.id || 'unknown-user'}>`)}
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
				</span>
			);
		} else if (type === '#') {
			const found = guild?.channels.find(c => c.id === id);
			parts.push(
				<span
					key={`channel-${match.index}`}
					className='p-1 py-0.5 my-[1px] select-none hover:bg-neutral-800 hover:text-neutral-300 transition-all cursor-pointer rounded-xl bg-fuchsia-600 text-neutral-900 inline-flex'
				>
					#{found ? found.name : 'unknown-channel'}
				</span>
			);
		}

		lastIndex = match.index + fullMatch.length;
	}

	if (lastIndex < rawContent.length) {
		parts.push(rawContent.slice(lastIndex));
	}

	// 🧩 now process parts for emojis and images
	const processedParts: (ReactNode | string)[] = [];
	for (const part of parts) {
		if (typeof part !== 'string') {
			processedParts.push(part);
			continue;
		}

		let lastEmojiIdx = 0;
		let match: RegExpExecArray | null;
		const emojiRegex = /<a?:([a-zA-Z0-9_]+):(\d+)>/g;

		while ((match = emojiRegex.exec(part)) !== null) {
			const [full, name, id] = match;
			const isAnimated = full.startsWith('<a:');

			const before = part.slice(lastEmojiIdx, match.index);
			if (before) processedParts.push(before);

			processedParts.push(
				<img
					key={`emoji-${match.index}-${id}`}
					src={`https://cdn.discordapp.com/emojis/${id}.${isAnimated ? 'gif' : 'webp'}`}
					alt={name}
					title={name}
					className={merge(
						"inline-flex self-center",
						"min-w-6 max-w-6 min-h-6 max-h-6 rounded-sm"
					)}
				/>
			);

			lastEmojiIdx = match.index + full.length;
		}

		if (lastEmojiIdx < part.length) {
			processedParts.push(part.slice(lastEmojiIdx));
		}
	}

	// markdown-style formatting pass
	return processedParts.map((chunk, idx) => {
		if (typeof chunk !== 'string') return chunk;

		// headings
		// if (/^-#\s+/.test(chunk)) return <p key={idx} className='text-xs font-medium text-neutral-500'>{chunk.replace(/^-#\s+/, '')}</p>;
		if (/^###\s+/.test(chunk)) {
			const content = chunk.replace(/^###\s+/, '');
			const parsed = parseMarkdownInline(content); // this should return a formatted HTML string
			return (
				<p
					key={idx}
					className='text-base font-medium'
					dangerouslySetInnerHTML={{ __html: parsed }}
				/>
			);
		}

		if (/^##\s+/.test(chunk)) {
			const content = chunk.replace(/^##\s+/, '');
			const parsed = parseMarkdownInline(content); // this should return a formatted HTML string
			return (
				<p
					key={idx}
					className='text-lg font-medium'
					dangerouslySetInnerHTML={{ __html: parsed }}
				/>
			);
		}


		if (/^#\s+/.test(chunk)) {
			const content = chunk.replace(/^#\s+/, '');
			const parsed = parseMarkdownInline(content); // this should return a formatted HTML string
			return (
				<p
					key={idx}
					className='text-xl font-medium'
					dangerouslySetInnerHTML={{ __html: parsed }}
				/>
			);
		}

		if (chunk.startsWith("```") && chunk.endsWith("```")) {
			return (
				<pre key={idx} className='font-ubuntu-mono bg-neutral-900 rounded p-2 text-sm w-full whitespace-pre-wrap'>
					{chunk.slice(3, -3)}
				</pre>
			);
		}

		const inline = chunk
			.replaceAll('&', '&amp;') // escape & first
			.replaceAll('<', '&lt;')
			.replace(/`([^`]+?)`/g, (_, m) => `<code1>${m}</code1>`)
			.replace(/``(.*?)``/g, (_, m) => `<code2>${m}</code2>`)
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
			.replace(/^>\s?(.*)$/gm, (_, content) =>
				`<div class='flex gap-2 items-start'>
					<div class="bg-neutral-600 rounded-md h-full w-[4px] min-h-[24px]"></div>
					<p class='whitespace-pre-wrap'>${content}</p>
				</div>`
			)
			.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, text, url) =>
				`<a href="${url}" target="_blank" rel="noopener noreferrer" class="hover:underline transition-all text-blue-600 hover:text-blue-700">${text}</a>`
			);

		// 1. Parse image links in rawContent
		const imageRegex = /(https?:\/\/[^\s]+\.(?:png|jpe?g|webp|gif)(?:[?#][^\s]*)?)/gi;
		let imgLastIndex = 0;
		let imgMatch: RegExpExecArray | null;

		while ((imgMatch = imageRegex.exec(rawContent)) !== null) {
			const before = rawContent.slice(imgLastIndex, imgMatch.index);
			if (before) parts.push(before);

			parts.push(
				<div key={`inline-img-${imgMatch.index}`} className="flex flex-col w-[12rem] min-w-0 rounded-2xl overflow-hidden">
					<img src={imgMatch[1]} className="rounded-2xl object-cover w-full h-auto" />
				</div>
			);

			imgLastIndex = imgMatch.index + imgMatch[0].length;
		}
		if (imgLastIndex < rawContent.length) {
			parts.push(rawContent.slice(imgLastIndex));
		}

		// 2. Handle embed.image.url and embed.url
		const allUrls: string[] = [];
		if (embed?.image?.url) allUrls.push(embed.image.url);
		if (embed?.url) allUrls.push(embed.url);

		allUrls.forEach((url, i) => {
			if (url.match(/\.(png|jpe?g|webp|gif)(?:[?#][^\s]*)?$/i)) {
				parts.push(
					<div key={`embed-img-${i}`} className="flex flex-col w-[12rem] min-w-0 rounded-2xl overflow-hidden">
						<img src={url} className="rounded-2xl object-cover w-full h-auto" />
					</div>
				);
			}
		});

		return (
			<span key={idx} className='inline whitespace-pre-wrap break-words' dangerouslySetInnerHTML={{ __html: html }} />
		);
	});
}

function format_discord_timestamp(raw: string | number | Date): string {
	const date = new Date(raw);
	const now = new Date();

	const is_same_day = (a: Date, b: Date) =>
		a.getFullYear() === b.getFullYear() &&
		a.getMonth() === b.getMonth() &&
		a.getDate() === b.getDate();

	const yesterday = new Date(now);
	yesterday.setDate(now.getDate() - 1);

	const hour = date.getHours() % 12 || 12;
	const minute = date.getMinutes().toString().padStart(2, '0');
	const ampm = date.getHours() >= 12 ? 'PM' : 'AM';
	const time = `${hour}:${minute} ${ampm}`;

	if (is_same_day(date, now)) return `Today at ${time}`;
	if (is_same_day(date, yesterday)) return `Yesterday at ${time}`;

	const mm = (date.getMonth() + 1).toString().padStart(2, '0');
	const dd = date.getDate().toString().padStart(2, '0');
	const yyyy = date.getFullYear();

	return `${mm}/${dd}/${yyyy}`;
}

function isOnlyEmojis(str: string) {
	// Remove all Discord-style custom emojis like <a:name:id>
	const cleaned = str
		.replace(/<a?:\w+:\d+>/g, '')
		.replace(/\s+/g, '') // remove spaces
		.replace(/<[@#]\d+>/g, '') // remove mentions
		.trim();

	// Check if nothing is left after removing emojis/mentions
	return cleaned.length === 0;
}

export { find_in_nested_channels, format_discord_timestamp, getContrastColor, isOnlyEmojis, parseEmbedAttachments, parseEmbedField, parseRepliedContent };

