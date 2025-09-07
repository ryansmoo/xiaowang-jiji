// 🐕 小汪記記部署前檢查腳本
const fs = require('fs').promises;
const path = require('path');
const { db } = require('./supabase-client-enhanced');
require('dotenv').config();

// 顏色輸出
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m'
};

// 檢查結果統計
let totalChecks = 0;
let passedChecks = 0;
let warnings = 0;
let criticalErrors = [];

// 檢查函數
async function runCheck(checkName, checkFunc, isCritical = false) {
    totalChecks++;
    process.stdout.write(`${colors.blue}[檢查 ${totalChecks}]${colors.reset} ${checkName}... `);
    
    try {
        const result = await checkFunc();
        
        if (result.success) {
            passedChecks++;
            console.log(`${colors.green}✓ 通過${colors.reset}`);
            if (result.details) {
                console.log(`  └─ ${colors.magenta}${result.details}${colors.reset}`);
            }
            return true;
        } else {
            if (result.warning) {
                warnings++;
                console.log(`${colors.yellow}⚠ 警告${colors.reset} - ${result.message}`);
            } else {
                console.log(`${colors.red}✗ 失敗${colors.reset} - ${result.message}`);
                if (isCritical) {
                    criticalErrors.push(`${checkName}: ${result.message}`);
                }
            }
            if (result.suggestion) {
                console.log(`  └─ 建議: ${result.suggestion}`);
            }
            return false;
        }
    } catch (error) {
        console.log(`${colors.red}✗ 錯誤${colors.reset} - ${error.message}`);
        if (isCritical) {
            criticalErrors.push(`${checkName}: ${error.message}`);
        }
        return false;
    }
}

// 主檢查函數
async function runPreDeployChecks() {
    console.log('\n' + '='.repeat(70));
    console.log(`${colors.cyan}🐕 小汪記記部署前檢查清單${colors.reset}`);
    console.log('='.repeat(70) + '\n');
    
    // ========== 環境變數檢查 ==========
    console.log(`${colors.yellow}📋 環境變數檢查${colors.reset}`);
    
    await runCheck('檢查必要環境變數', async () => {
        const required = [
            'LINE_CHANNEL_ACCESS_TOKEN',
            'LINE_CHANNEL_SECRET',
            'SUPABASE_URL',
            'SUPABASE_ANON_KEY'
        ];
        
        const missing = required.filter(key => !process.env[key]);
        
        if (missing.length > 0) {
            return {
                success: false,
                message: `缺少必要環境變數: ${missing.join(', ')}`,
                suggestion: '請檢查 .env 檔案或環境變數設定'
            };
        }
        
        const optional = ['SUPABASE_SERVICE_KEY', 'JWT_SECRET'];
        const missingOptional = optional.filter(key => !process.env[key]);
        
        if (missingOptional.length > 0) {
            return {
                success: true,
                warning: true,
                message: `建議設定選用環境變數: ${missingOptional.join(', ')}`,
                details: '所有必要環境變數已設定'
            };
        }
        
        return {
            success: true,
            details: '所有環境變數已正確設定'
        };
    }, true);
    
    await runCheck('檢查環境變數安全性', async () => {
        const secrets = ['LINE_CHANNEL_SECRET', 'SUPABASE_SERVICE_KEY', 'JWT_SECRET'];
        const weakSecrets = [];
        
        secrets.forEach(key => {
            const value = process.env[key];
            if (value && (value.length < 20 || value.includes('test') || value.includes('dev'))) {
                weakSecrets.push(key);
            }
        });
        
        if (weakSecrets.length > 0) {
            return {
                success: false,
                message: `可能使用測試用或不安全的金鑰: ${weakSecrets.join(', ')}`,
                suggestion: '請確認使用正式環境的安全金鑰'
            };
        }
        
        return {
            success: true,
            details: '環境變數安全性檢查通過'
        };
    });
    
    // ========== 資料庫連線檢查 ==========
    console.log(`\n${colors.yellow}🗄️ 資料庫連線檢查${colors.reset}`);
    
    await runCheck('測試資料庫連線', async () => {
        const result = await db.testConnection();
        if (!result.success) {
            return {
                success: false,
                message: result.error,
                suggestion: '請檢查 Supabase 連線設定和網路狀態'
            };
        }
        return {
            success: true,
            details: '資料庫連線正常'
        };
    }, true);
    
    await runCheck('檢查必要資料表', async () => {
        const requiredTables = ['members', 'tasks', 'task_history', 'system_settings'];
        const missingTables = [];
        
        for (const table of requiredTables) {
            try {
                const { error } = await db.client
                    .from(table)
                    .select('*')
                    .limit(0);
                
                if (error && error.code === '42P01') {
                    missingTables.push(table);
                }
            } catch (error) {
                if (error.message.includes('relation') && error.message.includes('does not exist')) {
                    missingTables.push(table);
                }
            }
        }
        
        if (missingTables.length > 0) {
            return {
                success: false,
                message: `缺少必要資料表: ${missingTables.join(', ')}`,
                suggestion: '請執行 node init-database.js 初始化資料庫'
            };
        }
        
        return {
            success: true,
            details: `所有必要資料表已就緒 (${requiredTables.length} 個)`
        };
    }, true);
    
    await runCheck('測試資料庫讀寫操作', async () => {
        try {
            // 測試寫入
            const testData = {
                line_id: `test_deploy_${Date.now()}`,
                member_id: `member_deploy_${Date.now()}`,
                display_name: '部署測試用戶'
            };
            
            const writeResult = await db.upsertMember(testData);
            if (!writeResult.success) {
                return {
                    success: false,
                    message: '資料寫入失敗',
                    suggestion: '請檢查資料庫權限設定'
                };
            }
            
            // 測試讀取
            const readResult = await db.getMemberByLineId(testData.line_id);
            if (!readResult.success || !readResult.data) {
                return {
                    success: false,
                    message: '資料讀取失敗',
                    suggestion: '請檢查資料庫查詢權限'
                };
            }
            
            // 清理測試資料
            await db.client
                .from('members')
                .delete()
                .eq('line_id', testData.line_id);
            
            return {
                success: true,
                details: '資料庫讀寫操作正常'
            };
        } catch (error) {
            return {
                success: false,
                message: `資料庫操作失敗: ${error.message}`,
                suggestion: '請檢查資料庫連線和權限'
            };
        }
    }, true);
    
    // ========== 檔案系統檢查 ==========
    console.log(`\n${colors.yellow}📁 檔案系統檢查${colors.reset}`);
    
    await runCheck('檢查必要檔案', async () => {
        const requiredFiles = [
            'app.js',
            'supabase-client.js',
            'supabase-schema.sql',
            'package.json'
        ];
        
        const missingFiles = [];
        
        for (const file of requiredFiles) {
            try {
                await fs.access(path.join(process.cwd(), file));
            } catch (error) {
                missingFiles.push(file);
            }
        }
        
        if (missingFiles.length > 0) {
            return {
                success: false,
                message: `缺少必要檔案: ${missingFiles.join(', ')}`,
                suggestion: '請確認所有核心檔案都已上傳'
            };
        }
        
        return {
            success: true,
            details: `所有必要檔案已存在 (${requiredFiles.length} 個)`
        };
    }, true);
    
    await runCheck('檢查 package.json 依賴', async () => {
        try {
            const packageJson = JSON.parse(
                await fs.readFile(path.join(process.cwd(), 'package.json'), 'utf8')
            );
            
            const requiredDeps = [
                '@line/bot-sdk',
                '@supabase/supabase-js',
                'express',
                'dotenv'
            ];
            
            const missing = requiredDeps.filter(dep => 
                !packageJson.dependencies?.[dep] && !packageJson.devDependencies?.[dep]
            );
            
            if (missing.length > 0) {
                return {
                    success: false,
                    message: `缺少必要依賴: ${missing.join(', ')}`,
                    suggestion: '請執行 npm install 安裝依賴'
                };
            }
            
            return {
                success: true,
                details: '所有必要依賴已定義'
            };
        } catch (error) {
            return {
                success: false,
                message: `package.json 讀取失敗: ${error.message}`,
                suggestion: '請檢查 package.json 檔案格式'
            };
        }
    });
    
    // ========== 安全性檢查 ==========
    console.log(`\n${colors.yellow}🔒 安全性檢查${colors.reset}`);
    
    await runCheck('檢查敏感檔案', async () => {
        const sensitiveFiles = ['.env', 'google-credentials.json'];
        const exposed = [];
        
        try {
            const gitignore = await fs.readFile(path.join(process.cwd(), '.gitignore'), 'utf8');
            
            for (const file of sensitiveFiles) {
                if (!gitignore.includes(file)) {
                    try {
                        await fs.access(path.join(process.cwd(), file));
                        exposed.push(file);
                    } catch (error) {
                        // 檔案不存在，跳過
                    }
                }
            }
        } catch (error) {
            return {
                success: false,
                warning: true,
                message: '.gitignore 檔案不存在',
                suggestion: '建議建立 .gitignore 避免提交敏感檔案'
            };
        }
        
        if (exposed.length > 0) {
            return {
                success: false,
                message: `敏感檔案可能被提交到版本控制: ${exposed.join(', ')}`,
                suggestion: '請將敏感檔案加入 .gitignore'
            };
        }
        
        return {
            success: true,
            details: '敏感檔案安全性檢查通過'
        };
    });
    
    // ========== 效能檢查 ==========
    console.log(`\n${colors.yellow}⚡ 效能檢查${colors.reset}`);
    
    await runCheck('測試資料庫查詢效能', async () => {
        const testUserId = 'performance_test_user';
        const startTime = Date.now();
        
        // 執行幾個常用查詢
        await Promise.all([
            db.getUserTasks(testUserId, { limit: 10 }),
            db.getSystemStats(),
            db.getMemberByLineId(testUserId)
        ]);
        
        const duration = Date.now() - startTime;
        
        if (duration > 5000) {
            return {
                success: false,
                warning: true,
                message: `查詢時間過長: ${duration}ms`,
                suggestion: '考慮優化資料庫查詢或檢查網路連線'
            };
        }
        
        return {
            success: true,
            details: `查詢效能良好 (${duration}ms)`
        };
    });
    
    // ========== 功能檢查 ==========
    console.log(`\n${colors.yellow}🎯 核心功能檢查${colors.reset}`);
    
    await runCheck('測試會員系統', async () => {
        const testMember = {
            line_id: `func_test_${Date.now()}`,
            member_id: `member_func_${Date.now()}`,
            display_name: '功能測試會員'
        };
        
        try {
            // 創建會員
            const createResult = await db.upsertMember(testMember);
            if (!createResult.success) throw new Error('創建會員失敗');
            
            // 查詢會員
            const getResult = await db.getMemberByLineId(testMember.line_id);
            if (!getResult.success || !getResult.data) throw new Error('查詢會員失敗');
            
            // 清理
            await db.client.from('members').delete().eq('line_id', testMember.line_id);
            
            return {
                success: true,
                details: '會員系統功能正常'
            };
        } catch (error) {
            return {
                success: false,
                message: error.message,
                suggestion: '請檢查會員相關功能實作'
            };
        }
    });
    
    await runCheck('測試任務系統', async () => {
        const testTask = {
            line_user_id: `task_test_${Date.now()}`,
            title: '功能測試任務',
            task_date: new Date().toISOString().split('T')[0]
        };
        
        try {
            // 創建任務
            const createResult = await db.createTask(testTask);
            if (!createResult.success) throw new Error('創建任務失敗');
            
            const taskId = createResult.data.task_id;
            
            // 切換完成狀態
            const toggleResult = await db.toggleTaskComplete(taskId);
            if (!toggleResult.success) throw new Error('切換任務狀態失敗');
            
            // 清理
            await db.deleteTask(taskId);
            
            return {
                success: true,
                details: '任務系統功能正常'
            };
        } catch (error) {
            return {
                success: false,
                message: error.message,
                suggestion: '請檢查任務相關功能實作'
            };
        }
    });
    
    // ========== 結果總結 ==========
    console.log('\n' + '='.repeat(70));
    console.log(`${colors.cyan}📊 檢查結果總結${colors.reset}`);
    console.log('='.repeat(70));
    
    const failedChecks = totalChecks - passedChecks;
    
    console.log(`總檢查項目: ${totalChecks}`);
    console.log(`${colors.green}通過: ${passedChecks}${colors.reset}`);
    console.log(`${colors.red}失敗: ${failedChecks}${colors.reset}`);
    console.log(`${colors.yellow}警告: ${warnings}${colors.reset}`);
    
    const successRate = Math.round((passedChecks / totalChecks) * 100);
    console.log(`成功率: ${successRate}%`);
    
    // 關鍵錯誤檢查
    if (criticalErrors.length > 0) {
        console.log(`\n${colors.red}🚨 關鍵錯誤 (${criticalErrors.length} 個):${colors.reset}`);
        criticalErrors.forEach((error, index) => {
            console.log(`  ${index + 1}. ${error}`);
        });
        console.log(`\n${colors.red}⚠️ 請修復所有關鍵錯誤後再部署！${colors.reset}`);
    }
    
    // 最終評估
    if (criticalErrors.length === 0) {
        if (warnings === 0) {
            console.log(`\n${colors.green}✅ 恭喜！小汪記記已準備好部署！${colors.reset}`);
            console.log('🐕 汪汪～準備迎接用戶了！');
        } else {
            console.log(`\n${colors.yellow}⚠️ 可以部署，但建議先處理警告項目${colors.reset}`);
        }
        
        console.log('\n建議的部署步驟:');
        console.log('1. 執行 node migrate-database.js migrate');
        console.log('2. 部署到生產環境');
        console.log('3. 執行 node test-db-connection.js 驗證');
        console.log('4. 測試 /health 端點');
    } else {
        console.log(`\n${colors.red}❌ 尚未準備好部署${colors.reset}`);
    }
    
    console.log('\n' + '='.repeat(70) + '\n');
    
    return {
        totalChecks,
        passedChecks,
        failedChecks,
        warnings,
        criticalErrors: criticalErrors.length,
        readyToDeploy: criticalErrors.length === 0
    };
}

// 執行檢查
if (require.main === module) {
    runPreDeployChecks()
        .then(results => {
            process.exit(results.readyToDeploy ? 0 : 1);
        })
        .catch(error => {
            console.error(`${colors.red}檢查執行失敗: ${error.message}${colors.reset}`);
            process.exit(1);
        });
}

module.exports = { runPreDeployChecks };