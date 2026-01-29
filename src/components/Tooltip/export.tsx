import { Component, createRef, type PropsWithChildren } from 'react';
import { createPortal } from 'react-dom';

type TooltipProps = PropsWithChildren & {
    label: string;
    align?: 'top' | 'bottom' | 'left' | 'right';
    distance?: number;
    interactive?: boolean;
    className?: string;
};

export class Tooltip extends Component<TooltipProps> {
    targetRef = createRef<HTMLDivElement>();
    tooltipRef = createRef<HTMLDivElement>();

    state = {
        mounted: false,
        visible: false,
        coords: { top: -9999, left: -9999 }
    };

    timeout?: number;

    componentDidMount() {
        window.addEventListener('scroll', this.updatePosition, true);
        window.addEventListener('resize', this.updatePosition, true);
    }

    componentWillUnmount() {
        window.removeEventListener('scroll', this.updatePosition, true);
        window.removeEventListener('resize', this.updatePosition, true);
        clearTimeout(this.timeout);
    }

    showTooltip = () => {
        clearTimeout(this.timeout);
        this.setState({ mounted: true }, () => {
            requestAnimationFrame(() => {
                this.setState({ visible: true }, this.updatePosition);
            });
        });
    };

    hideTooltip = () => {
        clearTimeout(this.timeout);
        this.setState({ visible: false });
        this.timeout = setTimeout(() => {
            this.setState({ mounted: false });
        }, 400);
    };

    updatePosition = () => {
		const el = this.targetRef.current;
		const tooltipEl = this.tooltipRef.current;
		if (!el || !tooltipEl) return;

		// force visibility so we can measure real size
		tooltipEl.style.visibility = 'hidden';
		tooltipEl.style.opacity = '1';
		tooltipEl.style.transform = 'none';

		const triggerRect = el.getBoundingClientRect();
		const tooltipRect = tooltipEl.getBoundingClientRect();
		const { align = 'top', distance = 8 } = this.props;

		tooltipEl.style.visibility = '';
		tooltipEl.style.opacity = '';
		tooltipEl.style.transform = '';

		let top = 0;
		let left = 0;

		switch (align) {
			case 'top':
				top = triggerRect.top - tooltipRect.height - distance;
				left = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
				break;
			case 'bottom':
				top = triggerRect.bottom + distance;
				left = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
				break;
			case 'left':
				top = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
				left = triggerRect.left - tooltipRect.width - distance;
				break;
			case 'right':
				top = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
				left = triggerRect.right + distance;
				break;
		}

		this.setState({ coords: { top, left } });
	};


    renderTooltip() {
        const { label, className, interactive = false } = this.props;
        const { coords, visible, mounted } = this.state;

        if (!mounted) return null;

        return createPortal(
            <div
                ref={this.tooltipRef}
                onPointerEnter={this.showTooltip}
                onPointerLeave={this.hideTooltip}
                className={`fixed z-[9999] transition-[opacity,transform] duration-200 ease-in-out pointer-events-${interactive ? 'auto' : 'none'} ${visible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2'} ${className || ''}`}
                style={{
                    top: coords.top,
                    left: coords.left
                }}
            >
                <div className='bg-neutral-900 backdrop-blur-sm text-white cursor-default text-sm font-bricolage-ss px-3 py-1 rounded-xl shadow-md whitespace-nowrap'>
                    {label}
                </div>
            </div>,
            document.body
        );
    }

    render() {
    return (
        <div
            ref={this.targetRef}
            className='inline-flex relative'
            onPointerEnter={this.showTooltip}
            onPointerLeave={this.hideTooltip}
        >
            {this.props.children}
            {this.renderTooltip()}
        </div>
    );
}

}
