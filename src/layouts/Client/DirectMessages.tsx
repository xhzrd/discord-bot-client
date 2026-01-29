import { Component, type PropsWithChildren, type ReactNode } from 'react';
import type { DeepKeys, DeepValue } from '../../safestate';
import { API, type UserDirect } from '../../util/api';

export class DirectMessagesLayoutComponent extends Component<PropsWithChildren & { children?: ReactNode }> {
	state = {
		directs: null as null | UserDirect[]
	};

	componentDidMount(): void {
		this.runAsync();
	}

	runAsync = async () => {
		const directs_request = await API.User.Directs();
		if (directs_request.data.code != 200) return;

		const directs: UserDirect[] | null = (directs_request.data as {
			data: null | UserDirect[]
		}).data;

		this.setTypedState('directs', directs);
	}

	constructor(props: PropsWithChildren & { children: ReactNode }) {
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
		return (
			<>
				{
					this.state.directs?.map((direct, idx) => (
						<span key={idx}>
							<p>{direct.displayname}</p>
						</span>
					))
				}
			</>
		)
	}
};