import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
  	container: {
  		center: true,
  		padding: '2rem',
  		screens: {
  			'2xl': '1400px'
  		}
  	},
  	extend: {
  		colors: {
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			},
  			status: {
  				new: 'hsl(var(--status-new))',
  				'new-foreground': 'hsl(var(--status-new-foreground))',
  				design: 'hsl(var(--status-design))',
  				'design-foreground': 'hsl(var(--status-design-foreground))',
  				production: 'hsl(var(--status-production))',
  				'production-foreground': 'hsl(var(--status-production-foreground))',
  				shipping: 'hsl(var(--status-shipping))',
  				'shipping-foreground': 'hsl(var(--status-shipping-foreground))',
  				delivered: 'hsl(var(--status-delivered))',
  				'delivered-foreground': 'hsl(var(--status-delivered-foreground))'
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
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
  			'auth-panel-in': {
  				from: { opacity: '0', transform: 'translateX(28px)' },
  				to: { opacity: '1', transform: 'translateX(0)' }
  			},
  			'auth-mesh-drift': {
  				'0%, 100%': { transform: 'translate(0%, 0%) scale(1)' },
  				'50%': { transform: 'translate(4%, -3%) scale(1.05)' }
  			},
  			'auth-float': {
  				'0%, 100%': { transform: 'translateY(0)' },
  				'50%': { transform: 'translateY(-10px)' }
  			},
  			'auth-float-reverse': {
  				'0%, 100%': { transform: 'translateY(0)' },
  				'50%': { transform: 'translateY(9px)' }
  			},
  			'auth-card-breathe': {
  				'0%, 100%': { transform: 'scale(1)' },
  				'50%': { transform: 'scale(1.015)' }
  			},
  			'auth-shimmer': {
  				'0%': { opacity: '0.55' },
  				'50%': { opacity: '1' },
  				'100%': { opacity: '0.55' }
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out',
  			'auth-panel-in': 'auth-panel-in 0.9s cubic-bezier(0.22, 1, 0.36, 1) both',
  			'auth-mesh-drift': 'auth-mesh-drift 22s ease-in-out infinite',
  			'auth-mesh-drift-slow': 'auth-mesh-drift 30s ease-in-out infinite reverse',
  			'auth-float': 'auth-float 5.5s ease-in-out infinite',
  			'auth-float-reverse': 'auth-float-reverse 6.5s ease-in-out infinite',
  			'auth-card-breathe': 'auth-card-breathe 7s ease-in-out infinite',
  			'auth-shimmer': 'auth-shimmer 3.5s ease-in-out infinite'
  		},
  		boxShadow: {
  			'2xs': 'var(--shadow-2xs)',
  			xs: 'var(--shadow-xs)',
  			sm: 'var(--shadow-sm)',
  			md: 'var(--shadow-md)',
  			lg: 'var(--shadow-lg)',
  			xl: 'var(--shadow-xl)',
  			'2xl': 'var(--shadow-2xl)'
  		},
  		fontFamily: {
  			sans: [
  				'Montserrat',
  				'ui-sans-serif',
  				'system-ui',
  				'-apple-system',
  				'BlinkMacSystemFont',
  				'Segoe UI',
  				'Roboto',
  				'Helvetica Neue',
  				'Arial',
  				'Noto Sans',
  				'sans-serif'
  			],
  			serif: [
  				'Cormorant Garamond',
  				'ui-serif',
  				'Georgia',
  				'Cambria',
  				'Times New Roman',
  				'Times',
  				'serif'
  			],
  			mono: [
  				'IBM Plex Mono',
  				'ui-monospace',
  				'SFMono-Regular',
  				'Menlo',
  				'Monaco',
  				'Consolas',
  				'Liberation Mono',
  				'Courier New',
  				'monospace'
  			],
  			arabic: [
  				'Cairo',
  				'Tajawal',
  				'Noto Sans Arabic',
  				'Segoe UI',
  				'Tahoma',
  				'sans-serif'
  			]
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
