import { Component, createRef, type MouseEvent, type RefObject } from 'react';
import { Download } from 'react-feather';
import { merge } from '../../util/class-merge';
import { ModalComponent } from '../Modal/export';

interface MediaModalProps {
    isVisible?: boolean | null;
    onClose: () => void;
    mediaUrl: string;
}

interface MediaModalState {
    zoom: number;
    mediaName: string;
    mediaSizeBytes?: number;
	offsetX: number;
	offsetY: number;
    isVideo: boolean;
	moving: boolean;
}

export class MediaModal extends Component<MediaModalProps, MediaModalState> {
    imageContainerRef: RefObject<HTMLDivElement | null> = createRef();
    isDragging = false;
    lastX = 0;
    lastY = 0;

    constructor(props: MediaModalProps) {
        super(props);
        this.state = {
            zoom: 0.5,
            mediaName: this.extractName(props.mediaUrl),
            mediaSizeBytes: undefined,
            isVideo: this.checkIsVideo(props.mediaUrl),
            offsetX: 0,
            offsetY: 0,
			moving: false
        };
    }

    // ---- dragging logic ----
    onMouseDown = (e: MouseEvent<HTMLDivElement>) => {
        if (this.state.zoom <= 0.5) return;
        this.isDragging = true;
        this.lastX = e.clientX;
        this.lastY = e.clientY;
        document.body.style.cursor = 'grabbing';
		this.offsetXRef = this.state.offsetX;
		this.offsetYRef = this.state.offsetY;
		this.setState({
			moving: true
		})
    };

    onMouseMove = (e: MouseEvent) => {
		if (!this.isDragging) return;

		const dx = e.clientX - this.lastX;
		const dy = e.clientY - this.lastY;
		this.lastX = e.clientX;
		this.lastY = e.clientY;

		this.pendingOffsetX += dx;
		this.pendingOffsetY += dy;

		if (this.animationFrame === null) {
			this.animationFrame = requestAnimationFrame(() => {
				const zoom = this.state.zoom;

				this.offsetXRef += this.pendingOffsetX;
				this.offsetYRef += this.pendingOffsetY;

				if (this.imgRef.current) {
					this.imgRef.current.style.transform = `scale(${zoom}) translate(${this.offsetXRef / zoom}px, ${this.offsetYRef / zoom}px)`;
				}

				// reset
				this.pendingOffsetX = 0;
				this.pendingOffsetY = 0;
				this.animationFrame = null;
			});
		}
	};

    onMouseUp = () => {
        this.isDragging = false;
		document.body.style.cursor = '';

		this.setState({
			moving: false,
			offsetX: this.offsetXRef,
			offsetY: this.offsetYRef,
		});

		if (this.animationFrame !== null) {
			cancelAnimationFrame(this.animationFrame);
			this.animationFrame = null;
		}
    };

    // ---- existing unchanged parts ----
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	componentDidUpdate(prevProps: Readonly<MediaModalProps>, _s: Readonly<MediaModalState>): void {
		if (prevProps.isVisible !== this.props.isVisible) {
			this.setState({
				isVisible: this.props.isVisible ?? false,
				zoom: 0.5,
				mediaName: this.extractName(this.props.mediaUrl),
				mediaSizeBytes: undefined,
				isVideo: this.checkIsVideo(this.props.mediaUrl),
				offsetX: 0,
				offsetY: 0,
				moving: false
			} as object);

			this.fetchFileSize(this.props.mediaUrl);
		}
	}

	componentDidMount() {
		this.fetchFileSize(this.props.mediaUrl);
		document.addEventListener('mouseup', this.onMouseUp);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		document.addEventListener('mousemove', this.onMouseMove as any);
	}

	componentWillUnmount() {
		document.removeEventListener('mouseup', this.onMouseUp);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		document.removeEventListener('mousemove', this.onMouseMove as any);
	}

	// --- helper methods stay same ---
	extractName(url: string): string {
        try {
            const path = new URL(url).pathname;
            return decodeURIComponent(path.split('/').pop() || 'Unknown');
        } catch {
            return 'Unknown';
        }
    }

	checkIsVideo(url: string): boolean {
		try {
			const parsed = new URL(url);
			const pathname = parsed.pathname.toLowerCase();
			const ext = pathname.split('.').pop();
			return ['mp4', 'webm', 'mov', 'ogg'].includes(ext || '');
		} catch {
			return false;
		}
	}

    async fetchFileSize(url: string) {
		try {
			const res = await fetch(url, {
				method: 'GET',
				headers: { Range: 'bytes=0-0' } // ask for 1 byte only
			});
			const size = res.headers.get('Content-Range')?.split('/')[1];
			if (size) {
				this.setState({ mediaSizeBytes: parseInt(size) });
			}
		} catch {
			// still fallback to unknown
		}
	}

    formatSize(bytes?: number): string {
        if (!bytes) return 'Unknown size';
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unit = 0;

        while (size >= 1024 && unit < units.length - 1) {
            size /= 1024;
            unit++;
        }

        return `${size.toFixed(1)} ${units[unit]}`;
    }

	animationFrame: number | null = null;
	pendingOffsetX: number = 0;
	pendingOffsetY: number = 0;
	offsetXRef = 0;
	offsetYRef = 0;

	imgRef = createRef<HTMLImageElement>();

    render() {
        const { isVisible, onClose, mediaUrl } = this.props;
        const { zoom, mediaName, isVideo, offsetX, offsetY } = this.state;

        const extension = mediaName.split('.').pop() ?? '';
        const nameOnly = mediaName.replace(`.${extension}`, '');

        return (
            <ModalComponent
                setVisibility={isVisible}
                onVisibilityChange={(v) => {
					if (v === false) {
						onClose();
						this.setState({
							mediaName: '',
							isVideo: false,
						})
						return;
					}
				}}
                defaultCloseButton
                animateFadeInDown
                blurCanvas
                closeOnClickOutside
                header={
                    <div className='flex flex-col gap-0 flex-1 items-start justify-start'>
                        <p className='truncate max-w-[70%]'>{nameOnly}</p>
                        <span className='bg-neutral-900 rounded-md p-0.5 px-2 text-center inline-flex justify-center items-center'>
                            <p className='text-sm text-neutral-400 uppercase font-ubuntu-mono'>{extension}</p>
                        </span>
                    </div>
                }
                footer={
                    <div className='inline-flex justify-between w-full gap-3 text-sm text-neutral-600 items-center'>
                        {!isVideo && <p className='select-none hover:text-neutral-300 font-semibold transition-all font-ubuntu-mono'>x{zoom}</p>}
                        <a
							onClick={() => {
								window.open(mediaUrl);
							}}
							className='hover:bg-neutral-200 cursor-pointer p-1 rounded-md transition-all inline-flex justify-center items-center'
						>
							<Download size={16} />
						</a>
                    </div>
                }
                contentClassName='items-center justify-center'
            >
				{isVideo ? (
					<div
						className='w-full h-full max-h-[70vh] flex items-center justify-center overflow-hidden'>
                        <video
                            src={mediaUrl}
                            controls
                            className='rounded-2xl shadow-md max-w-full max-h-[36vh] bg-black flex-1'
                        />
					</div>
                    ) :
                <div
                    className='w-full h-full max-h-[70vh] flex items-center justify-center overflow-hidden'
                    ref={this.imageContainerRef}
                    onMouseDown={(e) => {
						this.onMouseDown(e)
					}}
					onWheel={(e) => {
						e.preventDefault();

						const { zoom, offsetX, offsetY } = this.state;

						const rect = e.currentTarget.getBoundingClientRect();
						const mouseX = e.clientX - rect.left;
						const mouseY = e.clientY - rect.top;

						const centerX = rect.width / 2;
						const centerY = rect.height / 2;

						const relX = mouseX - centerX;
						const relY = mouseY - centerY;

						const delta = e.deltaY;
						let newZoom = zoom;

						if (delta > 0) {
							// zoom out
							newZoom = Math.max(0.5, zoom - 0.25);
						} else {
							// zoom in
							newZoom = zoom + 0.25;
						}

						// calc scale change ratio
						const scaleChange = newZoom / zoom;

						// update offsets based on mouse pos
						let newOffsetX = offsetX * scaleChange + relX * (1 - scaleChange);
						let newOffsetY = offsetY * scaleChange + relY * (1 - scaleChange);

						if (newZoom <= 0.5) {
							newOffsetX = 0;
							newOffsetY = 0;
						}

						this.setState({
							zoom: newZoom,
							offsetX: newZoom > 1.0 ? newOffsetX : 0,
							offsetY: newZoom > 1.0 ? newOffsetY : 0,
						});
					}}
                >
                     
                    <img
						ref={this.imgRef}
						src={mediaUrl}
						alt='media preview'
						style={{
							transform: `scale(${zoom}) translate(${offsetX / zoom}px, ${offsetY / zoom}px)`,
							willChange: 'transform',
							transformOrigin: 'center center',
							cursor: zoom > 0.5 ? 'grab' : 'default',
							backfaceVisibility: 'hidden', // smooths edge tearing sometimes
						}}
						className={merge(
							this.state.moving ? null : 'transition-transform duration-200 ease-in-out',
							'rounded-2xl shadow-md max-w-full max-h-full object-contain select-none'
						)}
						draggable={false}
					/>
                </div>
	}
            </ModalComponent>
        );
    }
}

