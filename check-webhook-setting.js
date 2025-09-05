// 🔍 檢查 LINE Webhook 設定
const axios = require('axios');
require('dotenv').config();

async function checkWebhookSetting() {
  console.log('=====================================');
  console.log('   🔍 LINE Webhook 設定檢查');
  console.log('=====================================\n');

  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  
  if (!token) {
    console.error('❌ LINE_CHANNEL_ACCESS_TOKEN 未設定');
    return;
  }

  try {
    // 獲取 Webhook 端點資訊
    const response = await axios.get(
      'https://api.line.me/v2/bot/channel/webhook/endpoint',
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    console.log('📋 目前的 Webhook 設定:');
    console.log('   🔗 Webhook URL:', response.data.endpoint || '(未設定)');
    console.log('   ✅ 狀態:', response.data.active ? '啟用' : '停用');
    
    if (!response.data.endpoint || response.data.endpoint.includes('localhost')) {
      console.log('\n⚠️  警告: Webhook URL 未設定或使用 localhost');
      console.log('\n💡 解決方案:');
      console.log('   1. 開啟新的終端機視窗');
      console.log('   2. 執行: ngrok http 3000');
      console.log('   3. 複製 ngrok 提供的 HTTPS URL (例如: https://xxxx.ngrok.io)');
      console.log('   4. 前往 LINE Developers Console:');
      console.log('      https://developers.line.biz/console/');
      console.log('   5. 選擇你的 Channel');
      console.log('   6. 在 Messaging API 標籤下');
      console.log('   7. 設定 Webhook URL: https://xxxx.ngrok.io/webhook');
      console.log('   8. 啟用 Use webhook');
      console.log('   9. 點擊 Verify 按鈕測試連線');
    }

    // 測試 Webhook
    console.log('\n📮 測試 Webhook...');
    const testResponse = await axios.post(
      'https://api.line.me/v2/bot/channel/webhook/test',
      {},
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    if (testResponse.data.success) {
      console.log('   ✅ Webhook 測試成功！');
      console.log('   📊 詳細資訊:', testResponse.data);
    } else {
      console.log('   ❌ Webhook 測試失敗');
      console.log('   📊 錯誤詳情:', testResponse.data);
    }

  } catch (error) {
    if (error.response?.status === 404) {
      console.log('❌ Webhook 端點未設定');
      console.log('\n請按照以下步驟設定:');
      console.log('1. 前往 LINE Developers Console');
      console.log('2. 選擇您的 Channel');
      console.log('3. 在 Messaging API 設定 Webhook URL');
    } else {
      console.error('❌ 錯誤:', error.response?.data || error.message);
    }
  }

  console.log('\n=====================================\n');
}

// 執行檢查
checkWebhookSetting().catch(console.error);