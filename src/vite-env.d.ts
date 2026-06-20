/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

// 由 vite.config.ts 於建置時注入，用來在畫面上確認載入的是哪一版
declare const __BUILD_TIME__: string;
