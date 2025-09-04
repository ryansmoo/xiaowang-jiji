// 🐕 小汪記記 Supabase 資料庫連線模組
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

// 🔗 創建 Supabase 客戶端
// 一般客戶端（使用 anon key）
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false
    }
});

// 服務端客戶端（使用 service key，有完整權限）
const supabaseAdmin = supabaseServiceKey 
    ? createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    })
    : null;

// 🎯 資料庫操作類別
class SupabaseDB {
    constructor() {
        this.client = supabase;
        this.admin = supabaseAdmin;
    }

    // ==================== 會員相關操作 ====================
    
    // 創建或更新會員
    async upsertMember(memberData) {
        try {
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
            console.log('✅ 會員資料已儲存到 Supabase');
            return { success: true, data };
        } catch (error) {
            console.error('❌ Supabase 會員儲存失敗:', error.message);
            return { success: false, error: error.message };
        }
    }

    // 根據 LINE ID 獲取會員
    async getMemberByLineId(lineId) {
        try {
            const { data, error } = await this.client
                .from('members')
                .select('*')
                .eq('line_id', lineId)
                .single();

            if (error && error.code !== 'PGRST116') throw error; // PGRST116 = 找不到資料
            return { success: true, data };
        } catch (error) {
            console.error('❌ Supabase 獲取會員失敗:', error.message);
            return { success: false, error: error.message };
        }
    }

    // 根據會員 ID 獲取會員
    async getMemberById(memberId) {
        try {
            const { data, error } = await this.client
                .from('members')
                .select('*')
                .eq('member_id', memberId)
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('❌ Supabase 獲取會員失敗:', error.message);
            return { success: false, error: error.message };
        }
    }

    // 更新會員統計
    async updateMemberStats(memberId, stats) {
        try {
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
            return { success: true, data };
        } catch (error) {
            console.error('❌ Supabase 更新會員統計失敗:', error.message);
            return { success: false, error: error.message };
        }
    }

    // 記錄會員登入
    async logMemberLogin(memberId, loginInfo) {
        try {
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
        } catch (error) {
            console.error('❌ Supabase 記錄登入失敗:', error.message);
            return { success: false, error: error.message };
        }
    }

    // ==================== 任務相關操作 ====================
    
    // 創建任務
    async createTask(taskData) {
        try {
            const { data, error } = await this.client
                .from('tasks')
                .insert({
                    task_id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
                    ...taskData
                })
                .select()
                .single();

            if (error) throw error;
            console.log('✅ 任務已儲存到 Supabase');
            
            // 記錄任務歷史
            await this.logTaskHistory(data.id, null, 'created', taskData);
            
            return { success: true, data };
        } catch (error) {
            console.error('❌ Supabase 創建任務失敗:', error.message);
            return { success: false, error: error.message };
        }
    }

    // 獲取用戶任務
    async getUserTasks(lineUserId, options = {}) {
        try {
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
            return { success: true, data };
        } catch (error) {
            console.error('❌ Supabase 獲取任務失敗:', error.message);
            return { success: false, error: error.message };
        }
    }

    // 更新任務
    async updateTask(taskId, updates) {
        try {
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
            
            // 記錄任務歷史
            await this.logTaskHistory(data.id, data.member_id, 'updated', updates);
            
            return { success: true, data };
        } catch (error) {
            console.error('❌ Supabase 更新任務失敗:', error.message);
            return { success: false, error: error.message };
        }
    }

    // 切換任務完成狀態
    async toggleTaskComplete(taskId) {
        try {
            console.log(`🔄 切換任務狀態: ${taskId}`);
            
            // 先獲取當前狀態
            const { data: task, error: fetchError } = await this.client
                .from('tasks')
                .select('completed')
                .eq('task_id', taskId)
                .single();

            if (fetchError) {
                console.error('❌ 獲取任務狀態失敗:', fetchError.message);
                throw fetchError;
            }

            // 更新狀態
            const newStatus = !task.completed;
            console.log(`📝 更新任務狀態: ${task.completed} → ${newStatus}`);
            
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
            
            console.log('✅ 任務狀態更新成功:', data);
            return { success: true, data };
        } catch (error) {
            console.error('❌ Supabase 切換任務狀態失敗:', error.message);
            return { success: false, error: error.message };
        }
    }

    // 刪除任務
    async deleteTask(taskId) {
        try {
            const { error } = await this.client
                .from('tasks')
                .delete()
                .eq('task_id', taskId);

            if (error) throw error;
            console.log('✅ 任務已從 Supabase 刪除');
            return { success: true };
        } catch (error) {
            console.error('❌ Supabase 刪除任務失敗:', error.message);
            return { success: false, error: error.message };
        }
    }

    // 獲取今日任務
    async getTodayTasks(lineUserId) {
        const today = new Date().toISOString().split('T')[0];
        return this.getUserTasks(lineUserId, { date: today });
    }

    // 清空今日任務
    async clearTodayTasks(lineUserId) {
        try {
            const today = new Date().toISOString().split('T')[0];
            console.log(`🗑️ 開始清空 ${lineUserId.substring(0, 10)}... 今日任務: ${today}`);
            
            const { data, error } = await this.client
                .from('tasks')
                .delete()
                .eq('line_user_id', lineUserId)
                .eq('task_date', today);

            if (error) throw error;
            console.log(`✅ 已清空今日任務: ${data ? data.length : 0} 筆`);
            return { success: true, deletedCount: data ? data.length : 0 };
        } catch (error) {
            console.error('❌ Supabase 清空今日任務失敗:', error.message);
            return { success: false, error: error.message };
        }
    }

    // 獲取多日任務
    async getMultiDayTasks(lineUserId, startDate, endDate) {
        try {
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
        } catch (error) {
            console.error('❌ Supabase 獲取多日任務失敗:', error.message);
            return { success: false, error: error.message };
        }
    }

    // ==================== 提醒相關操作 ====================
    
    // 創建任務提醒
    async createTaskReminder(taskId, memberId, reminderTime) {
        try {
            const { data, error } = await this.client
                .from('task_reminders')
                .insert({
                    task_id: taskId,
                    member_id: memberId,
                    reminder_time: reminderTime
                });

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('❌ Supabase 創建提醒失敗:', error.message);
            return { success: false, error: error.message };
        }
    }

    // 獲取待發送提醒
    async getPendingReminders() {
        try {
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
        } catch (error) {
            console.error('❌ Supabase 獲取待發送提醒失敗:', error.message);
            return { success: false, error: error.message };
        }
    }

    // 標記提醒已發送
    async markReminderSent(reminderId, errorMessage = null) {
        try {
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
        } catch (error) {
            console.error('❌ Supabase 更新提醒狀態失敗:', error.message);
            return { success: false, error: error.message };
        }
    }

    // ==================== 輔助功能 ====================
    
    // 記錄任務歷史
    async logTaskHistory(taskId, memberId, action, changes) {
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

    // 獲取系統統計
    async getSystemStats() {
        try {
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

            return { success: true, data: stats };
        } catch (error) {
            console.error('❌ Supabase 獲取系統統計失敗:', error.message);
            return { success: false, error: error.message };
        }
    }

    // 測試連線
    async testConnection() {
        try {
            const { data, error } = await this.client
                .from('system_settings')
                .select('key')
                .limit(1);

            if (error) throw error;
            console.log('✅ Supabase 連線成功！');
            return { success: true, message: 'Supabase 連線成功' };
        } catch (error) {
            console.error('❌ Supabase 連線失敗:', error.message);
            return { success: false, error: error.message };
        }
    }
}

// 創建單一實例
const db = new SupabaseDB();

// 匯出
module.exports = {
    supabase,
    supabaseAdmin,
    db
};