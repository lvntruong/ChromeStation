#!/bin/bash
set -e

# Kiểm tra Docker
if ! command -v docker &> /dev/null; then
    echo "Docker không được cài đặt. Vui lòng cài đặt Docker trước."
    exit 1
fi

# Kiểm tra Docker buildx
if ! docker buildx version &> /dev/null; then
    echo "Docker buildx không khả dụng. Đang cài đặt..."
    docker buildx create --name mybuilder --use
fi

# Đường dẫn đến thư mục hiện tại
CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROFILES_DIR="$HOME/chrome-profiles"

# Tạo thư mục profiles nếu chưa tồn tại
mkdir -p "$PROFILES_DIR/default"
chmod -R 777 "$PROFILES_DIR"

echo "Sử dụng thư mục profiles: $PROFILES_DIR"

# Phát hiện kiến trúc
ARCH=$(uname -m)
if [ "$ARCH" = "arm64" ] || [ "$ARCH" = "aarch64" ]; then
    echo "Phát hiện kiến trúc ARM64 (Apple Silicon)"
    echo "Sẽ sử dụng Chromium native trong container ARM64"
    PLATFORM="linux/arm64"
else
    echo "Phát hiện kiến trúc AMD64/x86_64"
    echo "Sẽ sử dụng Google Chrome trong container AMD64"
    PLATFORM="linux/amd64"
fi

# Tạo image Docker cho kiến trúc hiện tại
echo "Đang tạo image Docker cho nền tảng $PLATFORM..."
docker buildx build --platform=$PLATFORM -t chrome-kiosk-$PLATFORM "$CURRENT_DIR"

# Tạo alias cho image hiện tại
docker tag chrome-kiosk-$PLATFORM chrome-kiosk

# Chạy container
echo "Khởi động container Chrome trên nền tảng $PLATFORM..."
docker run -d \
    --platform=$PLATFORM \
    --name chrome-instance \
    -p 8080:8080 \
    -p 5900:5900 \
    -v "$PROFILES_DIR":/app/chrome-profiles \
    -e RESOLUTION=1920x1080x24 \
    chrome-kiosk

echo ""
echo "Container đã được khởi động:"
echo "- Web VNC: http://localhost:8080/vnc.html"
echo "- VNC Client: localhost:5900"
echo ""
echo "Để dừng container, chạy: docker stop chrome-instance"
echo "Để xóa container, chạy: docker rm chrome-instance" 