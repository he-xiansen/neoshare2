import React, { useEffect, useState } from 'react';
import { X, Loader2, Save, Check, Eye, PenLine, AlertCircle, ExternalLink, Code2 } from 'lucide-react';
import { client } from '../api/client';
import { FileItem } from '../store/fileStore';
import { useAuthStore } from '../store/authStore';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { NotebookViewer } from './NotebookViewer';
import { ExcelPreview } from './preview/ExcelPreview';
import { WordPreview } from './preview/WordPreview';

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-red-500 p-4">
          <AlertCircle className="w-8 h-8 mb-2" />
          <p>预览渲染出错</p>
          <p className="text-xs text-zinc-500 mt-2">{this.state.error?.message}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

interface FileViewerProps {
  file: FileItem;
  onClose: () => void;
}

export const FileViewer: React.FC<FileViewerProps> = ({ file, onClose }) => {
  const { isAuthenticated, user } = useAuthStore();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [useJupyter, setUseJupyter] = useState(false);

  // 判断文件类型
  const isImage = file.mime_type?.startsWith('image/');
  const isPdf = file.mime_type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  const isMarkdown = file.name.endsWith('.md') || file.mime_type === 'text/markdown';
  const isIpynb = file.name.endsWith('.ipynb');
  const isExcel = file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls') || file.name.toLowerCase().endsWith('.csv');
  const isWord = file.name.toLowerCase().endsWith('.docx');
  const isText = !isImage && !isPdf && !isExcel && !isWord && (
    file.mime_type?.startsWith('text/') || 
    file.mime_type === 'application/json' ||
    file.mime_type === 'application/javascript' ||
    file.mime_type === 'application/x-python' ||
    file.name.endsWith('.md') ||
    file.name.endsWith('.py') ||
    file.name.endsWith('.ts') ||
    file.name.endsWith('.tsx') ||
    file.name.endsWith('.json')
  );

  const canEdit = isText && (file.is_public || (isAuthenticated && (user?.role === 'admin' || user?.id === file.user_id)));

  // Jupyter URL Calculation
  // Use current hostname but port 8888 by default, or override with env var
  const jupyterBaseUrl = import.meta.env.VITE_JUPYTER_URL || `${window.location.protocol}//${window.location.hostname}:8888`;
  // Hardcoded token for development convenience matching the launch script
  const JUPYTER_TOKEN = 'neoshare2024'; 
  
  const getJupyterUrl = () => {
      const rootDir = file.is_public ? 'public' : `${file.user_id}`;
      const cleanPath = file.path.startsWith('/') ? file.path.slice(1) : file.path;
      const filePath = [rootDir, cleanPath, file.name].filter(Boolean).join('/');
      
      const baseUrl = isIpynb 
        ? `${jupyterBaseUrl}/notebooks/${filePath}`
        : `${jupyterBaseUrl}/edit/${filePath}`;
      
      return `${baseUrl}?token=${JUPYTER_TOKEN}`;
  };
  const jupyterUrl = getJupyterUrl();

  useEffect(() => {
    if (isText || isIpynb) {
      setUseJupyter(true);
    } else {
      setUseJupyter(false);
    }
  }, [file, isText, isIpynb]);

  useEffect(() => {
    if (isText && !useJupyter) {
      fetchContent();
    }
  }, [file, useJupyter]);

  // 如果是 Markdown，默认进入预览模式；其他文本默认进入编辑模式（如果可编辑）
  useEffect(() => {
    if (canEdit && !isMarkdown) {
      setIsEditing(true);
    }
  }, [canEdit, isMarkdown]);

  useEffect(() => {
    if (saveSuccess) {
      const timer = setTimeout(() => {
        setSaveSuccess(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [saveSuccess]);

  const fetchContent = async () => {
    setLoading(true);
    try {
      if (isIpynb && !isEditing) {
        const res = await client.get(`/files/preview/${file.id}`);
        setContent(res.data.html);
      } else {
        const res = await client.get(`/files/content/${file.id}`);
        setContent(res.data.content);
      }
    } catch (err) {
      setError('无法加载文件内容');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await client.put(`/files/content/${file.id}`, { content });
      setSaveSuccess(true);
    } catch (err) {
      alert('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const downloadUrl = `${client.defaults.baseURL}/files/download/${file.id}`;
  const previewUrl = `${downloadUrl}?preview=true`;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-zinc-900 w-full max-w-5xl h-[85vh] rounded-xl border border-zinc-700 flex flex-col shadow-2xl overflow-hidden relative">
        {/* Save Success Overlay */}
        {saveSuccess && (
          <div className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-green-500/90 text-white px-6 py-2 rounded-full shadow-lg flex items-center space-x-2 animate-in fade-in slide-in-from-top-4 z-50 backdrop-blur-sm">
            <Check className="w-5 h-5" />
            <span className="font-medium">保存成功</span>
          </div>
        )}

        {/* Header */}
        <div className="h-14 border-b border-zinc-700 flex items-center justify-between px-4 bg-zinc-800">
          <div className="flex items-center space-x-3">
             <h3 className="text-white font-medium truncate max-w-md">{file.name}</h3>
             {canEdit && (
                 <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">
                     {isEditing ? '编辑模式' : '预览模式'}
                 </span>
             )}
          </div>
          <div className="flex items-center space-x-2">
            {(isText || isIpynb) && (
                <button
                    onClick={() => setUseJupyter(!useJupyter)}
                    className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                        useJupyter ? 'bg-orange-500/80 hover:bg-orange-600 text-white' : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-300'
                    }`}
                    title={useJupyter ? "Switch to Native Editor" : "Switch to Jupyter"}
                >
                    <Code2 className="w-4 h-4" />
                    <span>Jupyter</span>
                </button>
            )}

            {useJupyter && (
                <a 
                    href={jupyterUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="p-2 hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-white transition-colors"
                    title="在浏览器新标签页打开"
                >
                    <ExternalLink className="w-5 h-5" />
                </a>
            )}

            {!useJupyter && canEdit && (isMarkdown || isIpynb) && (
                <button 
                    onClick={() => setIsEditing(!isEditing)}
                    className="flex items-center space-x-1 px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg text-sm transition-colors"
                >
                    {isEditing ? <Eye className="w-4 h-4" /> : <PenLine className="w-4 h-4" />}
                    <span>{isEditing ? '预览' : '编辑'}</span>
                </button>
            )}
            
            {!useJupyter && canEdit && isEditing && (
                <button 
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center space-x-1 px-3 py-1.5 bg-primary hover:bg-fuchsia-600 text-white rounded-lg text-sm transition-colors disabled:opacity-50"
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    <span>保存</span>
                </button>
            )}
            <button 
              onClick={onClose}
              className="p-2 hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden relative bg-zinc-950">
          {useJupyter ? (
             <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900 space-y-6">
                 <div className="text-center space-y-2">
                     <h3 className="text-xl font-medium text-white">Jupyter Notebook 编辑器</h3>
                     <p className="text-zinc-400 max-w-md mx-auto">
                         为了防止页面跳转并提供最佳编辑体验，Jupyter 编辑器将在新窗口中打开。
                     </p>
                 </div>
                 
                 <div className="flex items-center space-x-4">
                     <a 
                         href={jupyterUrl} 
                         target="_blank" 
                         rel="noopener noreferrer"
                         className="flex items-center space-x-2 px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors font-medium shadow-lg hover:shadow-orange-500/20"
                     >
                         <ExternalLink className="w-5 h-5" />
                         <span>在新窗口打开 Jupyter</span>
                     </a>
                     
                     <button
                         onClick={() => setUseJupyter(false)}
                         className="flex items-center space-x-2 px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg transition-colors border border-zinc-700"
                     >
                         <Code2 className="w-5 h-5" />
                         <span>使用简易编辑器</span>
                     </button>
                 </div>
             </div>
          ) : isImage ? (
            <div className="w-full h-full flex items-center justify-center p-4">
               <img src={previewUrl} alt={file.name} className="max-w-full max-h-full object-contain" />
            </div>
          ) : isPdf ? (
            <iframe src={previewUrl} className="w-full h-full border-none" title="PDF Preview" />
          ) : isExcel ? (
            <ExcelPreview url={previewUrl} />
          ) : isWord ? (
            <WordPreview url={previewUrl} />
          ) : (isText || isIpynb) ? (
            loading ? (
                <div className="flex items-center justify-center h-full">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
            ) : error ? (
                <div className="flex items-center justify-center h-full text-red-500">
                    {error}
                </div>
            ) : (
                <>
                    {isMarkdown && !isEditing ? (
                        <div className="w-full h-full overflow-auto p-8 bg-zinc-900 prose prose-invert max-w-none">
                            <ErrorBoundary>
                                <ReactMarkdown 
                                    remarkPlugins={[remarkGfm, remarkMath]}
                                    rehypePlugins={[rehypeKatex]}
                                    components={{
                                        img: ({node, ...props}) => (
                                            <span className="block my-4">
                                                <img 
                                                    {...props} 
                                                    className="max-w-full h-auto rounded-lg shadow-md mx-auto" 
                                                    alt={props.alt || ''}
                                                    referrerPolicy="no-referrer"
                                                    crossOrigin="anonymous"
                                                />
                                            </span>
                                        ),
                                        p: ({node, ...props}) => (
                                            <p {...props} className="mb-4 leading-relaxed" />
                                        )
                                    }}
                                >
                                    {content}
                                </ReactMarkdown>
                            </ErrorBoundary>
                        </div>
                    ) : isIpynb && !isEditing ? (
                         <div className="w-full h-full overflow-auto bg-zinc-900 p-8">
                             <ErrorBoundary>
                                 <div 
                                     className="prose prose-invert max-w-none notebook-html"
                                     dangerouslySetInnerHTML={{ __html: content }} 
                                 />
                             </ErrorBoundary>
                         </div>
                     ) : (
                        <textarea
                            value={content}
                            onChange={e => setContent(e.target.value)}
                            readOnly={!canEdit || !isEditing}
                            className="w-full h-full bg-zinc-950 text-zinc-300 p-4 font-mono text-sm resize-none focus:outline-none"
                            spellCheck={false}
                        />
                    )}
                </>
            )
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-zinc-500">
                <p>此文件格式不支持预览</p>
                <a 
                    href={downloadUrl} 
                    download={file.name}
                    className="mt-4 text-primary hover:underline"
                >
                    下载文件
                </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};