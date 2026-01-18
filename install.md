# NeoShare 部署文档 (CentOS 7.6) - 支持离线迁移

本文档详细说明如何在 CentOS 7.6 环境下部署 NeoShare 项目，包括前端、后端、Jupyter 服务以及 Nginx 反向代理配置。文档特别针对离线环境（内网环境）进行了适配，假设所有离线包存储在 `/opt/share` 目录下。

## 0. 离线资源准备 (在有网环境执行)

为了支持离线迁移，请在有外网的机器上下载以下资源，并打包传输至目标服务器的 `/opt/share` 目录。

1.  **创建存储目录**
    ```bash
    mkdir -p /opt/share
    ```

2.  **下载 Miniconda 安装脚本**
    ```bash
    wget https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh -O /opt/share/Miniconda3-latest-Linux-x86_64.sh
    ```

3.  **下载 Node.js 二进制包 (以 v20.10.0 为例)**
    ```bash
    wget https://nodejs.org/dist/v20.10.0/node-v20.10.0-linux-x64.tar.xz -O /opt/share/node-v20.10.0-linux-x64.tar.xz
    ```

4.  **下载项目代码**
    ```bash
    # 假设已在项目根目录
    # 打包项目代码，排除 git 目录
    tar -czf /opt/share/neoshare.tar.gz --exclude=.git .
    ```

5.  **下载 Python 依赖包 (Whl)**
    确保当前环境已安装 `pip`。
    
    **关键注意**：如果您是在 Windows/Mac 上为 CentOS 下载依赖，必须指定目标平台为 Linux，否则下载的包（如 psycopg2, cryptography）在 CentOS 上无法安装。
    
    建议使用以下命令下载 Linux 兼容包：

    ```bash
    mkdir -p /opt/share/pip-packages
    
    # 1. 下载基础工具 (Linux 版)
    pip download --dest /opt/share/pip-packages \
        --python-version 310 \
        --platform manylinux2014_x86_64 \
        --implementation cp \
        --only-binary=:all: \
        pip setuptools wheel
    
    # 2. 下载后端依赖 (Linux 版)
    # 使用 --platform 指定 Linux 环境，确保下载 manylinux wheels
    # 使用 --only-binary=:all: 强制下载二进制包 (跨平台下载不支持源码编译)
    pip download --dest /opt/share/pip-packages \
        --python-version 310 \
        --platform manylinux2014_x86_64 \
        --implementation cp \
        --only-binary=:all: \
        -r backend/requirements.txt
        
    # 3. 下载 Jupyter 相关依赖 (Linux 版)
    pip download --dest /opt/share/pip-packages \
        --python-version 310 \
        --platform manylinux2014_x86_64 \
        --implementation cp \
        --only-binary=:all: \
        jupyter notebook
    ```
    
    *如果遇到“no matching distribution”错误，通常是因为某些包只提供源码包（tar.gz）而没有 Linux Wheel。此时您可能需要在一个真实的 Linux 环境（如 Docker 容器或虚拟机）中执行下载命令：`pip download -d /opt/share/pip-packages -r backend/requirements.txt`*

6.  **打包迁移**
    将 `/opt/share` 目录下的所有文件传输到目标服务器的同名目录。

---

## 1. 环境准备 (目标服务器)

### 1.1 更新系统与安装基础工具
如果目标服务器可以访问 yum 源（或有本地 yum 源）：
```bash
yum update -y
yum install -y gcc openssl-devel bzip2-devel libffi-devel zlib-devel make
```

### 1.2 安装 Miniconda (Python 环境)
使用 `/opt/share` 中的离线脚本安装。

```bash
# 执行安装脚本
# -b: 批处理模式 (自动同意许可协议)
# -p: 指定安装路径
bash /opt/share/Miniconda3-latest-Linux-x86_64.sh -b -p /opt/miniconda3

# 初始化 conda (使其在当前 shell 生效)
source /opt/miniconda3/bin/activate
conda init

# 重新加载 shell 配置
source ~/.bashrc

# 创建 Python 3.10.8 环境
conda create -n neoshare python=3.10.8 -y

# 激活环境
conda activate neoshare

# 验证 Python 版本
python --version
```

### 1.3 安装 Node.js (用于前端构建)
使用 `/opt/share` 中的离线包安装。

```bash
# 解压 Node.js 到 /usr/local/lib/nodejs
mkdir -p /usr/local/lib/nodejs
tar -xvf /opt/share/node-v20.10.0-linux-x64.tar.xz -C /usr/local/lib/nodejs

# 配置环境变量 (添加到 ~/.bashrc 或 /etc/profile)
echo 'export PATH=/usr/local/lib/nodejs/node-v20.10.0-linux-x64/bin:$PATH' >> ~/.bashrc
source ~/.bashrc

# 验证安装
node -v
npm -v
```

### 1.4 安装 Nginx
如果目标服务器无法连接公网 yum 源，请使用 rpm 包安装或配置本地 yum 源。如果可以连接：
```bash
yum install -y epel-release
yum install -y nginx
systemctl enable nginx
systemctl start nginx
```

---

## 2. 项目部署

### 2.1 代码迁移
从 `/opt/share` 解压项目代码。

```bash
mkdir -p /opt/neoshare
# 解压代码
tar -xzf /opt/share/neoshare.tar.gz -C /opt/neoshare
cd /opt/neoshare
```

### 2.2 后端部署

1.  **激活环境**
    ```bash
    cd /opt/neoshare/backend
    conda activate neoshare
    ```

2.  **安装依赖 (离线模式)**
    使用 `--no-index` 和 `--find-links` 指定本地包路径。
    ```bash
    # 安装基础工具
    pip install --no-index --find-links=/opt/share/pip-packages pip setuptools wheel
    
    # 安装项目依赖
    pip install --no-index --find-links=/opt/share/pip-packages -r requirements.txt
    
    # 安装 Jupyter
    pip install --no-index --find-links=/opt/share/pip-packages jupyter notebook
    ```

3.  **配置 Systemd 服务 (后端 API)**
    创建文件 `/etc/systemd/system/neoshare-backend.service`:

    ```ini
    [Unit]
    Description=NeoShare Backend API
    After=network.target

    [Service]
    User=root
    WorkingDirectory=/opt/neoshare
    # 使用 Conda 环境中的 python
    # 路径通常为 /opt/miniconda3/envs/neoshare/bin/python
    ExecStart=/opt/miniconda3/envs/neoshare/bin/python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --workers 4
    Restart=always
    Environment="PATH=/opt/miniconda3/envs/neoshare/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin"

    [Install]
    WantedBy=multi-user.target
    ```

4.  **配置 Systemd 服务 (Jupyter)**
    创建文件 `/etc/systemd/system/neoshare-jupyter.service`:

    ```ini
    [Unit]
    Description=NeoShare Jupyter Service
    After=network.target

    [Service]
    User=root
    WorkingDirectory=/opt/neoshare/uploads
    ExecStart=/bin/bash /opt/neoshare/start_jupyter.sh
    Restart=always
    Environment="PATH=/opt/miniconda3/envs/neoshare/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin"

    [Install]
    WantedBy=multi-user.target
    ```

    同时确保脚本存在并可执行（项目仓库已提供 `start_jupyter.sh`，拷贝到服务器后执行）：

    ```bash
    cd /opt/neoshare
    yum install -y dos2unix || true
    dos2unix start_jupyter.sh || true
    chmod +x start_jupyter.sh
    ```

5.  **启动服务**
    ```bash
    systemctl daemon-reload
    systemctl enable neoshare-backend neoshare-jupyter
    systemctl start neoshare-backend neoshare-jupyter
    
    # 检查状态
    systemctl status neoshare-backend neoshare-jupyter
    ```

### 2.3 前端部署

1.  **构建前端代码**
    如果目标服务器 Node.js 环境已就绪：
    ```bash
    cd /opt/neoshare
    # 安装依赖 (如果 node_modules 未打包，需要配置 npm 离线镜像或将 node_modules 一并打包)
    # 建议在准备阶段直接打包 node_modules，或者配置私有 registry
    # 这里假设 node_modules 已经包含在 neoshare.tar.gz 中或者网络允许
    # 如果完全离线且未打包 node_modules，请在有网环境执行 npm install 后再打包
    
    # 构建生产环境代码
    npm run build
    ```
    构建完成后，静态文件会生成在 `/opt/neoshare/dist` 目录下。

---

## 3. Nginx 反向代理配置

编辑 Nginx 配置文件 `/etc/nginx/nginx.conf` 或在 `/etc/nginx/conf.d/` 下新建 `neoshare.conf`。

```nginx
server {
    listen 80;
    server_name your_domain_or_ip;  # 替换为你的域名或IP

    # 设置上传文件大小限制 (例如 5G)
    client_max_body_size 5G;
    
    # 增加超时时间，防止大文件上传中断 (例如 600秒)
    client_body_timeout 600s;
    proxy_read_timeout 600s;
    proxy_send_timeout 600s;

    # 前端静态文件
    location / {
        root /opt/neoshare/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # 后端 API 代理
    location /api {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 上传文件存储目录 (头像等静态资源)
    # 如果后端通过 /uploads/avatars 访问，需要确保 Nginx 能访问或通过后端代理
    # 查看代码，User 头像 URL 是 http://localhost:8000/uploads/avatars/...
    # 所以需要代理 /uploads 到后端，或者直接由 Nginx 托管
    location /uploads {
        alias /opt/neoshare/uploads;
        expires 30d;
    }

    # Jupyter 反向代理
    # Jupyter 需要 WebSocket 支持
    # 注意：这里的 /jupyter/ 必须与 Jupyter 启动参数 --ServerApp.base_url='/jupyter/' 保持一致
    location /jupyter/ {
        proxy_pass http://127.0.0.1:8888/jupyter/;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        
        # WebSocket 支持
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Origin "";
    }
}
```

**注意**：
1. **Jupyter Base URL**: 文档中已配置 Jupyter 运行在 `/jupyter/` 子路径下。这需要你在 Jupyter 启动命令中添加 `--ServerApp.base_url='/jupyter/'`（已在 systemd 配置中添加）。
2. **前端配置**: 你需要修改前端代码 `src/components/FileViewer.tsx` 中的 `jupyterBaseUrl`，将其指向生产环境的 `/jupyter` 路径（例如 `http://your_domain/jupyter`），或者在构建时通过环境变量注入。
3. **Conda 路径**: 确保 Systemd 配置文件中的 Conda 路径 `/opt/miniconda3/envs/neoshare/bin/python` 是正确的。如果你的 Miniconda 安装路径不同，请相应调整。

---

## 4. 验证与测试

1.  **重启 Nginx**
    ```bash
    nginx -t
    systemctl restart nginx
    ```

2.  **访问验证**
    *   打开浏览器访问 `http://your_domain_or_ip`，应显示 NeoShare 登录/首页。
    *   尝试登录、上传文件、预览文件。
    *   尝试打开 Jupyter Notebook 文件，查看是否能在 iframe 中正常加载。

3.  **SELinux 与 防火墙**
    如果访问不通，检查防火墙和 SELinux。

    ```bash
    # 开放 80 端口
    firewall-cmd --permanent --add-service=http
    firewall-cmd --reload

    # 临时关闭 SELinux (或者配置相应的规则)
    setenforce 0
    ```

## 5. 自定义端口与配置修改

如果您需要修改默认端口（前端 80/Nginx，后端 8000，Jupyter 8888），请参考以下步骤：

### 5.1 修改后端 API 端口
默认端口：`8000`

1.  **修改 Systemd 服务文件**
    编辑 `/etc/systemd/system/neoshare-backend.service`：
    ```ini
    # 将 8000 改为您想要的端口，例如 9000
    ExecStart=/opt/miniconda3/envs/neoshare/bin/python -m uvicorn backend.main:app --host 127.0.0.1 --port 9000 --workers 4
    ```

2.  **修改 Nginx 配置**
    编辑 `/etc/nginx/conf.d/neoshare.conf`：
    ```nginx
    location /api {
        # 对应修改后的后端端口
        proxy_pass http://127.0.0.1:9000;
        ...
    }
    ```

3.  **重启服务**
    ```bash
    systemctl daemon-reload
    systemctl restart neoshare-backend
    systemctl restart nginx
    ```

### 5.2 修改 Jupyter 端口
默认端口：`8888`

1.  **修改 Systemd 服务文件**
    编辑 `/etc/systemd/system/neoshare-jupyter.service`：
    ```ini
    # 将 8888 改为您想要的端口，例如 9999
    ExecStart=/opt/miniconda3/envs/neoshare/bin/python -m jupyter notebook --ip=127.0.0.1 --port=9999 ...
    ```

2.  **修改 Nginx 配置**
    编辑 `/etc/nginx/conf.d/neoshare.conf`：
    ```nginx
    location /jupyter/ {
        # 对应修改后的 Jupyter 端口
        proxy_pass http://127.0.0.1:9999/jupyter/;
        ...
    }
    ```

3.  **前端代码无需修改**
    因为前端是通过 Nginx 代理访问 Jupyter（即访问 `/jupyter/` 路径），只要 Nginx 的 `proxy_pass` 指向了正确的内部端口，前端代码中的 URL 不需要变动（前提是前端配置的 `jupyterBaseUrl` 指向的是 Nginx 服务的地址）。

4.  **重启服务**
    ```bash
    systemctl daemon-reload
    systemctl restart neoshare-jupyter
    systemctl restart nginx
    ```

### 5.3 修改前端/Nginx 端口
默认端口：`80`

1.  **修改 Nginx 配置**
    编辑 `/etc/nginx/conf.d/neoshare.conf`：
    ```nginx
    server {
        # 将 80 改为您想要的端口，例如 8080
        listen 8080;
        ...
    }
    ```

2.  **重启 Nginx**
    ```bash
    systemctl restart nginx
    ```

3.  **防火墙放行**
    ```bash
    firewall-cmd --permanent --add-port=8080/tcp
    firewall-cmd --reload
    ```

4.  **前端代码修改 (API Base URL)**
    前端代码构建时需要知道后端 API 的地址。
    *   在 `src/api/client.ts` 中，API Base URL 默认为 `http://localhost:8000/api`。
    *   在生产环境中，通常建议将其修改为 `/api`（相对路径），这样前端会请求当前域名下的 `/api`，由 Nginx 转发给后端。
    *   修改 `src/api/client.ts`:
        ```typescript
        // 生产环境建议使用相对路径，或者通过环境变量配置
        const API_URL = import.meta.env.VITE_API_URL || '/api';
        ```
    *   重新构建前端：`npm run build`。

## 6. 常见问题

*   **Jupyter 404**: 检查 Nginx 的 `location /jupyter/` 配置是否正确，以及 Jupyter 启动参数中是否包含了 `--ServerApp.base_url='/jupyter/'`。
*   **WebSocket 连接失败**: 确保 Nginx 配置了 `Upgrade` 和 `Connection` 头。
*   **权限问题**: 确保 Nginx 用户有权限读取 `/opt/neoshare/dist` 目录。

## 7. 故障排查指南

如果服务启动失败，请按照以下步骤进行排查。

### 7.1 查看服务状态与日志
```bash
# 查看服务状态
systemctl status neoshare-backend

# 查看详细日志 (定位报错堆栈)
journalctl -u neoshare-backend -n 50 --no-pager
```

### 7.2 手动启动调试
如果日志不清晰，可以尝试直接在终端运行启动命令，这样可以直接看到错误输出。

**调试后端:**
```bash
# 1. 切换到项目目录
cd /opt/neoshare

# 2. 激活环境
source /opt/miniconda3/bin/activate neoshare

# 3. 手动运行启动命令
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
```
如果报错提示 `AttributeError: 'FieldInfo' object has no attribute 'in_'`，说明是 `fastapi` 版本过低与 `pydantic` 2.x 不兼容。
**解决方法**: 升级 fastapi。
```bash
pip install "fastapi>=0.128.0"
```

**调试 Jupyter:**
```bash
cd /opt/neoshare

yum install -y dos2unix || true
dos2unix start_jupyter.sh || true
chmod +x start_jupyter.sh

./start_jupyter.sh
```


如果要修改您在界面左上角看到的软件名（即 h1 标签），您需要修改的文件是：

src\components\Sidebar.tsx

在该文件的第 28 行：

```
<h1 className="text-2xl font-bold 
text-white tracking-wider">NeoShare</h1>
```
将 NeoShare 替换为您想要的名字即可。

💡 建议： 为了保持软件名称的一致性，建议您同步修改以下文件中的名称：

1. 浏览器标签页标题 : index.html (第 7 行)
   ```
   <title>NeoShare</title>
   ```
2. 登录页面提示 : src\pages\Login.tsx (第 53 行)
   ```
   <p className="text-zinc-400 mt-2">登录您
   的 NeoShare 账号</p>
   ```
3. 注册页面提示 : src\pages\Register.tsx (第 49 行)
   ```
   <p className="text-zinc-400 mt-2">注册您
   的 NeoShare 账号</p>
   ```
4. 后端 API 文档标题 (可选): backend\main.py (第 5 行)
   ```
   app = FastAPI(title="NeoShare API", 
   version="1.0.0")
   ```
如果您需要，我可以帮您一次性把这些地方都改掉，请告诉我您想改成什么名字。