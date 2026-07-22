/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // PDFChill coral/terracotta palette. Values marked (ref) are sampled
        // directly from reference_photos/pdfchill-website-mockup.pdf (rendered
        // at 2x and read per-pixel, cross-checked against the PDF's own fill
        // operators); the rest are interpolated to complete the scale.
        surface: {
          DEFAULT: '#ffe5d2', // (ref) page background
          card: '#ffffff', // (ref) cards sit white on the peach page wash
          soft: '#f3d9c7', // quiet warm inset panels / progress tracks,
          // interpolated toward the mockup's #eac5b1 divider tone.
        },
        // Coral at the light end, deep red/maroon at the action end — one
        // continuous ramp, so the strong button red is a step of this scale
        // rather than a separate token.
        brand: {
          50: '#fff1ea',
          100: '#ffb285', // (ref) drop-zone fill, privacy pill
          200: '#ff865b', // (ref) upload-icon circle
          300: '#ea4e2c',
          400: '#cd2411',
          500: '#b20000', // (ref) primary action buttons
          600: '#940000', // (ref) "Chill" wordmark, upload arrow — hover step
          700: '#740000', // (ref) privacy-pill text
          800: '#5c0000',
          900: '#450000',
        },
        // (ref) the logo wave sits in a warm sand against the teal badge.
        wave: '#ebddb9',
        ink: {
          DEFAULT: '#271511', // (ref) headings, "PDF" wordmark
          soft: '#5b4039', // (ref) body copy
          // The mockup's own faint text is #61453e — visually indistinguishable
          // from its body copy. Kept as a genuinely lighter third step so the
          // existing three-level hierarchy still reads.
          faint: '#8b7268',
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
        // Same geometry as before; only the shadow tint follows the palette
        // (was a cold teal-black, now warm, derived from ink).
        card: '0 10px 30px -12px rgba(58, 26, 20, 0.18)',
        soft: '0 4px 16px -6px rgba(58, 26, 20, 0.15)',
      },
    },
  },
  plugins: [],
}
