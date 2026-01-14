import React, { useEffect, useCallback, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { useFileStore, FileItem } from '../store/fileStore';
import { useAuthStore } from '../store/authStore';
import { Search, Grid, List as ListIcon, Loader2, File as FileIcon, Folder, Download, Trash2, MoreVertical, Upload, FolderPlus } from 'lucide-react';
import clsx from 'clsx';
import { FileViewer } from '../components/FileViewer';
import { InputModal } from '../components/InputModal';
import { FileIconComponent } from '../components/FileIcon';

const Home: React.FC = () => {
  const { 
    files, isLoading, viewMode, setViewMode, fetchFiles, currentType, currentPath, setCurrentPath,
    uploadFile, createFolder, isUploading, uploadProgress, deleteFile, downloadFile 
  } = useFileStore();

  const location = useLocation();
  const navigate = useNavigate();

  // Sync URL with current path
  useEffect(() => {
      const pathFromUrl = decodeURIComponent(location.pathname);
      let targetPath = pathFromUrl;
      
      // Remove trailing slash if it exists and path is not root
      if (targetPath.length > 1 && targetPath.endsWith('/')) {
          targetPath = targetPath.slice(0, -1);
      }
      
      // If path matches current path, do nothing
      if (targetPath === currentPath) return;

      // Update store and fetch files
      fetchFiles(targetPath);
  }, [location.pathname, currentPath, fetchFiles]);

  const [isCreateFolderModalOpen, setIsCreateFolderModalOpen] = useState(false);

  const handleCreateFolder = async (name: string) => {
    try {
      await createFolder(name);
      setIsCreateFolderModalOpen(false);
    } catch (error) {
      alert('创建文件夹失败');
    }
  };
  
  const handleNavigate = (path: string) => {
      // 导航到指定路径
      fetchFiles(path);
  };
  
  const handleGoBack = () => {
      // 返回上一级
      if (currentPath === '/') return;
      
      const parts = currentPath.split('/');
      parts.pop(); // 移除最后一部分
      
      // 如果只剩空字符串（因为 split '/' 产生的第一个空元素），则为 '/'
      // 例如："/test2".split('/') -> ["", "test2"] -> pop -> [""] -> join -> "" (空字符串)
      // 例如："/test2/sub".split('/') -> ["", "test2", "sub"] -> pop -> ["", "test2"] -> join -> "/test2"
      
      let newPath = parts.join('/');
      if (newPath === '') newPath = '/';
      
      navigate(newPath);
  };

  const { isAuthenticated, user } = useAuthStore();
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // 防抖搜索
  useEffect(() => {
      const timer = setTimeout(() => {
          if (searchQuery) {
              fetchFiles(undefined, undefined, searchQuery);
          } else {
              // 如果清空搜索，重新加载当前路径
              fetchFiles();
          }
      }, 500);
      
      return () => clearTimeout(timer);
  }, [searchQuery, fetchFiles]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      for (const file of acceptedFiles) {
        try {
          // 尝试获取文件的相对路径（如果是文件夹拖拽）
          // react-dropzone 提供的 path 属性通常包含相对路径
          const filePath = (file as any).path || (file as any).webkitRelativePath || file.name;
          
          // 解析路径获取文件夹结构
          // 例如 /folder/file.txt -> relativeFolder = "/folder"
          // 如果是根目录文件 /file.txt -> relativeFolder = ""
          // 如果直接拖拽文件 a.txt -> /a.txt -> relativeFolder = ""
          
          let relativeFolder = '';
          if (filePath) {
              const parts = filePath.split('/');
              // split '/test2/1.txt' -> ['', 'test2', '1.txt']
              // split '/1.txt' -> ['', '1.txt']
              // split '1.txt' -> ['1.txt']
              
              if (parts.length > 0) {
                  // 移除文件名
                  parts.pop(); 
                  // 重新组合
                  relativeFolder = parts.join('/');
              }
          }
          
          // 调试日志
          console.log('Uploading file:', file.name, 'Path:', filePath, 'Relative:', relativeFolder);
          
          await uploadFile(file, relativeFolder);
        } catch (error) {
          console.error('Upload failed', error);
          alert(`上传失败: ${file.name}`);
        }
      }
    }
  }, [uploadFile]);

  // 只有在已登录且在私有目录，或者（如果是公共目录且允许上传？）
  // PRD: "用户登录后可以将本地文件拖入文件资源管理器" -> 登录用户可以拖入。
  // 未登录不能拖入。
  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
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

  const handleFileDoubleClick = (e: React.MouseEvent, file: FileItem) => {
      e.stopPropagation();
      if (file.type === 'directory') {
          // 进入目录
          const newPath = currentPath === '/' ? `/${file.name}` : `${currentPath}/${file.name}`;
          navigate(newPath);
          return;
      }
      
      // 检查文件是否可以编辑
      // 如果不是目录，且支持编辑，则打开编辑/预览
      // 如果不支持预览，可能是二进制文件，提示下载
      // 目前 previewFile 逻辑是在 FileViewer 中处理，FileViewer 会决定是显示图片、PDF 还是代码编辑器
      setPreviewFile(file);
  };

  return (
    <div className="flex-1 flex flex-col h-full relative" {...getRootProps()}>
      {previewFile && (
          <FileViewer file={previewFile} onClose={() => setPreviewFile(null)} />
      )}

      <InputModal
        isOpen={isCreateFolderModalOpen}
        onClose={() => setIsCreateFolderModalOpen(false)}
        onSubmit={handleCreateFolder}
        title="新建文件夹"
        placeholder="请输入文件夹名称"
      />

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
        <div className="flex items-center flex-1 max-w-xl space-x-4">
          {/* Back Button */}
          <button 
            onClick={handleGoBack}
            disabled={currentPath === '/'}
            className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="返回上一级"
          >
             <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          
          {/* Breadcrumb / Path Display (Simple) */}
          <div className="text-sm font-medium text-zinc-300 truncate max-w-[200px]">
             {currentPath}
          </div>

          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-500 w-4 h-4" />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
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
           <div className="flex items-center space-x-4">
               <span className="text-zinc-500 text-sm hidden sm:block">{files.length} 个项目</span>
               {isAuthenticated && (
                   <>
                       <button 
                           onClick={() => setIsCreateFolderModalOpen(true)}
                           className="flex items-center space-x-1 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm transition-colors border border-zinc-700"
                       >
                           <FolderPlus className="w-4 h-4" />
                           <span>新建文件夹</span>
                       </button>
                       <button 
                           onClick={open}
                           className="flex items-center space-x-1 px-3 py-1.5 bg-primary hover:bg-fuchsia-600 text-white rounded-lg text-sm transition-colors"
                       >
                           <Upload className="w-4 h-4" />
                           <span>上传文件</span>
                       </button>
                   </>
               )}
           </div>
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
                    onDoubleClick={(e) => handleFileDoubleClick(e, file)}
                  >
                    {/* Icon */}
                    <div className="w-10 h-10 bg-zinc-700/50 rounded flex items-center justify-center text-zinc-400">
                       <FileIconComponent fileName={file.name} isDir={file.type === 'directory'} className="w-6 h-6" />
                    </div>
                    
                    {/* Info */}
                    <div className="flex-1 min-w-0 text-left w-full">
                      <h3 className="text-sm font-medium text-white truncate" title={file.name}>{file.name}</h3>
                      <div className="flex items-center text-xs text-zinc-500 space-x-2">
                          <span>{file.size > 0 ? `${(file.size / 1024).toFixed(1)} KB` : '0 KB'}</span>
                          {searchQuery && (
                              <span className="text-zinc-300 bg-zinc-700/50 px-2 py-0.5 rounded truncate max-w-[200px]" title={file.path}>
                                  {file.path}
                              </span>
                          )}
                      </div>
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
