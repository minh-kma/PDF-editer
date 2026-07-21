/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // PDFChill teal/blue palette. Values marked (ref) are taken verbatim
        // from reference_photos/pdfchill-logo.pdf and
        // reference_photos/pdfchill-website-mockup.pdf; the rest are
        // interpolated to complete the scale.
        surface: {
          DEFAULT: '#eff6fd', // (ref) page background
          card: '#ffffff', // (ref) cards sit white on the blue page wash
          soft: '#e9f0f6', // neutral inset panels / progress tracks
        },
        brand: {
          50: '#e8f6f7',
          100: '#d2eef1', // (ref) drop-zone fill, icon badge
          200: '#bce7ec', // (ref) privacy pill, soft borders
          300: '#7fd0d8',
          400: '#2f9ba5',
          500: '#006c76', // (ref) primary deep teal — logo badge, CTA, "Chill"
          600: '#00636d', // (ref)
          700: '#005661', // (ref)
          800: '#06474e',
          900: '#0a3b41',
        },
        // (ref) the logo wave sits in a warm sand against the teal badge.
        wave: '#ebddb9',
        ink: {
          DEFAULT: '#1a2026', // (ref) headings, "PDF" wordmark
          soft: '#4d5660', // (ref) body copy
          faint: '#8a929c',
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
        card: '0 10px 30px -12px rgba(12, 45, 55, 0.18)',
        soft: '0 4px 16px -6px rgba(12, 45, 55, 0.15)',
      },
    },
  },
  plugins: [],
}
