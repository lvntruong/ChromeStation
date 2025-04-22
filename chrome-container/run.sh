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

# Kiểm tra kiến trúc
ARCH=$(uname -m)
USE_PLATFORM=""

if [ "$ARCH" = "arm64" ] || [ "$ARCH" = "aarch64" ]; then
    echo "Phát hiện kiến trúc ARM64 (Apple Silicon)"
    echo "Sẽ sử dụng mô phỏng để chạy container amd64"
    USE_PLATFORM="--platform=linux/amd64"
fi

# Đường dẫn đến thư mục hiện tại
CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROFILES_DIR="$CURRENT_DIR/../chrome-profiles"

# Tạo thư mục profiles nếu chưa tồn tại
mkdir -p "$PROFILES_DIR/default"

# Tạo image Docker - luôn sử dụng amd64 vì Chrome cho Linux chỉ hỗ trợ amd64
echo "Đang tạo image Docker cho nền tảng amd64..."
docker buildx build --platform=linux/amd64 -t chrome-kiosk "$CURRENT_DIR"

# Chạy container
echo "Khởi động container Chrome..."
docker run -d \
    $USE_PLATFORM \
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

if [ -n "$USE_PLATFORM" ]; then
    echo ""
    echo "Lưu ý: Container đang chạy trên chế độ mô phỏng amd64, hiệu suất có thể chậm hơn trên Mac M1"
fi 