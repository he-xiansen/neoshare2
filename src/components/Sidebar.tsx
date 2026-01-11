import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Folder, Users, Settings, LogOut, LogIn, HardDrive, LayoutGrid } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useFileStore } from '../store/fileStore';
import clsx from 'clsx';

export const Sidebar: React.FC = () => {
  const { isAuthenticated, user, logout } = useAuthStore();
  const { currentType, setCurrentType, fetchFiles } = useFileStore();
  const navigate = useNavigate();

  const handleTypeChange = (type: 'public' | 'private') => {
    setCurrentType(type);
    fetchFiles('/', type);
    navigate('/');
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="w-64 bg-secondary h-screen flex flex-col border-r border-zinc-700">
      <div className="p-6 flex items-center space-x-2">
        <LayoutGrid className="w-8 h-8 text-primary" />
        <h1 className="text-2xl font-bold text-white tracking-wider">NeoShare</h1>
      </div>

      <nav className="flex-1 px-4 space-y-2">
        <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2 px-2">
          文件
        </div>
        
        <button
          onClick={() => handleTypeChange('public')}
          className={clsx(
            "w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors",
            currentType === 'public' 
              ? "bg-primary/10 text-primary border border-primary/20" 
              : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
          )}
        >
          <Users className="w-5 h-5" />
          <span>公共文件</span>
        </button>

        {isAuthenticated && (
          <button
            onClick={() => handleTypeChange('private')}
            className={clsx(
              "w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors",
              currentType === 'private' 
                ? "bg-primary/10 text-primary border border-primary/20" 
                : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
            )}
          >
            <HardDrive className="w-5 h-5" />
            <span>我的文件</span>
          </button>
        )}

        <div className="pt-6 text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2 px-2">
          账户
        </div>

        {isAuthenticated ? (
          <>
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                clsx(
                  "flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors",
                  isActive ? "bg-primary/10 text-primary" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                )
              }
            >
              <Settings className="w-5 h-5" />
              <span>设置</span>
            </NavLink>

            {user?.role === 'admin' && (
              <NavLink
                to="/admin/users"
                className={({ isActive }) =>
                  clsx(
                    "flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors",
                    isActive ? "bg-primary/10 text-primary" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                  )
                }
              >
                <Users className="w-5 h-5" />
                <span>用户管理</span>
              </NavLink>
            )}

            <button
              onClick={handleLogout}
              className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-zinc-400 hover:bg-red-500/10 hover:text-red-500 transition-colors mt-auto"
            >
              <LogOut className="w-5 h-5" />
              <span>退出登录</span>
            </button>
          </>
        ) : (
          <NavLink
            to="/login"
            className="flex items-center space-x-3 px-3 py-2 rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
          >
            <LogIn className="w-5 h-5" />
            <span>登录</span>
          </NavLink>
        )}
      </nav>

      {isAuthenticated && user && (
        <div className="p-4 border-t border-zinc-700 bg-zinc-900/50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
              {user.avatar_url ? (
                  <img src={user.avatar_url} alt={user.username} className="w-full h-full rounded-full object-cover" />
              ) : (
                  user.username[0].toUpperCase()
              )}
            </div>
            <div className="flex-1 overflow-hidden">
              <div className="text-sm font-medium text-white truncate">{user.nickname || user.username}</div>
              <div className="text-xs text-zinc-500 truncate">{user.signature || "暂无签名"}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
