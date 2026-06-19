import { Component, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false
  };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('FamilyLedger render error', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="grid min-h-screen place-items-center bg-page px-4">
          <div className="max-w-md rounded-xl border border-red-200 bg-white p-6 text-center shadow-sm">
            <h1 className="text-xl font-bold text-slate-900">這一頁剛剛沒有成功顯示</h1>
            <p className="mt-2 text-sm text-slate-600">請重新整理一次；如果還是一樣，我們再繼續查這筆資料。</p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
