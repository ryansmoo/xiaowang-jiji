#!/bin/bash
# 🦓 小汪記記 - Zeabur 完整部署指令集

echo "🐕 小汪記記 Zeabur 完整部署開始..."
echo "======================================"

# 步驟 1: 設定 GitHub 儲存庫
echo "📦 步驟 1: 設定 GitHub 儲存庫"
read -p "請輸入您的 GitHub 用戶名: " GITHUB_USERNAME

if [ -z "$GITHUB_USERNAME" ]; then
    echo "❌ 必須提供 GitHub 用戶名"
    exit 1
fi

REPO_URL="https://github.com/${GITHUB_USERNAME}/xiaowang-jiji.git"
echo "🔗 將連接到: $REPO_URL"

# 設定 remote
git remote add origin "$REPO_URL"

# 步驟 2: 推送代碼
echo ""
echo "📤 步驟 2: 推送代碼到 GitHub"
git add .
git commit -m "🚀 準備部署到 Zeabur - 完整配置" || echo "沒有新的變更需要提交"
git push -u origin main

if [ $? -eq 0 ]; then
    echo "✅ 代碼成功推送到 GitHub"
else
    echo "❌ 推送失敗，請檢查 GitHub 儲存庫是否存在"
    echo "請前往 https://github.com/new 建立名為 'xiaowang-jiji' 的儲存庫"
    exit 1
fi

# 步驟 3: 顯示 Zeabur 部署指南
echo ""
echo "======================================"
echo "🦓 步驟 3: Zeabur 部署指南"
echo "======================================"
echo ""
echo "現在請依照以下步驟完成部署："
echo ""
echo "1. 前往 Zeabur 控制台："
echo "   🌐 https://zeabur.com/"
echo ""
echo "2. 用 GitHub 登入"
echo ""
echo "3. 建立專案："
echo "   - 點擊 'Create Project'"
echo "   - 選擇地區: Hong Kong (推薦) 或 Singapore"
echo ""
echo "4. 部署服務："
echo "   - 點擊 'Deploy New Service'"
echo "   - 選擇 'Deploy your source code'"
echo "   - 選擇儲存庫: xiaowang-jiji"
echo "   - Zeabur 會自動偵測 Node.js Express 並開始部署"
echo ""
echo "5. 設定環境變數 (在 Environment 標籤):"
echo "   LINE_CHANNEL_ACCESS_TOKEN = 您的LINE Token"
echo "   LINE_CHANNEL_SECRET = 您的LINE Secret"
echo "   SUPABASE_URL = 您的Supabase網址"
echo "   SUPABASE_ANON_KEY = 您的Supabase匿名金鑰"
echo "   SUPABASE_SERVICE_KEY = 您的Supabase服務金鑰"
echo "   PORT = 3000"
echo ""
echo "6. 設定域名 (在 Networking 標籤):"
echo "   - 點擊 'Generate Domain'"
echo "   - 記下域名: https://xxxxx.zeabur.app"
echo ""
echo "7. 更新 LINE Bot Webhook:"
echo "   - 前往 LINE Developers Console"
echo "   - 設定 Webhook URL: https://您的域名.zeabur.app/webhook"
echo "   - 點擊 Verify 測試"
echo ""
echo "======================================"
echo "✅ 部署完成後，您的 LINE Bot 將："
echo "  - 擁有永久固定域名"
echo "  - 99.99% 穩定運行"
echo "  - 亞洲最佳效能"
echo "  - 自動故障恢復"
echo "======================================"
echo ""
echo "🎉 恭喜！您的小汪記記即將永久上線！"