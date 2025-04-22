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
    libx11-6 \
    libxcb1 \
    libxext6 \
    libxi6 \
    libxtst6 \
    libglib2.0-0 \
    libpangocairo-1.0-0 \
    libpango-1.0-0 \
    libxcursor1 \
    libxss1 \
    libegl1 \
    sudo \
    software-properties-common \
    x11-utils \
    locales \
    fonts-noto \
    fonts-noto-cjk \
    fonts-noto-color-emoji \
    fonts-ubuntu \
    fonts-liberation \
    fontconfig \
    # Thêm gói font hỗ trợ Tiếng Việt
    fonts-dejavu \
    fonts-dejavu-core \
    fonts-dejavu-extra \
    fonts-freefont-ttf \
    fonts-liberation \
    fonts-liberation2 \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-thai-tlwg \
    fonts-kacst \
    fonts-symbola \
    fonts-indic \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Cấu hình locale và font
RUN locale-gen en_US.UTF-8 && \
    locale-gen vi_VN.UTF-8 && \
    fc-cache -f -v

# Thiết lập biến môi trường locale
ENV LANG=vi_VN.UTF-8 \
    LANGUAGE=vi_VN:en \
    LC_ALL=vi_VN.UTF-8

# Cài đặt Chrome
RUN apt-get update && \
    apt-get install -y wget && \
    ARCH=$(dpkg --print-architecture) && \
    if [ "$ARCH" = "amd64" ]; then \
        wget -q https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb && \
        apt-get install -y ./google-chrome-stable_current_amd64.deb && \
        rm -f google-chrome-stable_current_amd64.deb; \
    elif [ "$ARCH" = "arm64" ]; then \
        # Cài đặt Chromium từ PPA thay vì snap
        add-apt-repository ppa:xtradeb/apps -y && \
        apt-get update && \
        apt-get install -y chromium && \
        ln -sf /usr/bin/chromium /usr/bin/google-chrome-stable; \
    else \
        echo "Kiến trúc $ARCH không được hỗ trợ" && exit 1; \
    fi && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

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
    chmod -R 777 /app/chrome-profiles && \
    chown -R chrome:chrome /app/chrome-profiles

# Mở các cổng
EXPOSE 8080 5900

# Chạy supervisord để quản lý các tiến trình
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"] 