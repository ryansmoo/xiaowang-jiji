// 🐕 小汪記記快速設置和檢查腳本
const { db } = require('./supabase-client-enhanced');
require('dotenv').config();

const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

async function quickSetup() {
    console.log(`${colors.cyan}🐕 小汪記記快速設置檢查${colors.reset}\n`);
    
    try {
        // 1. 測試基本連線
        console.log(`${colors.blue}1.${colors.reset} 測試資料庫連線...`);
        const connectionResult = await db.testConnection();
        if (connectionResult.success) {
            console.log(`   ${colors.green}✓ 資料庫連線成功${colors.reset}`);
        } else {
            console.log(`   ${colors.red}✗ 連線失敗: ${connectionResult.error}${colors.reset}`);
            return false;
        }
        
        // 2. 檢查必要表格
        console.log(`\n${colors.blue}2.${colors.reset} 檢查資料表...`);
        const tables = ['members', 'tasks', 'task_history', 'task_reminders', 'system_settings'];
        
        for (const table of tables) {
            try {
                const { error } = await db.client
                    .from(table)
                    .select('count', { count: 'exact', head: true });
                
                if (error && error.code === '42P01') {
                    console.log(`   ${colors.red}✗ 表格 '${table}' 不存在${colors.reset}`);
                } else if (error) {
                    console.log(`   ${colors.yellow}⚠ 表格 '${table}' 可能有問題: ${error.message}${colors.reset}`);
                } else {
                    console.log(`   ${colors.green}✓ 表格 '${table}' 存在${colors.reset}`);
                }
            } catch (err) {
                console.log(`   ${colors.red}✗ 檢查表格 '${table}' 失敗: ${err.message}${colors.reset}`);
            }
        }
        
        // 3. 測試基本操作
        console.log(`\n${colors.blue}3.${colors.reset} 測試基本資料庫操作...`);
        
        // 測試會員操作
        const testMember = {
            line_id: `quick_test_${Date.now()}`,
            member_id: `member_quick_${Date.now()}`,
            display_name: '快速測試小汪'
        };
        
        const memberResult = await db.upsertMember(testMember);
        if (memberResult.success) {
            console.log(`   ${colors.green}✓ 會員操作測試成功${colors.reset}`);
            
            // 測試任務操作
            const testTask = {
                line_user_id: testMember.line_id,
                title: '快速測試任務',
                task_date: new Date().toISOString().split('T')[0]
            };
            
            const taskResult = await db.createTask(testTask);
            if (taskResult.success) {
                console.log(`   ${colors.green}✓ 任務操作測試成功${colors.reset}`);
                
                // 清理測試資料
                await db.deleteTask(taskResult.data.task_id);
                await db.client.from('members').delete().eq('line_id', testMember.line_id);
                console.log(`   ${colors.green}✓ 測試資料已清理${colors.reset}`);
            } else {
                console.log(`   ${colors.red}✗ 任務操作失敗: ${taskResult.error}${colors.reset}`);
            }
        } else {
            console.log(`   ${colors.red}✗ 會員操作失敗: ${memberResult.error}${colors.reset}`);
        }
        
        // 4. 檢查健康狀態
        console.log(`\n${colors.blue}4.${colors.reset} 檢查系統健康狀態...`);
        const statsResult = await db.getSystemStats();
        if (statsResult.success) {
            console.log(`   ${colors.green}✓ 系統統計正常${colors.reset}`);
            console.log(`   └─ 總會員數: ${statsResult.data.totalMembers}`);
            console.log(`   └─ 總任務數: ${statsResult.data.totalTasks}`);
            console.log(`   └─ 完成率: ${statsResult.data.completionRate}%`);
        }
        
        console.log(`\n${colors.green}🎉 快速設置檢查完成！系統運作正常！${colors.reset}`);
        console.log(`\n接下來您可以：`);
        console.log(`1. 執行 ${colors.cyan}npm start${colors.reset} 啟動應用程式`);
        console.log(`2. 測試 ${colors.cyan}http://localhost:3000/health${colors.reset} 端點`);
        console.log(`3. 在 LINE Developer Console 設定 Webhook URL`);
        
        return true;
        
    } catch (error) {
        console.error(`${colors.red}快速設置檢查失敗: ${error.message}${colors.reset}`);
        return false;
    }
}

// 如果需要初始化系統設定
async function initializeSystemSettings() {
    console.log(`${colors.blue}初始化系統設定...${colors.reset}`);
    
    const defaultSettings = [
        { 
            key: 'maintenance_mode', 
            value: { enabled: false, message: '系統維護中' }, 
            category: 'system',
            description: '系統維護模式'
        },
        { 
            key: 'task_limits', 
            value: { daily_max: 100, per_user_max: 50 }, 
            category: 'limits',
            description: '任務數量限制'
        },
        { 
            key: 'reminder_settings', 
            value: { enabled: true, default_minutes: 30 }, 
            category: 'reminders',
            description: '提醒功能設定'
        },
        { 
            key: 'bot_name', 
            value: '小汪記記', 
            category: 'general',
            description: 'Bot 名稱'
        }
    ];
    
    let created = 0;
    for (const setting of defaultSettings) {
        try {
            const { error } = await db.client
                .from('system_settings')
                .insert(setting)
                .select();
            
            if (!error) {
                created++;
            }
        } catch (err) {
            // 可能已存在，忽略
        }
    }
    
    console.log(`   ${colors.green}✓ 初始化了 ${created} 個系統設定${colors.reset}`);
}

// 執行
if (require.main === module) {
    const command = process.argv[2];
    
    if (command === 'init-settings') {
        initializeSystemSettings()
            .then(() => process.exit(0))
            .catch(err => {
                console.error('初始化設定失敗:', err.message);
                process.exit(1);
            });
    } else {
        quickSetup()
            .then(success => process.exit(success ? 0 : 1))
            .catch(err => {
                console.error('設置檢查失敗:', err.message);
                process.exit(1);
            });
    }
}

module.exports = { quickSetup, initializeSystemSettings };