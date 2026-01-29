import { Component } from 'react';

export class EmbedImage extends Component<{ src: string, onClick: () => void }> {
    render() {
        const { src } = this.props;

        return (
			<img
				src={src}
				className="object-cover rounded-2xl cursor-pointer"
				onClick={() => {
					this.props.onClick();
				}}
				style={{
					minWidth: '6rem',
					maxWidth: '100%',
					maxHeight: '30vh',
					height: 'auto',
					width: 'auto',
				}}
				alt="embed"
			/>
        );
    }
}
