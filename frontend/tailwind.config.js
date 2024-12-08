/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'notion-bg': '#EDEDED',
        'notion-tile': '#FFFFFF',
        'notion-text': '#37352F',
        'notion-gray': '#9B9A97'
      },
      boxShadow: {
        'notion-tile': '0 2px 4px rgba(0, 0, 0, 0.1)'
      }
    },
  },
  plugins: [],
}
