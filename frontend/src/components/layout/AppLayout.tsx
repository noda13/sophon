import React from 'react';
import { StrategySelector } from '../ranking/StrategySelector';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-gray-900 text-gray-100">
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold text-white">waga-scope</h1>
              <p className="text-sm text-gray-400 mt-0.5">清原流バリュー・スクリーナー</p>
            </div>
            <StrategySelector />
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        {children}
      </main>

      <footer className="bg-gray-800 border-t border-gray-700 px-6 py-4">
        <div className="max-w-7xl mx-auto text-center text-sm text-gray-500">
          本ツールは投資判断支援を目的とし、個別銘柄の推奨ではありません。
          投資に関する最終判断はご自身の責任で行ってください。
        </div>
      </footer>
    </div>
  );
}
