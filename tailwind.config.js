/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  // ИСПРАВЛЕНО: Добавлена эта строка для включения тем
  darkMode: 'class',
  theme: {
    extend: {},
  },
  plugins: [],
}
