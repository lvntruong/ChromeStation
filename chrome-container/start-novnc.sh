#!/bin/bash
set -e

echo "Khởi động noVNC proxy..."

# Định nghĩa đường dẫn đến thư mục chứa noVNC
NOVNC_HOME="/app/noVNC"

# Chuyển đến thư mục noVNC
cd $NOVNC_HOME

# Khởi động noVNC proxy để kết nối đến VNC server
exec ./utils/novnc_proxy --vnc localhost:5900 --listen 8080 