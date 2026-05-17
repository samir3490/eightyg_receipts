import tailwindcssAnimate from 'tailwindcss-animate'

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: '#1a2744',
          gold: '#c9a227',
          cream: '#f7f4ed',
        },
      },
    },
  },
  plugins: [tailwindcssAnimate],
}
