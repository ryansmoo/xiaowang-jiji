# 🔧 GitHub Email 驗證指南

## 問題：Zeabur 顯示 "Email Sign-in Required"

這是因為 GitHub 帳號的 Email 地址未驗證導致的 OAuth 驗證失敗。

## 解決步驟：

### 1. 驗證 GitHub Email
1. 前往：https://github.com/settings/emails
2. 檢查主要 Email 是否有 ✅ 驗證標記
3. 如果沒有，點擊「Resend verification email」
4. 到 Email 信箱點擊驗證連結

### 2. 清除瀏覽器資料
```
Chrome/Edge: Ctrl+Shift+Delete
- 清除 Cookie 和快取
- 時間範圍選擇「所有時間」
```

### 3. 重新登入 Zeabur
1. 前往：https://zeabur.com/
2. 點擊「Login with GitHub」
3. 現在應該能成功登入

## 常見問題：

### Q: 收不到驗證信？
- 檢查垃圾郵件資料夾
- 確認 Email 地址正確
- 嘗試更換主要 Email

### Q: 還是無法登入？
- 嘗試無痕模式
- 撤銷 GitHub → Settings → Applications → Zeabur 的授權
- 重新授權

### Q: Gmail 用戶特別注意
- 檢查「促銷內容」和「社交」標籤
- GitHub 驗證信可能被分類到這些資料夾

## 驗證成功標誌：
- ✅ GitHub Email 旁有綠色勾勾
- ✅ Zeabur 能順利用 GitHub 登入
- ✅ 可以建立和部署專案

完成後就能順利使用 Zeabur 部署小汪記記了！🚀