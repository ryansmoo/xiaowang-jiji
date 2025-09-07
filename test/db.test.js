// 🐕 小汪記記資料庫單元測試
const { db, DatabaseError } = require('../supabase-client-enhanced');
const assert = require('assert');

// 測試工具函數
class TestRunner {
    constructor() {
        this.tests = [];
        this.results = {
            passed: 0,
            failed: 0,
            errors: []
        };
    }
    
    describe(suiteName, testFunc) {
        console.log(`\n📦 測試套件: ${suiteName}`);
        testFunc();
    }
    
    it(testName, asyncTestFunc) {
        this.tests.push({ name: testName, func: asyncTestFunc });
    }
    
    async run() {
        for (const test of this.tests) {
            try {
                await test.func();
                console.log(`  ✅ ${test.name}`);
                this.results.passed++;
            } catch (error) {
                console.log(`  ❌ ${test.name}`);
                console.error(`     ${error.message}`);
                this.results.failed++;
                this.results.errors.push({
                    test: test.name,
                    error: error.message
                });
            }
        }
        
        // 顯示結果
        console.log('\n' + '='.repeat(50));
        console.log('測試結果總結:');
        console.log(`通過: ${this.results.passed}`);
        console.log(`失敗: ${this.results.failed}`);
        console.log(`總計: ${this.results.passed + this.results.failed}`);
        
        if (this.results.failed > 0) {
            console.log('\n失敗的測試:');
            this.results.errors.forEach(err => {
                console.log(`  - ${err.test}: ${err.error}`);
            });
        }
        
        return this.results.failed === 0;
    }
}

// 主測試函數
async function runDatabaseTests() {
    const runner = new TestRunner();
    
    // 測試資料
    const testLineId = `test_line_${Date.now()}`;
    const testMemberId = `test_member_${Date.now()}`;
    const testTaskId = `test_task_${Date.now()}`;
    
    // ========== 連線測試 ==========
    runner.describe('資料庫連線', () => {
        runner.it('應該能成功連線到資料庫', async () => {
            const result = await db.testConnection();
            assert.strictEqual(result.success, true, '連線應該成功');
        });
        
        runner.it('應該能獲取連線統計資訊', async () => {
            const stats = await db.getConnectionStats();
            assert(stats.timestamp, '應該有時間戳記');
            assert(typeof stats.cacheSize === 'number', '應該有快取大小');
        });
    });
    
    // ========== 會員操作測試 ==========
    runner.describe('會員操作', () => {
        runner.it('應該能創建新會員', async () => {
            const result = await db.upsertMember({
                line_id: testLineId,
                member_id: testMemberId,
                display_name: '單元測試小汪',
                member_level: 'basic'
            });
            
            assert.strictEqual(result.success, true, '創建應該成功');
            assert(result.data, '應該返回會員資料');
            assert.strictEqual(result.data.line_id, testLineId, 'LINE ID 應該匹配');
        });
        
        runner.it('應該能查詢會員資料', async () => {
            const result = await db.getMemberByLineId(testLineId);
            
            assert.strictEqual(result.success, true, '查詢應該成功');
            assert(result.data, '應該返回會員資料');
            assert.strictEqual(result.data.display_name, '單元測試小汪', '名稱應該匹配');
        });
        
        runner.it('應該能更新會員統計', async () => {
            const result = await db.updateMemberStats(testMemberId, {
                total_tasks: 10,
                completed_tasks: 5
            });
            
            assert.strictEqual(result.success, true, '更新應該成功');
            assert.strictEqual(result.data.total_tasks, 10, '總任務數應該更新');
        });
        
        runner.it('應該能處理不存在的會員查詢', async () => {
            const result = await db.getMemberByLineId('non_existent_id');
            
            assert.strictEqual(result.success, true, '查詢應該成功');
            assert.strictEqual(result.data, null, '不存在的會員應返回 null');
        });
    });
    
    // ========== 任務操作測試 ==========
    runner.describe('任務操作', () => {
        runner.it('應該能創建新任務', async () => {
            const result = await db.createTask({
                task_id: testTaskId,
                line_user_id: testLineId,
                title: '測試任務：餵小汪',
                description: '單元測試用任務',
                task_date: new Date().toISOString().split('T')[0],
                priority: 'normal'
            });
            
            assert.strictEqual(result.success, true, '創建應該成功');
            assert(result.data, '應該返回任務資料');
            assert.strictEqual(result.data.title, '測試任務：餵小汪', '標題應該匹配');
        });
        
        runner.it('應該能查詢用戶任務', async () => {
            const result = await db.getUserTasks(testLineId);
            
            assert.strictEqual(result.success, true, '查詢應該成功');
            assert(Array.isArray(result.data), '應該返回陣列');
            assert(result.data.length > 0, '應該有至少一個任務');
        });
        
        runner.it('應該能切換任務完成狀態', async () => {
            const result = await db.toggleTaskComplete(testTaskId);
            
            assert.strictEqual(result.success, true, '切換應該成功');
            assert.strictEqual(result.data.completed, true, '任務應該標記為完成');
            
            // 再次切換
            const result2 = await db.toggleTaskComplete(testTaskId);
            assert.strictEqual(result2.data.completed, false, '任務應該標記為未完成');
        });
        
        runner.it('應該能更新任務資訊', async () => {
            const result = await db.updateTask(testTaskId, {
                title: '更新後的任務標題',
                priority: 'high'
            });
            
            assert.strictEqual(result.success, true, '更新應該成功');
            assert.strictEqual(result.data.title, '更新後的任務標題', '標題應該更新');
            assert.strictEqual(result.data.priority, 'high', '優先級應該更新');
        });
        
        runner.it('應該能查詢今日任務', async () => {
            const result = await db.getTodayTasks(testLineId);
            
            assert.strictEqual(result.success, true, '查詢應該成功');
            assert(Array.isArray(result.data), '應該返回陣列');
        });
    });
    
    // ========== 批次操作測試 ==========
    runner.describe('批次操作', () => {
        runner.it('應該能批次創建任務', async () => {
            const tasks = [
                {
                    line_user_id: testLineId,
                    title: '批次任務1',
                    task_date: new Date().toISOString().split('T')[0]
                },
                {
                    line_user_id: testLineId,
                    title: '批次任務2',
                    task_date: new Date().toISOString().split('T')[0]
                },
                {
                    line_user_id: testLineId,
                    title: '批次任務3',
                    task_date: new Date().toISOString().split('T')[0]
                }
            ];
            
            const result = await db.createTasksBatch(tasks);
            
            assert.strictEqual(result.success, true, '批次創建應該成功');
            assert.strictEqual(result.data.length, 3, '應該創建3個任務');
        });
    });
    
    // ========== 快取測試 ==========
    runner.describe('快取機制', () => {
        runner.it('應該能快取查詢結果', async () => {
            // 清除快取
            db.clearCache();
            
            // 第一次查詢（不使用快取）
            const start1 = Date.now();
            await db.getMemberByLineId(testLineId);
            const time1 = Date.now() - start1;
            
            // 第二次查詢（使用快取）
            const start2 = Date.now();
            await db.getMemberByLineId(testLineId);
            const time2 = Date.now() - start2;
            
            assert(time2 < time1, '快取查詢應該更快');
        });
        
        runner.it('應該能清除快取', async () => {
            db.clearCache();
            const stats = await db.getConnectionStats();
            assert.strictEqual(stats.cacheSize, 0, '快取應該被清空');
        });
    });
    
    // ========== 錯誤處理測試 ==========
    runner.describe('錯誤處理', () => {
        runner.it('應該能處理缺少必要欄位的錯誤', async () => {
            try {
                await db.createTask({
                    // 缺少 line_user_id 和 title
                    description: '測試任務'
                });
                assert.fail('應該拋出錯誤');
            } catch (error) {
                assert(error instanceof DatabaseError, '應該是 DatabaseError');
                assert.strictEqual(error.code, 'VALIDATION_ERROR', '應該是驗證錯誤');
            }
        });
        
        runner.it('應該能處理無效的任務ID', async () => {
            const result = await db.toggleTaskComplete('invalid_task_id_999');
            assert.strictEqual(result.success, false, '應該失敗');
        });
    });
    
    // ========== 效能測試 ==========
    runner.describe('效能優化', () => {
        runner.it('應該能使用優化查詢', async () => {
            const result = await db.getUserTasksOptimized(testLineId, {
                columns: 'task_id,title,completed',
                limit: 5
            });
            
            assert.strictEqual(result.success, true, '優化查詢應該成功');
            assert(Array.isArray(result.data), '應該返回陣列');
            if (result.data.length > 0) {
                assert(result.data[0].task_id, '應該有 task_id');
                assert(result.data[0].title !== undefined, '應該有 title');
            }
        });
        
        runner.it('應該能處理日期範圍查詢', async () => {
            const today = new Date();
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            
            const result = await db.getUserTasksOptimized(testLineId, {
                dateRange: {
                    start: today.toISOString().split('T')[0],
                    end: tomorrow.toISOString().split('T')[0]
                }
            });
            
            assert.strictEqual(result.success, true, '日期範圍查詢應該成功');
        });
    });
    
    // ========== 清理測試資料 ==========
    runner.describe('清理測試資料', () => {
        runner.it('應該能刪除測試任務', async () => {
            const result = await db.deleteTask(testTaskId);
            assert.strictEqual(result.success, true, '刪除應該成功');
        });
        
        runner.it('應該能清空今日任務', async () => {
            const result = await db.clearTodayTasks(testLineId);
            assert.strictEqual(result.success, true, '清空應該成功');
        });
    });
    
    // 執行所有測試
    const success = await runner.run();
    
    // 最終清理
    try {
        // 刪除測試會員（這會連帶刪除所有相關資料）
        const { supabase } = require('../supabase-client-enhanced');
        await supabase
            .from('members')
            .delete()
            .eq('line_id', testLineId);
        
        console.log('\n✅ 測試資料已清理');
    } catch (error) {
        console.error('⚠️ 清理測試資料失敗:', error.message);
    }
    
    return success;
}

// 執行測試
if (require.main === module) {
    console.log('🐕 開始執行小汪記記資料庫單元測試...\n');
    
    runDatabaseTests()
        .then(success => {
            if (success) {
                console.log('\n🎉 所有測試通過！');
                process.exit(0);
            } else {
                console.log('\n❌ 部分測試失敗');
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('\n💥 測試執行失敗:', error);
            process.exit(1);
        });
}

module.exports = { runDatabaseTests };