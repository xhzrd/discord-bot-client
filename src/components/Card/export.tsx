import { Component, type CSSProperties, type ReactNode } from 'react';
import { merge } from '../../util/class-merge';

interface CardComponentProps {
	children?: ReactNode
	className?: string
	Style?: CSSProperties
}
export class CardComponent extends Component<CardComponentProps> {
	constructor(props: CardComponentProps) {
		super(props);
	}

	render() {
		return (
			<div className={merge(
				'flex flex-col bg-white w-[20rem] rounded-xl p-3 px-4',
				'font-brico transition-all shadow-lg shadow-transparent hover:shadow-orange-200/20',
				this.props.className
			)} style={this.props.Style}>
				{ this.props.children }
			</div>
		);
	}
}