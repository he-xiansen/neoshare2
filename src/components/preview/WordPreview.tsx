import React, { useEffect, useRef, useState } from 'react';
import { renderAsync } from 'docx-preview';
import { Loader2 } from 'lucide-react';

interface WordPreviewProps {
  url: string;
}

export const WordPreview: React.FC<WordPreviewProps> = ({ url }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadWord = async () => {
      if (!containerRef.current) return;
      
      try {
        setLoading(true);
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch file');
        const blob = await response.blob();
        
        await renderAsync(blob, containerRef.current, undefined, {
          className: 'docx-viewer',
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          ignoreFonts: false,
          breakPages: true,
          ignoreLastRenderedPageBreak: true,
          experimental: false,
          trimXmlDeclaration: true,
          useBase64URL: false,
          useMathMLPolyfill: false,
          debug: false,
        });
      } catch (err) {
        console.error(err);
        setError('无法加载 Word 文件');
      } finally {
        setLoading(false);
      }
    };

    loadWord();
  }, [url]);

  return (
    <div className="w-full h-full overflow-auto bg-zinc-100 relative">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-10">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      )}
      
      {error && (
        <div className="flex items-center justify-center h-full text-red-500">
          {error}
        </div>
      )}
      
      <div ref={containerRef} className="docx-container p-8 min-h-full text-black" />
    </div>
  );
};
