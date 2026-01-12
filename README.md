# NeoShare

NeoShare 是一个现代化的文件共享与协作平台，旨在提供安全、便捷的文件管理体验。它集成了文件上传、下载、预览、编辑以及 Jupyter Notebook 的无缝交互功能。

## 🌟 主要特性

*   **文件管理**：
    *   支持文件上传（拖拽上传）、下载、删除。
    *   支持文件列表的网格视图和列表视图切换。
    *   区分公共文件区（所有用户可见）和个人文件区（仅自己可见）。
*   **在线预览与编辑**：
    *   支持 Markdown、代码文件（Python, JS, TS 等）、JSON 等文本文件的在线预览和编辑。
    *   支持 PDF 文件预览。
    *   支持图片预览。
*   **Jupyter Notebook 集成**：
    *   **核心亮点**：无缝集成 Jupyter Notebook。
    *   双击 `.ipynb` 文件直接在应用内预览和运行 Notebook。
    *   双击代码文件可选择使用 Jupyter 的编辑器进行编辑。
    *   支持一键切换回原生简易编辑器。
*   **用户权限**：
    *   基于角色的权限控制（管理员/普通用户）。
    *   JWT 安全认证。

## 🛠️ 技术栈

### 前端 (Frontend)
*   **框架**: React 18 + TypeScript
*   **构建工具**: Vite
*   **样式**: Tailwind CSS
*   **状态管理**: Zustand
*   **路由**: React Router v6
*   **UI 组件**: Lucide React (图标)
*   **其他**: Axios, React Markdown, React Dropzone

### 后端 (Backend)
*   **框架**: FastAPI (Python)
*   **数据库**: SQLite (默认) / PostgreSQL (支持)
*   **ORM**: SQLAlchemy
*   **认证**: OAuth2 + JWT (Python-Jose, Passlib)

### 核心集成
*   **Jupyter Notebook**: 作为底层计算和编辑引擎。

## 🚀 部署指南 (Deployment)

### 前置要求
*   Node.js (v18+)
*   Python (v3.9+)
*   Jupyter Notebook (`pip install notebook`)

### 1. 后端部署

1.  进入项目根目录。
2.  创建并激活 Conda 环境（推荐）：
    ```bash
    # 创建新环境 (例如 python 3.11)
    conda create -n neoshare python=3.11
    
    # 激活环境
    conda activate neoshare
    ```
3.  安装依赖：
    ```bash
    cd backend
    pip install -r requirements.txt
    ```
4.  初始化数据库（首次运行）：
    ```bash
    python -c "from database import Base, engine; Base.metadata.create_all(bind=engine)"
    ```
5.  启动 FastAPI 服务：
    ```bash
    # 回到项目根目录
    cd ..
    python -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
    ```

### 2. Jupyter 服务部署

为了支持 NeoShare 的集成功能，必须以特定配置启动 Jupyter Notebook。

1.  **Windows 用户**：
    直接运行项目根目录下的启动脚本：
    ```powershell
    .\start_jupyter.ps1
    ```
    *该脚本会自动设置跨域策略 (CSP)、固定 Token (`neoshare2024`) 并指定 `uploads` 目录为根目录。*

2.  **手动启动 (Linux/Mac/自定义)**：
    在项目根目录下运行：
    ```bash
    cd uploads
    jupyter notebook --ip=0.0.0.0 --port=8888 --no-browser \
      --ServerApp.token='neoshare2024' \
      --ServerApp.password='' \
      --ServerApp.allow_origin='*' \
      --ServerApp.tornado_settings="{'headers': {'Content-Security-Policy': 'frame-ancestors *'}}"
    ```

### 3. 前端部署

1.  安装依赖：
    ```bash
    npm install
    ```
2.  启动开发服务器：
    ```bash
    npm run dev
    ```
3.  访问应用：
    打开浏览器访问 `http://localhost:5173`

## 📁 目录结构

```
neoshare/
├── backend/                 # FastAPI 后端代码
│   ├── routers/             # API 路由
│   ├── models.py            # 数据库模型
│   ├── schemas.py           # Pydantic 模型
│   └── ...
├── src/                     # React 前端代码
│   ├── components/          # UI 组件 (FileViewer, Sidebar等)
│   ├── pages/               # 页面组件
│   ├── store/               # Zustand 状态管理
│   └── ...
├── uploads/                 # 文件存储根目录 (Jupyter 运行目录)
│   ├── public/              # 公共文件
│   └── [user_id]/           # 用户私有文件
├── start_jupyter.ps1        # Jupyter 启动脚本
└── ...
```

## 📝 注意事项

*   **默认账号**：如果是开发模式，请查看 `backend/init_db.py` 或数据库中的初始账号。
*   **Jupyter Token**：默认硬编码为 `neoshare2024`，如需修改，请同时更新 `start_jupyter.ps1` 和 `src/components/FileViewer.tsx`。
*   **安全性**：当前配置允许跨域 iframe (`frame-ancestors *`)，在生产环境中建议将 `*` 替换为具体的域名以提高安全性。
