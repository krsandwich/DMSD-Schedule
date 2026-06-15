/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Location colors (§4)
        kona: { DEFAULT: '#7c3aed', bg: '#ede9fe', border: '#c4b5fd' }, // purple
        waimea: { DEFAULT: '#2563eb', bg: '#dbeafe', border: '#93c5fd' }, // blue
        remote: { DEFAULT: '#16a34a', bg: '#dcfce7', border: '#86efac' }, // green
        off: { DEFAULT: '#9ca3af', bg: '#f3f4f6', border: '#e5e7eb' }, // light grey
      },
    },
  },
  plugins: [],
};
