/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'wunari-purple': '#6D28D9',
        'wunari-dark': '#4C1D95',
      },
    },
  },
  plugins: [],
}