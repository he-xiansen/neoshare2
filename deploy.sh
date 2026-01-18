#!/bin/bash
set -e

# 定义变量
PROJECT_DIR="/opt/neoshare"
CONDA_ENV="neoshare"
CONDA_PATH="/opt/miniconda3"
BACKEND_PORT=8000
JUPYTER_PORT=8888

echo ">>> 开始部署 NeoShare (CentOS 7.6)..."

# 1. 激活 Conda 环境
echo ">>> 1. 激活 Conda 环境..."
source "$CONDA_PATH/bin/activate" "$CONDA_ENV"

# 2. 安装依赖
# 说明: 之前的离线包可能是 Windows 版本的，导致安装失败。
# 这里尝试直接从 PyPI 安装 Linux 版本的依赖。
echo ">>> 2. 安装 Python 依赖..."
cd "$PROJECT_DIR/backend"
echo "正在安装后端依赖..."
pip install -r requirements1.txt
echo "正在安装 Jupyter..."
pip install jupyter notebook

# 2.5 初始化数据库 (创建 admin 用户)
echo ">>> 2.5 初始化数据库..."
cd "$PROJECT_DIR"
$CONDA_PATH/envs/$CONDA_ENV/bin/python -m backend.init_db

# 3. 配置 Systemd 服务
echo ">>> 3. 配置 Systemd 服务..."

# 后端服务
cat > /etc/systemd/system/neoshare-backend.service <<EOF
[Unit]
Description=NeoShare Backend API
After=network.target

[Service]
User=root
WorkingDirectory=$PROJECT_DIR
ExecStart=$CONDA_PATH/envs/$CONDA_ENV/bin/python -m uvicorn backend.main:app --host 127.0.0.1 --port $BACKEND_PORT --workers 4
Restart=always
Environment="PATH=$CONDA_PATH/envs/$CONDA_ENV/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin"

[Install]
WantedBy=multi-user.target
EOF

# Jupyter 服务
mkdir -p "$PROJECT_DIR/uploads"
cat > /etc/systemd/system/neoshare-jupyter.service <<EOF
[Unit]
Description=NeoShare Jupyter Service
After=network.target

[Service]
User=root
WorkingDirectory=$PROJECT_DIR/uploads
ExecStartPre=/bin/mkdir -p $PROJECT_DIR/uploads
ExecStart=$CONDA_PATH/envs/$CONDA_ENV/bin/python -m jupyter notebook --ip=127.0.0.1 --port=$JUPYTER_PORT --no-browser --ServerApp.base_url='/jupyter/' --ServerApp.token='neoshare2024' --ServerApp.password='' --ServerApp.allow_origin='*' --ServerApp.tornado_settings="{'headers': {'Content-Security-Policy': 'frame-ancestors *'}}"
Restart=always
Environment="PATH=$CONDA_PATH/envs/$CONDA_ENV/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin"

[Install]
WantedBy=multi-user.target
EOF

# 4. 配置 Nginx
echo ">>> 4. 配置 Nginx..."
cat > /etc/nginx/conf.d/neoshare.conf <<EOF
server {
    listen 80;
    server_name _;

    # 前端静态文件
    location / {
        root $PROJECT_DIR/dist;
        index index.html;
        try_files \$uri \$uri/ /index.html;
    }

    # 后端 API 代理
    location /api {
        proxy_pass http://127.0.0.1:$BACKEND_PORT;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # 上传文件存储目录
    location /uploads {
        alias $PROJECT_DIR/uploads;
        expires 30d;
    }

    # Jupyter 反向代理
    location /jupyter/ {
        proxy_pass http://127.0.0.1:$JUPYTER_PORT/jupyter/;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        
        # WebSocket 支持
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Origin "";
    }
}
EOF

# 5. 重启服务
echo ">>> 5. 重启服务..."
systemctl daemon-reload
systemctl enable neoshare-backend neoshare-jupyter nginx
systemctl restart neoshare-backend neoshare-jupyter nginx

echo ">>> 部署完成！"
echo ">>> 请访问 http://192.168.42.51 进行验证"
