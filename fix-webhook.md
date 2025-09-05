# 🔧 修復 LINE Bot Webhook 步驟

## 立即執行：

### 方法一：使用 ngrok（推薦用於測試）

1. **開啟新的命令提示字元視窗**
   
2. **啟動 ngrok**
   ```bash
   ngrok http 3000
   ```

3. **複製新的 HTTPS URL**
   - 會看到類似：`https://abc123.ngrok-free.app`

4. **更新 LINE Developers Console**
   - 前往：https://developers.line.biz/console/
   - 選擇「小汪記記」Channel
   - 點擊「Messaging API」標籤
   - 在 Webhook settings 區塊：
     - Webhook URL: `https://你的新ngrok網址.ngrok-free.app/webhook`
     - Use webhook: 開啟
   - 點擊「Verify」按鈕

5. **測試**
   - 在 LINE 發送訊息給小汪記記
   - 應該會收到 Flex Message 回覆

### 方法二：部署到雲端（永久解決）

1. **使用 Railway 部署**
   ```bash
   # 安裝 Railway CLI
   npm install -g @railway/cli
   
   # 登入
   railway login
   
   # 初始化專案
   railway init
   
   # 部署
   railway up
   ```

2. **取得公開 URL**
   - Railway 會提供永久的 HTTPS URL
   - 格式：`https://你的專案.railway.app`

3. **更新 LINE Webhook**
   - Webhook URL: `https://你的專案.railway.app/webhook`

## 驗證檢查清單：

- [ ] 伺服器正在運行（本地或雲端）
- [ ] ngrok 或雲端 URL 是 HTTPS
- [ ] LINE Console 的 Webhook URL 正確
- [ ] Use webhook 已開啟
- [ ] Verify 測試通過

## 常見錯誤排除：

| 錯誤 | 原因 | 解決方法 |
|------|------|----------|
| 404 | ngrok URL 已過期 | 重新啟動 ngrok 並更新 URL |
| 401 | 簽名驗證失敗 | 檢查 Channel Secret |
| 500 | 伺服器錯誤 | 查看 console 錯誤訊息 |
| 無回應 | Webhook 未開啟 | 確認 Use webhook 已開啟 |

## 測試指令：
發送以下訊息給小汪記記測試：
- 「買狗糧」（新增任務）
- 「查看任務」（查看清單）
- 「完成任務」（完成第一個任務）