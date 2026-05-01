/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Cormorant Garamond', 'Georgia', 'serif'],
      },
      colors: {
        bg: 'rgb(var(--c-bg) / <alpha-value>)',
        surface: 'rgb(var(--c-surface) / <alpha-value>)',
        ink: 'rgb(var(--c-ink) / <alpha-value>)',
        muted: 'rgb(var(--c-muted) / <alpha-value>)',
        border: 'rgb(var(--c-border) / <alpha-value>)',
        primary: 'rgb(var(--c-primary) / <alpha-value>)',
        'primary-soft': 'rgb(var(--c-primary-soft) / <alpha-value>)',
        accent: 'rgb(var(--c-accent) / <alpha-value>)',
        'accent-soft': 'rgb(var(--c-accent-soft) / <alpha-value>)',
        rose: 'rgb(var(--c-rose) / <alpha-value>)',
        sage: 'rgb(var(--c-sage) / <alpha-value>)',
        danger: 'rgb(var(--c-danger) / <alpha-value>)',
        warning: 'rgb(var(--c-warning) / <alpha-value>)',
        success: 'rgb(var(--c-success) / <alpha-value>)',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)',
        lift: '0 4px 24px rgba(0,0,0,0.08)',
      },
      borderRadius: {
        xl2: '14px',
      },
    },
  },
  plugins: [],
};
