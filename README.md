# Chrome Browser Container

Dự án này chứa các tập tin cấu hình Docker để tạo và quản lý các container Chrome Browser có thể truy cập từ xa thông qua VNC hoặc noVNC (trên trình duyệt web).

## Tính năng

- Chạy Chrome trong môi trường Docker an toàn
- Hỗ trợ xem và điều khiển từ xa qua VNC
- Giao diện web thông qua noVNC
- Hỗ trợ nhiều profile Chrome
- Tự động khởi động lại dịch vụ khi gặp sự cố
- Tính năng quản lý nhiều phiên Chrome qua web UI

## Cách sử dụng

### Sử dụng Docker Compose

1. Clone repository này:
   ```
   git clone <repository-url>
   cd chrome-browser
   ```

2. Tạo và khởi động container:
   ```
   docker-compose up -d
   ```

3. Truy cập:
   - Giao diện web: http://localhost:3000
   - Xem Chrome trực tiếp: http://localhost:8080/vnc.html
   - Kết nối VNC client: localhost:5900

### Chạy Chrome Container độc lập

Nếu bạn chỉ muốn chạy container Chrome mà không cần web server:

```
cd chrome-container
./run.sh
```

Sau đó truy cập Chrome qua:
- Web: http://localhost:8080/vnc.html
- VNC: localhost:5900

## Cấu trúc dự án

```
chrome-browser/
├── chrome-container/
│   ├── Dockerfile             # Cấu hình Docker cho container Chrome
│   ├── start-chrome.sh        # Script khởi động Chrome
│   ├── start-xvfb.sh          # Script khởi động X virtual framebuffer
│   ├── start-vnc.sh           # Script khởi động VNC server
│   ├── start-novnc.sh         # Script khởi động noVNC
│   ├── supervisord.conf       # Cấu hình supervisor để quản lý các tiến trình
│   └── run.sh                 # Script khởi động container độc lập
├── web-server/
│   ├── Dockerfile             # Cấu hình Docker cho web server
│   ├── package.json           # Cấu hình Node.js
│   ├── server.js              # Mã nguồn web server
│   └── public/                # Tập tin front-end
│       ├── index.html         # Trang người dùng
│       └── admin.html         # Trang quản trị
├── chrome-profiles/           # Thư mục chứa dữ liệu profile Chrome
├── docker-compose.yml         # Cấu hình Docker Compose
└── README.md                  # Tài liệu dự án
```

## Tùy chỉnh

### Thay đổi độ phân giải màn hình

Để thay đổi độ phân giải màn hình, sửa biến `RESOLUTION` trong file `docker-compose.yml` hoặc `Dockerfile`.

Ví dụ:
```yaml
environment:
  - RESOLUTION=1920x1080x24
```

### Điều chỉnh tham số khởi động Chrome

Các tham số khởi động Chrome có thể được tùy chỉnh trong file `chrome-container/start-chrome.sh`.

## Xử lý sự cố

### Container không khởi động

Kiểm tra logs:
```
docker-compose logs
```

### Chrome không hiển thị

Kiểm tra logs của Xvfb và Chrome:
```
docker-compose logs chrome-base
```

### Vấn đề kết nối VNC

Đảm bảo cổng 5900 và 8080 không bị chặn bởi tường lửa hoặc được sử dụng bởi các ứng dụng khác.

## Đóng góp

Đóng góp là rất được hoan nghênh! Vui lòng gửi pull request hoặc báo cáo các vấn đề bạn gặp phải.

## Giấy phép

MIT 