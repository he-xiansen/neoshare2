import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface NotebookCell {
  cell_type: 'markdown' | 'code';
  source: string[] | string;
  outputs?: NotebookOutput[];
  execution_count?: number | null;
}

interface NotebookOutput {
  output_type: string;
  text?: string[] | string;
  data?: {
    'text/plain'?: string[] | string;
    'image/png'?: string;
    'image/jpeg'?: string;
    'text/html'?: string[] | string;
  };
}

interface Notebook {
  cells: NotebookCell[];
  metadata?: any;
  nbformat?: number;
  nbformat_minor?: number;
}

interface NotebookViewerProps {
  content: string; // JSON string
}

export const NotebookViewer: React.FC<NotebookViewerProps> = ({ content }) => {
  let notebook: Notebook;
  try {
    notebook = JSON.parse(content);
  } catch (e) {
    return <div className="text-red-500 p-4">Invalid Notebook JSON</div>;
  }

  if (!notebook.cells || !Array.isArray(notebook.cells)) {
    return <div className="text-red-500 p-4">Invalid Notebook Structure</div>;
  }

  const joinSource = (source: string[] | string) => {
    if (Array.isArray(source)) {
      return source.join('');
    }
    return source || '';
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4 md:p-8 space-y-6 pb-20">
      {notebook.cells.map((cell, index) => (
        <div key={index} className="flex flex-col space-y-2 group">
          {/* Cell Input */}
          <div className="flex flex-row">
            <div className="w-16 flex-shrink-0 text-right pr-2 text-xs font-mono text-zinc-500 pt-1 select-none">
              {cell.cell_type === 'code' ? `[${cell.execution_count || ' '}]` : ''}
            </div>
            <div className="flex-1 min-w-0 overflow-hidden rounded-lg border border-transparent group-hover:border-zinc-700/50 transition-colors">
              {cell.cell_type === 'markdown' ? (
                <div className="prose prose-invert max-w-none p-2 bg-transparent">
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
                    {joinSource(cell.source)}
                  </ReactMarkdown>
                </div>
              ) : (
                <div className="rounded-lg overflow-hidden border border-zinc-700/50 bg-[#1e1e1e]">
                  <SyntaxHighlighter
                    language="python"
                    style={vscDarkPlus}
                    customStyle={{ margin: 0, padding: '1rem', fontSize: '0.875rem' }}
                    wrapLongLines={true}
                  >
                    {joinSource(cell.source)}
                  </SyntaxHighlighter>
                </div>
              )}
            </div>
          </div>

          {/* Cell Output */}
          {cell.cell_type === 'code' && cell.outputs && cell.outputs.length > 0 && (
            <div className="flex flex-row">
                <div className="w-16 flex-shrink-0 text-right pr-2 text-xs font-mono text-red-400/70 pt-1 select-none">
                    {/* Output label usually matches input count or is empty */}
                    [{cell.execution_count || ' '}]
                </div>
                <div className="flex-1 min-w-0 overflow-x-auto">
                    {cell.outputs.map((output, outIndex) => (
                        <div key={outIndex} className="mb-2">
                            {output.output_type === 'stream' && (
                                <pre className="font-mono text-sm text-zinc-300 whitespace-pre-wrap">
                                    {joinSource(output.text || '')}
                                </pre>
                            )}
                            {(output.output_type === 'execute_result' || output.output_type === 'display_data') && output.data && (
                                <div>
                                    {output.data['image/png'] ? (
                                        <img 
                                            src={`data:image/png;base64,${joinSource(output.data['image/png'])}`} 
                                            alt="output" 
                                            className="max-w-full h-auto bg-white rounded"
                                        />
                                    ) : output.data['image/jpeg'] ? (
                                        <img 
                                            src={`data:image/jpeg;base64,${joinSource(output.data['image/jpeg'])}`} 
                                            alt="output" 
                                            className="max-w-full h-auto bg-white rounded"
                                        />
                                    ) : output.data['text/html'] ? (
                                        <div 
                                            className="prose prose-invert max-w-none bg-white text-black p-2 rounded"
                                            dangerouslySetInnerHTML={{ __html: joinSource(output.data['text/html']) }} 
                                        />
                                    ) : output.data['text/plain'] ? (
                                        <pre className="font-mono text-sm text-zinc-300 whitespace-pre-wrap">
                                            {joinSource(output.data['text/plain'])}
                                        </pre>
                                    ) : null}
                                </div>
                            )}
                            {output.output_type === 'error' && (
                                <pre className="font-mono text-sm text-red-400 whitespace-pre-wrap bg-red-900/10 p-2 rounded border border-red-500/20">
                                    {/* Usually evalue and ename and traceback */}
                                    {(output as any).traceback ? (output as any).traceback.join('\n') : (output as any).evalue}
                                </pre>
                            )}
                        </div>
                    ))}
                </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};