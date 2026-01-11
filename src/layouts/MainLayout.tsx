import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';

export const MainLayout: React.FC = () => {
  return (
    <div className="flex h-screen bg-background text-text overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto relative flex flex-col">
        {/* 这里可以添加顶部 Header 如果需要，或者直接显示内容 */}
        <Outlet />
      </main>
    </div>
  );
};
