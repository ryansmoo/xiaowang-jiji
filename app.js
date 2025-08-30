require('dotenv').config();
const line = require('@line/bot-sdk');
const express = require('express');

// 🐕 小汪記記 LINE Bot 配置
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new line.Client(config);
const app = express();
const PORT = process.env.PORT || 3000;

// 任務儲存 (使用記憶體儲存，重啟後會重置)
const tasks = new Map(); // userId -> tasks array

// 中間件設定
app.use('/webhook', line.middleware(config));
app.use(express.static('public'));

// 🐾 小汪的可愛表情符號
const puppyEmojis = {
  happy: '🐕',
  excited: '🐶',
  working: '🦮',
  sleeping: '😴🐕',
  playing: '🐕‍🦺',
  bone: '🦴',
  paw: '🐾'
};

// 🎨 創建小汪主題的 Flex Message
function createPuppyTaskFlexMessage(todayTasks, userName = '主人') {
  const completedCount = todayTasks.filter(t => t.completed).length;
  const pendingCount = todayTasks.length - completedCount;

  // 根據任務數量選擇小汪的心情
  let puppyMood = '🐕';
  let moodText = '';
  if (todayTasks.length === 0) {
    puppyMood = '😴🐕';
    moodText = '小汪想睡覺了~';
  } else if (completedCount === todayTasks.length) {
    puppyMood = '🎉🐕';
    moodText = '汪汪！全部完成了！';
  } else if (todayTasks.length > 5) {
    puppyMood = '😰🐕';
    moodText = '汪...任務好多...';
  } else {
    puppyMood = '🐶';
    moodText = '汪汪！一起加油！';
  }

  const taskItems = todayTasks.map((task, index) => ({
    type: 'box',
    layout: 'horizontal',
    contents: [
      {
        type: 'text',
        text: `${index + 1}.`,
        size: 'sm',
        color: '#8B4513',
        flex: 0,
        weight: 'bold'
      },
      {
        type: 'text',
        text: task.completed ? '✅' : '🦴',
        size: 'sm',
        flex: 0,
        margin: 'sm'
      },
      {
        type: 'text',
        text: task.text,
        size: 'sm',
        color: task.completed ? '#666666' : '#333333',
        flex: 1,
        wrap: true,
        margin: 'sm',
        decoration: task.completed ? 'line-through' : 'none'
      }
    ],
    spacing: 'sm',
    margin: index > 0 ? 'sm' : 'none'
  }));

  return {
    type: 'flex',
    altText: `${puppyMood} 小汪記記：今天 ${todayTasks.length} 個任務`,
    contents: {
      type: 'bubble',
      styles: {
        body: {
          backgroundColor: '#FFF8DC' // 米色背景
        },
        header: {
          backgroundColor: '#DEB887' // 淺棕色頭部
        }
      },
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: `${puppyMood} 小汪記記`,
            weight: 'bold',
            size: 'lg',
            color: '#8B4513'
          },
          {
            type: 'text',
            text: moodText,
            size: 'sm',
            color: '#A0522D',
            margin: 'xs'
          }
        ],
        paddingAll: '15px'
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: `🐾 ${userName} 今天有 ${todayTasks.length} 個任務`,
            weight: 'bold',
            size: 'md',
            color: '#8B4513',
            align: 'center',
            margin: 'none'
          },
          {
            type: 'separator',
            margin: 'md',
            color: '#DEB887'
          },
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
                text: `🦴 完成 ${completedCount} 個`,
                size: 'xs',
                color: '#228B22',
                flex: 1
              },
              {
                type: 'text',
                text: `🐾 待完成 ${pendingCount} 個`,
                size: 'xs',
                color: '#FF6347',
                flex: 1,
                align: 'end'
              }
            ],
            margin: 'md'
          }
        ],
        spacing: 'sm',
        paddingAll: '20px'
      },
      footer: {
        type: 'box',
        layout: 'horizontal',
        contents: [
          {
            type: 'button',
            style: 'secondary',
            action: {
              type: 'message',
              label: '🐕 汪汪清單',
              text: '查看所有任務'
            },
            color: '#8B4513',
            flex: 1
          },
          {
            type: 'button',
            style: 'secondary',
            action: {
              type: 'message',
              label: '🦴 餵食小汪',
              text: '完成任務'
            },
            color: '#228B22',
            flex: 1,
            margin: 'sm'
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
  if (event.type !== 'message' || event.message.type !== 'text') {
    return null;
  }

  const userId = event.source.userId;
  const messageText = event.message.text.trim();
  const today = new Date().toISOString().split('T')[0];

  console.log(`🐕 小汪收到訊息: "${messageText}" from user: ${userId.substring(0, 10)}...`);

  // 初始化用戶任務
  if (!tasks.has(userId)) {
    tasks.set(userId, []);
  }

  // 特殊指令處理
  if (messageText === '查看所有任務' || messageText === '汪汪清單') {
    const todayTasks = tasks.get(userId).filter(task => task.date === today);
    const replyMessage = createPuppyTaskFlexMessage(todayTasks);
    return client.replyMessage(event.replyToken, replyMessage);
  }

  if (messageText === '完成任務') {
    const todayTasks = tasks.get(userId).filter(task => task.date === today);
    if (todayTasks.length > 0) {
      // 簡單示範：完成最新的未完成任務
      const uncompletedTask = todayTasks.find(task => !task.completed);
      if (uncompletedTask) {
        uncompletedTask.completed = true;
        console.log(`🎉 任務已完成: ${uncompletedTask.text}`);
        
        const replyMessage = {
          type: 'text',
          text: `🎉🐕 汪汪！任務完成了！\n「${uncompletedTask.text}」\n\n小汪很開心呢～ 🦴`
        };
        return client.replyMessage(event.replyToken, replyMessage);
      }
    }
    
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: '🐕 汪？沒有待完成的任務呢～\n要不要新增一些任務讓小汪幫你記住？'
    });
  }

  // 新增任務
  const newTask = {
    id: Date.now().toString(),
    text: messageText,
    createdAt: new Date().toISOString(),
    date: today,
    userId: userId,
    completed: false
  };

  tasks.get(userId).push(newTask);
  console.log(`🐾 小汪記住了新任務: ${newTask.text}`);

  // 獲取今天的任務並回傳
  const todayTasks = tasks.get(userId).filter(task => task.date === today);
  const replyMessage = createPuppyTaskFlexMessage(todayTasks);

  try {
    await client.replyMessage(event.replyToken, replyMessage);
    console.log('🐕 小汪成功回傳任務清單！');
  } catch (error) {
    console.error('❌ 小汪發送失敗:', error.message);
    
    // 備案：發送簡單文字回應
    const fallbackText = `🐕 汪汪！小汪記住了：\n「${messageText}」\n\n今天總共有 ${todayTasks.length} 個任務呢！`;
    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: fallbackText
    });
  }
}

// 🌐 路由設定
app.post('/webhook', (req, res) => {
  console.log('📨 小汪收到 Webhook 請求:', new Date().toLocaleTimeString('zh-TW'));
  
  Promise.all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error('❌ 小汪 Webhook 錯誤:', err);
      res.status(500).end();
    });
});

// 健康檢查
app.get('/health', (req, res) => {
  res.json({ 
    status: '🐕 小汪很健康！', 
    mood: '汪汪！', 
    timestamp: new Date().toISOString() 
  });
});

// 任務 API
app.get('/api/tasks/:userId', (req, res) => {
  const userId = req.params.userId;
  const userTasks = tasks.get(userId) || [];
  res.json({ 
    tasks: userTasks,
    puppyStatus: '🐕 小汪在守護你的任務！',
    totalTasks: userTasks.length
  });
});

// 🚀 啟動伺服器
app.listen(PORT, () => {
  console.log('🐕🎉 小汪記記啟動成功！');
  console.log(`📡 小汪正在 http://localhost:${PORT} 等你！`);
  console.log('🔗 記得將 Webhook URL 設定到 LINE Developer Console');
  console.log('🦴 小汪準備好記錄你的任務了！汪汪～');
  console.log('');
  console.log('🐾 小汪的功能：');
  console.log('   • 發送任何訊息 → 新增任務');
  console.log('   • 發送「查看所有任務」→ 查看任務清單');
  console.log('   • 發送「完成任務」→ 完成最新任務');
  console.log('   • 可愛的狗狗主題 Flex Message！');
});