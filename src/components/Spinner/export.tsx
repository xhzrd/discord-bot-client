import { Component, type PropsWithChildren } from 'react';

type SpinnerProps = {
    width?: number;              // Override width in pixels (takes priority over size)
    height?: number;             // Override height in pixels (takes priority over size)
    size?: number;               // Default size for square spinner (width=height=size)
    ringWidth?: number;          // Thickness of the spinner stroke
    shape?: 'circle' | 'square'; // Spinner shape: circular or pill-like square
    backgroundColor?: string;    // Background color of spinner container
    spinnerColor?: string;       // Color of the main spinner stroke
    glowColor?: string;          // Color of the glowing tail stroke (default: orange-200)
    glowAmount?: number;         // Intensity of glow blur (higher = stronger glow)
};

export class Spinner extends Component<PropsWithChildren<SpinnerProps>, {}> {
    static defaultProps = {
        size: 48,
        ringWidth: 4,
        shape: 'circle',
        backgroundColor: '#f3f4f6',
        spinnerColor: '#3b82f6',
        glowColor: '#fed7aa',  // Tailwind orange-200 by default
        glowAmount: 3,         // Glow blur radius
    };

    constructor(props: PropsWithChildren<SpinnerProps>) {
        super(props);
    }

    render() {
        // Destructure props with defaults
        const {
            width,
            height,
            size = 48,
            ringWidth = 4,
            shape = 'circle',
            backgroundColor = '#f3f4f6',
            spinnerColor = '#3b82f6',
            glowColor = '#fed7aa',
            glowAmount = 3
        } = this.props;

        // Final dimensions fallback to size if width/height missing
        const w = width ?? size;
        const h = height ?? size;

        if (shape === 'circle') {
            // For circle, diameter limited by smaller dimension
            const diameter = Math.min(w, h);
            const radius = (diameter - ringWidth) / 2;

            // Circumference for stroke dash calculations
            const circumference = 2 * Math.PI * radius;

            return (
                <div
					className='rounded-[50%] overflow-hidden items-center justify-center flex'
                    style={{
                        width: w,
                        height: h,
                        backgroundColor,
                    }}
                >
                    <svg
                        width={w}
                        height={h}
                        viewBox={`0 0 ${diameter} ${diameter}`}
                    >
                        {/* Main spinner circle stroke */}
                        <circle
                            cx={diameter / 2}
                            cy={diameter / 2}
                            r={radius}
                            fill='none'
                            stroke={spinnerColor}
                            strokeWidth={ringWidth}
                            strokeLinecap='round'
                            style={{
                                strokeDasharray: circumference,
                                strokeDashoffset: circumference * 0.25,
                                animation: 'spin-circle 1.4s linear infinite'
                            }}
                        />
                        {/* Glow tail circle: thicker, blurred, same animation synced */}
                        <circle
                            cx={diameter / 2}
                            cy={diameter / 2}
                            r={radius}
                            fill='none'
                            stroke={glowColor}
                            strokeWidth={ringWidth * 1.5}
                            strokeLinecap='round'
                            style={{
                                strokeDasharray: circumference,
                                strokeDashoffset: circumference * 0.25,
                                filter: `drop-shadow(0 0 ${glowAmount}px ${glowColor})`,
                                animation: 'spin-circle 1.4s linear infinite'
                            }}
                        />
                    </svg>

                    <style>{`
                        @keyframes spin-circle {
                            0% {
                                stroke-dashoffset: ${circumference};
                            }
                            100% {
                                stroke-dashoffset: 0;
                            }
                        }
                    `}</style>
                </div>
            );
        } else {
            // For square (pill-shaped), calculate inner rect dimensions
            const inner_width = w - ringWidth;
            const inner_height = h - ringWidth;

            // Rounded corner radius = half smallest dimension for pill shape
            const corner_radius = Math.min(inner_width, inner_height) / 2;

            // Perimeter of rounded rect for stroke dash array
            const perimeter =
                2 * (inner_width + inner_height - 2 * corner_radius) +
                2 * Math.PI * corner_radius;

            return (
                <div
					className='rounded-full flex justify-center items-center overflow-hidden'
                    style={{
                        width: w,
                        height: h,
                        backgroundColor,
                    }}
                >
                    <svg
                        width={w}
                        height={h}
                        viewBox={`0 0 ${w} ${h}`}
                    >
                        {/* Main spinner rounded rect stroke */}
                        <rect
                            x={ringWidth / 2}
                            y={ringWidth / 2}
                            width={inner_width}
                            height={inner_height}
                            fill='none'
                            stroke={spinnerColor}
                            strokeWidth={ringWidth}
                            strokeLinecap='round'
                            rx={corner_radius}
                            ry={corner_radius}
                            style={{
                                strokeDasharray: perimeter,
                                strokeDashoffset: perimeter * 0.25,
                                animation: 'spin-pill 1.4s linear infinite'
                            }}
                        />
                        {/* Glow tail rounded rect: thicker stroke + glow */}
                        <rect
                            x={ringWidth / 2}
                            y={ringWidth / 2}
                            width={inner_width}
                            height={inner_height}
                            fill='none'
                            stroke={glowColor}
                            strokeWidth={ringWidth * 1.5}
                            strokeLinecap='round'
                            rx={corner_radius}
                            ry={corner_radius}
                            style={{
                                strokeDasharray: perimeter,
                                strokeDashoffset: perimeter * 0.25,
                                filter: `drop-shadow(0 0 ${glowAmount}px ${glowColor})`,
                                animation: 'spin-pill 1.4s linear infinite'
                            }}
                        />
                    </svg>

                    <style>{`
                        @keyframes spin-pill {
                            0% {
                                stroke-dashoffset: ${perimeter};
                            }
                            100% {
                                stroke-dashoffset: 0;
                            }
                        }
                    `}</style>
                </div>
            );
        }
    }
}
