# 🐕 小汪記記 Docker 部署配置
FROM node:18-alpine

# 設定工作目錄
WORKDIR /app

# 複製 package.json 和 package-lock.json
COPY package*.json ./

# 安裝依賴
RUN npm ci --only=production

# 複製所有應用程式檔案
COPY . .

# 建立非 root 用戶
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# 變更檔案擁有者
USER nodejs

# 暴露端口
EXPOSE 3000

# 健康檢查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# 啟動應用程式
CMD ["node", "app-improved.js"]