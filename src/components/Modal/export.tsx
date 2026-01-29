import { Component, type ReactElement, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'react-feather';
import { merge } from '../../util/class-merge';
import type { BlockingAsyncCompatiable } from '../../util/types';

interface ModalProps {
	header	?: ReactNode | ReactElement
	children?: ReactNode | ReactElement
	footer	?: ReactNode | ReactElement

	blurCanvas 			?: boolean
	animateFadeInDown	?: boolean

	onVisibilityChange  ?: (visiblity: boolean) => BlockingAsyncCompatiable
	setVisibility		?: boolean | null | undefined

	closeOnClickOutside ?: boolean
	defaultCloseButton  ?: boolean
	customCloseButton   ?: ReactNode | ReactElement

	contentClassName    ?: string
	dir					?: string
};

export class ModalComponent extends Component<ModalProps> {
	constructor(props: ModalProps) {
		super(props);
	}

	renderModalContent() {
		return (
			<div dir={this.props.dir || 'ltr'} className={merge(
				'fixed top-0 left-0',
				'min-w-[100vw] min-h-[100vh]',
				'z-50 bg-black/10 use-dyn-perspective',
				'flex justify-center md:items-center items-end',
				this.props.blurCanvas ? 'backdrop-blur-sm' : null,
				
				this.props.setVisibility != null && this.props.setVisibility != undefined ?
					this.props.setVisibility
						? (this.props.animateFadeInDown ? 'opacity-100 animate-fade-in-down' : 'opacity-100')
						: (this.props.animateFadeInDown ? 'opacity-100 animate-fade-out-up pointer-events-none' : 'opacity-0')
				: 'opacity-0 pointer-events-none',
			)} onClick={(e) => {
				e.stopPropagation();
				e.preventDefault();

				if (this.props.closeOnClickOutside)
					this.props.onVisibilityChange?.(false);
			}}>
				<div className={merge(
					'md:min-w-[40%] md:w-80 md:rounded-xl',
					'min-w-full min-h-full rounded-t-xl',
					'bg-neutral-800 flex flex-col shadow',
					'p-4 max-h-screen md:animate-none md:opacity-100 md:translate-y-0 transform-preserve-3d',

					this.props.setVisibility != null && this.props.setVisibility != undefined ?
						this.props.setVisibility 
							? this.props.animateFadeInDown ? 'opacity-0 -translate-y-full animate-slide-drawer-up' : 'opacity-100'
							: this.props.animateFadeInDown ? 'opacity-100 translate-y-0 animate-slide-drawer-down' : 'opacity-0'
						: null
				)} onClick={(e) => {
					e.stopPropagation();
					e.preventDefault();

					return;
				}}>
					<div className='inline-flex justify-between items-center text-center flex-1 w-full select-none mb-2 pb-2 border-b border-b-neutral-600'>
						<span className='inline-flex items-center h-full flex-1 text-base/6'>
							{ this.props.header }
						</span>

						<span className='inline-flex items-start justify-end w-max h-full self-start absolute right-4 max-h-10'>
							{
								this.props.defaultCloseButton ?
									<button onClick={() => this.props.onVisibilityChange?.(false)} className={merge(
										'rounded-xl w-8 h-8 text-neutral-400 transition-all',
										'hover:bg-neutral-700 hover:text-neutral-100 p-0.5',
										'inline-flex justify-center items-center'
									)}>
										<X className='w-4 h-4' size={18}/>
									</button>
								: this.props.customCloseButton ? 
									this.props.customCloseButton 
								: null
							}
						</span>
					</div>

					<div className={merge(
						'flex flex-col py-2 md:max-h-[50vh] md:h-max max-h-screen overflow-y-auto',
						this.props.contentClassName
					)}>
						{ this.props.children }
					</div>


					{ 
						this.props.footer ? 
							<div className={merge(
								'inline-flex justify-between items-center flex-1 w-full mt-2 pt-2',
							)}>
								{ this.props.footer }
							</div>
						: null
					}
				</div>
			</div>
		);
	}

	render() {
        if (typeof window === 'undefined') return null; // for SSR
        return createPortal(this.renderModalContent(), document.body);
    }
}