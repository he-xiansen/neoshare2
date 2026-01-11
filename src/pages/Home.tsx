import React, { useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useFileStore, FileItem } from '../store/fileStore';
import { useAuthStore } from '../store/authStore';
import { Search, Grid, List as ListIcon, Loader2, File as FileIcon, Folder, Download, Trash2, MoreVertical } from 'lucide-react';
import clsx from 'clsx';

const Home: React.FC = () => {
  const { 
    files, isLoading, viewMode, setViewMode, fetchFiles, currentType, 
    uploadFile, isUploading, uploadProgress, deleteFile, downloadFile 
  } = useFileStore();
  const { isAuthenticated, user } = useAuthStore();

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      // 仅处理第一个文件示例，或者循环处理
      for (const file of acceptedFiles) {
        try {
          await uploadFile(file);
        } catch (error) {
          alert('上传失败');
        }
      }
    }
  }, [uploadFile]);

  // 只有在已登录且在私有目录，或者（如果是公共目录且允许上传？）
  // PRD: "用户登录后可以将本地文件拖入文件资源管理器" -> 登录用户可以拖入。
  // 未登录不能拖入。
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    noClick: true,
    noKeyboard: true,
    disabled: !isAuthenticated
  });

  const handleDelete = async (e: React.MouseEvent, fileId: number) => {
    e.stopPropagation();
    if (confirm('确认删除此文件吗？')) {
        await deleteFile(fileId);
    }
  };

  const handleDownload = (e: React.MouseEvent, file: FileItem) => {
      e.stopPropagation();
      downloadFile(file.id, file.name);
  };

  return (
    <div className="flex-1 flex flex-col h-full relative" {...getRootProps()}>
      <input {...getInputProps()} />
      
      {/* Upload Progress Bar */}
      {isUploading && (
          <div className="absolute top-0 left-0 w-full h-2 bg-zinc-800 z-50">
              <div 
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300 ease-out shadow-[0_0_10px_rgba(217,70,239,0.5)]"
                style={{ width: `${uploadProgress}%` }}
              />
          </div>
      )}

      {/* Drag Overlay */}
      {isDragActive && (
          <div className="absolute inset-0 bg-primary/10 border-2 border-dashed border-primary z-40 flex items-center justify-center backdrop-blur-sm">
              <div className="text-primary text-xl font-bold">拖拽文件至此上传</div>
          </div>
      )}

      {/* Top Bar */}
      <header className="h-16 border-b border-zinc-700 flex items-center justify-between px-6 bg-secondary/50 backdrop-blur-sm">
        <div className="flex items-center flex-1 max-w-xl">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-500 w-4 h-4" />
            <input 
              type="text" 
              placeholder="搜索文件..." 
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-primary transition-colors text-white"
            />
          </div>
        </div>

        <div className="flex items-center space-x-4 ml-4">
           <div className="flex items-center bg-zinc-900 rounded-lg p-1 border border-zinc-700">
             <button 
               onClick={() => setViewMode('list')}
               className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'}`}
             >
               <ListIcon className="w-4 h-4" />
             </button>
             <button 
               onClick={() => setViewMode('grid')}
               className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'}`}
             >
               <Grid className="w-4 h-4" />
             </button>
           </div>
        </div>
      </header>

      {/* File Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="mb-4 flex items-center justify-between">
           <h2 className="text-xl font-semibold text-white">
             {currentType === 'public' ? '公共文件' : '我的文件'}
           </h2>
           <span className="text-zinc-500 text-sm">{files.length} 个项目</span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : (
          <div>
            {files.length === 0 ? (
              <div className="text-center text-zinc-500 py-20">
                <p>暂无文件</p>
                {isAuthenticated ? (
                    <p className="text-sm mt-2">拖拽文件至此上传</p>
                ) : (
                    <p className="text-sm mt-2">登录后可上传文件</p>
                )}
              </div>
            ) : (
              <div className={viewMode === 'grid' ? "grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4" : "space-y-2"}>
                {files.map(file => (
                  <div 
                    key={file.id} 
                    className={clsx(
                        "group bg-zinc-800/50 border border-zinc-700/50 hover:border-primary/50 hover:bg-zinc-800 transition-all cursor-pointer rounded-lg p-3 relative",
                        viewMode === 'list' ? 'flex items-center space-x-4' : 'flex flex-col items-center text-center space-y-3'
                    )}
                    onDoubleClick={(e) => handleDownload(e, file)}
                  >
                    {/* Icon */}
                    <div className="w-10 h-10 bg-zinc-700/50 rounded flex items-center justify-center text-zinc-400">
                       {file.type === 'directory' ? <Folder className="w-6 h-6" /> : <FileIcon className="w-6 h-6" />}
                    </div>
                    
                    {/* Info */}
                    <div className="flex-1 min-w-0 text-left w-full">
                      <h3 className="text-sm font-medium text-white truncate" title={file.name}>{file.name}</h3>
                      <p className="text-xs text-zinc-500">{file.size > 0 ? `${(file.size / 1024).toFixed(1)} KB` : '0 KB'}</p>
                    </div>

                    {/* Actions (Hover) */}
                    <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity flex space-x-1 bg-zinc-800 rounded-md p-1 shadow-lg">
                        <button onClick={(e) => handleDownload(e, file)} className="p-1 hover:text-primary text-zinc-400" title="下载">
                            <Download className="w-4 h-4" />
                        </button>
                        {(isAuthenticated && (user?.role === 'admin' || user?.id === file.user_id)) && (
                            <button onClick={(e) => handleDelete(e, file.id)} className="p-1 hover:text-red-500 text-zinc-400" title="删除">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;
