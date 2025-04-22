#!/bin/bash
set -e

echo "Khởi động Xvfb với độ phân giải $RESOLUTION..."

# Lấy chiều rộng và chiều cao từ biến RESOLUTION
WIDTH=$(echo $RESOLUTION | cut -d 'x' -f 1)
HEIGHT=$(echo $RESOLUTION | cut -d 'x' -f 2)

# Khởi động Xvfb với độ sâu màu 24-bit và cấu hình GLX
exec Xvfb :99 -screen 0 ${WIDTH}x${HEIGHT}x24 -ac +extension GLX +render -noreset 