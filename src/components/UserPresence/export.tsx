import { Component } from 'react';
import type { DeepKeys, DeepValue } from '../../safestate';
import { BellOff, Moon, Box } from 'react-feather';
import { merge } from '../../util/class-merge';
import type { RoleInfo, UserPresence } from '../../util/api';

interface UserListProps {
	channelId: string;
	sortedRoles: RoleInfo[];
	groupedUsers: Map<string, UserPresence[]>;

	setInputMention: (content: string) => void;
}

export class UserListComponent extends Component<UserListProps> {
	state = {
		
	};

	constructor(props: UserListProps) {
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
		const sorted_roles = this.props.sortedRoles;
		const users_grouped_by_role = this.props.groupedUsers;
		return (
			<div className='flex flex-col p-4 gap-1 min-w-72 w-72 max-w-72 flex-1 rounded-2xl bg-neutral-800 items-center justify-start relative h-full max-h-full overflow-y-auto'>
				{sorted_roles.map(role => {
					const users_in_role = users_grouped_by_role.get(role.id);
					if (!users_in_role || users_in_role.length === 0) return null;

					// sort users alphabetically by display_name
					const sorted_users = [...users_in_role].sort((a, b) =>
						a.user.display_name.localeCompare(b.user.display_name)
					);

					return (
						<div key={role.id} className='flex flex-col gap-0 w-full flex-1'>
							<span className='inline-flex items-center gap-1 mb-0.5'>
								{
									role.icon ?
										<img className='w-4 h-4' src={role.icon}/>
									: null
								}
								<p
									className='text-neutral-500 select-none text-sm font-medium font-bricolage-ss w-full'
								>
									{role.name} — {sorted_users.length}
								</p>
							</span>

							{sorted_users.map((client, idx) => {
								const hasAccess = client.accessible_channels.some(
									ch => ch.id === this.props.channelId
								);

								return (
									<span
										key={idx}
										className={merge(
											'p-1 px-2 h-12 max-h-12 mb-1 overflow-hidden select-none cursor-pointer relative rounded-2xl transition-all hover:bg-neutral-900',
											'inline-flex items-center justify-start gap-2 w-full',
											!hasAccess ? 'opacity-30 pointer-events-none select-none' : null
										)}
										onClick={(e) => {
											if (!e.shiftKey) return;
											this.props.setInputMention(`<@${client.user.id}> `);
										}}
									>
										<span className='inline-flex relative items-center'>
											<img src={client.user.icon} className='min-w-8 min-h-8 max-w-8 max-h-8 my-0.5 rounded-full'/>
											<span className={merge(
												'w-4 h-4 p-0.5 rounded-full absolute text-black',
												'bottom-0 right-0 inline-flex justify-center items-center',
												'border-2',
												client.user.status == 'dnd' ? 'border-[#a84d4a] bg-[#bf6763]' :
												client.user.status == 'idle' ? 'border-[#f5b642] bg-[#eda726]' :
												client.user.status == 'online' ? 'border-[#acf791] bg-[#a8d996]' : null
											)}>
												{
													client.user.status == 'dnd' ? <BellOff fill={'currentColor'} strokeWidth={3} size={16}/> :
													client.user.status == 'idle' ? <Moon fill={'currentColor'} strokeWidth={3} size={16}/> :
													client.user.status == 'online' ? <Box fill={'currentColor'} size={14}/> : null
												}
											</span>
										</span>
										<div className='flex flex-col w-full flex-1 gap-0'>
											<p className='text-neutral-300 text-base/5'>{client.user.display_name}</p>
											{
												client.user.statusText ?
													<p aria-label={client.user.statusText} className='text-sm/4 mb-0.5 text-neutral-500 truncate max-w-[10rem]'>{client.user.statusText}</p>
												: null
											}
										</div>
									</span>
								);
							})}
						</div>
					);
				})}
			</div>
		)
	}
};