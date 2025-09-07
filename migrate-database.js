// 🐕 小汪記記資料庫遷移腳本
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
    cyan: '\x1b[36m',
    magenta: '\x1b[35m'
};

// Supabase 客戶端
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);

// 遷移版本記錄表
const MIGRATION_TABLE = 'schema_migrations';

// 遷移定義
const migrations = [
    {
        version: '001',
        name: 'initial_schema',
        description: '初始資料庫架構',
        up: async () => {
            console.log('執行初始架構遷移...');
            // 這個應該已經由 supabase-schema.sql 處理
            return { success: true, message: '初始架構已存在' };
        },
        down: async () => {
            // 危險操作，通常不實作
            throw new Error('不支援回滾初始架構');
        }
    },
    {
        version: '002',
        name: 'add_task_attachments',
        description: '新增任務附件功能',
        up: async () => {
            const { error } = await supabase.rpc('exec_sql', {
                sql: `
                    CREATE TABLE IF NOT EXISTS task_attachments (
                        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
                        task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
                        file_name VARCHAR(255) NOT NULL,
                        file_url TEXT NOT NULL,
                        file_type VARCHAR(100),
                        file_size INTEGER,
                        uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
                    );
                    
                    CREATE INDEX IF NOT EXISTS idx_task_attachments_task_id 
                    ON task_attachments(task_id);
                `
            });
            
            if (error && !error.message.includes('already exists')) {
                throw error;
            }
            
            return { success: true, message: '任務附件表已創建' };
        },
        down: async () => {
            const { error } = await supabase.rpc('exec_sql', {
                sql: 'DROP TABLE IF EXISTS task_attachments CASCADE;'
            });
            
            if (error) throw error;
            return { success: true };
        }
    },
    {
        version: '003',
        name: 'add_recurring_tasks',
        description: '新增循環任務功能',
        up: async () => {
            const { error } = await supabase.rpc('exec_sql', {
                sql: `
                    ALTER TABLE tasks 
                    ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false,
                    ADD COLUMN IF NOT EXISTS recurrence_pattern JSONB,
                    ADD COLUMN IF NOT EXISTS recurrence_end_date DATE,
                    ADD COLUMN IF NOT EXISTS parent_task_id UUID REFERENCES tasks(id);
                    
                    CREATE INDEX IF NOT EXISTS idx_tasks_recurring 
                    ON tasks(is_recurring) WHERE is_recurring = true;
                    
                    CREATE INDEX IF NOT EXISTS idx_tasks_parent 
                    ON tasks(parent_task_id);
                `
            });
            
            if (error && !error.message.includes('already exists')) {
                throw error;
            }
            
            return { success: true, message: '循環任務欄位已新增' };
        },
        down: async () => {
            const { error } = await supabase.rpc('exec_sql', {
                sql: `
                    ALTER TABLE tasks 
                    DROP COLUMN IF EXISTS is_recurring,
                    DROP COLUMN IF EXISTS recurrence_pattern,
                    DROP COLUMN IF EXISTS recurrence_end_date,
                    DROP COLUMN IF EXISTS parent_task_id;
                `
            });
            
            if (error) throw error;
            return { success: true };
        }
    },
    {
        version: '004',
        name: 'add_task_collaborators',
        description: '新增任務協作者功能',
        up: async () => {
            const { error } = await supabase.rpc('exec_sql', {
                sql: `
                    CREATE TABLE IF NOT EXISTS task_collaborators (
                        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
                        task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
                        member_id UUID REFERENCES members(id) ON DELETE CASCADE,
                        role VARCHAR(50) DEFAULT 'viewer',
                        added_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
                        added_by UUID REFERENCES members(id),
                        UNIQUE(task_id, member_id)
                    );
                    
                    CREATE INDEX IF NOT EXISTS idx_task_collaborators_task 
                    ON task_collaborators(task_id);
                    
                    CREATE INDEX IF NOT EXISTS idx_task_collaborators_member 
                    ON task_collaborators(member_id);
                `
            });
            
            if (error && !error.message.includes('already exists')) {
                throw error;
            }
            
            return { success: true, message: '任務協作者表已創建' };
        },
        down: async () => {
            const { error } = await supabase.rpc('exec_sql', {
                sql: 'DROP TABLE IF EXISTS task_collaborators CASCADE;'
            });
            
            if (error) throw error;
            return { success: true };
        }
    },
    {
        version: '005',
        name: 'add_performance_indexes',
        description: '新增效能優化索引',
        up: async () => {
            const { error } = await supabase.rpc('exec_sql', {
                sql: `
                    -- 複合索引優化查詢
                    CREATE INDEX IF NOT EXISTS idx_tasks_user_date_status 
                    ON tasks(line_user_id, task_date, status);
                    
                    CREATE INDEX IF NOT EXISTS idx_tasks_user_completed 
                    ON tasks(line_user_id, completed);
                    
                    -- 部分索引優化
                    CREATE INDEX IF NOT EXISTS idx_tasks_pending 
                    ON tasks(line_user_id, created_at) 
                    WHERE completed = false;
                    
                    CREATE INDEX IF NOT EXISTS idx_members_active 
                    ON members(created_at) 
                    WHERE is_active = true;
                    
                    -- 全文搜尋索引（如果需要）
                    CREATE INDEX IF NOT EXISTS idx_tasks_title_gin 
                    ON tasks USING gin(to_tsvector('chinese', title));
                `
            });
            
            if (error && !error.message.includes('already exists')) {
                throw error;
            }
            
            return { success: true, message: '效能索引已創建' };
        },
        down: async () => {
            const { error } = await supabase.rpc('exec_sql', {
                sql: `
                    DROP INDEX IF EXISTS idx_tasks_user_date_status;
                    DROP INDEX IF EXISTS idx_tasks_user_completed;
                    DROP INDEX IF EXISTS idx_tasks_pending;
                    DROP INDEX IF EXISTS idx_members_active;
                    DROP INDEX IF EXISTS idx_tasks_title_gin;
                `
            });
            
            if (error) throw error;
            return { success: true };
        }
    }
];

// 遷移管理類別
class MigrationManager {
    async ensureMigrationTable() {
        try {
            const { error } = await supabase.rpc('exec_sql', {
                sql: `
                    CREATE TABLE IF NOT EXISTS ${MIGRATION_TABLE} (
                        version VARCHAR(10) PRIMARY KEY,
                        name VARCHAR(255) NOT NULL,
                        executed_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
                    );
                `
            });
            
            if (error && !error.message.includes('already exists')) {
                throw error;
            }
            
            console.log(`${colors.green}✓${colors.reset} 遷移記錄表已就緒`);
        } catch (error) {
            // 如果 RPC 不存在，嘗試直接操作
            console.log(`${colors.yellow}⚠${colors.reset} 無法使用 RPC，嘗試直接操作`);
            
            // 檢查表是否存在
            const { error: checkError } = await supabase
                .from(MIGRATION_TABLE)
                .select('version')
                .limit(1);
            
            if (checkError && checkError.code === '42P01') {
                console.error(`${colors.red}✗${colors.reset} 請手動創建遷移記錄表`);
                console.log(`SQL:
                    CREATE TABLE ${MIGRATION_TABLE} (
                        version VARCHAR(10) PRIMARY KEY,
                        name VARCHAR(255) NOT NULL,
                        executed_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
                    );
                `);
                throw new Error('需要手動創建遷移記錄表');
            }
        }
    }
    
    async getExecutedMigrations() {
        const { data, error } = await supabase
            .from(MIGRATION_TABLE)
            .select('version')
            .order('version', { ascending: true });
        
        if (error) {
            if (error.code === '42P01') {
                return [];
            }
            throw error;
        }
        
        return data ? data.map(m => m.version) : [];
    }
    
    async recordMigration(version, name) {
        const { error } = await supabase
            .from(MIGRATION_TABLE)
            .insert({ version, name });
        
        if (error) throw error;
    }
    
    async removeMigration(version) {
        const { error } = await supabase
            .from(MIGRATION_TABLE)
            .delete()
            .eq('version', version);
        
        if (error) throw error;
    }
    
    async runMigrations(targetVersion = null) {
        console.log('\n' + '='.repeat(60));
        console.log(`${colors.cyan}🐕 小汪記記資料庫遷移${colors.reset}`);
        console.log('='.repeat(60) + '\n');
        
        // 確保遷移表存在
        await this.ensureMigrationTable();
        
        // 獲取已執行的遷移
        const executed = await this.getExecutedMigrations();
        console.log(`已執行的遷移: ${executed.length ? executed.join(', ') : '無'}\n`);
        
        // 找出待執行的遷移
        const pending = migrations.filter(m => !executed.includes(m.version));
        
        if (pending.length === 0) {
            console.log(`${colors.green}✅ 資料庫已是最新版本${colors.reset}`);
            return;
        }
        
        console.log(`發現 ${pending.length} 個待執行遷移\n`);
        
        // 執行遷移
        for (const migration of pending) {
            if (targetVersion && migration.version > targetVersion) {
                break;
            }
            
            console.log(`${colors.blue}▶${colors.reset} 執行遷移 ${migration.version}: ${migration.name}`);
            console.log(`  ${colors.magenta}${migration.description}${colors.reset}`);
            
            try {
                const result = await migration.up();
                
                if (result.success) {
                    await this.recordMigration(migration.version, migration.name);
                    console.log(`  ${colors.green}✓ 成功${colors.reset} ${result.message || ''}\n`);
                } else {
                    throw new Error(result.message || '遷移失敗');
                }
            } catch (error) {
                console.error(`  ${colors.red}✗ 失敗: ${error.message}${colors.reset}\n`);
                throw error;
            }
        }
        
        console.log(`${colors.green}✅ 所有遷移執行完成${colors.reset}\n`);
    }
    
    async rollback(targetVersion) {
        console.log('\n' + '='.repeat(60));
        console.log(`${colors.yellow}⬅ 回滾資料庫遷移${colors.reset}`);
        console.log('='.repeat(60) + '\n');
        
        const executed = await this.getExecutedMigrations();
        const toRollback = executed.filter(v => v > targetVersion).reverse();
        
        if (toRollback.length === 0) {
            console.log(`${colors.green}已在目標版本 ${targetVersion}${colors.reset}`);
            return;
        }
        
        console.log(`將回滾 ${toRollback.length} 個遷移: ${toRollback.join(', ')}\n`);
        
        for (const version of toRollback) {
            const migration = migrations.find(m => m.version === version);
            
            if (!migration) {
                console.error(`${colors.red}找不到遷移 ${version}${colors.reset}`);
                continue;
            }
            
            console.log(`${colors.blue}▶${colors.reset} 回滾遷移 ${migration.version}: ${migration.name}`);
            
            try {
                const result = await migration.down();
                
                if (result.success) {
                    await this.removeMigration(migration.version);
                    console.log(`  ${colors.green}✓ 成功${colors.reset}\n`);
                } else {
                    throw new Error(result.message || '回滾失敗');
                }
            } catch (error) {
                console.error(`  ${colors.red}✗ 失敗: ${error.message}${colors.reset}\n`);
                throw error;
            }
        }
        
        console.log(`${colors.green}✅ 回滾完成${colors.reset}\n`);
    }
    
    async status() {
        console.log('\n' + '='.repeat(60));
        console.log(`${colors.cyan}📊 遷移狀態${colors.reset}`);
        console.log('='.repeat(60) + '\n');
        
        const executed = await this.getExecutedMigrations();
        
        console.log('所有遷移:\n');
        for (const migration of migrations) {
            const isExecuted = executed.includes(migration.version);
            const status = isExecuted 
                ? `${colors.green}✓ 已執行${colors.reset}`
                : `${colors.yellow}○ 待執行${colors.reset}`;
            
            console.log(`  ${status} ${migration.version}: ${migration.name}`);
            console.log(`         ${colors.magenta}${migration.description}${colors.reset}`);
        }
        
        console.log('\n' + '='.repeat(60) + '\n');
    }
}

// CLI 處理
async function main() {
    const manager = new MigrationManager();
    const command = process.argv[2];
    const version = process.argv[3];
    
    try {
        switch (command) {
            case 'up':
            case 'migrate':
                await manager.runMigrations(version);
                break;
                
            case 'down':
            case 'rollback':
                if (!version) {
                    console.error(`${colors.red}請指定要回滾到的版本${colors.reset}`);
                    process.exit(1);
                }
                await manager.rollback(version);
                break;
                
            case 'status':
                await manager.status();
                break;
                
            default:
                console.log(`${colors.cyan}小汪記記資料庫遷移工具${colors.reset}\n`);
                console.log('使用方式:');
                console.log('  node migrate-database.js migrate [version]  - 執行遷移');
                console.log('  node migrate-database.js rollback <version> - 回滾到指定版本');
                console.log('  node migrate-database.js status            - 查看遷移狀態');
                console.log('\n範例:');
                console.log('  node migrate-database.js migrate           - 執行所有待執行遷移');
                console.log('  node migrate-database.js migrate 003       - 執行到版本 003');
                console.log('  node migrate-database.js rollback 002      - 回滾到版本 002');
                console.log('  node migrate-database.js status            - 查看目前狀態');
        }
    } catch (error) {
        console.error(`\n${colors.red}錯誤: ${error.message}${colors.reset}`);
        process.exit(1);
    }
}

// 執行
if (require.main === module) {
    main();
}

module.exports = { MigrationManager, migrations };