import { create } from 'zustand';
import { client } from '../api/client';

export interface FileItem {
  id: number;
  name: string;
  path: string;
  type: 'file' | 'directory';
  size: number;
  mime_type?: string;
  is_public: boolean;
  updated_at: string;
  user_id: number;
}

interface FileState {
  files: FileItem[];
  currentPath: string;
  viewMode: 'list' | 'grid';
  isLoading: boolean;
  isUploading: boolean;
  uploadProgress: number;
  currentType: 'public' | 'private';
  
  setFiles: (files: FileItem[]) => void;
  setCurrentPath: (path: string) => void;
  setViewMode: (mode: 'list' | 'grid') => void;
  setCurrentType: (type: 'public' | 'private') => void;
  
  fetchFiles: (path?: string, type?: 'public' | 'private') => Promise<void>;
  uploadFile: (file: File) => Promise<void>;
  deleteFile: (fileId: number) => Promise<void>;
  downloadFile: (fileId: number, fileName: string) => Promise<void>;
}

export const useFileStore = create<FileState>((set, get) => ({
  files: [],
  currentPath: '/',
  viewMode: 'list',
  isLoading: false,
  isUploading: false,
  uploadProgress: 0,
  currentType: 'public',

  setFiles: (files) => set({ files }),
  setCurrentPath: (path) => set({ currentPath: path }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setCurrentType: (type) => set({ currentType: type, currentPath: '/' }),

  fetchFiles: async (path, type) => {
    set({ isLoading: true });
    const { currentPath, currentType } = get();
    const targetPath = path !== undefined ? path : currentPath;
    const targetType = type !== undefined ? type : currentType;
    
    try {
      const endpoint = targetType === 'public' ? '/files/list/public' : '/files/list/private';
      const res = await client.get(endpoint, {
        params: { path: targetPath }
      });
      set({ 
        files: res.data, 
        currentPath: targetPath, 
        currentType: targetType,
        isLoading: false 
      });
    } catch (error) {
      console.error('Failed to fetch files:', error);
      set({ isLoading: false });
    }
  },

  uploadFile: async (file) => {
    set({ isUploading: true, uploadProgress: 0 });
    const { currentPath, currentType, fetchFiles } = get();
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('path', currentPath);
    formData.append('is_public', String(currentType === 'public'));

    try {
      await client.post('/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const progress = progressEvent.total
            ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
            : 0;
          set({ uploadProgress: progress });
        },
      });
      await fetchFiles();
    } catch (error) {
      console.error('Failed to upload file:', error);
      throw error;
    } finally {
      // 延迟关闭进度条以显示 100%
      setTimeout(() => {
        set({ isUploading: false, uploadProgress: 0 });
      }, 1000);
    }
  },

  deleteFile: async (fileId) => {
    try {
      await client.delete(`/files/${fileId}`);
      await get().fetchFiles();
    } catch (error) {
      console.error('Failed to delete file:', error);
      throw error;
    }
  },

  downloadFile: async (fileId, fileName) => {
    try {
      const response = await client.get(`/files/download/${fileId}`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Failed to download file:', error);
    }
  },
}));
