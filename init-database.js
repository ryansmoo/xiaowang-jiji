// 🐕 小汪記記資料庫初始化腳本
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

// 顏色輸出
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

// 初始化 Supabase 管理員客戶端
const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);

// 執行步驟記錄
async function executeStep(stepName, stepFunc) {
    process.stdout.write(`${colors.cyan}► ${stepName}...${colors.reset} `);
    
    try {
        const result = await stepFunc();
        console.log(`${colors.green}✓ 完成${colors.reset}`);
        if (result && result.message) {
            console.log(`  └─ ${result.message}`);
        }
        return { success: true, ...result };
    } catch (error) {
        console.log(`${colors.red}✗ 失敗${colors.reset}`);
        console.error(`  └─ 錯誤: ${error.message}`);
        return { success: false, error: error.message };
    }
}

// 主要初始化函數
async function initializeDatabase() {
    console.log('\n' + '='.repeat(60));
    console.log(`${colors.yellow}🐕 小汪記記資料庫初始化程序${colors.reset}`);
    console.log('='.repeat(60) + '\n');
    
    const results = [];
    
    // 步驟 1: 檢查環境變數
    results.push(await executeStep('檢查環境變數', async () => {
        const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'];
        const missing = required.filter(key => !process.env[key]);
        
        if (missing.length > 0) {
            throw new Error(`缺少必要的環境變數: ${missing.join(', ')}`);
        }
        
        const hasServiceKey = !!process.env.SUPABASE_SERVICE_KEY;
        return {
            message: `所有必要環境變數已設定 ${hasServiceKey ? '(包含 Service Key)' : '(使用 Anon Key)'}`
        };
    }));
    
    // 步驟 2: 測試資料庫連線
    results.push(await executeStep('測試資料庫連線', async () => {
        const { data, error } = await supabaseAdmin
            .from('members')
            .select('count', { count: 'exact', head: true });
        
        if (error && error.code !== '42P01') { // 42P01 = table does not exist
            throw error;
        }
        
        return {
            message: error ? '連線成功，但表格尚未建立' : `連線成功，members 表有 ${data} 筆資料`
        };
    }));
    
    // 步驟 3: 讀取並執行 SQL Schema
    results.push(await executeStep('執行資料庫 Schema', async () => {
        const schemaPath = path.join(__dirname, 'supabase-schema.sql');
        
        try {
            const schemaContent = await fs.readFile(schemaPath, 'utf8');
            
            // 分割 SQL 語句（簡單分割，實際可能需要更複雜的解析）
            const statements = schemaContent
                .split(';')
                .map(s => s.trim())
                .filter(s => s.length > 0 && !s.startsWith('--'));
            
            let createdTables = 0;
            let createdIndexes = 0;
            let errors = [];
            
            for (const statement of statements) {
                try {
                    // 透過 Supabase 的 RPC 執行原始 SQL
                    const { error } = await supabaseAdmin.rpc('exec_sql', {
                        sql: statement + ';'
                    });
                    
                    if (error) {
                        // 如果表格或索引已存在，不視為錯誤
                        if (!error.message.includes('already exists')) {
                            errors.push(error.message);
                        }
                    } else {
                        if (statement.toUpperCase().includes('CREATE TABLE')) {
                            createdTables++;
                        } else if (statement.toUpperCase().includes('CREATE INDEX')) {
                            createdIndexes++;
                        }
                    }
                } catch (err) {
                    // RPC 可能不存在，嘗試其他方法
                    console.log(`\n  ⚠️ 無法透過 RPC 執行 SQL，請手動在 Supabase Dashboard 執行 schema`);
                    return {
                        message: '需要手動執行 SQL Schema'
                    };
                }
            }
            
            if (errors.length > 0) {
                console.log(`\n  ⚠️ 部分語句執行失敗:`, errors);
            }
            
            return {
                message: `處理了 ${statements.length} 個 SQL 語句`
            };
        } catch (error) {
            if (error.code === 'ENOENT') {
                throw new Error('找不到 supabase-schema.sql 檔案');
            }
            throw error;
        }
    }));
    
    // 步驟 4: 驗證表格結構
    results.push(await executeStep('驗證表格結構', async () => {
        const requiredTables = [
            'members',
            'tasks',
            'task_history',
            'member_login_logs',
            'task_reminders',
            'system_settings'
        ];
        
        const tableStatus = {};
        
        for (const tableName of requiredTables) {
            const { error } = await supabaseAdmin
                .from(tableName)
                .select('*')
                .limit(0);
            
            tableStatus[tableName] = !error;
        }
        
        const existingTables = Object.entries(tableStatus)
            .filter(([_, exists]) => exists)
            .map(([name, _]) => name);
        
        const missingTables = Object.entries(tableStatus)
            .filter(([_, exists]) => !exists)
            .map(([name, _]) => name);
        
        if (missingTables.length > 0) {
            console.log(`\n  ⚠️ 缺少的表格: ${missingTables.join(', ')}`);
            console.log(`  ℹ️ 請在 Supabase Dashboard 的 SQL Editor 中執行 supabase-schema.sql`);
        }
        
        return {
            message: `找到 ${existingTables.length}/${requiredTables.length} 個必要表格`
        };
    }));
    
    // 步驟 5: 初始化系統設定
    results.push(await executeStep('初始化系統設定', async () => {
        const defaultSettings = [
            { key: 'bot_name', value: '小汪記記', category: 'general' },
            { key: 'default_language', value: 'zh-TW', category: 'general' },
            { key: 'timezone', value: 'Asia/Taipei', category: 'general' },
            { key: 'max_tasks_per_day', value: '50', category: 'limits' },
            { key: 'reminder_advance_minutes', value: '30', category: 'reminders' },
            { key: 'enable_voice_memo', value: 'true', category: 'features' },
            { key: 'enable_task_reminders', value: 'true', category: 'features' },
            { key: 'maintenance_mode', value: 'false', category: 'system' }
        ];
        
        let inserted = 0;
        let skipped = 0;
        
        for (const setting of defaultSettings) {
            const { data: existing } = await supabaseAdmin
                .from('system_settings')
                .select('key')
                .eq('key', setting.key)
                .single();
            
            if (!existing) {
                const { error } = await supabaseAdmin
                    .from('system_settings')
                    .insert(setting);
                
                if (!error) {
                    inserted++;
                }
            } else {
                skipped++;
            }
        }
        
        return {
            message: `新增 ${inserted} 個設定，跳過 ${skipped} 個已存在設定`
        };
    }));
    
    // 步驟 6: 建立測試資料（可選）
    const createTestData = process.argv.includes('--test-data');
    if (createTestData) {
        results.push(await executeStep('建立測試資料', async () => {
            // 建立測試會員
            const testMember = {
                line_id: 'U_test_' + Date.now(),
                member_id: 'member_test_' + Date.now(),
                display_name: '測試小汪',
                picture_url: 'https://example.com/test-puppy.jpg',
                member_level: 'basic',
                preferences: {
                    language: 'zh-TW',
                    timezone: 'Asia/Taipei',
                    notifications: {
                        task_reminder: true,
                        daily_summary: true
                    }
                }
            };
            
            const { data: member, error: memberError } = await supabaseAdmin
                .from('members')
                .insert(testMember)
                .select()
                .single();
            
            if (memberError) throw memberError;
            
            // 建立測試任務
            const testTasks = [
                {
                    task_id: 'task_test_1_' + Date.now(),
                    member_id: member.id,
                    line_user_id: member.line_id,
                    title: '餵小汪吃早餐',
                    description: '記得準備營養均衡的狗糧',
                    task_date: new Date().toISOString().split('T')[0],
                    priority: 'high',
                    category: '日常照顧'
                },
                {
                    task_id: 'task_test_2_' + Date.now(),
                    member_id: member.id,
                    line_user_id: member.line_id,
                    title: '帶小汪散步',
                    description: '到公園跑跑，運動30分鐘',
                    task_date: new Date().toISOString().split('T')[0],
                    priority: 'normal',
                    category: '運動'
                }
            ];
            
            const { error: tasksError } = await supabaseAdmin
                .from('tasks')
                .insert(testTasks);
            
            if (tasksError) throw tasksError;
            
            return {
                message: `建立了 1 個測試會員和 ${testTasks.length} 個測試任務`
            };
        }));
    }
    
    // 步驟 7: 設定 Row Level Security
    results.push(await executeStep('檢查 Row Level Security', async () => {
        // 注意：RLS 政策需要在 Supabase Dashboard 或透過 SQL 設定
        // 這裡只是檢查提醒
        console.log(`\n  ℹ️ 請確認已在 Supabase Dashboard 設定適當的 RLS 政策`);
        console.log(`  ℹ️ 詳細說明請參考 SUPABASE_SETUP.md`);
        
        return {
            message: 'RLS 需要手動設定'
        };
    }));
    
    // 總結
    console.log('\n' + '='.repeat(60));
    console.log(`${colors.yellow}初始化結果總結${colors.reset}`);
    console.log('='.repeat(60));
    
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    
    console.log(`成功步驟: ${colors.green}${successCount}${colors.reset}`);
    console.log(`失敗步驟: ${colors.red}${failCount}${colors.reset}`);
    
    if (failCount === 0) {
        console.log(`\n${colors.green}✅ 資料庫初始化完成！${colors.reset}`);
        console.log('接下來可以：');
        console.log('1. 執行 node test-db-connection.js 測試連線');
        console.log('2. 執行 npm start 啟動應用程式');
    } else {
        console.log(`\n${colors.yellow}⚠️ 部分步驟需要手動完成${colors.reset}`);
        console.log('請參考上述錯誤訊息和 SUPABASE_SETUP.md 完成設定');
    }
    
    console.log('='.repeat(60) + '\n');
    
    return failCount === 0;
}

// 執行初始化
if (require.main === module) {
    console.log(`${colors.cyan}提示: 使用 --test-data 參數可建立測試資料${colors.reset}`);
    
    initializeDatabase()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error(`${colors.red}初始化失敗: ${error.message}${colors.reset}`);
            process.exit(1);
        });
}

module.exports = { initializeDatabase };