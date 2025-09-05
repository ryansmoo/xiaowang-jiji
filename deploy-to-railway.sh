#!/bin/bash
# 🚀 一鍵部署到 Railway 腳本

echo "=================================="
echo "   🚂 Railway 自動部署腳本"
echo "=================================="

# 檢查 Git 狀態
echo "📋 檢查 Git 狀態..."
git status

# 提交最新改動
echo "📦 提交程式碼..."
git add .
git commit -m "🚀 準備部署到 Railway - $(date +%Y-%m-%d)"

# 安裝 Railway CLI（如果尚未安裝）
if ! command -v railway &> /dev/null; then
    echo "📥 安裝 Railway CLI..."
    npm install -g @railway/cli
fi

# 登入 Railway
echo "🔐 登入 Railway..."
railway login

# 連結或建立專案
echo "🔗 連結 Railway 專案..."
railway link

# 部署
echo "🚀 開始部署..."
railway up

# 獲取部署 URL
echo "🌐 獲取部署 URL..."
railway domain

echo "=================================="
echo "✅ 部署完成！"
echo "=================================="
echo ""
echo "📝 後續步驟："
echo "1. 複製上方顯示的 Railway URL"
echo "2. 前往 LINE Developers Console"
echo "3. 更新 Webhook URL 為: https://你的域名.railway.app/webhook"
echo "4. 點擊 Verify 測試"
echo ""