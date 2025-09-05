// 🔍 啟動並診斷 LINE Bot 系統
const { spawn } = require('child_process');
const axios = require('axios');
require('dotenv').config();

const PORT = process.env.PORT || 3000;
const BASE_URL = `http://localhost:${PORT}`;

console.log('=====================================');
console.log('   🐕 小汪記記系統診斷工具');
console.log('=====================================\n');

// 步驟 1: 啟動伺服器
console.log('1️⃣ 啟動伺服器...');
const server = spawn('node', ['app.js'], {
  cwd: process.cwd(),
  env: process.env,
  shell: true
});

let serverReady = false;

server.stdout.on('data', (data) => {
  console.log(`   📝 ${data.toString().trim()}`);
  if (data.toString().includes('小汪記記啟動成功')) {
    serverReady = true;
  }
});

server.stderr.on('data', (data) => {
  console.error(`   ❌ 錯誤: ${data.toString().trim()}`);
});

server.on('error', (error) => {
  console.error('   ❌ 無法啟動伺服器:', error.message);
  process.exit(1);
});

// 等待伺服器啟動
setTimeout(async () => {
  if (!serverReady) {
    console.log('   ⏳ 等待伺服器啟動...');
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  try {
    // 步驟 2: 測試健康檢查
    console.log('\n2️⃣ 測試健康檢查端點...');
    const healthResponse = await axios.get(`${BASE_URL}/health`);
    console.log('   ✅ 健康檢查成功');
    console.log(`   📊 狀態: ${healthResponse.data.status}`);
    console.log(`   🔧 環境檢查:`, healthResponse.data.env_check);

    // 步驟 3: 測試狀態端點
    console.log('\n3️⃣ 測試狀態監控端點...');
    try {
      const statusResponse = await axios.get(`${BASE_URL}/status`);
      console.log('   ✅ 狀態端點正常');
      console.log(`   📊 服務狀態:`, statusResponse.data.services);
    } catch (error) {
      console.log('   ⚠️  狀態端點錯誤:', error.message);
    }

    // 步驟 4: 檢查 Webhook 配置
    console.log('\n4️⃣ 檢查 LINE Webhook 配置...');
    if (process.env.LINE_CHANNEL_ACCESS_TOKEN && process.env.LINE_CHANNEL_SECRET) {
      console.log('   ✅ LINE 認證資訊已設定');
      
      // 測試 LINE API 連線
      const line = require('@line/bot-sdk');
      const client = new line.Client({
        channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
        channelSecret: process.env.LINE_CHANNEL_SECRET
      });
      
      try {
        const botInfo = await client.getBotInfo();
        console.log(`   ✅ LINE Bot 連線成功: ${botInfo.displayName}`);
      } catch (error) {
        console.error('   ❌ LINE Bot 連線失敗:', error.message);
      }
    } else {
      console.log('   ❌ LINE 認證資訊未設定');
    }

    // 步驟 5: 測試 Webhook 端點
    console.log('\n5️⃣ 測試 Webhook 端點...');
    try {
      const webhookTest = await axios.post(`${BASE_URL}/webhook`, 
        { events: [] },
        { 
          headers: { 
            'X-Line-Signature': 'test',
            'Content-Type': 'application/json'
          }
        }
      );
      console.log('   ⚠️  Webhook 端點可訪問（但簽名驗證會失敗）');
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('   ✅ Webhook 端點正常（簽名驗證運作中）');
      } else {
        console.log('   ❌ Webhook 端點錯誤:', error.message);
      }
    }

    // 步驟 6: 檢查外部訪問
    console.log('\n6️⃣ 檢查外部訪問設定...');
    console.log('   ℹ️  本地伺服器運行在: http://localhost:' + PORT);
    console.log('   ⚠️  LINE 需要公開的 HTTPS URL');
    console.log('   💡 解決方案:');
    console.log('      1. 使用 ngrok: ngrok http ' + PORT);
    console.log('      2. 部署到雲端: Railway, Heroku, etc.');
    console.log('      3. 使用反向代理服務');

    // 步驟 7: 診斷總結
    console.log('\n=====================================');
    console.log('   📋 診斷總結');
    console.log('=====================================');
    
    const issues = [];
    const solutions = [];

    // 檢查是否有 ngrok 或公開 URL
    if (!process.env.BASE_URL || process.env.BASE_URL.includes('localhost')) {
      issues.push('❌ 沒有設定公開的 Webhook URL');
      solutions.push('1. 啟動 ngrok: ngrok http 3000');
      solutions.push('2. 複製 ngrok 提供的 HTTPS URL');
      solutions.push('3. 在 LINE Developers Console 設定 Webhook URL');
    }

    if (issues.length > 0) {
      console.log('\n🚨 發現的問題:');
      issues.forEach(issue => console.log('   ' + issue));
      
      console.log('\n💡 建議解決方案:');
      solutions.forEach((solution, index) => console.log(`   ${solution}`));
    } else {
      console.log('\n✅ 系統配置正常！');
    }

    console.log('\n=====================================\n');

  } catch (error) {
    console.error('\n❌ 診斷過程發生錯誤:', error.message);
  }

  // 保持伺服器運行
  console.log('📌 伺服器保持運行中... (按 Ctrl+C 結束)');
  
}, 5000);

// 處理退出
process.on('SIGINT', () => {
  console.log('\n🛑 關閉伺服器...');
  server.kill();
  process.exit(0);
});