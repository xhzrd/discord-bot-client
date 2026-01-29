import { Component, type PropsWithChildren, type ReactNode } from "react";
import { Spinner } from "../components/Spinner/export";
import type { DeepKeys, DeepValue } from "../safestate";
import { API } from "../util/api";
import { CookiesManager } from "../util/class-manager";
import { merge } from "../util/class-merge";
import { Navigate } from "react-router";

export class LoadingLayoutComponent extends Component<
	PropsWithChildren & { children?: ReactNode }
> {
	state = {
		location: null as string | null,
	};

	constructor(props: PropsWithChildren & { children: ReactNode }) {
		super(props);
	}

	setTypedState<K extends DeepKeys<typeof this.state>>(
		key: K,
		value: Partial<DeepValue<typeof this.state, K>>,
	) {
		this.setState((prevState) => {
			const keys = (typeof key == "string" ? key : "").split(
				".",
			) as string[];
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

	componentDidMount(): void {
		setTimeout(async () => {
			const lLocalToken: string | null =
				CookiesManager.get_cookie("imp.local.token");
			if (!lLocalToken || lLocalToken.length < 23)
				return this.setTypedState("location", "/login");
			const request = await API.User.Authenticate(lLocalToken);

			if (request.data.code != 200) {
				CookiesManager.clear_all_cookies();
				return this.setTypedState("location", "/login");
			}

			CookiesManager.set_cookie(
				"imp.local.id",
				`'${
					(
						request.data as unknown as {
							data: {
								id: string;
							};
						}
					).data.id
				}'`,
			);

			this.setTypedState("location", "/client");
		}, 2000);
	}

	render() {
		return (
			<div
				className={merge(
					"flex flex-col justify-center items-center gap-2 relative bg-neutral-900",
					"p-0 m-0 w-screen h-screen overflow-hidden top-0 left-0",
				)}
			>
				{this.state.location ? (
					<Navigate to={this.state.location} />
				) : null}

				<img
					src="https://i.pinimg.com/originals/59/2b/c6/592bc6a592bbacc67ef9871690768996.gif"
					className={merge("w-[10vw]")}
				/>
				<Spinner
					backgroundColor="transparent"
					glowColor=""
					height={16}
					shape="square"
					glowAmount={0}
					width={36}
					ringWidth={3}
				/>
				<span className="inline-flex items-center justify-center">
					<p className="text-sm">
						Did you know this client exists cuz a dev didn't like
						how discord looks?
					</p>
				</span>
			</div>
		);
	}
}
