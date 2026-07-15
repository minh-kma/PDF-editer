/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Warm PDFAid-style palette
        cream: {
          DEFAULT: '#fdf6f1',
          card: '#fffaf6',
          soft: '#faefe7',
        },
        brand: {
          50: '#fff1ee',
          100: '#ffe0d9',
          200: '#ffc2b5',
          300: '#ff9c88',
          400: '#fb6f52',
          500: '#f4512c', // primary coral/red accent
          600: '#e23c18',
          700: '#bd2f11',
          800: '#9a2913',
          900: '#7f2716',
        },
        ink: {
          DEFAULT: '#2b2320',
          soft: '#6b5d55',
          faint: '#9a8a80',
        },
      },
      fontFamily: {
        sans: ['Nunito', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.5rem',
      },
      boxShadow: {
        card: '0 10px 30px -12px rgba(120, 60, 30, 0.18)',
        soft: '0 4px 16px -6px rgba(120, 60, 30, 0.15)',
      },
    },
  },
  plugins: [],
}
