#!/bin/bash
set -e

# NeoShare 自动化部署脚本 (剩余步骤)
# 请确保此脚本在目标服务器上运行，且 /opt/share/pip-packages 中包含正确的 Linux 依赖包

BASE_DIR="/opt/neoshare"
SHARE_DIR="/opt/share"
PIP_DIR="$SHARE_DIR/pip-packages"
CONDA_PYTHON="/opt/miniconda3/envs/neoshare/bin/python"
JUPYTER_PORT=8888
BACKEND_PORT=8000

echo ">>> 1. 检查环境..."
if [ ! -d "$PIP_DIR" ]; then
    echo "错误: 未找到依赖包目录 $PIP_DIR"
    exit 1
fi

source /opt/miniconda3/bin/activate neoshare

echo ">>> 2. 安装/修复 Python 依赖..."
cd $BASE_DIR/backend
# 使用 --force-reinstall 确保覆盖可能错误的 Windows 包
pip install --force-reinstall --no-index --find-links=$PIP_DIR -r requirements.txt
pip install --no-index --find-links=$PIP_DIR jupyter notebook

echo ">>> 3. 配置 Systemd 服务..."

# Backend Service
cat > /etc/systemd/system/neoshare-backend.service <<EOF
[Unit]
Description=NeoShare Backend API
After=network.target

[Service]
User=root
WorkingDirectory=$BASE_DIR
ExecStart=$CONDA_PYTHON -m uvicorn backend.main:app --host 127.0.0.1 --port $BACKEND_PORT --workers 4
Restart=always
Environment="PATH=/opt/miniconda3/envs/neoshare/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin"

[Install]
WantedBy=multi-user.target
EOF

# Jupyter Service
mkdir -p $BASE_DIR/uploads
cat > /etc/systemd/system/neoshare-jupyter.service <<EOF
[Unit]
Description=NeoShare Jupyter Service
After=network.target

[Service]
User=root
WorkingDirectory=$BASE_DIR/uploads
ExecStartPre=/bin/mkdir -p $BASE_DIR/uploads
ExecStart=$CONDA_PYTHON -m jupyter notebook --ip=127.0.0.1 --port=$JUPYTER_PORT --no-browser --ServerApp.base_url='/jupyter/' --ServerApp.token='neoshare2024' --ServerApp.password='' --ServerApp.allow_origin='*' --ServerApp.tornado_settings="{'headers': {'Content-Security-Policy': 'frame-ancestors *'}}"
Restart=always
Environment="PATH=/opt/miniconda3/envs/neoshare/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin"

[Install]
WantedBy=multi-user.target
EOF

echo ">>> 4. 配置 Nginx..."
cat > /etc/nginx/conf.d/neoshare.conf <<EOF
server {
    listen 80;
    server_name _;

    # 前端静态文件
    location / {
        root $BASE_DIR/dist;
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
        alias $BASE_DIR/uploads;
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

# 移除默认配置以免冲突 (可选)
mv /etc/nginx/conf.d/default.conf /etc/nginx/conf.d/default.conf.bak 2>/dev/null || true

echo ">>> 5. 构建前端 (假设远程有环境)..."
# 如果远程没有 npm 环境，这一步会失败，建议本地构建好 dist 传过去
if command -v npm &> /dev/null; then
    cd $BASE_DIR
    echo "正在构建前端..."
    npm install
    npm run build
else
    echo "警告: 未找到 npm，跳过前端构建。请确保 $BASE_DIR/dist 已存在。"
fi

echo ">>> 6. 启动服务..."
systemctl daemon-reload
systemctl enable neoshare-backend neoshare-jupyter nginx
systemctl restart neoshare-backend neoshare-jupyter nginx

echo ">>> 部署完成！"
echo "请访问 http://192.168.42.51 验证"
