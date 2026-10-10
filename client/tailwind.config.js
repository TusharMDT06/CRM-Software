/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: 'var(--color-bg)',
        card: 'var(--color-card)',
        'card-subtle': 'var(--color-card-subtle)',
        border: 'var(--color-border)',
        foreground: 'var(--color-text)',
        muted: 'var(--color-muted)',
        'muted-foreground': 'var(--color-muted)',
        brand: {
          DEFAULT: '#F07B2A',
          hover: '#E06A19',
          light: '#FDEBDD',
        },
        chart: {
          purple: '#8B7FE0',
          green: '#3FCB8A',
          blue: '#6F8BE8',
          orange: '#F07B2A',
        },
        badge: {
          'info-bg': 'var(--badge-info-bg)',
          'info-text': 'var(--badge-info-text)',
          'warning-bg': 'var(--badge-warning-bg)',
          'warning-text': 'var(--badge-warning-text)',
          'success-bg': 'var(--badge-success-bg)',
          'success-text': 'var(--badge-success-text)',
          'danger-bg': 'var(--badge-danger-bg)',
          'danger-text': 'var(--badge-danger-text)',
        },
      },
      borderRadius: {
        card: '16px',
        container: '20px',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
