FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV RESOLUTION=1920x1080x24
ENV DISPLAY=:99

# Cài đặt các gói cơ bản
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    apt-transport-https \
    ca-certificates \
    supervisor \
    xvfb \
    x11vnc \
    fluxbox \
    xterm \
    git \
    curl \
    unzip \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    sudo \
    x11-utils \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Phát hiện kiến trúc và cài đặt trình duyệt thích hợp
RUN arch=$(dpkg --print-architecture) && \
    if [ "$arch" = "arm64" ]; then \
        # Cài đặt Chromium cho ARM64 (native)
        apt-get update && \
        apt-get install -y chromium-browser && \
        # Tạo symbolic link để lệnh "google-chrome" hoạt động
        ln -sf /usr/bin/chromium-browser /usr/bin/google-chrome && \
        ln -sf /usr/bin/chromium-browser /usr/bin/google-chrome-stable && \
        apt-get clean && rm -rf /var/lib/apt/lists/*; \
    else \
        # Cài đặt Chrome cho AMD64
        apt-get update && \
        apt-get install -y wget gnupg && \
        wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - && \
        echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list && \
        apt-get update && \
        apt-get install -y google-chrome-stable && \
        apt-get clean && rm -rf /var/lib/apt/lists/*; \
    fi

# Cài đặt noVNC
RUN mkdir -p /app \
    && git clone --depth 1 https://github.com/novnc/noVNC.git /app/noVNC \
    && git clone --depth 1 https://github.com/novnc/websockify /app/noVNC/utils/websockify

# Tạo người dùng không có quyền root để chạy Chrome/Chromium
RUN useradd -m chrome -s /bin/bash \
    && usermod -aG sudo chrome \
    && echo "chrome ALL=(ALL) NOPASSWD: ALL" >> /etc/sudoers \
    && mkdir -p /app/chrome-profiles \
    && chown -R chrome:chrome /app

# Thêm script khởi động và cấu hình
COPY start-chrome.sh /app/
COPY start-xvfb.sh /app/
COPY start-vnc.sh /app/
COPY start-novnc.sh /app/
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Phân quyền cho script khởi động
RUN chmod +x /app/start-chrome.sh \
    && chmod +x /app/start-xvfb.sh \
    && chmod +x /app/start-vnc.sh \
    && chmod +x /app/start-novnc.sh \
    && chown chrome:chrome /app/start-chrome.sh

# Tạo thư mục logs và đảm bảo thư mục chrome-profiles có sẵn
RUN mkdir -p /var/log /app/chrome-profiles/default && \
    chmod 777 /var/log && \
    chown -R chrome:chrome /app/chrome-profiles

# Mở các cổng
EXPOSE 8080 5900

# Chạy supervisord để quản lý các tiến trình
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"] 