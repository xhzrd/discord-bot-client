import { Component, type PropsWithChildren, type ReactNode } from "react";
import { Anchor, Check, LogIn, X } from "react-feather";
import { Button } from "../components/Button/export";
import { Input } from "../components/Input/export";
import type { DeepKeys, DeepValue } from "../safestate";
import { merge } from "../util/class-merge";
import { Spinner } from "../components/Spinner/export";
import { API } from "../util/api";
import { CookiesManager } from "../util/class-manager";
import { Navigate } from "react-router";

export class AuthorizationLayoutComponent extends Component<
	PropsWithChildren & { children?: ReactNode }
> {
	state = {
		authorization: {
			loading: false,
			error: false,
			done: false,
		},
		data: {
			token: null as string | null,
		},
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

	onLoginClick = async () => {
		this.setTypedState("authorization.loading", true);
		const token = this.state.data.token;
		if (!token)
			return this.setTypedState("authorization", {
				loading: false,
				error: true,
			});

		const response = await API.User.Authenticate(token);
		if (response.data.code != 200)
			return this.setTypedState("authorization", {
				loading: false,
				error: true,
			});

		CookiesManager.set_cookie("imp.local.token", token.trim(), 60);

		this.setTypedState("authorization", {
			loading: false,
			done: true,
		});

		setTimeout(() => {
			this.setTypedState("location", "/");
		}, 1000);
	};

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
				<div
					className={merge(
						"flex flex-col justify-center items-center gap-2",
						"w-screen h-screen overflow-hidden z-10 absolute",
					)}
				>
					<div
						className={merge(
							"bg-neutral-900/30 backdrop-blur-md rounded-2xl p-2",
							"lg:min-w-[40vw] md:min-w-[60vw] min-w-[70vw]",
							"lg:max-w-[50vw] md:max-w-[70vw] max-w-[80vw]",
							"min-h-max px-4",
							"flex flex-col gap-2",
						)}
					>
						<div className="flex flex-col gap-0 select-none">
							<p className="text-base/5 mt-0.5">
								Authorize into a Bot
							</p>
							<p className="text-sm/4 opacity-80">
								Note: We are not responsible for anything, If
								caught, You could get your account & bot banned
								by using this client.
							</p>
							<p className="text-sm/4 opacity-60">
								You can log-into a discord bot using the token
								from this page, It will give you a
								discord-client-like page where you can text,
								reply, send images, and more later on from this
								page using a discord bot.
							</p>
							<p className="text-sm/4 opacity-70">
								Using this tool means you acknowledge that you
								are responsible for any actions taken through
								your bot token. This tool does not bypass
								Discord's terms of service — it simply provides
								a bot-controlled interface.
							</p>
						</div>

						<div className="flex flex-col gap-0 select-none">
							<p
								className={merge(
									"origin-bottom-left transition-[opacity,max-height,transform] duration-300 ease-in-out",
									this.state.authorization.error
										? "text-sm opacity-90 text-neutral-100 translate-y-0 max-h-40"
										: "translate-y-12 opacity-0 max-h-0 overflow-hidden",
								)}
							>
								Please make sure the entered token is valid and
								all of the intents for it are enabled and try
								again.
							</p>

							<p className="text-sm font-medium opacity-90">
								Discord Token
							</p>
							<Input
								isDisabled={
									this.state.authorization.done ||
									this.state.authorization.loading
								}
								onChange={(event) => {
									const value = event.currentTarget.value;
									this.setTypedState(
										"authorization.error",
										false,
									);
									this.setTypedState(
										"data.token",
										value.trim(),
									);
								}}
								className={merge(
									"bg-neutral-900/40 text-white",
									"w-full px-3",
								)}
								startContent={<Anchor size={16} />}
								placeholder="MFAXXXxXXXXXX.XXXX.xXXXXXXXXXXXXXXxxX"
							/>
						</div>
						<Button
							onClick={this.onLoginClick}
							className={merge(
								"w-max px-2 py-1.5 rounded-2xl gap-2",
								"bg-black self-end transition-all",
								"hover:bg-white/30 hover:backdrop-blur-md hover:text-black",
								this.state.authorization.loading ||
									this.state.authorization.error ||
									this.state.authorization.done
									? "opacity-70 pointer-events-none"
									: null,
							)}
						>
							{this.state.authorization.loading ? (
								<>
									Authorizing
									<Spinner
										backgroundColor="transparent"
										glowColor=""
										height={12}
										shape="square"
										glowAmount={0}
										width={20}
										ringWidth={3}
									/>
								</>
							) : this.state.authorization.error ? (
								<>
									Failed to Authorize
									<X size={16} />
								</>
							) : this.state.authorization.done ? (
								<>
									Authorized
									<Check size={18} />
								</>
							) : (
								<>
									<LogIn size={18} />
									Login
								</>
							)}
						</Button>
					</div>
				</div>

				<div className={merge("w-screen h-screen", "top-0 left-0")}>
					<span
						className={merge(
							"w-full h-full absolute block",
							"bg-center bg-no-repeat bg-cover",
						)}
						style={{
							backgroundImage: `url(https://i.pinimg.com/736x/64/91/7a/64917afe94ecfceaaf54f14e35df7738.jpg)`,
						}}
					></span>
					{/* <span className={merge(
						'bg-neutral-900/10 w-full h-full',
						'absolute block backdrop-blur-md'
					)}></span> */}
				</div>
			</div>
		);
	}
}
