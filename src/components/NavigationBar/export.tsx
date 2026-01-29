import { Component, type PropsWithChildren } from 'react';
import { Bell, Globe, LogIn, Search, ShoppingBag, User } from 'react-feather';
import { merge } from '../../util/class-merge';
import { getTranslation } from '../../util/i18n';
import { LocalStorageManager } from '../../util/storage-manager';
import { Button } from '../Button/export';
import { Input } from '../Input/export';
import { CookiesManager } from '../../util/class-manager';
import type { Session } from '../../schema/Session';
import { API } from '../../util/api';

type DeepKeys<T, _P extends string = ''> = T extends object
	? {
		[K in keyof T]: K extends string
			? `${_P}${K}` | DeepKeys<T[K], `${_P}${K}.`>
			: never;
	}[keyof T]
	: never;

type DeepValue<T, K extends any> = K extends `${infer P}.${infer R}`
	? P extends keyof T
		? DeepValue<T[P], R>
		: never
	: K extends keyof T
	? T[K]
	: never;

export class NavigationBarComponent extends Component<PropsWithChildren, {}> {
	state = {
		current_language: LocalStorageManager.get_item('current_language') as (string | undefined) || 'en',
		transitioning: false,
		
		authorized: false,
		action_required: false,
		shopping_bag_items: null as number | null,

		user: {
			avatar: null as string | null,
			name: null as string | null
		}
	};

	constructor(props: PropsWithChildren) {
		super(props);
 	}

	async ManageSession(): Promise<void> {
		const session: Session | null = CookiesManager.get_cookie('session') as Session | null;
		if (!session) return CookiesManager.delete_cookie('session');
		const ExpiryUnix = new Date(session.expires_at).getTime();

		if (
			(ExpiryUnix - 1000) - Date.now() <= 0
		) return CookiesManager.delete_cookie('session');

		let user_data_req;
		let response;
		let tries = 0;

		while (tries < 3) {
			tries++;
			user_data_req = await API.User.Session(session.refered_to_id, session.token);
			response = user_data_req?.data;

			if (user_data_req && response && response.data) break;
		}

		if (!user_data_req || !response || !response.data) return CookiesManager.delete_cookie('session');

		const user_data = response.data;
		this.setTypedState('authorized', true);

		if (!user_data.private?.email_verified) this.setTypedState('action_required', true);
		if (user_data.based?.cart) this.setTypedState('shopping_bag_items', user_data.based.cart.length);
		if (
			user_data.public?.profile.avatar
		) this.setTypedState('user.avatar',
			user_data.public.profile.avatar
		);
		if (
			user_data.public?.profile.display_name
		) this.setTypedState('user.name',
			user_data.public.profile.display_name,
		);
		else if (user_data.public?.name.first) 
			this.setTypedState('user.name', user_data.public?.name.first);
		else this.setTypedState('user.name', getTranslation(this.state.current_language, 'Global.text.unknown'));
	}

	componentDidMount(): void {
		window.addEventListener('localStorageUpdated', () => {
			if (this.state.current_language != LocalStorageManager.get_item('current_language')) {
				const lang = LocalStorageManager.get_item('current_language');
				const validLang = lang === "en" || lang === "ar" ? lang : "en";
				this.setTypedState('current_language', validLang);
				return;
			}
		});

		this.ManageSession();
	}

	onLanguagePickerClick = () => {
        this.setTypedState('transitioning', true);

        setTimeout(() => {
            const new_lang = this.state.current_language === 'en' ? 'ar' : 'en';
            this.setTypedState('current_language', new_lang);
            LocalStorageManager.set_item('current_language', new_lang);

            setTimeout(() => {
                this.setTypedState('transitioning', false);
            }, 300); // match transition duration
        }, 150); // half of transition for fade out
    };

	setTypedState<K extends DeepKeys<typeof this.state>>(key: K, value: Partial<DeepValue<typeof this.state, K>>) {
		this.setState((prevState) => {
			const keys = (typeof key == 'string' ? key : '').split('.') as string[];
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

	render() {
		const is_ar = this.state.current_language === 'ar';
        const is_en = this.state.current_language === 'en';

		return (
			<div className={merge(
				'inline-flex min-w-full max-w-full fixed z-20',
				'p-3 gap-2 justify-between items-center mb-1',
				'backdrop-blur'
			)}>
				<span className='inline-flex items-center gap-2'>
					<Button NavigateTo={'/'} className={merge(
						'bg-white rounded-full px-4',
						'transition-all border border-transparent hover:text-white hover:bg-black',
					)}>
						<p className={is_ar ? 'font-ar' : ''}>{
							is_ar ? 'إيجاكس' : 
							is_en ? 'Egax' :
							'Egax'
						}</p>
					</Button>
					<Input 
						className={merge(
							'bg-white rounded-full px-4',
							'transition-all border border-transparent text-base focus-within:border-orange-400',
							'text-black min-w-0 w-full max-w-[360px]',
							is_ar ? 'font-ar placeholder:font-ar' : ''
						)} placeholder={
							is_en ? 'Search for a product.' :
							is_ar ? 'ابحث على منتج' :
							'Search for a product.'
						}
						endContent={<Button className={merge(
							'rounded-full px-1 translate-x-3 bg-black/70',
							'transition-all hover:bg-black'
						)}>
							<Search size={24} 
								className='text-white h-4 w-6'
							/>
						</Button>}
					/>
				</span>

				<span className='inline-flex items-center gap-2'>
					<Button
						className={merge(
							'bg-white hidden lg:inline-flex rounded-full px-4 max-w-full origin-right',
							'transition-all border border-transparent hover:text-white hover:bg-black',
							'items-center',
							this.state.transitioning
									? 'px-10'
									: null,
							is_ar
								? merge(
									'[&>:last-child]:transition-all',
									'[&>:last-child]:w-0 [&>:last-child]:opacity-0 [&>:last-child]:translate-x-0',
									'[&:hover>:last-child]:w-4 [&:hover>:last-child]:opacity-100 [&:hover>:last-child]:translate-x-1'
								)
								: merge(
									'[&>:first-child]:transition-all',
									'[&>:first-child]:w-0 [&>:first-child]:opacity-0 [&>:first-child]:translate-x-0',
									'[&:hover>:first-child]:w-4 [&:hover>:first-child]:opacity-100 [&:hover>:first-child]:-translate-x-1'
								)
						)}
						onClick={this.onLanguagePickerClick}
					>
						{is_en && <Globe className='overflow-hidden' size={20} stroke='currentColor' />}
						
						<p
							className={merge(
								'transition-all duration-300 ease-in-out',
								this.state.transitioning
									? 'blur-sm scale-95'
									: 'blur-0 scale-100',
								is_en ? 'font-ar' : ''
							)}
						>
							{is_en ? 'العربية' : 'English'}
						</p>

						{is_ar && <Globe className='overflow-hidden' size={20} stroke='currentColor' />}
					</Button>

					{
						this.state.authorized ? (
							<Button NavigateTo={'/user/bag'} className={merge(
								'bg-white rounded-full px-4 h-10 relative',
								'transition-all border border-transparent hover:text-white hover:bg-black',
							)}>
								<ShoppingBag size={20}/>
								{ this.state.shopping_bag_items && this.state.shopping_bag_items > 0 ? <p className={merge(
									'absolute -bottom-2 right-0 text-sm text-black',
									'min-w-5 w-max px-1 rounded-full bg-gradient-to-br',
									'from-emerald-100 to-orange-200',
									'pointer-events-none'
								)}>{ this.state.shopping_bag_items }</p> : null }
							</Button>
						) : null
					}
					<Button NavigateTo={this.state.authorized ? '/user/profile' : '/auth/login'} className={merge(
						'bg-white rounded-full px-2 h-[45px] gap-1 min-w-10 w-max relative',
						'transition-all border border-transparent hover:text-white hover:bg-black',
					)}>
						{
							this.state.authorized ? (
								<>
									<p className='md:inline-block hidden max-w-0 md:max-w-max'>{ this.state.user.name }</p>
									{
										this.state.user.avatar ?
											<img src={this.state.user.avatar} className={merge(
												'p-1 rounded-full',
												'md:w-8 md:h-8 md:relative',
												'w-12 h-full absolute'
											)}/>
										: <User className='p-1 w-8 h-8 rounded-full' size={20}/>
									}
									{
										this.state.action_required ? (
											<div className={merge(
												'absolute -bottom-2 h-5 right-0 text-sm text-black',
												'min-w-5 w-max p-0.5 px-2 rounded-full bg-gradient-to-br',
												'from-emerald-100 to-orange-200',
												'pointer-events-none inline-flex gap-0.5 items-center justify-center'
											)}>
												<Bell size={18} fill='currentColor'></Bell>
												<p className={merge(
													'text-black text-sm font-semibold'
												)}>+1</p>
											</div>
										) : null
									}
								</>
							) : (
								<>
									<p className={merge(
										'md:inline-block hidden max-w-0 md:max-w-max',
										is_ar ? 'font-ar' : null
									)}>{getTranslation(this.state.current_language, 'Navigation.text.login')}</p>
									<LogIn className='p-1 w-7 h-7 rounded-full' size={20}/>
								</>
							)
						}
					</Button>
				</span>
				
			</div>
		);
	}
}