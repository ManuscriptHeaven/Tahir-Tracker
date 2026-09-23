/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
          950: '#022c22',
        },
        tt: {
          bg: '#071724',
          bgDark: '#06131F',
          surface: '#0B1D2C',
          surface2: '#102638',
          elevated: '#122B3E',
          input: '#091A28',
          border: 'rgba(70, 150, 180, 0.18)',
          borderStrong: 'rgba(55, 210, 190, 0.32)',
          accent: '#18E6BE',
          accentHover: '#23F2CB',
          accentSoft: 'rgba(24, 230, 190, 0.10)',
          primary: '#F4F8FB',
          secondary: '#A9BDCC',
          muted: '#6F899B',
          success: '#14E6AA',
          danger: '#FF627B',
          warning: '#F7B733',
          info: '#39AFFF',
          purple: '#9B7BFF',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      screens: {
        'print': {'raw': 'print'},
      }
    },
  },
  plugins: [],
}
