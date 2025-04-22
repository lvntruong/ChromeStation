#!/bin/bash
set -e

# Kiểm tra Docker
if ! command -v docker &> /dev/null; then
    echo "Docker không được cài đặt. Vui lòng cài đặt Docker trước."
    exit 1
fi

# Đường dẫn đến thư mục hiện tại
CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROFILES_DIR="$CURRENT_DIR/../chrome-profiles"

# Tạo thư mục profiles nếu chưa tồn tại
mkdir -p "$PROFILES_DIR/default"

# Tạo image Docker
echo "Đang tạo image Docker..."
docker build -t chrome-kiosk "$CURRENT_DIR"

# Chạy container
echo "Khởi động container Chrome..."
docker run -d \
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