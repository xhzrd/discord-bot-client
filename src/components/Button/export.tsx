import { Button as HUIButton } from '@headlessui/react';
import { Component, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { Link } from 'react-router';
import { merge } from '../../util/class-merge';
import type { BlockingAsyncCompatiable } from '../../util/types';

interface ButtonProps {
	onClick?: (event: MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => BlockingAsyncCompatiable
	className?: string | (() => (string))
	children?: ReactNode | (() => (ReactNode))
	ariaLable?: string
	isDisabled?: boolean
	NavigateTo?: string | (() => (string))
	Style?: CSSProperties 
	CompatiablePaddingFallback?: boolean
};

export class Button extends Component<ButtonProps> {
	constructor(props: ButtonProps) {
		super(props);
	}

	render() {
		return !this.props.NavigateTo ? (
			<HUIButton
				aria-label={this.props.ariaLable}
				onClick={(e) => { this.props.onClick?.(e); }}
				style={this.props.Style}
				className={merge(
					'inline-flex',
					'items-center text-center gap-1',
					'justify-center rounded-xl font-brico',
					'text-base bg-transparent',
					this.props.isDisabled ? 'pointer-events-none opacity-60' : null,
					this.props.className ? 
						typeof this.props.className == 'function' ?
							this.props.className()
						: this.props.className
					: null,
					'p-2 px-3'

					// this.props.CompatiablePaddingFallback != undefined ? this.props.className ? 
					// 	typeof this.props.className == 'function' ?
					// 		this.props.className().includes('p-') ? null : 'p-2 px-3'
					// 	: this.props.className.includes('p-') ? null : 'p-2 px-3'
					// : null : null
				)}
			>
				{
					this.props.children ? 
						typeof this.props.children == 'function' ?
							this.props.children()
						: this.props.children
					: null
				}
			</HUIButton>
		) : (
			<Link
				aria-label={this.props.ariaLable}
				onClick={(e) => { this.props.onClick?.(e); }}
				style={this.props.Style}
				to={typeof this.props.NavigateTo == 'function' ?
					this.props.NavigateTo()
				: this.props.NavigateTo}
				className={merge(
					'p-2 px-3 inline-flex',
					'items-center text-center gap-1',
					'justify-center rounded-xl font-brico',
					'text-base bg-transparent',
					this.props.isDisabled ? 'pointer-events-none opacity-60' : null,
					this.props.className ? 
						typeof this.props.className == 'function' ?
							this.props.className()
						: this.props.className
					: null
				)}
			>
				{
					this.props.children ? 
						typeof this.props.children == 'function' ?
							this.props.children()
						: this.props.children
					: null
				}
			</Link>
		);
	}
}