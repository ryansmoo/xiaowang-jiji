# 🐕 小汪記記 - 可愛的狗狗任務管理 LINE Bot

![小汪記記](https://img.shields.io/badge/🐕-小汪記記-orange.svg)
![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)
![LINE Bot](https://img.shields.io/badge/LINE-Bot-00C300.svg)

## 🎯 專案簡介

**小汪記記** 是一個充滿可愛狗狗元素的 LINE Bot 任務管理系統！讓可愛的小汪陪伴您管理日常任務，用最萌的方式記錄您的待辦事項。

### 🐾 小汪的特色

- 🐕 **可愛狗狗主題**：所有介面都充滿狗狗元素
- 🦴 **簡單易用**：發送訊息即可新增任務
- 🎨 **美觀介面**：米色系 Flex Message 設計
- 🐶 **智能回應**：小汪會根據任務情況展現不同心情
- 🦮 **即時反饋**：任務狀態即時更新

## 🚀 快速開始

### 1. 環境需求
- Node.js >= 18.0.0
- npm >= 8.0.0
- LINE Developer Account

### 2. 安裝專案
```bash
# 克隆專案 (或下載 ZIP)
cd 小汪記記

# 安裝依賴
npm install
```

### 3. 環境設定
```bash
# 複製環境變數檔案
cp .env.example .env

# 編輯 .env 檔案，填入您的 LINE Bot 設定
LINE_CHANNEL_ACCESS_TOKEN=你的TOKEN
LINE_CHANNEL_SECRET=你的SECRET
PORT=3000
```

### 4. 啟動小汪
```bash
# 開發模式 (自動重啟)
npm run dev

# 正式運行
npm start
```

## 🐕 小汪的功能

### 📋 任務管理
- **新增任務**：向小汪發送任何文字訊息
- **查看任務**：發送「查看所有任務」或「汪汪清單」
- **完成任務**：發送「完成任務」或「餵食小汪」

### 🎨 視覺特色
- **米色背景**：溫暖舒適的視覺風格
- **狗狗圖示**：🐕🐶🦮🐾🦴 豐富的表情符號
- **心情變化**：小汪會根據任務數量展現不同情緒
  - 😴🐕 沒任務時想睡覺
  - 🐶 正常工作狀態
  - 😰🐕 任務太多時會緊張
  - 🎉🐕 全部完成時很開心

### 🔧 API 端點
- `GET /health` - 檢查小汪的健康狀態
- `GET /api/tasks/:userId` - 獲取用戶的任務列表
- `POST /webhook` - LINE Bot Webhook 端點

## 📱 使用範例

### 新增任務
```
用戶：買狗糧
小汪：🐕 汪汪！小汪記住了！
      [顯示可愛的任務清單]
```

### 查看任務
```
用戶：查看所有任務
小汪：[顯示完整的狗狗主題任務清單]
      🐾 主人今天有 3 個任務
      1. 🦴 買狗糧
      2. 🦴 遛狗
      3. 🦴 整理狗窩
```

### 完成任務
```
用戶：完成任務
小汪：🎉🐕 汪汪！任務完成了！
      「買狗糧」
      小汪很開心呢～ 🦴
```

## 🏗️ 專案結構

```
小汪記記/
├── app.js              # 🐕 主程式檔案
├── package.json        # 📦 專案配置
├── .env.example        # 🔧 環境變數範例
├── .gitignore         # 🚫 Git 忽略清單
├── README.md          # 📖 說明文件
└── public/            # 🌐 靜態資源 (未來功能)
```

## 🎨 自訂小汪

### 修改小汪的心情
在 `app.js` 中的 `puppyEmojis` 物件：
```javascript
const puppyEmojis = {
  happy: '🐕',
  excited: '🐶', 
  working: '🦮',
  sleeping: '😴🐕',
  playing: '🐕‍🦺',
  // 加入更多表情！
};
```

### 自訂顏色主題
修改 Flex Message 中的顏色設定：
```javascript
styles: {
  body: {
    backgroundColor: '#FFF8DC' // 米色背景
  },
  header: {
    backgroundColor: '#DEB887' // 淺棕色頭部
  }
}
```

## 🚀 部署選項

### 1. Railway 部署
1. 連接 GitHub 倉庫到 Railway
2. 設定環境變數
3. 自動部署完成！

### 2. 本地 + ngrok
```bash
# 安裝 ngrok
npm install -g ngrok

# 啟動應用
npm start

# 另開視窗建立隧道
ngrok http 3000
```

### 3. 其他雲端平台
- Heroku
- Vercel  
- Google Cloud Run
- AWS Lambda

## 🔧 開發指南

### 新增功能
1. 修改 `app.js` 中的 `handleEvent` 函數
2. 加入新的指令處理邏輯
3. 設計對應的 Flex Message 回應

### 除錯技巧
```bash
# 檢查小汪健康狀態
curl http://localhost:3000/health

# 查看用戶任務 (需要實際 userId)
curl http://localhost:3000/api/tasks/USER_ID
```

## 🤝 貢獻指南

歡迎為小汪記記貢獻程式碼！

1. Fork 這個專案
2. 創建您的功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交您的修改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 開啟一個 Pull Request

## 📄 授權條款

本專案使用 MIT 授權條款 - 查看 [LICENSE](LICENSE) 檔案了解詳情。

## 🐾 致謝

- 感謝所有可愛的狗狗們提供靈感 🐕
- 感謝 LINE Bot SDK 團隊
- 感謝 Node.js 和 Express.js 社群

## 📞 聯絡資訊

- **專案作者**：您的名字
- **Email**：your.email@example.com
- **LINE Bot ID**：@your-bot-id

---

**🐕 汪汪！小汪期待與您一起管理任務！ 🦴**

## 🎯 下一步計畫

- [ ] 🔔 任務提醒功能
- [ ] 📊 任務統計圖表  
- [ ] 🎮 小汪養成遊戲
- [ ] 📱 LIFF 應用整合
- [ ] 🌈 更多狗狗主題選擇
- [ ] 🦴 完成任務獎勵系統

*讓我們一起讓小汪記記變得更可愛更實用！* 🚀🐕