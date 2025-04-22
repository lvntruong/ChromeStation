#!/bin/bash
# Script để khởi động Chrome/Chromium với cấu hình tốt nhất cho container

# Kích hoạt chế độ debug để dễ dàng xác định vấn đề
set -e

# Kiểm tra và tạo thư mục profile nếu không tồn tại
PROFILE_DIR="/app/chrome-profiles/default"
if [ ! -d "$PROFILE_DIR" ]; then
    mkdir -p "$PROFILE_DIR"
    chown -R chrome:chrome "$PROFILE_DIR"
fi

# Đảm bảo DISPLAY đã được thiết lập
if [ -z "$DISPLAY" ]; then
  export DISPLAY=:99
fi

# Chờ Xvfb khởi động hoàn tất
echo "Đang chờ Xvfb khởi động..."
for i in $(seq 1 30); do
    if [ -e /tmp/.X99-lock ]; then
        echo "Xvfb đã được khởi động."
        break
    fi
    echo "Chờ Xvfb... ($i/30)"
    sleep 1
    if [ $i -eq 30 ]; then
        echo "Không thể kết nối với Xvfb sau 30 giây. Thoát."
        exit 1
    fi
done

# Đợi cho đến khi X server sẵn sàng
echo "Đợi cho X server khởi động..."
for i in $(seq 1 30); do
    if DISPLAY=:99 xdpyinfo >/dev/null 2>&1; then
        echo "X server đã sẵn sàng."
        break
    fi
    echo "Chờ X server... ($i/30)"
    sleep 1
    if [ $i -eq 30 ]; then
        echo "Không thể kết nối với X server sau 30 giây. Thoát."
        exit 1
    fi
done

# Xóa các file khóa cũ để tránh lỗi khi trình duyệt crash
rm -f $PROFILE_DIR/SingletonLock
rm -f $PROFILE_DIR/SingletonCookie

echo "Xvfb đã khởi động, bắt đầu chạy trình duyệt..."

# Phát hiện trình duyệt đã cài đặt (Chrome hoặc Chromium)
CHROME_PATH="/usr/bin/google-chrome-stable"
CHROMIUM_PATH="/usr/bin/chromium-browser"

if [ -f "$CHROMIUM_PATH" ]; then
  BROWSER_CMD="$CHROMIUM_PATH"
  echo "Đã phát hiện Chromium Browser tại $BROWSER_CMD"
  BROWSER_VERSION=$($BROWSER_CMD --version 2>/dev/null || echo "Không thể xác định phiên bản")
  echo "Chromium version: $BROWSER_VERSION"
elif [ -f "$CHROME_PATH" ]; then
  BROWSER_CMD="$CHROME_PATH"
  echo "Đã phát hiện Google Chrome tại $BROWSER_CMD"
  BROWSER_VERSION=$($BROWSER_CMD --version 2>/dev/null || echo "Không thể xác định phiên bản")
  echo "Chrome version: $BROWSER_VERSION"
else
  echo "Không tìm thấy Chrome hoặc Chromium. Tìm kiếm trong PATH..."
  if command -v google-chrome >/dev/null 2>&1; then
    BROWSER_CMD=$(command -v google-chrome)
    echo "Tìm thấy Google Chrome tại $BROWSER_CMD"
  elif command -v chromium-browser >/dev/null 2>&1; then
    BROWSER_CMD=$(command -v chromium-browser)
    echo "Tìm thấy Chromium tại $BROWSER_CMD"
  else
    echo "Không tìm thấy trình duyệt nào! Thoát."
    exit 1
  fi
fi

# Log thông tin debug
echo "Khởi động $BROWSER_CMD với profile: $PROFILE_DIR"

# Chạy trình duyệt với tùy chọn an toàn
exec sudo -u chrome $BROWSER_CMD \
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