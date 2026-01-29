import { Input as HUIInput } from '@headlessui/react';
import { Component, createRef, type ChangeEvent, type FocusEvent, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import { merge } from '../../util/class-merge';
import type { BlockingAsyncCompatiable } from '../Dropdown/export';

interface InputProps {
	onChange?: (event: ChangeEvent<HTMLInputElement>) => BlockingAsyncCompatiable;
	onKeyUp?: (event: KeyboardEvent<HTMLInputElement>) => BlockingAsyncCompatiable;
	onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => BlockingAsyncCompatiable;
	onFocus?: (event: FocusEvent<HTMLInputElement>) => BlockingAsyncCompatiable;
	onBlur?: (event: FocusEvent<HTMLInputElement>) => BlockingAsyncCompatiable;
	value?: string;
	className?: string | (() => string);
	placeholder?: string;
	startContent?: ReactNode | (() => (ReactNode))
	endContent?: ReactNode | (() => (ReactNode))
	isDisabled?: boolean
	isDisabledWithoutOpacity?: boolean
	type?: 'text' | 'number' | 'password'
	direction?: 'rtl' | 'ltr'
}

export class Input extends Component<InputProps> {
	state = {
		focused: false
	};

	constructor(props: InputProps) {
		super(props);
	}

	InputRef: RefObject<HTMLInputElement | null> = createRef();

	render() {
		const className = 
			this.props.className
				? typeof this.props.className == 'function'
					? this.props.className()
					: this.props.className
				: null;

		return (
			<span className={merge(
				!className?.includes('w-') ? 'w-max' : null,
				'inline-flex relative max-h-10',
				'py-2 px-1.5 inline-flex',
				'items-center text-start',
				'justify-evenly rounded-xl font-brico',
				'text-base bg-transparent',
				!className?.includes('placeholder:text') ?
					'placeholder:text-current/30' : null,
				!className?.includes('border') ? 
					this.state.focused ? 'border-blue-500' : 'border-transparent'
				: null,
				this.props.isDisabled && 
				!this.props.isDisabledWithoutOpacity ? 'pointer-events-none opacity-60' : null,
				!this.props.isDisabled && !this.props.isDisabledWithoutOpacity ? 'cursor-text' : null,
				className
			)} onClick={() => this.InputRef.current?.focus()}>
				{
					this.props.direction == 'rtl' ? 
					<span className='max-h-full cursor-default' onClick={(e) => e.stopPropagation()}>
						{
							this.props.endContent ? 
								typeof this.props.endContent == 'function' ?
									this.props.endContent()
								: this.props.endContent
							: null
						}
					</span>
					:
					<span className='max-h-full cursor-default' onClick={(e) => e.stopPropagation()}>
						{
							this.props.startContent ? 
								typeof this.props.startContent == 'function' ?
									this.props.startContent()
								: this.props.startContent
							: null
						}
					</span>
				}
				<HUIInput
					ref={this.InputRef}
					value={this.props.value}
					onKeyDown={(e) => { this.props.onKeyDown?.(e); }}
					onKeyUp={(e) => { this.props.onKeyUp?.(e); }}
					onChange={(e) => { this.props.onChange?.(e); }}
					onFocus={(e) => {
						this.setState({ focused: true });
						this.props.onFocus?.(e);
					}}
					onBlur={(e) => {
						this.setState({ focused: false });
						this.props.onBlur?.(e);
					}}
					type={this.props.type}
					placeholder={this.props.placeholder}
					disabled={this.props.isDisabled || this.props.isDisabledWithoutOpacity}
					className={merge(
						'bg-transparent px-2 w-full',
						'text-base border-0 outline-none ring-0',
						'text-current placeholder:text-current/30',
						this.props.isDisabled || this.props.isDisabledWithoutOpacity ? 'pointer-events-none' : null,
						className?.includes('font-') ? null : 'font-brico'
					)}
				/>
				{
					this.props.direction == 'rtl' ? 
					<span className='max-h-full cursor-default' onClick={(e) => e.stopPropagation()}>
						{
							this.props.startContent ? 
								typeof this.props.startContent == 'function' ?
									this.props.startContent()
								: this.props.startContent
							: null
						}
					</span>
					:
					<span className='max-h-full cursor-default' onClick={(e) => e.stopPropagation()}>
						{
							this.props.endContent ? 
								typeof this.props.endContent == 'function' ?
									this.props.endContent()
								: this.props.endContent
							: null
						}
					</span>
				}
			</span>
		);
	}
}
