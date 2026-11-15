import type { Config } from 'tailwindcss';

// 所有顏色都指向 styles.css 的 CSS 變數（R G B 三個數字），
// 深色模式只要切換變數，元件不用寫 dark: 樣式；也保留 /透明度 寫法（例如 ring-action/30）。
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;
const scale = (prefix: string, steps: number[]) =>
  Object.fromEntries(steps.map((step) => [step, v(`${prefix}-${step}`)]));

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        // 暖色中性階：取代冷灰 slate，深色模式自動反轉成可可棕夜色。
        slate: scale('n', [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]),
        // white 只用在「彩色底上的字」：淺色是白、深色是深可可，確保對比。卡片底色改用 card。
        white: v('on-accent'),
        black: 'rgb(0 0 0 / <alpha-value>)',
        page: v('page'),
        card: v('card'),
        ink: v('n-900'),
        muted: v('n-600'),
        // 唯一的動作色：只給可以按的東西。
        action: v('action'),
        actionSoft: v('action-soft'),
        // 帳本身分色：家庭綠、個人藍，只用來辨識帳本。
        family: v('family'),
        familySoft: v('family-soft'),
        personal: v('personal'),
        personalSoft: v('personal-soft'),
        // 圖表資料色：預設家庭綠，個人分析外層把 --ledger 換成個人藍。
        ledger: v('ledger'),
        red: scale('red', [50, 200, 400, 500, 600]),
        amber: scale('amber', [50, 100, 200, 500, 600, 700, 800]),
        emerald: scale('emerald', [100, 500, 600]),
        green: scale('green', [100, 200, 600, 700]),
        yellow: scale('yellow', [200])
      },
      fontFamily: {
        sans: [
          '"Nunito Variable"',
          '"PingFang TC"',
          '"Noto Sans TC"',
          '"Microsoft JhengHei"',
          'ui-sans-serif',
          'system-ui',
          'sans-serif'
        ]
      },
      borderRadius: {
        lg: '0.875rem',
        xl: '1.25rem',
        '2xl': '1.5rem'
      },
      boxShadow: {
        sm: '0 1px 2px rgb(var(--shadow) / 0.06)',
        DEFAULT: '0 2px 8px -2px rgb(var(--shadow) / 0.12)',
        md: '0 6px 16px -6px rgb(var(--shadow) / 0.18)',
        lg: '0 10px 28px -8px rgb(var(--shadow) / 0.30)',
        xl: '0 18px 44px -12px rgb(var(--shadow) / 0.35)'
      }
    }
  },
  plugins: []
} satisfies Config;
