// Supabase 客户端配置
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ieeoqncpjdpaeqlltsnk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllZW9xbmNwamRwYWVxbGx0c25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2OTI3NjgsImV4cCI6MjA4MTI2ODc2OH0.-RfkxBHk8Q6T2s9SDmEE2DjVPypZwFXXsaLg2yFqmnw';

// 创建 Supabase 客户端
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export interface HistoryRecord {
  question?: string | null;
  answer?: string | null;
  time?: string | Date; // 使用 time 而不是 created_at
  created_at?: string | Date; // 保留兼容性
}

// 保存问答到 Supabase history 表（问题和回答都可以为空）
export async function saveToHistory(record: HistoryRecord): Promise<boolean> {
  try {
    console.log('正在保存到 Supabase:', record);
    
    // 使用传入的时间，如果没有则使用当前时间
    const timestamp = record.time ? new Date(record.time).toISOString() : new Date().toISOString();
    
    // 先尝试使用 time 列
    let dataToSave: any = {
      question: record.question || null,
      answer: record.answer || null,
      time: timestamp,
    };
    
    let { data, error } = await supabase
      .from('history')
      .insert([dataToSave]);
    
    // 如果 time 列不存在，尝试 created_at
    if (error && error.code === '42703') {
      console.warn('time 列不存在，尝试 created_at');
      dataToSave = {
        question: record.question || null,
        answer: record.answer || null,
        created_at: timestamp,
      };
      
      const result = await supabase
        .from('history')
        .insert([dataToSave]);
      
      data = result.data;
      error = result.error;
      
      // 如果 created_at 也不存在，使用简化保存
      if (error && error.code === '42703') {
        console.warn('created_at 列也不存在，使用简化保存');
        dataToSave = {
          question: record.question || null,
          answer: record.answer || null,
        };
        
        const fallbackResult = await supabase
          .from('history')
          .insert([dataToSave]);
        
        data = fallbackResult.data;
        error = fallbackResult.error;
      }
    }
    
    if (error) {
      console.error('Supabase 保存失败:', error);
      return false;
    }
    
    console.log('Supabase 保存成功', data);
    return true;
  } catch (err) {
    console.error('Failed to save to Supabase:', err);
    return false;
  }
}

// 单独保存问题
export async function saveQuestion(question: string): Promise<boolean> {
  return saveToHistory({ question, answer: null });
}

// 单独保存回答
export async function saveAnswer(answer: string): Promise<boolean> {
  return saveToHistory({ question: null, answer });
}

// 更新最近的历史记录的答案（用于在提问后更新答案）
export async function updateLatestAnswer(question: string, answer: string): Promise<boolean> {
  try {
    console.log('更新最近的记录答案，问题:', question);
    
    // 查找最近的匹配问题的记录
    const { data: records, error: fetchError } = await supabase
      .from('history')
      .select('*')
      .eq('question', question)
      .order('time', { ascending: false })
      .limit(1);
    
    if (fetchError) {
      // 如果 time 列不存在，尝试 created_at
      if (fetchError.code === '42703') {
        const { data: fallbackRecords, error: fallbackError } = await supabase
          .from('history')
          .select('*')
          .eq('question', question)
          .limit(1);
        
        if (fallbackError || !fallbackRecords || fallbackRecords.length === 0) {
          console.error('查找记录失败，创建新记录');
          return saveToHistory({ question, answer });
        }
        
        // 更新找到的记录
        const recordToUpdate = fallbackRecords[0];
        const { error: updateError } = await supabase
          .from('history')
          .update({ answer })
          .match({ question: recordToUpdate.question });
        
        if (updateError) {
          console.error('更新失败:', updateError);
          return false;
        }
        
        console.log('答案更新成功');
        return true;
      }
      
      console.error('查找记录失败:', fetchError);
      return false;
    }
    
    if (!records || records.length === 0) {
      console.warn('未找到匹配的记录，创建新记录');
      return saveToHistory({ question, answer });
    }
    
    // 更新找到的记录
    const recordToUpdate = records[0];
    const { error: updateError } = await supabase
      .from('history')
      .update({ answer })
      .match({ question: recordToUpdate.question, time: recordToUpdate.time });
    
    if (updateError) {
      console.error('更新失败:', updateError);
      return false;
    }
    
    console.log('答案更新成功');
    return true;
  } catch (err) {
    console.error('Failed to update answer:', err);
    return false;
  }
}

// 时间筛选选项
export type TimeFilter = 'all' | 'today' | 'week' | 'month';

// 获取历史记录（支持时间筛选，最多返回50条）
export async function getHistory(timeFilter: TimeFilter = 'all'): Promise<HistoryRecord[]> {
  try {
    console.log('开始获取历史记录，筛选条件:', timeFilter);
    
    // 先尝试使用 time 列查询
    let timeQuery = supabase
      .from('history')
      .select('question, answer, time')
      .order('time', { ascending: false })
      .limit(50);
    
    // 根据时间筛选
    if (timeFilter !== 'all') {
      const now = new Date();
      let startDate: Date;
      
      switch (timeFilter) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(0);
      }
      
      timeQuery = timeQuery.gte('time', startDate.toISOString());
    }
    
    let { data, error } = await timeQuery;
    
    // 如果 time 列不存在，尝试 created_at
    if (error && error.code === '42703') {
      console.warn('time 列不存在，尝试 created_at');
      let createdAtQuery = supabase
        .from('history')
        .select('question, answer, created_at')
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (timeFilter !== 'all') {
        const now = new Date();
        let startDate: Date;
        
        switch (timeFilter) {
          case 'today':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            break;
          case 'week':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case 'month':
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          default:
            startDate = new Date(0);
        }
        
        createdAtQuery = createdAtQuery.gte('created_at', startDate.toISOString());
      }
      
      const result = await createdAtQuery;
      data = result.data as any;
      error = result.error;
      
      // 如果 created_at 也不存在，使用简化查询
      if (error && error.code === '42703') {
        console.warn('created_at 列也不存在，使用简化查询');
        const fallbackQuery = supabase
          .from('history')
          .select('question, answer')
          .limit(50);
        
        const { data: fallbackData, error: fallbackError } = await fallbackQuery;
        
        if (fallbackError) {
          console.error('简化查询也失败:', fallbackError);
          return [];
        }
        
        console.log('获取历史记录成功（无时间信息），共', fallbackData?.length || 0, '条');
        return fallbackData || [];
      }
    }
    
    if (error) {
      console.error('获取历史记录失败 - Supabase错误:', error);
      console.error('错误详情:', JSON.stringify(error, null, 2));
      return [];
    }
    
    console.log('获取历史记录成功，共', data?.length || 0, '条');
    
    // 将 time 字段映射到 created_at 以保持兼容性
    return (data || []).map((record: any) => ({
      question: record.question,
      answer: record.answer,
      created_at: record.time || record.created_at,
      time: record.time
    }));
  } catch (err) {
    console.error('Failed to get history - 异常:', err);
    if (err instanceof Error) {
      console.error('错误消息:', err.message);
      console.error('错误堆栈:', err.stack);
    }
    return [];
  }
}
