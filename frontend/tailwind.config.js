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
        darkBg: '#0B0E11',
        cardBg: '#161B22',
        cardHover: '#1D2430',
        borderGray: '#2A313C',
        brandGreen: '#00C076',
        brandRed: '#FF3B30',
        brandBlue: '#1D9BF0',
        brandOrange: '#FF9500',
        textMuted: '#8B949E',
        textNormal: '#C9D1D9',
        textBright: '#F0F6FC'
      },
      fontFamily: {
        sans: ['Inter', 'Outfit', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace']
      },
      animation: {
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'flash-green': 'flashGreen 0.6s ease-out',
        'flash-red': 'flashRed 0.6s ease-out'
      },
      keyframes: {
        flashGreen: {
          '0%': { backgroundColor: 'rgba(0, 192, 118, 0.2)' },
          '100%': { backgroundColor: 'transparent' }
        },
        flashRed: {
          '0%': { backgroundColor: 'rgba(255, 59, 48, 0.2)' },
          '100%': { backgroundColor: 'transparent' }
        }
      }
    },
  },
  plugins: [],
}
