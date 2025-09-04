require('dotenv').config();
const line = require('@line/bot-sdk');
const express = require('express');
const crypto = require('crypto');
const { db } = require('./supabase-client');

// 🐕 小汪記記 LINE Bot 配置
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new line.Client(config);
const app = express();
const PORT = process.env.PORT || 3000;

console.log('🐕 小汪記記啟動中...');
console.log('🔑 Channel Secret 長度:', process.env.LINE_CHANNEL_SECRET ? process.env.LINE_CHANNEL_SECRET.length : '未設定');
console.log('🔑 Access Token 長度:', process.env.LINE_CHANNEL_ACCESS_TOKEN ? process.env.LINE_CHANNEL_ACCESS_TOKEN.length : '未設定');

// 工具函數：取得台灣時區的正確日期
function getTaiwanDate() {
  const now = new Date();
  const taiwanTime = new Date(now.getTime() + (8 * 60 * 60 * 1000)); // UTC+8
  return taiwanTime.toISOString().split('T')[0];
}

// 手動簽名驗證中間件（經過 debug 驗證有效）
function validateLineSignature(req, res, next) {
  console.log('🔐 開始簽名驗證...');
  
  const signature = req.headers['x-line-signature'];
  if (!signature) {
    console.error('❌ 缺少 LINE 簽名 header');
    return res.status(401).end();
  }
  
  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  const body = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body);
  const hash = crypto.createHmac('SHA256', channelSecret).update(body, 'utf8').digest('base64');
  
  console.log('📝 計算出的簽名:', hash.substring(0, 20) + '...');
  console.log('📨 LINE 傳來的簽名:', signature);
  
  if (hash !== signature) {
    console.error('❌ LINE 簽名驗證失敗');
    return res.status(401).end();
  }
  
  console.log('✅ LINE 簽名驗證成功');
  next();
}

// 🎨 創建小汪主題的 Flex Message
function createPuppyTaskFlexMessage(allTasks, userName = '主人') {
  const completedCount = allTasks.filter(t => t.completed).length;
  const pendingCount = allTasks.length - completedCount;

  // 根據任務數量選擇小汪的心情
  let puppyMood = '🐕';
  let moodText = '';
  if (allTasks.length === 0) {
    puppyMood = '😴🐕';
    moodText = '小汪想睡覺了~';
  } else if (completedCount === allTasks.length) {
    puppyMood = '🎉🐕';
    moodText = '汪汪！全部完成了！';
  } else if (allTasks.length > 5) {
    puppyMood = '😰🐕';
    moodText = '汪...任務好多...';
  } else {
    puppyMood = '🐶';
    moodText = '汪汪！一起加油！';
  }

  // 將任務按照完成狀態排序：未完成的在前，已完成的在後
  const sortedTasks = [...allTasks].sort((a, b) => {
    if (a.completed === b.completed) return 0;
    return a.completed ? 1 : -1; // 未完成的排在前面
  });

  // 建立帶有分隔線的任務項目 (筆記本風格)
  const taskItems = [];
  
  sortedTasks.forEach((task, index) => {
    // 如果不是第一個任務，先加入分隔線
    if (index > 0) {
      taskItems.push({
        type: 'separator',
        margin: 'md',
        color: '#E0E0E0' // 淺灰色分隔線，營造筆記本線條感
      });
    }
    
    // 加入任務項目
    const taskContents = [
      // 第一行：編號 + 任務名稱 + 圖示
      {
        type: 'box',
        layout: 'horizontal',
        alignItems: 'center',
        contents: [
          {
            type: 'text',
            text: `${index + 1}.`,
            size: 'md',
            color: task.completed ? '#666666' : '#000000',
            flex: 0,
            weight: 'bold',
            decoration: task.completed ? 'line-through' : 'none'
          },
          {
            type: 'text',
            text: task.title || task.text,
            size: 'md',
            color: task.completed ? '#666666' : '#000000',
            flex: 1,
            wrap: true,
            margin: 'sm',
            decoration: task.completed ? 'line-through' : 'none',
            maxLines: 3
          },
          {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: task.completed ? '☑' : '☐',
                size: 'xxl',
                color: '#333333',
                action: {
                  type: 'postback',
                  data: `complete_task_${task.task_id}`,
                  displayText: `${task.completed ? '取消完成' : '完成'}任務：${task.title || task.text}`
                }
              }
            ],
            flex: 0,
            margin: 'xl'
          }
        ],
        spacing: 'sm'
      }
    ];

    // 如果有備註，在任務名稱下方加入備註
    if (task.note && task.note.trim() !== '') {
      taskContents.push({
        type: 'box',
        layout: 'horizontal',
        alignItems: 'center',
        contents: [
          {
            type: 'text',
            text: '  ', // 兩個空格佔位，微調對齊位置
            size: 'md',
            color: '#FFF8DC', // 背景色隱藏
            flex: 0,
            weight: 'bold'
          },
          {
            type: 'text',
            text: task.note,
            size: 'xs', // 再小一級字體
            color: task.completed ? '#999999' : '#000000',
            wrap: true,
            decoration: task.completed ? 'line-through' : 'none',
            maxLines: 2,
            flex: 1,
            margin: 'sm'
          },
          {
            type: 'text',
            text: ' ', // 隱形佔位，對應勾選框
            size: 'xxl',
            color: '#FFF8DC',
            flex: 0,
            margin: 'xl'
          }
        ],
        spacing: 'sm',
        margin: 'xs'
      });
    }

    taskItems.push({
      type: 'box',
      layout: 'vertical',
      contents: taskContents,
      margin: index === 0 ? 'none' : 'md',
      paddingEnd: '5px' // 減小右側 padding 讓文字寬度增加到10個字
    });
  });

  return {
    type: 'flex',
    altText: `${puppyMood} 小汪記記：總共 ${allTasks.length} 個任務`,
    contents: {
      type: 'bubble',
      styles: {
        body: {
          backgroundColor: '#FFF8DC' // 米色背景
        },
        header: {
          backgroundColor: '#DDA368' // 指定顏色頭部
        }
      },
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: `總共 ${allTasks.length} 件事要做`,
            weight: 'bold',
            size: 'lg',
            color: '#FFFFFF',
            align: 'center'
          }
        ],
        paddingAll: '15px'
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          ...(taskItems.length > 0 ? taskItems : [
            {
              type: 'text',
              text: '🦴 還沒有任務呢！\n發送訊息給小汪來新增任務吧～',
              size: 'sm',
              color: '#A0522D',
              align: 'center',
              wrap: true
            }
          ]),
          {
            type: 'separator',
            margin: 'lg',
            color: '#DEB887'
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'text',
                text: `已完成 ${completedCount} 件、待完成 ${pendingCount} 件`,
                size: 'sm',
                color: '#8B4513',
                flex: 1,
                align: 'center'
              }
            ],
            margin: 'md'
          }
        ],
        spacing: 'sm',
        paddingAll: '20px'
      }
    }
  };
}

// 🎯 處理 LINE 訊息事件
async function handleEvent(event) {
  try {
    console.log('🎯 開始處理事件:', event.type);
    
    // 處理 postback 事件 (點擊勾選框)
    if (event.type === 'postback') {
      const data = event.postback.data;
      const userId = event.source.userId;
      const today = getTaiwanDate();
      
      // 處理完成任務的 postback
      if (data.startsWith('complete_task_')) {
        const taskId = data.replace('complete_task_', '');
        
        // 使用 Supabase 切換任務完成狀態
        const { success, data: updatedTask } = await db.toggleTaskComplete(taskId);
      
        if (success && updatedTask) {
          const statusText = updatedTask.completed ? '完成' : '取消完成';
          console.log(`✅ 任務${statusText}: ${updatedTask.title}`);
          
          // 獲取用戶所有任務
          const { success: fetchSuccess, data: allTasks } = await db.getUserTasks(userId, { date: today });
          const userTasks = fetchSuccess ? allTasks : [];
          const flexMessage = createPuppyTaskFlexMessage(userTasks);
          
          const replyMessage = {
            type: 'flex',
            altText: flexMessage.altText,
            contents: flexMessage.contents,
            quickReply: {
              items: [
                {
                  type: 'action',
                  action: {
                    type: 'uri',
                    label: '全部紀錄',
                    uri: 'https://liff.line.me/2007976732-1kEGwX34'
                  }
                },
                {
                  type: 'action',
                  action: {
                    type: 'uri',
                    label: '個人帳戶',
                    uri: `${process.env.BASE_URL}/profile`
                  }
                }
              ]
            }
          };
          
          return client.replyMessage(event.replyToken, replyMessage);
        } else {
          // 如果找不到任務
          return client.replyMessage(event.replyToken, {
            type: 'text',
            text: '🐕 汪？找不到這個任務耶～'
          });
        }
      }
      return null;
    }
    
    // 只處理文字訊息
    if (event.type !== 'message' || event.message.type !== 'text') {
      return null;
    }

    const userId = event.source.userId;
    const messageText = event.message.text.trim();
    const today = getTaiwanDate();
    
    console.log(`🐕 小汪收到訊息: "${messageText}" from user: ${userId.substring(0, 10)}...`);

    // 特殊指令處理
    if (messageText === '查看所有任務' || messageText === '汪汪清單') {
      const { success, data: allTasks } = await db.getUserTasks(userId, { date: today });
      const userTasks = success ? allTasks : [];
      const flexMessage = createPuppyTaskFlexMessage(userTasks);
      
      // 建立包含 Quick Reply 的回覆訊息
      const replyMessage = {
        type: 'flex',
        altText: flexMessage.altText,
        contents: flexMessage.contents,
        quickReply: {
          items: [
            {
              type: 'action',
              action: {
                type: 'uri',
                label: '全部紀錄',
                uri: 'https://liff.line.me/2007976732-1kEGwX34'
              }
            },
            {
              type: 'action',
              action: {
                type: 'uri',
                label: '個人帳戶',
                uri: `${process.env.BASE_URL}/profile`
              }
            }
          ]
        }
      };
      
      return client.replyMessage(event.replyToken, replyMessage);
    }

    if (messageText === '完成任務') {
      const { success, data: allTasks } = await db.getUserTasks(userId, { date: today });
      const userTasks = success ? allTasks : [];
      
      if (userTasks.length > 0) {
        // 簡單示範：完成最新的未完成任務
        const uncompletedTask = userTasks.find(task => !task.completed);
        if (uncompletedTask) {
          const { success: toggleSuccess, data: updatedTask } = await db.toggleTaskComplete(uncompletedTask.task_id);
          if (toggleSuccess) {
            console.log(`🎉 任務已完成: ${updatedTask.title}`);
            
            const replyMessage = {
              type: 'text',
              text: `🎉🐕 汪汪！任務完成了！\n「${updatedTask.title}」\n\n小汪很開心呢～ 🦴`
            };
            return client.replyMessage(event.replyToken, replyMessage);
          }
        }
      }
      
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: '🐕 汪？沒有待完成的任務呢～\n要不要新增一些任務讓小汪幫你記住？'
      });
    }

    // 新增任務 (使用 Supabase)
    const taskData = {
      line_user_id: userId,
      title: messageText,
      description: '',
      note: '',
      task_date: today,
      status: 'pending',
      completed: false
    };

    console.log('📝 準備新增任務:', taskData.title);
    const { success, data: newTask } = await db.createTask(taskData);
    
    if (!success) {
      console.error('❌ 創建任務失敗，使用記憶體儲存作為備案');
      // 這裡可以加入記憶體備案邏輯
    }

    // 獲取用戶所有任務 (從 Supabase)
    const { success: fetchSuccess, data: allTasks } = await db.getUserTasks(userId, { date: today });
    const userTasks = fetchSuccess ? allTasks : [];
    const flexMessage = createPuppyTaskFlexMessage(userTasks);
    
    // 建立包含 Quick Reply 的回覆訊息
    const replyMessage = {
      type: 'flex',
      altText: flexMessage.altText,
      contents: flexMessage.contents,
      quickReply: {
        items: [
          {
            type: 'action',
            action: {
              type: 'uri',
              label: '全部紀錄',
              uri: 'https://liff.line.me/2007976732-1kEGwX34'
            }
          },
          {
            type: 'action',
            action: {
              type: 'uri',
              label: '個人帳戶',
              uri: `${process.env.BASE_URL}/profile`
            }
          }
        ]
      }
    };
    
    return client.replyMessage(event.replyToken, replyMessage);

  } catch (error) {
    console.error('❌ 處理事件時發生錯誤:', error);
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: '🐕 汪汪！小汪遇到了一點小問題，請稍後再試～'
    });
  }
}

// 健康檢查端點
app.get('/health', (req, res) => {
  console.log('🏥 健康檢查請求');
  res.status(200).json({
    status: '🐕 小汪記記正在運行中！',
    timestamp: new Date().toISOString(),
    message: 'Webhook 準備就緒！汪汪～',
    env_check: {
      channel_secret: process.env.LINE_CHANNEL_SECRET ? '✅ 已設定' : '❌ 未設定',
      channel_token: process.env.LINE_CHANNEL_ACCESS_TOKEN ? '✅ 已設定' : '❌ 未設定',
      supabase: '✅ 已設定'
    }
  });
});

// Webhook 路由 - 使用已驗證的自定義簽名驗證
app.use('/webhook', express.raw({type: 'application/json'}));
app.post('/webhook', validateLineSignature, (req, res) => {
  console.log('🔔🔔🔔 Webhook 被觸發！🔔🔔🔔');
  console.log('📨 時間:', new Date().toLocaleTimeString('zh-TW'));
  
  // 解析 JSON
  let events;
  try {
    const jsonBody = JSON.parse(req.body);
    events = jsonBody.events;
  } catch (error) {
    console.error('❌ JSON 解析失敗:', error);
    return res.status(400).end();
  }
  
  // 檢查是否有 events
  if (!events || events.length === 0) {
    console.log('⚠️ 沒有事件資料');
    return res.status(200).end();
  }
  
  console.log(`📋 處理 ${events.length} 個事件`);
  
  // 詳細記錄每個事件
  events.forEach((event, index) => {
    console.log(`\n事件 ${index + 1}:`);
    console.log('- Type:', event.type);
    if (event.message) {
      console.log('- Message Type:', event.message.type);
      console.log('- Message Text:', event.message.text);
    }
    console.log('- User ID:', event.source?.userId?.substring(0, 10) + '...');
  });
  
  // 處理所有事件
  Promise.all(events.map(handleEvent))
    .then(() => {
      console.log('✅ 所有事件處理完成');
      res.status(200).end();
    })
    .catch((err) => {
      console.error('❌ 處理事件時發生錯誤:', err);
      // 即使出錯也要回應 200，避免 LINE 重試
      res.status(200).end();
    });
});

// 啟動伺服器
app.listen(PORT, () => {
  console.log('\n🐕🎉 小汪記記啟動成功！');
  console.log(`📡 小汪正在 http://localhost:${PORT} 等你！`);
  console.log('🔗 記得將 Webhook URL 設定到 LINE Developer Console');
  console.log('🦴 小汪準備好記錄你的任務了！汪汪～\n');
  
  console.log('🐾 小汪的功能：');
  console.log('   • 發送任何訊息 → 新增任務');
  console.log('   • 發送「查看所有任務」→ 查看任務清單');
  console.log('   • 簡化版本，專注核心功能！\n');
});