import { Component, type ReactNode } from 'react';
import { Anchor } from 'react-feather';
import { Tooltip } from '../components/Tooltip/export';
import type { DeepKeys, DeepValue } from '../safestate';
import { API, type Guild } from '../util/api';
import { merge } from '../util/class-merge';
import { Link } from 'react-router';

interface ClientProps {
	children?: ReactNode
	onPageSelect?: (page: {
		type: 'guild' | 'home',
		id?: string
	}) => void;
}

export class ClientLayoutComponent extends Component<ClientProps> {
	state = {
		guilds: null as null | Guild[]
	};

	constructor(props: ClientProps) {
		super(props);
	}

	componentDidMount(): void {
		const cached = localStorage.getItem('cached_guilds');
		if (cached) {
			try {
				const parsed = JSON.parse(cached) as Guild[];
				this.setTypedState('guilds', parsed);
			} catch {
				// corrupted or invalid, ignore
			}
		}

		// always fetch fresh in case cache is old
		this.runAsync();
	}

	runAsync = async () => {
		const guilds_request = await API.User.Guilds();
		if (guilds_request.data.code != 200) return;

		const guilds: Guild[] | null = (guilds_request.data as {
			data: null | Guild[]
		}).data;

		if (guilds) {
			// cache for future loads
			localStorage.setItem('cached_guilds', JSON.stringify(guilds));
			this.setTypedState('guilds', guilds);
		}
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
		return (
			<div className={merge(
				'inline-flex gap-3 w-screen h-screen overflow-hidden',
				'absolute top-0 left-0 p-4'
			)}>
				<div className={merge(
					'flex flex-col items-center gap-1.5 min-w-14 max-w-14',
					'bg-neutral-800 rounded-2xl p-1.5 overflow-x-hidden overflow-y-auto'
				)}>
					<Tooltip label={'Home'} align='right' interactive distance={8} className='transition-all duration-300 ease-in-out text-lg'>
						<Link replace to={'/client'} className={merge(
							'min-w-10 min-h-10 rounded-2xl transition-all',
							'bg-neutral-900 relative cursor-pointer border border-transparent',
							'relative inline-flex justify-center items-center',
							'hover:bg-blue-600'
						)}>
							<Anchor size={18}/>
						</Link>
					</Tooltip>
					<span className='w-full my-2 h-0.5 bg-neutral-600 scale-x-75 rounded-full'></span>
					{
						this.state.guilds?.map((guild, idx) => (
							<Tooltip label={guild.name} align='right' interactive distance={8} key={idx} className='transition-all duration-300 ease-in-out text-lg'>
								<Link replace to={`/client/guild/${guild.id}`} className={merge(
									'min-w-10 min-h-10 rounded-2xl transition-all',
									'bg-neutral-900 relative cursor-pointer border border-transparent',
									'relative'
								)}>
									<img src={guild.icon} className={merge(
										'w-full h-full absolute border-transparent outline-none rounded-2xl',
									)}/>
								</Link>
							</Tooltip>
						))
					}
				</div>
				<div className={merge(
					'flex flex-col w-full flex-1 h-full max-h-full overflow-hidden'
				)}>
					{
						this.props.children
					}
				</div>
			</div>
		)
	}
};