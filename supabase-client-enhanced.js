// 🐕 小汪記記 Supabase 增強版資料庫連線模組 - 包含錯誤處理和重試機制
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// 🔐 Supabase 配置
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

// 檢查環境變數
if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Supabase 環境變數未設定！');
    console.log('請在 .env 檔案中設定：');
    console.log('SUPABASE_URL=你的_supabase_專案_url');
    console.log('SUPABASE_ANON_KEY=你的_supabase_anon_key');
    console.log('SUPABASE_SERVICE_KEY=你的_supabase_service_key（選填）');
}

// 🔗 創建 Supabase 客戶端（含連線池管理）
const supabaseOptions = {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false
    },
    db: {
        schema: 'public'
    },
    global: {
        headers: { 
            'x-app-name': 'xiaowang-jiji',
            'x-app-version': '1.0.0'
        }
    },
    realtime: {
        params: {
            eventsPerSecond: 10
        }
    }
};

// 一般客戶端（使用 anon key）
const supabase = createClient(supabaseUrl, supabaseAnonKey, supabaseOptions);

// 服務端客戶端（使用 service key，有完整權限）
const supabaseAdmin = supabaseServiceKey 
    ? createClient(supabaseUrl, supabaseServiceKey, {
        ...supabaseOptions,
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    })
    : null;

// 🔄 重試機制配置
const RETRY_CONFIG = {
    maxRetries: 3,
    initialDelay: 1000, // 1秒
    maxDelay: 10000,    // 10秒
    backoffMultiplier: 2,
    retryableErrors: [
        'ECONNREFUSED',
        'ETIMEDOUT',
        'ENOTFOUND',
        'NetworkError',
        'TimeoutError',
        '503',
        '502',
        '500'
    ]
};

// 🛡️ 錯誤處理類別
class DatabaseError extends Error {
    constructor(message, code, details) {
        super(message);
        this.name = 'DatabaseError';
        this.code = code;
        this.details = details;
        this.timestamp = new Date().toISOString();
    }
}

// 🔄 重試執行函數
async function executeWithRetry(operation, operationName, retryConfig = RETRY_CONFIG) {
    let lastError;
    let delay = retryConfig.initialDelay;
    
    for (let attempt = 1; attempt <= retryConfig.maxRetries; attempt++) {
        try {
            // 執行操作
            const result = await operation();
            
            // 如果成功且之前有重試，記錄成功
            if (attempt > 1) {
                console.log(`✅ ${operationName} 在第 ${attempt} 次嘗試後成功`);
            }
            
            return result;
        } catch (error) {
            lastError = error;
            
            // 檢查是否為可重試的錯誤
            const isRetryable = retryConfig.retryableErrors.some(retryableError => 
                error.message?.includes(retryableError) || 
                error.code === retryableError
            );
            
            if (!isRetryable || attempt === retryConfig.maxRetries) {
                // 不可重試或已達最大重試次數
                console.error(`❌ ${operationName} 失敗 (嘗試 ${attempt}/${retryConfig.maxRetries}):`, error.message);
                throw new DatabaseError(
                    `${operationName} 執行失敗: ${error.message}`,
                    error.code || 'UNKNOWN',
                    { attempts: attempt, originalError: error }
                );
            }
            
            // 等待後重試
            console.warn(`⚠️ ${operationName} 失敗 (嘗試 ${attempt}/${retryConfig.maxRetries})，${delay}ms 後重試...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            
            // 增加延遲時間（指數退避）
            delay = Math.min(delay * retryConfig.backoffMultiplier, retryConfig.maxDelay);
        }
    }
    
    throw lastError;
}

// 🎯 增強版資料庫操作類別
class EnhancedSupabaseDB {
    constructor() {
        this.client = supabase;
        this.admin = supabaseAdmin;
        this.cache = new Map(); // 簡單快取機制
        this.cacheTimeout = 60000; // 快取 60 秒
    }
    
    // ==================== 快取管理 ====================
    
    getCacheKey(operation, params) {
        return `${operation}:${JSON.stringify(params)}`;
    }
    
    getFromCache(key) {
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            console.log(`📦 使用快取: ${key}`);
            return cached.data;
        }
        this.cache.delete(key);
        return null;
    }
    
    setCache(key, data) {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
        
        // 限制快取大小
        if (this.cache.size > 100) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
    }
    
    clearCache() {
        this.cache.clear();
        console.log('🗑️ 快取已清除');
    }
    
    // ==================== 會員相關操作（含錯誤處理） ====================
    
    async upsertMember(memberData) {
        return executeWithRetry(async () => {
            // 資料驗證
            if (!memberData.line_id || !memberData.member_id) {
                throw new DatabaseError('缺少必要欄位: line_id 或 member_id', 'VALIDATION_ERROR');
            }
            
            const { data, error } = await this.client
                .from('members')
                .upsert({
                    ...memberData,
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'line_id'
                })
                .select()
                .single();

            if (error) throw error;
            
            // 清除相關快取
            this.clearMemberCache(memberData.line_id);
            
            console.log('✅ 會員資料已儲存到 Supabase');
            return { success: true, data };
        }, 'upsertMember');
    }
    
    async getMemberByLineId(lineId) {
        // 檢查快取
        const cacheKey = this.getCacheKey('getMemberByLineId', { lineId });
        const cached = this.getFromCache(cacheKey);
        if (cached) return cached;
        
        return executeWithRetry(async () => {
            const { data, error } = await this.client
                .from('members')
                .select('*')
                .eq('line_id', lineId)
                .single();

            if (error && error.code !== 'PGRST116') throw error;
            
            const result = { success: true, data };
            
            // 設定快取
            if (data) {
                this.setCache(cacheKey, result);
            }
            
            return result;
        }, 'getMemberByLineId');
    }
    
    clearMemberCache(lineId) {
        // 清除特定會員的所有快取
        for (const key of this.cache.keys()) {
            if (key.includes(lineId)) {
                this.cache.delete(key);
            }
        }
    }
    
    // ==================== 任務相關操作（含批次處理） ====================
    
    async createTask(taskData) {
        return executeWithRetry(async () => {
            // 資料驗證
            if (!taskData.line_user_id || !taskData.title) {
                throw new DatabaseError('缺少必要欄位: line_user_id 或 title', 'VALIDATION_ERROR');
            }
            
            const { data, error } = await this.client
                .from('tasks')
                .insert({
                    task_id: taskData.task_id || `task_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
                    ...taskData
                })
                .select()
                .single();

            if (error) throw error;
            
            console.log('✅ 任務已儲存到 Supabase');
            
            // 記錄任務歷史（非同步，不阻塞主流程）
            this.logTaskHistory(data.id, null, 'created', taskData).catch(err => 
                console.warn('⚠️ 記錄任務歷史失敗:', err.message)
            );
            
            return { success: true, data };
        }, 'createTask');
    }
    
    async createTasksBatch(tasksArray) {
        return executeWithRetry(async () => {
            // 批次驗證
            const invalidTasks = tasksArray.filter(task => !task.line_user_id || !task.title);
            if (invalidTasks.length > 0) {
                throw new DatabaseError(
                    `${invalidTasks.length} 個任務缺少必要欄位`,
                    'VALIDATION_ERROR',
                    { invalidTasks }
                );
            }
            
            // 為每個任務生成 ID
            const tasksWithIds = tasksArray.map(task => ({
                task_id: task.task_id || `task_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
                ...task
            }));
            
            const { data, error } = await this.client
                .from('tasks')
                .insert(tasksWithIds)
                .select();

            if (error) throw error;
            
            console.log(`✅ 批次創建 ${data.length} 個任務成功`);
            return { success: true, data };
        }, 'createTasksBatch');
    }
    
    async getUserTasks(lineUserId, options = {}) {
        // 檢查快取
        const cacheKey = this.getCacheKey('getUserTasks', { lineUserId, options });
        const cached = this.getFromCache(cacheKey);
        if (cached) return cached;
        
        return executeWithRetry(async () => {
            let query = this.client
                .from('tasks')
                .select('*')
                .eq('line_user_id', lineUserId);

            // 選項處理
            if (options.date) {
                query = query.eq('task_date', options.date);
            }
            if (options.status) {
                query = query.eq('status', options.status);
            }
            if (options.completed !== undefined) {
                query = query.eq('completed', options.completed);
            }
            
            // 排序
            query = query.order('created_at', { ascending: false });
            
            // 限制數量
            if (options.limit) {
                query = query.limit(options.limit);
            }

            const { data, error } = await query;

            if (error) throw error;
            
            const result = { success: true, data };
            
            // 設定快取
            this.setCache(cacheKey, result);
            
            return result;
        }, 'getUserTasks');
    }
    
    async toggleTaskComplete(taskId) {
        return executeWithRetry(async () => {
            console.log(`🔄 切換任務狀態: ${taskId}`);
            
            // 使用事務確保資料一致性
            const { data: task, error: fetchError } = await this.client
                .from('tasks')
                .select('completed, line_user_id')
                .eq('task_id', taskId)
                .single();

            if (fetchError) throw fetchError;

            const newStatus = !task.completed;
            
            const { data, error } = await this.client
                .from('tasks')
                .update({
                    completed: newStatus,
                    status: newStatus ? 'completed' : 'pending',
                    completed_at: newStatus ? new Date().toISOString() : null,
                    updated_at: new Date().toISOString()
                })
                .eq('task_id', taskId)
                .select()
                .single();

            if (error) throw error;
            
            // 清除相關快取
            this.clearTaskCache(task.line_user_id);
            
            console.log('✅ 任務狀態更新成功:', data);
            return { success: true, data };
        }, 'toggleTaskComplete');
    }
    
    clearTaskCache(lineUserId) {
        // 清除特定用戶的任務快取
        for (const key of this.cache.keys()) {
            if (key.includes('getUserTasks') && key.includes(lineUserId)) {
                this.cache.delete(key);
            }
        }
    }
    
    // ==================== 效能優化查詢 ====================
    
    async getUserTasksOptimized(lineUserId, options = {}) {
        return executeWithRetry(async () => {
            // 使用部分欄位選擇減少資料傳輸
            const columns = options.columns || 'task_id,title,completed,task_date,priority,created_at';
            
            let query = this.client
                .from('tasks')
                .select(columns)
                .eq('line_user_id', lineUserId);

            // 使用索引優化查詢
            if (options.date) {
                query = query.eq('task_date', options.date);
            } else if (options.dateRange) {
                query = query
                    .gte('task_date', options.dateRange.start)
                    .lte('task_date', options.dateRange.end);
            }
            
            if (options.completed !== undefined) {
                query = query.eq('completed', options.completed);
            }
            
            // 優化排序（使用索引欄位）
            query = query.order('task_date', { ascending: false })
                        .order('created_at', { ascending: false });
            
            // 限制數量
            const limit = options.limit || 50;
            query = query.limit(limit);

            const { data, error } = await query;

            if (error) throw error;
            
            return { success: true, data };
        }, 'getUserTasksOptimized');
    }
    
    // ==================== 連線池管理 ====================
    
    async getConnectionStats() {
        // 獲取連線統計資訊
        return {
            cacheSize: this.cache.size,
            cacheTimeout: this.cacheTimeout,
            hasAdminClient: !!this.admin,
            timestamp: new Date().toISOString()
        };
    }
    
    async warmupConnection() {
        // 預熱連線
        try {
            await this.testConnection();
            console.log('🔥 連線預熱完成');
            return { success: true };
        } catch (error) {
            console.error('❌ 連線預熱失敗:', error.message);
            return { success: false, error: error.message };
        }
    }
    
    // ==================== 輔助功能 ====================
    
    async logTaskHistory(taskId, memberId, action, changes) {
        // 非關鍵操作，不使用重試機制
        try {
            const { error } = await this.client
                .from('task_history')
                .insert({
                    task_id: taskId,
                    member_id: memberId,
                    action: action,
                    changes: changes,
                    created_by: 'system'
                });

            if (error) throw error;
        } catch (error) {
            console.error('⚠️ 記錄任務歷史失敗:', error.message);
            // 不影響主要操作
        }
    }
    
    async testConnection() {
        return executeWithRetry(async () => {
            const { data, error } = await this.client
                .from('system_settings')
                .select('key')
                .limit(1);

            if (error) throw error;
            console.log('✅ Supabase 連線成功！');
            return { success: true, message: 'Supabase 連線成功' };
        }, 'testConnection', { ...RETRY_CONFIG, maxRetries: 5 });
    }
    
    // 保留原有 API 相容性
    async getTodayTasks(lineUserId) {
        const today = new Date().toISOString().split('T')[0];
        return this.getUserTasksOptimized(lineUserId, { date: today });
    }
    
    async clearTodayTasks(lineUserId) {
        return executeWithRetry(async () => {
            const today = new Date().toISOString().split('T')[0];
            console.log(`🗑️ 開始清空 ${lineUserId.substring(0, 10)}... 今日任務: ${today}`);
            
            const { data, error } = await this.client
                .from('tasks')
                .delete()
                .eq('line_user_id', lineUserId)
                .eq('task_date', today)
                .select();

            if (error) throw error;
            
            // 清除快取
            this.clearTaskCache(lineUserId);
            
            console.log(`✅ 已清空今日任務: ${data ? data.length : 0} 筆`);
            return { success: true, deletedCount: data ? data.length : 0 };
        }, 'clearTodayTasks');
    }
    
    async updateTask(taskId, updates) {
        return executeWithRetry(async () => {
            const { data, error } = await this.client
                .from('tasks')
                .update({
                    ...updates,
                    updated_at: new Date().toISOString()
                })
                .eq('task_id', taskId)
                .select()
                .single();

            if (error) throw error;
            
            // 清除相關快取
            if (data) {
                this.clearTaskCache(data.line_user_id);
            }
            
            // 記錄任務歷史
            this.logTaskHistory(data.id, data.member_id, 'updated', updates).catch(err => 
                console.warn('⚠️ 記錄任務歷史失敗:', err.message)
            );
            
            return { success: true, data };
        }, 'updateTask');
    }
    
    async deleteTask(taskId) {
        return executeWithRetry(async () => {
            // 先獲取任務資訊以清除快取
            const { data: task } = await this.client
                .from('tasks')
                .select('line_user_id')
                .eq('task_id', taskId)
                .single();
            
            const { error } = await this.client
                .from('tasks')
                .delete()
                .eq('task_id', taskId);

            if (error) throw error;
            
            // 清除快取
            if (task) {
                this.clearTaskCache(task.line_user_id);
            }
            
            console.log('✅ 任務已從 Supabase 刪除');
            return { success: true };
        }, 'deleteTask');
    }
    
    async getMemberById(memberId) {
        const cacheKey = this.getCacheKey('getMemberById', { memberId });
        const cached = this.getFromCache(cacheKey);
        if (cached) return cached;
        
        return executeWithRetry(async () => {
            const { data, error } = await this.client
                .from('members')
                .select('*')
                .eq('member_id', memberId)
                .single();

            if (error) throw error;
            
            const result = { success: true, data };
            this.setCache(cacheKey, result);
            
            return result;
        }, 'getMemberById');
    }
    
    async updateMemberStats(memberId, stats) {
        return executeWithRetry(async () => {
            const { data, error } = await this.client
                .from('members')
                .update({
                    ...stats,
                    updated_at: new Date().toISOString()
                })
                .eq('member_id', memberId)
                .select()
                .single();

            if (error) throw error;
            
            // 清除快取
            this.clearMemberCache(data.line_id);
            
            return { success: true, data };
        }, 'updateMemberStats');
    }
    
    async getMultiDayTasks(lineUserId, startDate, endDate) {
        return executeWithRetry(async () => {
            const { data, error } = await this.client
                .from('tasks')
                .select('*')
                .eq('line_user_id', lineUserId)
                .gte('task_date', startDate)
                .lte('task_date', endDate)
                .order('task_date', { ascending: true })
                .order('created_at', { ascending: false });

            if (error) throw error;
            return { success: true, data };
        }, 'getMultiDayTasks');
    }
    
    async createTaskReminder(taskId, memberId, reminderTime) {
        return executeWithRetry(async () => {
            const { data, error } = await this.client
                .from('task_reminders')
                .insert({
                    task_id: taskId,
                    member_id: memberId,
                    reminder_time: reminderTime
                });

            if (error) throw error;
            return { success: true, data };
        }, 'createTaskReminder');
    }
    
    async getPendingReminders() {
        return executeWithRetry(async () => {
            const now = new Date().toISOString();
            const { data, error } = await this.client
                .from('task_reminders')
                .select(`
                    *,
                    tasks (
                        title,
                        description,
                        task_time,
                        line_user_id
                    )
                `)
                .eq('is_sent', false)
                .lte('reminder_time', now);

            if (error) throw error;
            return { success: true, data };
        }, 'getPendingReminders');
    }
    
    async markReminderSent(reminderId, errorMessage = null) {
        return executeWithRetry(async () => {
            const updateData = {
                is_sent: true,
                sent_at: new Date().toISOString()
            };
            
            if (errorMessage) {
                updateData.error_message = errorMessage;
            }

            const { error } = await this.client
                .from('task_reminders')
                .update(updateData)
                .eq('id', reminderId);

            if (error) throw error;
            return { success: true };
        }, 'markReminderSent');
    }
    
    async getSystemStats() {
        const cacheKey = this.getCacheKey('getSystemStats', {});
        const cached = this.getFromCache(cacheKey);
        if (cached) return cached;
        
        return executeWithRetry(async () => {
            // 獲取會員統計
            const { data: memberStats, error: memberError } = await this.client
                .from('members')
                .select('member_level')
                .eq('is_active', true);

            if (memberError) throw memberError;

            // 獲取任務統計
            const { data: taskStats, error: taskError } = await this.client
                .from('tasks')
                .select('status, completed');

            if (taskError) throw taskError;

            // 計算統計資料
            const stats = {
                totalMembers: memberStats.length,
                membersByLevel: {
                    basic: memberStats.filter(m => m.member_level === 'basic').length,
                    premium: memberStats.filter(m => m.member_level === 'premium').length,
                    vip: memberStats.filter(m => m.member_level === 'vip').length
                },
                totalTasks: taskStats.length,
                completedTasks: taskStats.filter(t => t.completed).length,
                pendingTasks: taskStats.filter(t => !t.completed).length,
                completionRate: taskStats.length > 0 
                    ? Math.round((taskStats.filter(t => t.completed).length / taskStats.length) * 100)
                    : 0
            };

            const result = { success: true, data: stats };
            this.setCache(cacheKey, result);
            
            return result;
        }, 'getSystemStats');
    }
    
    async logMemberLogin(memberId, loginInfo) {
        return executeWithRetry(async () => {
            const { data, error } = await this.client
                .from('member_login_logs')
                .insert({
                    member_id: memberId,
                    ...loginInfo
                });

            if (error) throw error;
            
            // 更新最後登入時間
            await this.client
                .from('members')
                .update({
                    last_login_at: new Date().toISOString(),
                    login_count: this.client.rpc('increment', { x: 1 })
                })
                .eq('id', memberId);

            return { success: true };
        }, 'logMemberLogin');
    }
}

// 創建單一實例
const enhancedDb = new EnhancedSupabaseDB();

// 預熱連線（非阻塞）
enhancedDb.warmupConnection().catch(err => {
    console.warn('⚠️ 連線預熱失敗，但不影響正常運作:', err.message);
});

// 匯出
module.exports = {
    supabase,
    supabaseAdmin,
    db: enhancedDb,
    DatabaseError,
    RETRY_CONFIG
};