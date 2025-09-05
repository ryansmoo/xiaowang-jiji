#!/bin/bash
# 🚀 一鍵部署到 Zeabur 腳本

echo "=================================="
echo "   🦓 Zeabur 自動部署腳本"
echo "=================================="

# 檢查 Git 狀態
echo "📋 檢查 Git 狀態..."
git status

# 提交最新改動
echo "📦 提交程式碼..."
git add .
git commit -m "🚀 準備部署到 Zeabur - $(date +%Y-%m-%d)"

# 推送到 GitHub（Zeabur 需要從 GitHub 部署）
echo "📤 推送到 GitHub..."
git push

echo "=================================="
echo "✅ 代碼已推送到 GitHub！"
echo "=================================="
echo ""
echo "📝 接下來請手動完成以下步驟："
echo ""
echo "1. 前往 Zeabur 控制台："
echo "   https://zeabur.com/"
echo ""
echo "2. 用 GitHub 登入"
echo ""
echo "3. 點擊 'Create Project'"
echo ""
echo "4. 選擇地區（推薦：Hong Kong 或 Singapore）"
echo ""
echo "5. 點擊 'Deploy New Service' → 'Deploy your source code'"
echo ""
echo "6. 選擇您的 GitHub 儲存庫：xiaowang-jiji"
echo ""
echo "7. Zeabur 會自動偵測 Node.js Express 專案並開始部署"
echo ""
echo "8. 部署完成後，在 'Networking' 標籤設定域名"
echo ""
echo "9. 在 'Environment' 標籤設定以下環境變數："
echo "   - LINE_CHANNEL_ACCESS_TOKEN"
echo "   - LINE_CHANNEL_SECRET"
echo "   - SUPABASE_URL"
echo "   - SUPABASE_ANON_KEY"
echo "   - SUPABASE_SERVICE_KEY"
echo "   - PORT (設為 3000)"
echo ""
echo "10. 複製 Zeabur 提供的域名，更新 LINE Bot Webhook URL"
echo ""
echo "=================================="