/** @type {import('tailwindcss').Config} */
export default {
    darkMode: ['class'],
    content: [
        './resources/views/**/*.blade.php',
        './resources/js/**/*.{js,jsx,ts,tsx}',
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Noto Sans Variable', 'Noto Sans', 'Helvetica Neue', 'Arial', 'ui-sans-serif', 'system-ui', 'sans-serif'],
                display: ['Noto Sans Variable', 'Noto Sans', 'Helvetica Neue', 'Arial', 'ui-sans-serif', 'system-ui', 'sans-serif'],
                mono: ['ui-monospace', 'SFMono-Regular', 'Consolas', 'Liberation Mono', 'monospace'],
            },
            colors: {
                border: 'hsl(var(--border))',
                input: 'hsl(var(--input))',
                ring: 'hsl(var(--ring))',
                background: 'hsl(var(--background))',
                foreground: 'hsl(var(--foreground))',
                sale: 'hsl(var(--sale))',
                surface: {
                    DEFAULT: 'hsl(var(--surface))',
                    muted: 'hsl(var(--surface-muted))',
                },
                primary: {
                    DEFAULT: 'hsl(var(--primary))',
                    foreground: 'hsl(var(--primary-foreground))',
                    hover: 'hsl(var(--primary-hover))',
                },
                secondary: {
                    DEFAULT: 'hsl(var(--secondary))',
                    foreground: 'hsl(var(--secondary-foreground))',
                },
                muted: {
                    DEFAULT: 'hsl(var(--muted))',
                    foreground: 'hsl(var(--muted-foreground))',
                },
                accent: {
                    DEFAULT: 'hsl(var(--accent))',
                    foreground: 'hsl(var(--accent-foreground))',
                },
                destructive: {
                    DEFAULT: 'hsl(var(--destructive))',
                    foreground: 'hsl(var(--destructive-foreground))',
                },
                popover: {
                    DEFAULT: 'hsl(var(--popover))',
                    foreground: 'hsl(var(--popover-foreground))',
                },
                card: {
                    DEFAULT: 'hsl(var(--card))',
                    foreground: 'hsl(var(--card-foreground))',
                },
                success: {
                    DEFAULT: 'hsl(var(--success))',
                    foreground: 'hsl(var(--success-foreground))',
                },
                warning: {
                    DEFAULT: 'hsl(var(--warning))',
                    foreground: 'hsl(var(--warning-foreground))',
                },
                info: {
                    DEFAULT: 'hsl(var(--info))',
                    foreground: 'hsl(var(--info-foreground))',
                },
            },
            borderRadius: {
                // Moderate corners for form surfaces (textarea, chips). Pills use rounded-full.
                sm: 'calc(var(--radius-control) - 2px)',
                DEFAULT: 'var(--radius-control)',
                md: 'var(--radius-control)',
                lg: 'var(--radius)',
                xl: 'calc(var(--radius) + 2px)',
                '2xl': '1rem',
                full: '9999px',
            },
            boxShadow: {
                soft: 'var(--shadow-soft)',
                float: 'var(--shadow-float)',
            },
            maxWidth: {
                page: '90rem',
                reading: '68ch',
            },
            transitionTimingFunction: {
                standard: 'var(--ease-standard)',
                emphasized: 'var(--ease-emphasized)',
            },
            zIndex: {
                header: '30',
                overlay: '40',
                modal: '50',
                toast: '60',
            },
        },
    },
    plugins: [],
};
