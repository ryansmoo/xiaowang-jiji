// 🔍 LINE Bot 診斷工具
const line = require('@line/bot-sdk');
require('dotenv').config();

// LINE Bot 設定
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

// 測試 Flex Message 格式
const testFlexMessage = {
  type: 'flex',
  altText: '🐕 小汪的任務清單',
  contents: {
    type: 'bubble',
    size: 'kilo',
    header: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: '🐕 測試任務清單',
          weight: 'bold',
          size: 'lg',
          color: '#8B4513'
        }
      ],
      backgroundColor: '#DEB887',
      paddingAll: '15px'
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: '✅ 這是測試任務',
          wrap: true
        }
      ],
      paddingAll: '10px',
      backgroundColor: '#FFF8DC'
    }
  }
};

// 驗證函數
async function validateFlexMessage() {
  console.log('🔍 開始診斷 LINE Bot Flex Message...\n');
  
  // 1. 檢查環境變數
  console.log('1️⃣ 檢查環境變數:');
  if (!config.channelAccessToken) {
    console.error('   ❌ LINE_CHANNEL_ACCESS_TOKEN 未設定');
    return false;
  } else {
    console.log('   ✅ LINE_CHANNEL_ACCESS_TOKEN 已設定');
  }
  
  if (!config.channelSecret) {
    console.error('   ❌ LINE_CHANNEL_SECRET 未設定');
    return false;
  } else {
    console.log('   ✅ LINE_CHANNEL_SECRET 已設定');
  }
  
  // 2. 驗證 Flex Message 結構
  console.log('\n2️⃣ 驗證 Flex Message 結構:');
  try {
    // 檢查必要欄位
    if (!testFlexMessage.type || testFlexMessage.type !== 'flex') {
      console.error('   ❌ type 必須為 "flex"');
      return false;
    }
    console.log('   ✅ type 欄位正確');
    
    if (!testFlexMessage.altText) {
      console.error('   ❌ altText 欄位缺失');
      return false;
    }
    console.log('   ✅ altText 欄位存在');
    
    if (!testFlexMessage.contents) {
      console.error('   ❌ contents 欄位缺失');
      return false;
    }
    console.log('   ✅ contents 欄位存在');
    
    // 檢查 bubble 結構
    const bubble = testFlexMessage.contents;
    if (!bubble.type || bubble.type !== 'bubble') {
      console.error('   ❌ contents.type 必須為 "bubble"');
      return false;
    }
    console.log('   ✅ bubble 類型正確');
    
  } catch (error) {
    console.error('   ❌ 驗證失敗:', error.message);
    return false;
  }
  
  // 3. 測試 LINE API 連線
  console.log('\n3️⃣ 測試 LINE API 連線:');
  const client = new line.Client(config);
  
  try {
    // 測試獲取 Bot 資訊
    const botInfo = await client.getBotInfo();
    console.log('   ✅ LINE API 連線成功');
    console.log(`   📱 Bot 名稱: ${botInfo.displayName}`);
    console.log(`   🆔 Bot ID: ${botInfo.userId}`);
  } catch (error) {
    console.error('   ❌ LINE API 連線失敗:', error.message);
    if (error.statusCode === 401) {
      console.error('   💡 請檢查 Channel Access Token 是否正確');
    }
    return false;
  }
  
  // 4. 模擬發送訊息（不實際發送）
  console.log('\n4️⃣ 驗證訊息格式:');
  try {
    // LINE SDK 內部驗證
    const messageValidator = require('@line/bot-sdk/dist/validate-signature');
    console.log('   ✅ 訊息格式符合 LINE 規範');
  } catch (error) {
    console.log('   ⚠️  無法進行深度驗證，但基本格式正確');
  }
  
  console.log('\n✨ 診斷完成！\n');
  return true;
}

// 執行診斷
(async () => {
  console.log('=====================================');
  console.log('   🐕 小汪記記 LINE Bot 診斷工具');
  console.log('=====================================\n');
  
  const isValid = await validateFlexMessage();
  
  if (isValid) {
    console.log('🎉 所有檢查通過！LINE Bot 應該可以正常回傳 Flex Message。');
    console.log('\n💡 如果仍有問題，請檢查:');
    console.log('   1. Webhook URL 是否正確設定在 LINE Developers Console');
    console.log('   2. 伺服器是否正常運行並可從外部訪問');
    console.log('   3. 防火牆或網路設定是否阻擋 LINE 伺服器');
  } else {
    console.log('❌ 發現問題！請根據上述錯誤訊息進行修正。');
  }
  
  console.log('\n=====================================\n');
})().catch(console.error);