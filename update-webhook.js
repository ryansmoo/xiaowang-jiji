require('dotenv').config();
const axios = require('axios');

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN
};

// 使用現有的 ngrok URL，但改為指向小汪記記的 port 3000
const WEBHOOK_URL = 'https://b09e1cf172a6.ngrok-free.app/webhook';

async function updateWebhookForPuppy() {
  console.log('🐕 更新小汪記記的 LINE Bot Webhook 設定');
  console.log('🦴 新的 Webhook URL:', WEBHOOK_URL);
  
  try {
    // 更新 Webhook URL
    await axios.put('https://api.line.me/v2/bot/channel/webhook/endpoint', {
      endpoint: WEBHOOK_URL
    }, {
      headers: {
        'Authorization': `Bearer ${config.channelAccessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ 小汪的 Webhook URL 更新成功！');
    console.log('🐾 現在可以在 LINE 中和小汪記記聊天了！');
    console.log('汪汪～ 發送任何訊息給小汪試試看！');
    
  } catch (error) {
    console.error('❌ 小汪的 Webhook 設定失敗:', error.message);
    if (error.response) {
      console.error('詳細錯誤:', error.response.data);
    }
  }
}

updateWebhookForPuppy();