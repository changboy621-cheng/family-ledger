import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        family: '#4F46E5',
        personal: '#0EA5E9',
        page: '#F8FAFC',
        ink: '#1E293B',
        muted: '#64748B'
      }
    }
  },
  plugins: []
} satisfies Config;
