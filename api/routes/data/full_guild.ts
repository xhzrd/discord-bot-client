/* eslint-disable @typescript-eslint/no-unused-vars */
import { status } from 'elysia';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import type { Route } from '../../exports/routes';
import { mClient, mRebaseClient } from '../../local';
import {
    type GuildBasedChannel,
    type NonThreadGuildBasedChannel,
    type Collection,
    ChannelType
} from 'discord.js';

export default {
    path: '/data/fetch/guild/full',
    type: 'POST',
    run: async ({
        body: { guild_id }
    }: {
        body: {
            guild_id?: string
        }
    }) => {
        if (!mClient) await mRebaseClient();

        if (!guild_id) {
            return status('Bad Request', {
                message: 'Missing guild_id in body.',
                code: StatusCodes.BAD_REQUEST,
            });
        }

        try {
            const guild = mClient?.guilds.cache.get(guild_id) ?? await mClient?.guilds.fetch(guild_id);

            let channels: Collection<string, GuildBasedChannel> | undefined = guild?.channels.cache as Collection<string, GuildBasedChannel>;

            if (!channels?.size) {
                const fetched = await guild?.channels.fetch();

                // filter out nulls and threads (just to be safe)
                const filtered = new Map<string, NonThreadGuildBasedChannel>();
                for (const [id, ch] of fetched ?? []) {
                    if (
                        ch !== null &&
                        ch.type !== ChannelType.GuildForum &&
                        ch.type !== ChannelType.GuildAnnouncement &&
                        ch.type !== ChannelType.GuildCategory
                    ) {
                        filtered.set(id, ch);
                    }
                }

                // cast safely
                channels = filtered as Collection<string, GuildBasedChannel>;
            }

            const categories = new Map<string, {
                id: string;
                name: string;
                type: 'CATEGORY';
                position: number;
                channels: {
                    id: string;
                    name: string;
                    type: number;
                }[];
            }>();

            for (const channel of channels?.values() ?? []) {
                if (channel?.type === ChannelType.GuildCategory) {
                    categories.set(channel.id, {
                        id: channel.id,
                        name: channel.name,
                        type: 'CATEGORY',
                        position: channel.position,
                        channels: [],
                    });
                }
            }

            for (const channel of channels?.values() ?? []) {
                if (channel?.type !== ChannelType.GuildCategory && channel?.parentId) {
                    const parent = categories.get(channel.parentId);
                    if (parent) {
                        parent.channels.push({
                            id: channel.id,
                            name: channel.name,
                            type: channel.type,
                        });
                    }
                }
            }

            const organizedChannels = Array.from(categories.values())
                .sort((a, b) => a.position - b.position);

            // emoji fetch if cache empty
            if (!guild?.emojis.cache.size) {
                await guild?.emojis.fetch();
            }

            const guild_data = {
                id: guild?.id,
                name: guild?.name,
                acronym: guild?.nameAcronym,
                description: guild?.description,
                icon: guild?.iconURL({ size: 1024 }),
                banner: guild?.bannerURL({ size: 2048 }),
                owner_id: guild?.ownerId,
                partnered: guild?.partnered,
                verified: guild?.verified,
                member_count: guild?.memberCount,
                channels: organizedChannels,
                roles: guild?.roles.cache.map(role => ({
                    id: role.id,
                    name: role.name,
                    color: role.hexColor,
                    position: role.position,
                })),
                emojis: guild?.emojis.cache.map(emoji => ({
                    id: emoji.id,
                    name: emoji.name,
                    animated: emoji.animated,
                    url: emoji.url,
                })),
            };

            return status('OK', {
                actions: [
                    {
                        event: 'guild-full-fetch',
                        message: 'Fetched full guild data',
                        state: true,
                    },
                ],
                data: guild_data,
                timestamp: Date.now(),
                reason: ReasonPhrases.OK,
                code: StatusCodes.OK,
                message: `Fetched data for guild ${guild?.name}`,
            });

        } catch (err) {
            return status('Not Found', {
                message: 'Guild not found or inaccessible.',
                code: StatusCodes.NOT_FOUND,
                reason: ReasonPhrases.NOT_FOUND,
                timestamp: Date.now(),
            });
        }
    },
} as Route;
