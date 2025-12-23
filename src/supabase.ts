// Supabase 客户端配置
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ieeoqncpjdpaeqlltsnk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllZW9xbmNwamRwYWVxbGx0c25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2OTI3NjgsImV4cCI6MjA4MTI2ODc2OH0.-RfkxBHk8Q6T2s9SDmEE2DjVPypZwFXXsaLg2yFqmnw';

// 创建 Supabase 客户端
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export interface HistoryRecord {
  question?: string | null;
  answer?: string | null;
}

// 保存问答到 Supabase history 表（问题和回答都可以为空）
export async function saveToHistory(record: HistoryRecord): Promise<boolean> {
  try {
    console.log('正在保存到 Supabase:', record);
    
    // 构建要保存的数据，允许空值
    const dataToSave = {
      question: record.question || null,
      answer: record.answer || null,
    };
    
    const { data, error } = await supabase
      .from('history')
      .insert([dataToSave]);
    
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

// 获取历史记录
export async function getHistory(): Promise<HistoryRecord[]> {
  try {
    const { data, error } = await supabase
      .from('history')
      .select('*')
      .order('id', { ascending: false })
      .limit(50);
    
    if (error) {
      console.error('获取历史记录失败:', error);
      return [];
    }
    
    return data || [];
  } catch (err) {
    console.error('Failed to get history:', err);
    return [];
  }
}
