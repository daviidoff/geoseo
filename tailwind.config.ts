import type { Config } from 'tailwindcss'

const config: Config = {
    darkMode: ['class'],
    content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
  	extend: {
  		screens: {
  			xs: '475px'
  		},
  		fontSize: {
  			'responsive-xs': 'clamp(0.75rem, 2vw + 0.25rem, 0.875rem)',
  			'responsive-sm': 'clamp(0.875rem, 2.5vw + 0.25rem, 1rem)',
  			'responsive-base': 'clamp(1rem, 2.5vw + 0.5rem, 1.125rem)',
  			'responsive-lg': 'clamp(1.125rem, 3vw + 0.5rem, 1.25rem)',
  			'responsive-xl': 'clamp(1.25rem, 3.5vw + 0.5rem, 1.5rem)',
  			'responsive-2xl': 'clamp(1.5rem, 4vw + 0.75rem, 1.875rem)',
  			'responsive-3xl': 'clamp(1.875rem, 5vw + 1rem, 2.25rem)',
  		},
  		colors: {
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
  		},
  		borderRadius: {
  			sm: 'calc(var(--radius) - 4px)',
  			DEFAULT: '0.375rem',
  			md: 'calc(var(--radius) - 2px)',
  			lg: 'var(--radius)',
  			xl: '0.75rem',
  			'2xl': '1rem'
  		},
  		fontFamily: {
  			sans: [
  				'var(--font-geist-sans)'
  			],
  			mono: [
  				'var(--font-geist-mono)'
  			]
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			},
'shimmer': {
				'0%': { transform: 'translateX(-100%)' },
				'100%': { transform: 'translateX(100%)' }
			},
			'gradient': {
				'0%': { backgroundPosition: '0% 50%' },
				'50%': { backgroundPosition: '100% 50%' },
				'100%': { backgroundPosition: '0% 50%' }
			}
		},
		animation: {
			'accordion-down': 'accordion-down 0.2s ease-out',
			'accordion-up': 'accordion-up 0.2s ease-out',
			'shimmer': 'shimmer 1.5s ease-in-out infinite',
			'gradient': 'gradient 2s ease infinite'
		},
  		spacing: {
  			'touch-target': '44px',
  			'touch-target-sm': '40px',
  			'touch-target-lg': '48px',
  		},
  		minHeight: {
  			'touch': '44px',
  			'touch-sm': '40px',
  			'touch-lg': '48px',
  		},
  		minWidth: {
  			'touch': '44px',
  			'touch-sm': '40px',
  			'touch-lg': '48px',
  		}
  	}
  },
  plugins: [require('tailwindcss-animate')],
}

export default config

