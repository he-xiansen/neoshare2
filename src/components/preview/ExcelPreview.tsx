import React, { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { Loader2 } from 'lucide-react';

interface ExcelPreviewProps {
  url: string;
}

export const ExcelPreview: React.FC<ExcelPreviewProps> = ({ url }) => {
  const [data, setData] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadExcel = async () => {
      try {
        setLoading(true);
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        
        // 获取第一个工作表
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // 转换为 HTML
        const html = XLSX.utils.sheet_to_html(worksheet, { id: 'excel-table', editable: false });
        setData(html);
      } catch (err) {
        console.error(err);
        setError('无法加载 Excel 文件');
      } finally {
        setLoading(false);
      }
    };

    loadExcel();
  }, [url]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-red-500">
        {error}
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-auto bg-white p-4 text-black">
      <div 
        dangerouslySetInnerHTML={{ __html: data }} 
        className="excel-preview-container prose max-w-none"
      />
      <style>{`
        .excel-preview-container table {
          border-collapse: collapse;
          width: 100%;
        }
        .excel-preview-container th, .excel-preview-container td {
          border: 1px solid #ddd;
          padding: 8px;
          text-align: left;
        }
        .excel-preview-container th {
          background-color: #f2f2f2;
        }
      `}</style>
    </div>
  );
};
