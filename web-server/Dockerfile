FROM node:16

WORKDIR /app

# Cài đặt các dependencies
COPY package.json .
RUN npm install

# Copy code nguồn
COPY . .

# Tạo thư mục profiles
RUN mkdir -p /app/chrome-profiles

# Expose port
EXPOSE 3000

# Khởi động server
CMD ["node", "server.js"] 