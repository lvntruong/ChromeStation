#!/bin/bash
# Script để khởi động Chrome với cấu hình tốt nhất cho container

# Kích hoạt chế độ debug để dễ dàng xác định vấn đề
set -e

# Kiểm tra và tạo thư mục profile nếu không tồn tại
PROFILE_DIR="/app/chrome-profiles/default"
if [ ! -d "$PROFILE_DIR" ]; then
    mkdir -p "$PROFILE_DIR"
    chown -R chrome:chrome "$PROFILE_DIR"
fi

# Chờ Xvfb khởi động hoàn tất
until [ -e /tmp/.X99-lock ]; do
    echo "Đang chờ Xvfb khởi động..."
    sleep 0.5
done

echo "Xvfb đã khởi động, bắt đầu chạy Chrome..."

# Xóa các file khóa cũ để tránh lỗi khi Chrome crash
rm -f $PROFILE_DIR/SingletonLock
rm -f $PROFILE_DIR/SingletonCookie

# Đảm bảo DISPLAY đã được thiết lập
if [ -z "$DISPLAY" ]; then
  export DISPLAY=:99
fi

# Đợi cho đến khi X server sẵn sàng
echo "Đợi cho X server khởi động..."
until xdpyinfo >/dev/null 2>&1; do
  echo "Đợi X server..."
  sleep 0.1
done
echo "X server đã sẵn sàng."

# Log thông tin debug
echo "Khởi động Chrome với profile: $PROFILE_DIR"
echo "Chrome version: $(google-chrome-stable --version)"

# Chạy Chrome với tùy chọn an toàn
exec sudo -u chrome google-chrome \
    --user-data-dir=$PROFILE_DIR \
    --no-sandbox \
    --disable-dev-shm-usage \
    --disable-gpu \
    --disable-software-rasterizer \
    --disable-background-networking \
    --disable-background-timer-throttling \
    --disable-backgrounding-occluded-windows \
    --disable-breakpad \
    --disable-client-side-phishing-detection \
    --disable-component-update \
    --disable-default-apps \
    --disable-domain-reliability \
    --disable-extensions \
    --disable-features=Translate,BackForwardCache \
    --disable-hang-monitor \
    --disable-ipc-flooding-protection \
    --disable-popup-blocking \
    --disable-prompt-on-repost \
    --disable-sync \
    --disable-translate \
    --metrics-recording-only \
    --no-first-run \
    --safebrowsing-disable-auto-update \
    --password-store=basic \
    --use-mock-keychain \
    --start-maximized \
    --window-position=0,0 \
    --window-size=$RESOLUTION \
    --kiosk \
    "https://www.google.com" 