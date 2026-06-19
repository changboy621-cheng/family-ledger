import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        family: '#1D9E75',
        familySoft: '#E1F5EE',
        personal: '#378ADD',
        personalSoft: '#E6F1FB',
        page: '#EEF2F7',
        ink: '#1E293B',
        muted: '#64748B'
      }
    }
  },
  plugins: []
} satisfies Config;
