import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        surface2: 'var(--surface2)',
        border: 'var(--border)',
        accent: 'var(--accent)',
        'accent-hover': 'var(--accent-hover)',
        cta: 'var(--cta)',
        'cta-hover': 'var(--cta-hover)',
        success: 'var(--success)',
        danger: 'var(--danger)',
        ink: 'var(--ink)',
        muted: 'var(--muted)',
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '10px',
        lg: '14px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(28,28,46,.06), 0 8px 24px rgba(28,28,46,.04)',
        pop: '0 4px 12px rgba(28,28,46,.08), 0 16px 48px rgba(28,28,46,.08)',
      },
    },
  },
  plugins: [],
};

export default config;
