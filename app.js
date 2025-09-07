// 🐕 小汪記記 - 改進版 LINE Bot 應用程式
const express = require('express');
const line = require('@line/bot-sdk');
const crypto = require('crypto');
require('dotenv').config();

// 引入 Supabase 資料庫模組
const { db } = require('./supabase-client');

// 🔧 設定
const app = express();
const PORT = process.env.PORT || 3000;

// LINE Bot 設定
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

// 建立 LINE Client
const client = new line.Client(config);

// 🏥 資料庫健康檢查端點
app.get('/health', async (req, res) => {
  try {
    const healthCheck = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        app: 'running',
        database: 'checking'
      },
      version: '1.0.0',
      uptime: process.uptime()
    };

    // 檢查資料庫連線
    const dbResult = await db.testConnection();
    if (dbResult.success) {
      healthCheck.services.database = 'connected';
      
      // 獲取系統統計
      const stats = await db.getSystemStats();
      if (stats.success) {
        healthCheck.statistics = stats.data;
      }
    } else {
      healthCheck.services.database = 'disconnected';
      healthCheck.status = 'degraded';
      healthCheck.error = dbResult.error;
    }

    // 檢查 LINE 配置
    healthCheck.services.line = (config.channelAccessToken && config.channelSecret) ? 'configured' : 'not_configured';

    const statusCode = healthCheck.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(healthCheck);
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// 🔍 資料庫狀態端點（更詳細的診斷資訊）
app.get('/health/db', async (req, res) => {
  try {
    const diagnostics = {
      timestamp: new Date().toISOString(),
      connection: {},
      tables: {},
      performance: {}
    };

    // 測試基本連線
    const startTime = Date.now();
    const connectionTest = await db.testConnection();
    diagnostics.connection = {
      status: connectionTest.success ? 'connected' : 'failed',
      latency: Date.now() - startTime,
      message: connectionTest.message || connectionTest.error
    };

    if (connectionTest.success) {
      // 檢查各表格狀態
      const tables = ['members', 'tasks', 'task_history', 'task_reminders', 'system_settings'];
      for (const table of tables) {
        try {
          const start = Date.now();
          const { data, error } = await db.client
            .from(table)
            .select('count', { count: 'exact', head: true });
          
          diagnostics.tables[table] = {
            accessible: !error,
            count: data || 0,
            responseTime: Date.now() - start
          };
        } catch (err) {
          diagnostics.tables[table] = {
            accessible: false,
            error: err.message
          };
        }
      }

      // 測試查詢效能
      const perfStart = Date.now();
      await db.getUserTasks('performance_test_user', { limit: 1 });
      diagnostics.performance.simpleQuery = Date.now() - perfStart;
    }

    res.json(diagnostics);
  } catch (error) {
    console.error('Database diagnostics failed:', error);
    res.status(500).json({
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// 🎨 狗狗表情符號集
const puppyEmojis = {
  happy: '🐕',
  excited: '🐶',
  working: '🦮',
  sleeping: '😴🐕',
  playing: '🐕‍🦺',
  thinking: '🤔🐕',
  love: '🥰🐕',
  party: '🎉🐕',
  hungry: '🦴',
  paw: '🐾'
};

// 📅 取得台灣時區的今日日期
function getTaiwanDate() {
  const now = new Date();
  const taiwanTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Taipei"}));
  return taiwanTime.toISOString().split('T')[0];
}

// 📝 詳細日誌記錄
function logDetail(level, message, data = null) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level}] ${message}`;
  
  if (level === 'ERROR') {
    console.error(logMessage, data || '');
  } else if (level === 'WARN') {
    console.warn(logMessage, data || '');
  } else {
    console.log(logMessage, data || '');
  }
  
  // 可以在這裡加入寫入檔案或發送到監控系統的邏輯
}

// 🎨 創建小汪主題的 Flex Message（加強版）
function createPuppyTaskFlexMessage(allTasks, userName = '主人') {
  try {
    const today = getTaiwanDate();
    const todayTasks = allTasks.filter(task => {
      if (!task.task_date) return false;
      const taskDate = new Date(task.task_date).toISOString().split('T')[0];
      return taskDate === today;
    });

    const completedTasks = todayTasks.filter(task => task.completed);
    const pendingTasks = todayTasks.filter(task => !task.completed);
    
    // 根據任務數量決定小汪的心情
    let puppyMood = puppyEmojis.happy;
    let moodText = '汪汪！今天要做什麼呢？';
    
    if (todayTasks.length === 0) {
      puppyMood = puppyEmojis.sleeping;
      moodText = '今天沒有任務，小汪可以睡覺了～';
    } else if (completedTasks.length === todayTasks.length) {
      puppyMood = puppyEmojis.party;
      moodText = '太棒了！今天的任務都完成了！';
    } else if (todayTasks.length > 5) {
      puppyMood = '😰🐕';
      moodText = '汪！今天任務有點多喔...';
    } else {
      puppyMood = puppyEmojis.working;
      moodText = `還有 ${pendingTasks.length} 個任務要完成，加油！`;
    }

    // 任務列表內容
    const taskContents = todayTasks.length > 0 ? todayTasks.map((task, index) => {
      const checkbox = task.completed ? '✅' : '⬜';
      const taskStyle = task.completed ? {
        decoration: 'line-through',
        color: '#999999'
      } : {};
      
      return {
        type: 'box',
        layout: 'horizontal',
        contents: [
          {
            type: 'text',
            text: checkbox,
            flex: 0,
            size: 'sm'
          },
          {
            type: 'text',
            text: task.title || '未命名任務',
            flex: 1,
            size: 'sm',
            wrap: true,
            decoration: taskStyle.decoration,
            color: taskStyle.color,
            action: {
              type: 'postback',
              data: `complete_task_${task.task_id}`,
              displayText: `${task.completed ? '取消完成' : '完成'}「${task.title}」`
            }
          }
        ],
        margin: 'sm',
        spacing: 'sm'
      };
    }) : [
      {
        type: 'text',
        text: '🐾 今天還沒有任務喔～',
        size: 'sm',
        color: '#8B4513',
        align: 'center'
      }
    ];

    // 加入分隔線
    if (todayTasks.length > 0) {
      taskContents.push({
        type: 'separator',
        margin: 'md'
      });
    }

    // 統計資訊
    taskContents.push({
      type: 'box',
      layout: 'horizontal',
      contents: [
        {
          type: 'text',
          text: `${puppyEmojis.paw} 今日進度`,
          flex: 0,
          size: 'xs',
          color: '#8B4513'
        },
        {
          type: 'text',
          text: `${completedTasks.length} / ${todayTasks.length} 完成`,
          flex: 1,
          size: 'xs',
          color: '#8B4513',
          align: 'end'
        }
      ],
      margin: 'md'
    });

    // 進度條
    const progressPercentage = todayTasks.length > 0 
      ? Math.round((completedTasks.length / todayTasks.length) * 100)
      : 0;
    
    taskContents.push({
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'box',
          layout: 'vertical',
          contents: [],
          height: '6px',
          backgroundColor: progressPercentage > 0 ? '#90EE90' : '#E0E0E0',
          width: `${progressPercentage}%`,
          cornerRadius: '3px'
        }
      ],
      backgroundColor: '#E0E0E0',
      height: '6px',
      margin: 'sm',
      cornerRadius: '3px'
    });

    // 構建完整的 Flex Message
    const flexMessage = {
      type: 'bubble',
      size: 'kilo',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: `${puppyMood} 小汪的任務清單`,
            weight: 'bold',
            size: 'lg',
            color: '#8B4513'
          },
          {
            type: 'text',
            text: moodText,
            size: 'xs',
            color: '#8B6914',
            margin: 'sm'
          }
        ],
        backgroundColor: '#DEB887',
        paddingAll: '15px'
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: taskContents,
        paddingAll: '10px',
        backgroundColor: '#FFF8DC'
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: `🦴 ${userName}，記得完成任務喔！`,
            size: 'xs',
            color: '#8B4513',
            align: 'center'
          }
        ],
        backgroundColor: '#FAEBD7',
        paddingAll: '10px'
      },
      styles: {
        body: {
          separator: true
        }
      }
    };

    return {
      altText: `🐕 小汪提醒：今天有 ${todayTasks.length} 個任務，已完成 ${completedTasks.length} 個`,
      contents: flexMessage
    };
  } catch (error) {
    logDetail('ERROR', 'createPuppyTaskFlexMessage 錯誤', error);
    // 返回錯誤時的備用訊息
    return {
      altText: '🐕 小汪的任務清單',
      contents: {
        type: 'bubble',
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: '🐕 汪汪！載入任務時遇到問題',
              wrap: true
            }
          ]
        }
      }
    };
  }
}

// 🔐 驗證 LINE 簽名（加強版）
function validateLineSignature(req, res, next) {
  const signature = req.get('X-Line-Signature');
  const body = req.body;
  
  if (!signature) {
    logDetail('ERROR', '缺少 X-Line-Signature');
    return res.status(401).send('Unauthorized');
  }
  
  if (!config.channelSecret) {
    logDetail('ERROR', 'Channel Secret 未設定');
    return res.status(500).send('Server configuration error');
  }
  
  try {
    const hash = crypto
      .createHmac('SHA256', config.channelSecret)
      .update(body)
      .digest('base64');
    
    if (hash !== signature) {
      logDetail('ERROR', '簽名驗證失敗', { expected: hash, received: signature });
      return res.status(401).send('Signature validation failed');
    }
    
    req.body = JSON.parse(body.toString());
    next();
  } catch (error) {
    logDetail('ERROR', '簽名驗證過程錯誤', error);
    return res.status(500).send('Internal server error');
  }
}

// 🎯 處理 LINE 事件（加強版）
async function handleEvent(event) {
  logDetail('INFO', '收到事件', { 
    type: event.type, 
    userId: event.source?.userId,
    message: event.message?.text 
  });

  // 只處理訊息和 postback 事件
  if (event.type !== 'message' && event.type !== 'postback') {
    logDetail('INFO', '忽略非訊息/postback 事件');
    return Promise.resolve(null);
  }

  const userId = event.source.userId;
  
  try {
    // 處理 postback 事件
    if (event.type === 'postback') {
      const data = event.postback.data;
      const today = getTaiwanDate();
      
      if (data.startsWith('complete_task_')) {
        const taskId = data.replace('complete_task_', '');
        logDetail('INFO', `切換任務完成狀態: ${taskId}`);
        
        const { success, data: updatedTask } = await db.toggleTaskComplete(taskId);
      
        if (success && updatedTask) {
          const statusText = updatedTask.completed ? '完成' : '取消完成';
          logDetail('INFO', `任務${statusText}: ${updatedTask.title}`);
          
          const { success: fetchSuccess, data: allTasks } = await db.getUserTasks(userId, { date: today });
          const userTasks = fetchSuccess ? allTasks : [];
          const flexMessage = createPuppyTaskFlexMessage(userTasks);
          
          const replyMessage = {
            type: 'flex',
            altText: flexMessage.altText,
            contents: flexMessage.contents
          };
          
          await client.replyMessage(event.replyToken, replyMessage);
          logDetail('INFO', 'Flex Message 已發送（postback）');
          return;
        } else {
          logDetail('WARN', `找不到任務: ${taskId}`);
          return client.replyMessage(event.replyToken, {
            type: 'text',
            text: '🐕 汪？找不到這個任務耶～'
          });
        }
      }
    }

    // 處理文字訊息
    if (event.type === 'message' && event.message.type === 'text') {
      const messageText = event.message.text.trim();
      const today = getTaiwanDate();
      
      logDetail('INFO', `處理文字訊息: ${messageText}`);
      
      // 檢查是否為查看任務指令
      if (messageText === '查看所有任務' || 
          messageText === '任務' || 
          messageText === '清單' || 
          messageText === '汪汪清單' ||
          messageText === '查看任務') {
        
        logDetail('INFO', '執行查看任務指令');
        const { success, data: allTasks } = await db.getUserTasks(userId, { date: today });
        const userTasks = success ? allTasks : [];
        const flexMessage = createPuppyTaskFlexMessage(userTasks);
        
        const replyMessage = {
          type: 'flex',
          altText: flexMessage.altText,
          contents: flexMessage.contents
        };
        
        await client.replyMessage(event.replyToken, replyMessage);
        logDetail('INFO', 'Flex Message 已發送（查看任務）');
        return;
      }
      
      // 檢查是否為完成任務指令
      if (messageText === '完成任務' || 
          messageText === '餵食小汪' || 
          messageText === '完成' ||
          messageText === '汪汪完成') {
        
        logDetail('INFO', '執行完成任務指令');
        const { success, data: allTasks } = await db.getUserTasks(userId, { date: today });
        const userTasks = success ? allTasks : [];
        const uncompletedTask = userTasks.find(task => !task.completed);
        
        if (uncompletedTask) {
          const { success: toggleSuccess, data: updatedTask } = await db.toggleTaskComplete(uncompletedTask.task_id);
          
          if (toggleSuccess && updatedTask) {
            const { success: fetchSuccess, data: updatedTasks } = await db.getUserTasks(userId, { date: today });
            const latestTasks = fetchSuccess ? updatedTasks : [];
            const flexMessage = createPuppyTaskFlexMessage(latestTasks);
            
            const replyMessage = {
              type: 'flex',
              altText: flexMessage.altText,
              contents: flexMessage.contents
            };
            
            await client.replyMessage(event.replyToken, replyMessage);
            logDetail('INFO', 'Flex Message 已發送（完成任務）');
            return;
          }
        } else {
          return client.replyMessage(event.replyToken, {
            type: 'text',
            text: '🎉🐕 汪汪！所有任務都完成了！你真棒～'
          });
        }
        return;
      }
      
      // 其他訊息視為新任務
      const taskData = {
        line_user_id: userId,
        title: messageText,
        description: '',
        note: '',
        task_date: today,
        status: 'pending',
        completed: false
      };

      logDetail('INFO', `新增任務: ${taskData.title}`);
      const { success, data: newTask } = await db.createTask(taskData);
      
      if (!success) {
        logDetail('ERROR', '創建任務失敗');
      } else {
        logDetail('INFO', `任務創建成功: ${newTask.task_id}`);
      }

      const { success: fetchSuccess, data: allTasks } = await db.getUserTasks(userId, { date: today });
      const userTasks = fetchSuccess ? allTasks : [];
      const flexMessage = createPuppyTaskFlexMessage(userTasks);
      
      const replyMessage = {
        type: 'flex',
        altText: flexMessage.altText,
        contents: flexMessage.contents
      };
      
      await client.replyMessage(event.replyToken, replyMessage);
      logDetail('INFO', 'Flex Message 已發送（新增任務）');
      return;
    }

  } catch (error) {
    logDetail('ERROR', '處理事件時發生錯誤', error);
    
    // 嘗試發送錯誤訊息
    try {
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: '🐕 汪汪！小汪遇到了一點小問題，請稍後再試～'
      });
    } catch (replyError) {
      logDetail('ERROR', '發送錯誤訊息失敗', replyError);
    }
  }
}

// 🏥 健康檢查端點
app.get('/health', (req, res) => {
  logDetail('INFO', '健康檢查請求');
  res.status(200).json({
    status: '🐕 小汪記記正在運行中！',
    timestamp: new Date().toISOString(),
    message: 'Webhook 準備就緒！汪汪～',
    version: '1.0.1-improved',
    env_check: {
      channel_secret: process.env.LINE_CHANNEL_SECRET ? '✅ 已設定' : '❌ 未設定',
      channel_token: process.env.LINE_CHANNEL_ACCESS_TOKEN ? '✅ 已設定' : '❌ 未設定',
      supabase: process.env.SUPABASE_URL ? '✅ 已設定' : '❌ 未設定'
    }
  });
});

// 📊 狀態監控端點
app.get('/status', async (req, res) => {
  try {
    // 測試資料庫連線
    const dbTest = await db.testConnection();
    
    res.status(200).json({
      status: 'operational',
      services: {
        web: 'up',
        database: dbTest.success ? 'up' : 'down',
        lineApi: config.channelAccessToken ? 'configured' : 'not configured'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'partial',
      error: error.message
    });
  }
});

// 🔄 Webhook 路由
app.use('/webhook', express.raw({type: 'application/json'}));
app.post('/webhook', validateLineSignature, async (req, res) => {
  try {
    const events = req.body.events;
    
    if (!events || events.length === 0) {
      logDetail('WARN', '收到空的事件陣列');
      return res.status(200).json({ message: 'No events to process' });
    }
    
    logDetail('INFO', `處理 ${events.length} 個事件`);
    
    // 並行處理所有事件
    const results = await Promise.all(events.map(handleEvent));
    
    logDetail('INFO', `成功處理所有事件`);
    res.status(200).json({ 
      message: 'Events processed successfully',
      processed: events.length 
    });
    
  } catch (error) {
    logDetail('ERROR', 'Webhook 處理錯誤', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 🚀 啟動伺服器
app.listen(PORT, () => {
  logDetail('INFO', `🐕 小汪記記啟動成功！`);
  logDetail('INFO', `🌐 伺服器運行在 http://localhost:${PORT}`);
  logDetail('INFO', `📍 Webhook URL: http://localhost:${PORT}/webhook`);
  logDetail('INFO', `🏥 健康檢查: http://localhost:${PORT}/health`);
  logDetail('INFO', `📊 狀態監控: http://localhost:${PORT}/status`);
  logDetail('INFO', '汪汪！準備好接收任務了～ 🦴');
});

// 優雅關閉
process.on('SIGTERM', () => {
  logDetail('INFO', '收到 SIGTERM 信號，準備關閉...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logDetail('INFO', '收到 SIGINT 信號，準備關閉...');
  process.exit(0);
});