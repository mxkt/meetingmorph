import type { Config } from 'tailwindcss';

export default {
  content: [
    './src/**/*.{ts,tsx,html}',
    './public/**/*.html',
  ],
  theme: {
    extend: {
      colors: {
        accent: '#10b981',
        surface: '#141414',
        'bg-dark': '#0a0a0a',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config;
