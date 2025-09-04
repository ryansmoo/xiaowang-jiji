// 🐕 小汪記記會員系統模組
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const axios = require('axios');

// 會員資料儲存 (使用記憶體儲存，重啟後會重置)
const members = new Map(); // memberId -> member data
const lineIdToMemberId = new Map(); // lineId -> memberId 對應表

// 🎯 會員系統核心功能
class MemberSystem {
    constructor() {
        this.jwtSecret = process.env.JWT_SECRET || 'xiaowang-jiji-default-secret';
        this.baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    }

    // 🔐 使用 LINE Access Token 獲取用戶資料
    async getLineUserProfile(accessToken) {
        try {
            const response = await axios.get('https://api.line.me/v2/profile', {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });
            
            return response.data; // { userId, displayName, pictureUrl, statusMessage }
        } catch (error) {
            console.error('❌ 獲取 LINE 用戶資料失敗:', error.message);
            throw new Error('無法獲取 LINE 用戶資料');
        }
    }

    // 📝 註冊或更新會員資料
    async registerOrUpdateMember(lineProfile, accessToken) {
        try {
            const lineId = lineProfile.userId;
            
            // 檢查是否已經是會員
            let memberId = lineIdToMemberId.get(lineId);
            
            if (memberId && members.has(memberId)) {
                // 更新現有會員資料
                const existingMember = members.get(memberId);
                existingMember.displayName = lineProfile.displayName;
                existingMember.pictureUrl = lineProfile.pictureUrl;
                existingMember.statusMessage = lineProfile.statusMessage;
                existingMember.lastLoginAt = new Date().toISOString();
                
                console.log(`✅ 會員資料已更新: ${existingMember.displayName} (${memberId})`);
                return existingMember;
            } else {
                // 創建新會員
                memberId = 'member_' + Date.now() + '_' + Math.random().toString(36).substring(2, 15);
                
                const newMember = {
                    memberId: memberId,
                    lineId: lineId,
                    displayName: lineProfile.displayName,
                    pictureUrl: lineProfile.pictureUrl,
                    statusMessage: lineProfile.statusMessage,
                    email: null, // 可後續擴展
                    phone: null, // 可後續擴展
                    createdAt: new Date().toISOString(),
                    lastLoginAt: new Date().toISOString(),
                    memberLevel: 'basic', // basic, premium, vip
                    isActive: true,
                    preferences: {
                        language: 'zh-TW',
                        timezone: 'Asia/Taipei',
                        notifications: {
                            taskReminder: true,
                            dailySummary: true,
                            weeklyReport: false
                        }
                    },
                    stats: {
                        totalTasks: 0,
                        completedTasks: 0,
                        loginCount: 1
                    }
                };
                
                // 儲存會員資料
                members.set(memberId, newMember);
                lineIdToMemberId.set(lineId, memberId);
                
                console.log(`🎉 新會員註冊成功: ${newMember.displayName} (${memberId})`);
                return newMember;
            }
        } catch (error) {
            console.error('❌ 註冊或更新會員失敗:', error.message);
            throw error;
        }
    }

    // 🔑 生成 JWT Token
    generateAuthToken(member) {
        const payload = {
            memberId: member.memberId,
            lineId: member.lineId,
            displayName: member.displayName,
            memberLevel: member.memberLevel,
            iat: Math.floor(Date.now() / 1000)
        };
        
        return jwt.sign(payload, this.jwtSecret, { expiresIn: '30d' });
    }

    // 🔍 驗證 JWT Token
    verifyAuthToken(token) {
        try {
            const decoded = jwt.verify(token, this.jwtSecret);
            return decoded;
        } catch (error) {
            console.error('❌ JWT Token 驗證失敗:', error.message);
            return null;
        }
    }

    // 👤 根據會員 ID 獲取會員資料
    getMemberById(memberId) {
        return members.get(memberId) || null;
    }

    // 👤 根據 LINE ID 獲取會員資料
    getMemberByLineId(lineId) {
        const memberId = lineIdToMemberId.get(lineId);
        return memberId ? members.get(memberId) : null;
    }

    // 📊 更新會員統計資料
    updateMemberStats(memberId, taskCount = 0, completedCount = 0) {
        const member = members.get(memberId);
        if (member) {
            member.stats.totalTasks = taskCount;
            member.stats.completedTasks = completedCount;
            member.stats.loginCount = (member.stats.loginCount || 0) + 1;
        }
    }

    // 📋 獲取所有會員資料 (管理用)
    getAllMembers() {
        return Array.from(members.values());
    }

    // 🗑️ 刪除會員 (軟刪除)
    deactivateMember(memberId) {
        const member = members.get(memberId);
        if (member) {
            member.isActive = false;
            member.deactivatedAt = new Date().toISOString();
            console.log(`🚫 會員已停用: ${member.displayName} (${memberId})`);
            return true;
        }
        return false;
    }

    // 🔄 重新啟用會員
    reactivateMember(memberId) {
        const member = members.get(memberId);
        if (member) {
            member.isActive = true;
            delete member.deactivatedAt;
            console.log(`✅ 會員已重新啟用: ${member.displayName} (${memberId})`);
            return true;
        }
        return false;
    }

    // 📈 會員系統統計
    getSystemStats() {
        const allMembers = Array.from(members.values());
        const activeMembers = allMembers.filter(m => m.isActive);
        
        return {
            totalMembers: allMembers.length,
            activeMembers: activeMembers.length,
            newMembersToday: allMembers.filter(m => {
                const today = new Date().toDateString();
                const memberDate = new Date(m.createdAt).toDateString();
                return memberDate === today;
            }).length,
            memberLevels: {
                basic: activeMembers.filter(m => m.memberLevel === 'basic').length,
                premium: activeMembers.filter(m => m.memberLevel === 'premium').length,
                vip: activeMembers.filter(m => m.memberLevel === 'vip').length
            }
        };
    }
}

// 🏗️ 中間件：驗證會員身份
function authenticateMember(req, res, next) {
    const token = req.headers.authorization?.replace('Bearer ', '') || 
                  req.cookies?.authToken || 
                  req.query?.token;
    
    if (!token) {
        return res.status(401).json({ 
            success: false, 
            message: '需要登入才能存取此功能',
            error: 'NO_TOKEN'
        });
    }
    
    const memberSystem = new MemberSystem();
    const decoded = memberSystem.verifyAuthToken(token);
    
    if (!decoded) {
        return res.status(401).json({ 
            success: false, 
            message: '登入憑證無效或已過期',
            error: 'INVALID_TOKEN'
        });
    }
    
    // 檢查會員是否存在且啟用
    const member = memberSystem.getMemberById(decoded.memberId);
    if (!member || !member.isActive) {
        return res.status(401).json({ 
            success: false, 
            message: '會員帳戶不存在或已停用',
            error: 'INACTIVE_MEMBER'
        });
    }
    
    // 將會員資料加入 request 物件
    req.member = member;
    req.token = token;
    next();
}

// 匯出模組
module.exports = {
    MemberSystem,
    authenticateMember
};