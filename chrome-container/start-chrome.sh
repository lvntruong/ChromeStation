#!/bin/bash
# Script để khởi động Chrome/Chromium với cấu hình tốt nhất cho container

# Cho phép lỗi để script không dừng đột ngột
set +e

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

# Thiết lập biến môi trường cho locale và font
export LANG=vi_VN.UTF-8
export LANGUAGE=vi_VN:en
export LC_ALL=vi_VN.UTF-8

# Kiểm tra chế độ admin (được chuyển qua từ biến môi trường)
ADMIN_MODE=${ADMIN_MODE:-0}

# Lấy URL mặc định từ biến môi trường hoặc sử dụng giá trị mặc định
DEFAULT_URL=${DEFAULT_URL:-"https://www.google.com.vn"}
echo "[DEBUG] Environment variables:"
env | grep -E "ADMIN_MODE|DEFAULT_URL"
echo "[DEBUG] Using DEFAULT_URL: $DEFAULT_URL"

# Kiểm tra các thư mục quan trọng
echo "Kiểm tra các thư mục và quyền..."
ls -la /app/chrome-profiles/
ls -la $PROFILE_DIR || echo "Thư mục profile không tồn tại hoặc không có quyền truy cập!"
ls -la /home/chrome/ || echo "Thư mục home của user chrome không tồn tại!"

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

# Thông tin debug để kiểm tra user hiện tại
echo "Đang chạy với user $(whoami)"
echo "HOME directory: $HOME"
echo "Kiểm tra quyền sudo:"
sudo -l

# Phát hiện trình duyệt và sử dụng đường dẫn chính xác
BROWSER_CMD="/usr/bin/google-chrome-stable"

# Kiểm tra xem trình duyệt có tồn tại không
if [ ! -f "$BROWSER_CMD" ]; then
    echo "CẢNH BÁO: Không tìm thấy Google Chrome tại $BROWSER_CMD"
    
    # Tìm kiếm các đường dẫn khác
    if [ -f "/opt/google/chrome/chrome" ]; then
        BROWSER_CMD="/opt/google/chrome/chrome"
        echo "Đã tìm thấy Chrome tại $BROWSER_CMD"
    elif [ -f "/usr/bin/chromium" ]; then
        BROWSER_CMD="/usr/bin/chromium"
        echo "Đã tìm thấy Chromium tại $BROWSER_CMD"
    else
        echo "Tìm kiếm Chrome/Chromium trên hệ thống:"
        find / -name "chrome" -o -name "google-chrome*" -o -name "chromium" -type f 2>/dev/null | head -10
        
        # Thử cách cuối cùng
        if command -v google-chrome >/dev/null 2>&1; then
            BROWSER_CMD=$(command -v google-chrome)
            echo "Tìm thấy Google Chrome trong PATH: $BROWSER_CMD"
        elif command -v google-chrome-stable >/dev/null 2>&1; then
            BROWSER_CMD=$(command -v google-chrome-stable)
            echo "Tìm thấy Google Chrome Stable trong PATH: $BROWSER_CMD"
        elif command -v chromium >/dev/null 2>&1; then
            BROWSER_CMD=$(command -v chromium)
            echo "Tìm thấy Chromium trong PATH: $BROWSER_CMD"
        else
            echo "Không tìm thấy trình duyệt Chrome/Chromium! Thoát."
            exit 1
        fi
    fi
fi

# Kiểm tra phiên bản và thông tin
echo "Kiểm tra phiên bản trình duyệt:"
$BROWSER_CMD --version || echo "Không thể xác định phiên bản"

# Log thông tin debug
echo "Khởi động $BROWSER_CMD với profile: $PROFILE_DIR"

# Thử chạy với quyền debug để xem lỗi
echo "Thử chạy browser với --version để kiểm tra:"
sudo -u chrome $BROWSER_CMD --version >/dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "Không thể chạy browser với --version, có thể có vấn đề với quyền! Thử chạy với --help"
    sudo -u chrome $BROWSER_CMD --help >/dev/null 2>&1
    if [ $? -ne 0 ]; then
        echo "Cũng không thể chạy với --help. Lỗi nghiêm trọng về quyền hoặc cài đặt!"
    fi
else
    echo "Browser command hoạt động bình thường với --version."
fi

# Thử tạo thư mục tạm thời cho Chrome
TMP_DIR="/tmp/chrome-data"
mkdir -p $TMP_DIR
chown -R chrome:chrome $TMP_DIR

# Cài đặt tham số chạy cho Chrome dựa trên chế độ (admin/user)
if [ "$ADMIN_MODE" = "1" ]; then
    echo "Chạy trong chế độ ADMIN với đầy đủ tính năng..."
    # Chạy Chrome với tính năng đầy đủ cho Admin
    exec sudo -u chrome $BROWSER_CMD \
        --user-data-dir=$PROFILE_DIR \
        --no-sandbox \
        --disable-dev-shm-usage \
        --disable-gpu \
        --disable-software-rasterizer \
        --password-store=basic \
        --start-maximized \
        --window-position=0,0 \
        --window-size=$RESOLUTION \
        --lang=vi \
        --font-render-hinting=medium \
        "$DEFAULT_URL" 2>&1
else
    echo "Chạy trong chế độ USER với tính năng hạn chế..."
    # Chạy Chrome với tùy chọn an toàn cho người dùng thông thường
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
        --metrics-recording-only \
        --no-first-run \
        --safebrowsing-disable-auto-update \
        --password-store=basic \
        --use-mock-keychain \
        --start-maximized \
        --window-position=0,0 \
        --window-size=$RESOLUTION \
        --lang=vi \
        --font-render-hinting=medium \
        --kiosk \
        "$DEFAULT_URL" 2>&1
fi