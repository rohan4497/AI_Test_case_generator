/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0B0F19',
        panel: 'rgba(30, 41, 59, 0.45)', // Glassmorphic background
        border: 'rgba(255, 255, 255, 0.1)',
        primary: '#6366f1',
        primaryHover: '#4f46e5',
        success: '#10b981',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
