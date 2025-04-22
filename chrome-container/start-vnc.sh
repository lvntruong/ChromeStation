#!/bin/bash
set -e

echo "Khởi động VNC server..."

# Chờ cho X server sẵn sàng
until xdpyinfo -display :99 >/dev/null 2>&1; do
    echo "Đang chờ Xvfb khởi động..."
    sleep 0.5
done

echo "X server đã sẵn sàng, khởi động x11vnc"

# Khởi động x11vnc với cấu hình phù hợp
exec x11vnc -display :99 -forever -shared -rfbport 5900 -nopw -quiet 