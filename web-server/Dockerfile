FROM node:18-alpine

WORKDIR /app

# Copy package files để cài đặt dependencies trước
COPY package*.json ./

# Cài đặt dependencies và nodemon toàn cục
RUN npm install && npm install -g nodemon

# Copy source code
COPY . .

# Tạo thư mục profiles nếu chưa có
RUN mkdir -p /app/chrome-profiles

EXPOSE 3000

# Sử dụng CMD thay vì ENTRYPOINT để cho phép override từ docker-compose command
CMD ["npm", "start"] 