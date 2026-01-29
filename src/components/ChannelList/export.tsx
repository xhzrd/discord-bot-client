import { Component } from 'react';
import type { DeepKeys, DeepValue } from '../../safestate';
import type { GuildFullInfo } from '../../util/api';
import { ChevronDown, Hash, Mic, Anchor } from 'react-feather';
import { merge } from '../../util/class-merge';
import { Tooltip } from '../Tooltip/export';

interface GuildChannelProps {
	guild: GuildFullInfo
	channelId: string

	onChannelClick: (channel_name: string, channel_id: string) => void
}

type CollapsedState = {
    [key: string]: boolean | undefined;
};

export class GuildChannelsComponent extends Component<GuildChannelProps> {
	state = {
		collapsed: { } as CollapsedState,
	};

	constructor(props: GuildChannelProps) {
		super(props);
	}

	setTypedState<K extends DeepKeys<typeof this.state>>(key: K, value: Partial<DeepValue<typeof this.state, K>>) {
		this.setState((prevState) => {
			const keys = (typeof key == 'string' ? key : '').split('.') as string[];
			// eslint-disable-next-line @typescript-eslint/no-explicit-any, prefer-const
			let newState: any = structuredClone(prevState);

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			let current: any = newState;
			for (let i = 0; i < keys.length - 1; i++) {
				current[keys[i]] = { ...current[keys[i]] };
				current = current[keys[i]];
			}
			current[keys[keys.length - 1]] = value;

			return newState;
		});
	}

	render() {
		const { guild } = this.props;

		return (
			<div className='flex flex-col gap-1 min-w-[16rem] w-[16rem] max-w-[18rem] rounded-2xl bg-neutral-800 relative'>
				<div className='flex flex-col gap-0 mb-2 relative max-w-full w-full'>
					<span className='px-4 w-full absolute h-10 bg-neutral-900/50 backdrop-blur rounded-t-xl text-base font-medium py-3 inline-flex text-start items-center justify-start truncate'>
						<Tooltip align='bottom' label={guild.name || ''} interactive distance={8}>
							<p className='truncate'>{guild.name}</p>
						</Tooltip>
					</span>
					{
						guild?.banner ?
						<span style={{ backgroundImage: `url(${guild?.banner})` }}
							className='px-4 h-36 rounded-t-2xl bg-cover bg-center inline-flex justify-center items-center bg-neutral-900 rounded-b-xl text-base font-medium py-3 text-pretty truncate'>
						</span>
						: <span className='my-4'></span>
					}
				</div>

				<div className='flex flex-col overflow-y-auto max-h-[80vh]'>
					{guild?.channels.map((category, idx) => (
						<div className='flex flex-col gap-1 w-full px-2' key={idx}>
							<span
								className='inline-flex gap-2 items-center justify-start opacity-55 text-sm hover:opacity-70 select-none cursor-pointer'
								
								onClick={() => this.setState((prev: typeof this.state) => ({
									collapsed: {
										...prev.collapsed,
										[category.id]: !prev.collapsed?.[category.id],
									}
								}))}
							>
								<ChevronDown
									size={16}
									className={`transition-transform duration-200 ${
										!this.state.collapsed?.[category.id] ? 'rotate-180' : 'rotate-0'
									}`}
								/>
								<p>{category.name}</p>
							</span>

							<div
								className='transition-all overflow-hidden duration-300 ease-in-out'
								style={{
									
									maxHeight: this.state.collapsed?.[category.id]
										? '0px'
										: `${category.channels.length * 42}px`
								}}
							>
								{category.channels.map((channel, i) => {
									const icon = channel.type === 0
										? <Hash size={16} />
										: channel.type === 2
										? <Mic size={16} />
										: <Anchor size={16} />;

									return (
										<span
											key={i}
											className={merge(
												'ml-1 text-neutral-300 inline-flex items-center gap-2 p-1 px-2 rounded-2xl w-[90%]',
												'transition-all select-none cursor-pointer hover:bg-neutral-700 mb-1 translate-x-2',
												this.props.channelId == channel.id ? 'bg-neutral-600' : null
											)}
											onClick={() => {
												this.props.onChannelClick?.(channel.name, channel.id);
											}}
										>
											{icon}
											<p>{channel.name}</p>
										</span>
									);
								})}
							</div>
						</div>
					))}
				</div>
			</div>
		)
	}
};