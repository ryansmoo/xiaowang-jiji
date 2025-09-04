// 🎤 小汪記記語音轉文字模組
const speech = require('@google-cloud/speech');
const fs = require('fs');

// 初始化 Speech-to-Text 客戶端
const speechClient = new speech.SpeechClient();

/**
 * 將語音 Buffer 轉換為文字
 * @param {Buffer} audioBuffer - 語音檔案的 Buffer
 * @returns {Promise<string>} 轉換後的文字
 */
async function convertSpeechToText(audioBuffer) {
  try {
    console.log('🎤 開始進行語音轉文字...');
    console.log(`📊 音檔大小: ${audioBuffer.length} bytes`);
    
    // 檢查音檔前幾個 bytes 來判斷格式
    const header = audioBuffer.slice(0, 12).toString('hex');
    console.log(`🔍 音檔頭部: ${header}`);
    
    // 嘗試多種格式配置
    const configs = [
      // 配置 1: M4A/AAC 格式
      {
        encoding: 'M4A',
        sampleRateHertz: 16000,
        audioChannelCount: 1,
        languageCode: 'zh-TW',
        enableAutomaticPunctuation: true
      },
      // 配置 2: 不指定格式，讓 Google 自動偵測
      {
        languageCode: 'zh-TW',
        alternativeLanguageCodes: ['zh-CN', 'en-US'],
        enableAutomaticPunctuation: true,
        audioChannelCount: 1
      },
      // 配置 3: WEBM_OPUS (常見的網路語音格式)
      {
        encoding: 'WEBM_OPUS',
        sampleRateHertz: 48000,
        audioChannelCount: 1,
        languageCode: 'zh-TW',
        enableAutomaticPunctuation: true
      }
    ];

    // 依序嘗試不同的配置
    for (let i = 0; i < configs.length; i++) {
      try {
        console.log(`🔄 嘗試配置 ${i + 1}: ${configs[i].encoding || '自動偵測'}`);
        
        const request = {
          audio: {
            content: audioBuffer.toString('base64')
          },
          config: configs[i]
        };

        const [response] = await speechClient.recognize(request);
        console.log('📋 API 回應:', JSON.stringify(response, null, 2));
        
        // 如果成功，就跳出迴圈
        const transcription = response.results
          .map(result => result.alternatives[0].transcript)
          .join('\n');
        
        if (transcription) {
          console.log(`✅ 配置 ${i + 1} 成功: "${transcription}"`);
          return transcription.trim();
        }
        
      } catch (configError) {
        console.log(`⚠️ 配置 ${i + 1} 失敗: ${configError.message}`);
        continue; // 嘗試下一個配置
      }
    }
    
    // 所有配置都失敗
    console.log('⚠️ 所有配置都無法識別語音內容');
    return '無法識別語音內容，請重新發送';

  } catch (error) {
    console.error('❌ 語音轉文字失敗:', error.message);
    
    // 根據錯誤類型返回不同訊息
    if (error.message.includes('credentials')) {
      return '語音服務憑證設定錯誤';
    } else if (error.message.includes('quota')) {
      return '語音服務配額不足';
    } else {
      return '語音處理失敗，請重新發送';
    }
  }
}

/**
 * 測試語音轉文字功能
 */
async function testSpeechToText() {
  try {
    // 測試用的空 buffer（實際使用時會是真實的語音檔案）
    const testBuffer = Buffer.from('test');
    const result = await convertSpeechToText(testBuffer);
    console.log('🧪 測試結果:', result);
  } catch (error) {
    console.error('🧪 測試失敗:', error.message);
  }
}

module.exports = {
  convertSpeechToText,
  testSpeechToText
};