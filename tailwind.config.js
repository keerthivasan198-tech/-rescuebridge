/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Primary emerald-green (matches screenshot)
        primary: {
          50:  '#f0fdf6',
          100: '#dcfce9',
          200: '#bbf7d2',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
        // Near-black for headings
        ink: {
          DEFAULT: '#0f1721',
          soft:    '#1e293b',
          muted:   '#475569',
          subtle:  '#94a3b8',
        },
        // Surface colours
        surface: {
          DEFAULT: '#ffffff',
          subtle:  '#f8fafc',
          raised:  '#f1f5f9',
          border:  '#e2e8f0',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px 0 rgba(0,0,0,.06), 0 1px 2px -1px rgba(0,0,0,.04)',
        'card-md': '0 4px 12px 0 rgba(0,0,0,.07), 0 1px 3px -1px rgba(0,0,0,.05)',
        'card-lg': '0 8px 24px 0 rgba(0,0,0,.09), 0 2px 6px -1px rgba(0,0,0,.06)',
      },
    },
  },
  plugins: [],
}
