import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import './styles.css';

// 偵測到新版本就自動更新並重新載入，避免 PWA 卡在舊版快取顯示舊畫面
registerSW({ immediate: true });

// 部署新版後，舊頁面要載入的分頁程式檔（含雜湊檔名）已不存在，動態載入會失敗。
// 遇到這種情況自動重新載入一次拿新版；用 sessionStorage 防止無限重載。
const RELOAD_KEY = 'fl_chunk_reload_at';
window.addEventListener('vite:preloadError', (event) => {
  let last = 0;
  try {
    last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
  } catch {
    // 無痕模式等情況讀不到就當作沒重載過
  }
  if (Date.now() - last < 10_000) return; // 10 秒內已重載過，交給錯誤畫面處理
  event.preventDefault();
  try {
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    // 寫不進去也照樣重載
  }
  window.location.reload();
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
