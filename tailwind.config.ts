import type { Config } from 'tailwindcss'

export default {
	content: [
		'./index.html',
		'./src/**/*.{tsx,ts}'
	],
	theme: {
		extend: {
			fontFamily: {
				'bricolage-ss': '"Bricolage Grotesque", sans-serif',
				'ubuntu-mono': '"Ubuntu Mono", monospace',
				'noto-arabic': '"Noto Kufi Arabic", sans-serif',
			},
			keyframes: {
				fadeInUp: {
					'0%': { opacity: '0' },
					'100%': { opacity: '1' },
				},
				'fade-in-down': {
                    '0%': { opacity: '0', transform: 'translateY(-10px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                'fade-out-up': {
                    '0%': { opacity: '1', transform: 'translateY(0)' },
                    '100%': { opacity: '0', transform: 'translateY(-10px)' },
                },
			},
			animation: {
				'fade-in': 'fadeInUp 0.2s ease-out forwards',
				'fade-in-down': 'fade-in-down 0.3s ease-out forwards',
                'fade-out-up': 'fade-out-up 0.3s ease-in forwards',
			},
		},
	},
	plugins: [],
} satisfies Config
