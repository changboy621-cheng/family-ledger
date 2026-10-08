import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        family: '#15805E',
        familySoft: '#E1F5EE',
        personal: '#256BB5',
        personalSoft: '#E6F1FB',
        page: '#EEF2F7',
        ink: '#1E293B',
        muted: '#64748B'
      }
    }
  },
  plugins: []
} satisfies Config;
