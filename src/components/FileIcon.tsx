import React from 'react';
import { Folder, File } from 'lucide-react';
import clsx from 'clsx';

// Import custom icons
import cssIcon from './icon_code/CSS.svg';
import goIcon from './icon_code/Go.svg';
import jsonIcon from './icon_code/JSON.svg';
import ps1Icon from './icon_code/PS1.svg';
import pyIcon from './icon_code/Python.svg';
import shIcon from './icon_code/SH.svg';
import sqlIcon from './icon_code/SQL.svg';
import dbIcon from './icon_code/db.svg';
import gitIcon from './icon_code/gitignore.svg';
import ipynbIcon from './icon_code/ipynb.svg';
import javaIcon from './icon_code/java.svg';
import jpgIcon from './icon_code/jpg.svg';
import jsIcon from './icon_code/js.svg';
import jsxIcon from './icon_code/jsx.svg';
import mdIcon from './icon_code/md.svg';
import pngIcon from './icon_code/png.svg';
import rarIcon from './icon_code/rar.svg';
import tsIcon from './icon_code/ts.svg';
import tsxIcon from './icon_code/tsx.svg';
import txtIcon from './icon_code/txt.svg';
import zipIcon from './icon_code/zip.svg';

interface FileIconProps {
  fileName: string;
  isDir: boolean;
  className?: string;
}

export const FileIconComponent: React.FC<FileIconProps> = ({ fileName, isDir, className = "w-6 h-6" }) => {
  if (isDir) {
    return <Folder className={clsx(className, "text-blue-400 fill-blue-400/20")} />;
  }

  const ext = fileName.split('.').pop()?.toLowerCase();
  const name = fileName.toLowerCase();

  // Special files
  if (name === '.gitignore') {
      return <img src={gitIcon} alt="gitignore" className={className} />;
  }

  switch (ext) {
    case 'css':
    case 'scss':
    case 'less':
      return <img src={cssIcon} alt="css" className={className} />;
    
    case 'go':
      return <img src={goIcon} alt="go" className={className} />;
      
    case 'json':
    case 'yml':
    case 'yaml':
      return <img src={jsonIcon} alt="json" className={className} />;
      
    case 'ps1':
      return <img src={ps1Icon} alt="ps1" className={className} />;
      
    case 'py':
    case 'pyc':
      return <img src={pyIcon} alt="python" className={className} />;
      
    case 'sh':
    case 'bash':
    case 'zsh':
      return <img src={shIcon} alt="sh" className={className} />;
      
    case 'sql':
      return <img src={sqlIcon} alt="sql" className={className} />;
      
    case 'db':
    case 'sqlite':
    case 'sqlite3':
      return <img src={dbIcon} alt="db" className={className} />;
      
    case 'ipynb':
      return <img src={ipynbIcon} alt="ipynb" className={className} />;
      
    case 'java':
    case 'jar':
      return <img src={javaIcon} alt="java" className={className} />;
      
    case 'jpg':
    case 'jpeg':
    case 'webp':
    case 'ico':
    case 'svg':
      return <img src={jpgIcon} alt="jpg" className={className} />;
      
    case 'js':
    case 'cjs':
    case 'mjs':
      return <img src={jsIcon} alt="js" className={className} />;
      
    case 'jsx':
      return <img src={jsxIcon} alt="jsx" className={className} />;
      
    case 'md':
    case 'markdown':
      return <img src={mdIcon} alt="md" className={className} />;
      
    case 'png':
    case 'gif':
    case 'bmp':
    case 'tiff':
      return <img src={pngIcon} alt="png" className={className} />;
      
    case 'rar':
      return <img src={rarIcon} alt="rar" className={className} />;
      
    case 'ts':
      return <img src={tsIcon} alt="ts" className={className} />;
      
    case 'tsx':
      return <img src={tsxIcon} alt="tsx" className={className} />;
      
    case 'txt':
    case 'log':
      return <img src={txtIcon} alt="txt" className={className} />;
      
    case 'zip':
    case '7z':
    case 'tar':
    case 'gz':
      return <img src={zipIcon} alt="zip" className={className} />;
      
    default:
      return <File className={clsx(className, "text-gray-400")} />;
  }
};
