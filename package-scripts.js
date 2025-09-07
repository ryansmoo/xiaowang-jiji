// 🐕 小汪記記便利腳本工具
const { exec } = require('child_process');
const path = require('path');

// 顏色輸出
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

// 執行命令並顯示結果
function runCommand(command, description) {
    return new Promise((resolve, reject) => {
        console.log(`${colors.blue}▶${colors.reset} ${description}`);
        console.log(`${colors.cyan}執行: ${command}${colors.reset}\n`);
        
        const process = exec(command, { cwd: __dirname });
        
        process.stdout.on('data', (data) => {
            console.log(data.toString());
        });
        
        process.stderr.on('data', (data) => {
            console.error(data.toString());
        });
        
        process.on('close', (code) => {
            if (code === 0) {
                console.log(`${colors.green}✓ ${description} 完成${colors.reset}\n`);
                resolve(code);
            } else {
                console.log(`${colors.red}✗ ${description} 失敗 (退出碼: ${code})${colors.reset}\n`);
                reject(new Error(`Command failed with code ${code}`));
            }
        });
    });
}

// 腳本定義
const scripts = {
    // 開發工具
    'dev': {
        command: 'node app.js',
        description: '啟動開發伺服器'
    },
    'dev:watch': {
        command: 'nodemon app.js',
        description: '啟動開發伺服器（自動重載）'
    },
    
    // 資料庫相關
    'db:init': {
        command: 'node init-database.js',
        description: '初始化資料庫'
    },
    'db:init:test': {
        command: 'node init-database.js --test-data',
        description: '初始化資料庫（含測試資料）'
    },
    'db:test': {
        command: 'node test-db-connection.js',
        description: '測試資料庫連線'
    },
    'db:migrate': {
        command: 'node migrate-database.js migrate',
        description: '執行資料庫遷移'
    },
    'db:migrate:status': {
        command: 'node migrate-database.js status',
        description: '查看遷移狀態'
    },
    'db:rollback': {
        command: 'node migrate-database.js rollback',
        description: '回滾資料庫遷移（需指定版本）'
    },
    
    // 測試相關
    'test': {
        command: 'node test/db.test.js',
        description: '執行單元測試'
    },
    'test:all': {
        command: 'npm run test && npm run db:test',
        description: '執行所有測試'
    },
    
    // 部署前檢查
    'check': {
        command: 'node pre-deploy-check.js',
        description: '執行部署前檢查'
    },
    'pre-deploy': {
        command: 'npm run check && npm run test:all',
        description: '完整的部署前檢查和測試'
    },
    
    // 生產環境
    'start': {
        command: 'node app.js',
        description: '生產環境啟動'
    },
    'pm2:start': {
        command: 'pm2 start app.js --name "xiaowang-jiji"',
        description: '使用 PM2 啟動'
    },
    'pm2:stop': {
        command: 'pm2 stop xiaowang-jiji',
        description: '停止 PM2 程序'
    },
    'pm2:restart': {
        command: 'pm2 restart xiaowang-jiji',
        description: '重啟 PM2 程序'
    },
    'pm2:logs': {
        command: 'pm2 logs xiaowang-jiji',
        description: '查看 PM2 日誌'
    },
    
    // 健康檢查
    'health': {
        command: 'curl -s http://localhost:3000/health | json_pp || curl -s http://localhost:3000/health',
        description: '檢查應用程式健康狀態'
    },
    'health:db': {
        command: 'curl -s http://localhost:3000/health/db | json_pp || curl -s http://localhost:3000/health/db',
        description: '檢查資料庫健康狀態'
    },
    
    // 清理工具
    'clean:cache': {
        command: 'rm -rf node_modules/.cache && echo "快取已清除"',
        description: '清除快取'
    },
    'clean:logs': {
        command: 'find . -name "*.log" -delete && echo "日誌檔案已清除"',
        description: '清除日誌檔案'
    },
    
    // 工具腳本
    'lint': {
        command: 'echo "代碼檢查功能待實作"',
        description: '代碼品質檢查'
    },
    'format': {
        command: 'echo "代碼格式化功能待實作"',
        description: '代碼格式化'
    },
    
    // 備份和恢復
    'backup:env': {
        command: 'cp .env .env.backup && echo "環境變數已備份到 .env.backup"',
        description: '備份環境變數檔案'
    },
    'restore:env': {
        command: 'cp .env.backup .env && echo "環境變數已從 .env.backup 恢復"',
        description: '恢復環境變數檔案'
    }
};

// 主函數
async function main() {
    const scriptName = process.argv[2];
    const args = process.argv.slice(3);
    
    if (!scriptName) {
        console.log(`${colors.cyan}🐕 小汪記記便利腳本工具${colors.reset}\n`);
        console.log('可用的腳本:\n');
        
        const categories = {
            '開發工具': ['dev', 'dev:watch'],
            '資料庫管理': ['db:init', 'db:init:test', 'db:test', 'db:migrate', 'db:migrate:status', 'db:rollback'],
            '測試': ['test', 'test:all'],
            '部署檢查': ['check', 'pre-deploy'],
            '生產環境': ['start', 'pm2:start', 'pm2:stop', 'pm2:restart', 'pm2:logs'],
            '健康檢查': ['health', 'health:db'],
            '清理工具': ['clean:cache', 'clean:logs'],
            '其他工具': ['lint', 'format', 'backup:env', 'restore:env']
        };
        
        Object.entries(categories).forEach(([category, scriptNames]) => {
            console.log(`${colors.yellow}${category}:${colors.reset}`);
            scriptNames.forEach(name => {
                if (scripts[name]) {
                    console.log(`  ${colors.green}${name.padEnd(20)}${colors.reset} - ${scripts[name].description}`);
                }
            });
            console.log();
        });
        
        console.log('使用方式:');
        console.log(`  node package-scripts.js <腳本名稱> [參數]`);
        console.log(`  npm run script <腳本名稱> [參數]`);
        console.log('\n範例:');
        console.log(`  node package-scripts.js dev`);
        console.log(`  node package-scripts.js db:init`);
        console.log(`  node package-scripts.js db:rollback 002`);
        
        return;
    }
    
    if (!scripts[scriptName]) {
        console.error(`${colors.red}錯誤: 找不到腳本 "${scriptName}"${colors.reset}`);
        console.log(`\n請使用 ${colors.cyan}node package-scripts.js${colors.reset} 查看可用的腳本列表`);
        process.exit(1);
    }
    
    try {
        let command = scripts[scriptName].command;
        
        // 處理參數
        if (args.length > 0) {
            command += ' ' + args.join(' ');
        }
        
        console.log(`${colors.cyan}🚀 執行小汪記記腳本: ${scriptName}${colors.reset}\n`);
        
        await runCommand(command, scripts[scriptName].description);
        
        console.log(`${colors.green}🎉 腳本 "${scriptName}" 執行完成！${colors.reset}`);
        
    } catch (error) {
        console.error(`${colors.red}❌ 腳本執行失敗: ${error.message}${colors.reset}`);
        process.exit(1);
    }
}

// 執行
if (require.main === module) {
    main();
}

module.exports = { scripts, runCommand };