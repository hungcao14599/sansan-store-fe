/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#203529',
        pine: '#29543c',
        saffron: '#c97a1b',
        cream: '#f6f1e8',
        sand: '#e6d9c7',
        rose: '#f0d6c9',
      },
      boxShadow: {
        panel: '0 20px 60px rgba(32, 53, 41, 0.08)',
      },
      backgroundImage: {
        grain:
          "radial-gradient(circle at 1px 1px, rgba(32,53,41,0.04) 1px, transparent 0)",
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        display: ['"Sora"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
