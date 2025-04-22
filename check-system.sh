#!/bin/bash

# Script để kiểm tra trạng thái hệ thống và xem các container đang chạy
echo "=== Thông tin hệ thống ==="
echo "Phiên bản Docker:"
docker --version
echo ""

echo "=== Các container đang chạy ==="
docker ps
echo ""

echo "=== Các image hiện có ==="
docker images
echo ""

echo "=== Kiểm tra Chrome profiles ==="
find ./chrome-profiles -type d -maxdepth 2 | sort
echo ""

echo "=== Kiểm tra trạng thái các port đang mở ==="
netstat -tuln | grep '6080\|3000' || echo "Không tìm thấy port 6080 hoặc 3000 đang mở"
echo ""

echo "=== Kiểm tra log của container chrome-kiosk (nếu có) ==="
CHROME_CONTAINER=$(docker ps -q --filter "ancestor=chrome-kiosk")
if [ -n "$CHROME_CONTAINER" ]; then
  echo "Log của container chrome-kiosk:"
  docker logs --tail 50 $CHROME_CONTAINER
else
  echo "Không tìm thấy container chrome-kiosk đang chạy"
fi
echo ""

echo "=== Kiểm tra log của container web-server (nếu có) ==="
WEB_CONTAINER=$(docker ps -q --filter "name=chrome-browser_web-server")
if [ -n "$WEB_CONTAINER" ]; then
  echo "Log của container web-server:"
  docker logs --tail 50 $WEB_CONTAINER
else
  echo "Không tìm thấy container web-server đang chạy"
fi
echo ""

echo "=== Tình trạng sử dụng tài nguyên Docker ==="
docker stats --no-stream
echo ""

echo "Kiểm tra hoàn tất."

# Các chức năng phụ trợ
echo ""
echo "Các lệnh gỡ lỗi có thể hữu ích:"
echo "- Xem log chi tiết của container: docker logs -f <container_id>"
echo "- Truy cập vào container: docker exec -it <container_id> bash"
echo "- Khởi động lại các container: docker-compose restart"
echo "- Xây dựng lại image: docker-compose build"
echo "" 