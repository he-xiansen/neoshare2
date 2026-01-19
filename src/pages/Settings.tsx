import React, { useState, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { client } from '../api/client';
import { Loader2, Save, Upload, Camera } from 'lucide-react';

const Settings: React.FC = () => {
  const { user, checkAuth, login } = useAuthStore();
  const [nickname, setNickname] = useState(user?.nickname || '');
  const [signature, setSignature] = useState(user?.signature || '');
  const [tempAvatarUrl, setTempAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Stable timestamp for avatar
  const [avatarTimestamp, setAvatarTimestamp] = useState(Date.now());
  
  // Update timestamp when user updates or temp avatar changes
  React.useEffect(() => {
      setAvatarTimestamp(Date.now());
  }, [user, tempAvatarUrl]);

  const getAvatarSrc = (url: string) => {
    if (!url) return '';
    if (url.startsWith('http') || url.startsWith('https')) {
      return url;
    }
    // 使用相对路径，让浏览器自动补全域名 (e.g. /uploads/...)
    // 或者使用环境变量配置的 API_URL 基础路径
    // 如果 url 是 /uploads/avatars/...，且 Nginx 代理了 /uploads，则直接返回 url
    if (url.startsWith('/')) {
        const baseUrl = import.meta.env.VITE_API_URL || '';
        // 如果 VITE_API_URL 包含 http，则拼接
        if (baseUrl.startsWith('http')) {
             // 简单的拼接逻辑，实际可能需要更严谨的处理
             // 这里假设后端返回的 url 是 /uploads/...
             // 而 VITE_API_URL 是 http://...:8000/api
             // 图片通常不在 /api 下，而在根目录下的 /uploads
             
             // 如果是在开发环境 (localhost)，且 VITE_API_URL 指向 8000
             const urlObj = new URL(baseUrl);
             return `${urlObj.origin}${url}`;
        }
        return url;
    }
    return url;
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
        const res = await client.post('/users/avatar', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        
        // 上传成功后立即同步全局用户状态
        if (checkAuth) await checkAuth();
        
        setMessage('头像更新成功');
        // 清除临时状态，让界面直接使用更新后的 user.avatar_url
        setTempAvatarUrl(null); 
    } catch (error) {
        console.error(error);
        setMessage('头像上传失败');
    } finally {
        setUploadingAvatar(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    
    try {
      if (!user) return;
      
      // 调用 PUT /api/users/{id}
      const updateData: any = {
          nickname,
          signature,
      };
      
      // 头像已在上传时实时保存，此处无需再次提交 avatar_url
      // 除非我们想支持“未保存时回滚”，但目前后端是立即覆盖的
      
      await client.put(`/users/${user.id}`, updateData);
      
      setMessage('资料更新成功');
      if (checkAuth) await checkAuth();
      
    } catch (error) {
      console.error(error);
      setMessage('更新失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-8">设置</h1>
      
      <div className="bg-secondary border border-zinc-700 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-6">个人资料</h2>
        
        {message && (
            <div className={`mb-6 p-3 rounded-lg text-sm ${message.includes('失败') ? 'text-red-500 bg-red-500/10' : 'text-green-500 bg-green-500/10'}`}>
                {message}
            </div>
        )}

        <div className="flex flex-col items-center mb-8">
            <div className="relative group cursor-pointer" onClick={handleAvatarClick}>
                <div className="w-24 h-24 rounded-full bg-zinc-800 overflow-hidden border-2 border-zinc-700 group-hover:border-primary transition-colors">
                    {(tempAvatarUrl || user?.avatar_url) ? (
                        <img 
                            key={avatarTimestamp} // 强制重新渲染图片组件
                            src={tempAvatarUrl ? `${getAvatarSrc(tempAvatarUrl)}?t=${avatarTimestamp}` : `${getAvatarSrc(user?.avatar_url || '')}?t=${avatarTimestamp}`} 
                            alt="Avatar" 
                            className="w-full h-full object-cover" 
                            onError={(e) => {
                                // 如果图片加载失败，回退到首字母显示
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.parentElement?.classList.add('flex', 'items-center', 'justify-center');
                                const fallback = document.createElement('div');
                                fallback.className = 'text-zinc-500 text-2xl font-bold';
                                fallback.innerText = user?.username?.[0]?.toUpperCase() || '?';
                                e.currentTarget.parentElement?.appendChild(fallback);
                            }}
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-500 text-2xl font-bold">
                            {user?.username?.[0]?.toUpperCase()}
                        </div>
                    )}
                    
                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Camera className="w-8 h-8 text-white" />
                    </div>
                    
                    {/* Loading Overlay */}
                    {uploadingAvatar && (
                        <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-10">
                            <Loader2 className="w-8 h-8 text-primary animate-spin" />
                        </div>
                    )}
                </div>
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*"
                    onChange={handleFileChange}
                />
            </div>
            <p className="text-xs text-zinc-500 mt-2">点击更换头像</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">用户名</label>
            <input
              type="text"
              value={user?.username}
              disabled
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 text-zinc-500 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">昵称</label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">个性签名</label>
            <textarea
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary transition-colors h-24 resize-none"
            />
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="bg-primary hover:bg-fuchsia-600 text-white font-medium px-6 py-2 rounded-lg transition-colors flex items-center space-x-2 disabled:opacity-50 w-full justify-center sm:w-auto"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>保存更改</span>
          </button>
        </form>
      </div>
    </div>
  );
};

export default Settings;
