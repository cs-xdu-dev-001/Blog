import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        ink: '#000000',
        paper: '#ffffff',
        graphite: '#404040',
        muted: '#808080',
        hairline: '#e5e5e5',
        wash: '#f5f5f5',
        link: '#0066ff',
      },
      fontFamily: {
        sans: ['Inter', '"Helvetica Neue"', '"SF Pro Display"', 'Arial', 'sans-serif'],
      },
      transitionTimingFunction: {
        minimal: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [typography],
};
