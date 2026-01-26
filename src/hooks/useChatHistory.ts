import { useState, useEffect, useCallback } from 'react';
import { indexedDBManager, type ChatHistoryItem } from '../lib/indexedDB';

export type { ChatHistoryItem };

const MAX_HISTORY_ITEMS = 500; // IndexedDB 可以存储更多记录

export function useChatHistory() {
  const [history, setHistory] = useState<ChatHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // 从 IndexedDB 加载历史记录
  const loadHistory = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      await indexedDBManager.init();
      const items = await indexedDBManager.getAllItems();
      setHistory(items);
    } catch (err) {
      console.error('Failed to load chat history:', err);
      setError('加载历史记录失败');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 初始化时加载历史记录
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // 添加新的对话记录
  const addHistoryItem = async (question: string, answers: string[]) => {
    try {
      const newItem: ChatHistoryItem = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        question: question.trim(),
        answers,
        timestamp: Date.now(),
      };

      await indexedDBManager.addItem(newItem);
      
      // 更新本地状态
      setHistory((prev) => [newItem, ...prev]);

      // 检查是否超过最大数量，如果超过则删除最旧的记录
      const count = await indexedDBManager.getCount();
      if (count > MAX_HISTORY_ITEMS) {
        const toDelete = count - MAX_HISTORY_ITEMS;
        await indexedDBManager.deleteOldestItems(toDelete);
        // 重新加载以更新状态
        await loadHistory();
      }

      return newItem.id;
    } catch (err) {
      console.error('Failed to add history item:', err);
      setError('保存历史记录失败');
      return '';
    }
  };

  // 删除指定的历史记录
  const deleteHistoryItem = async (id: string) => {
    try {
      await indexedDBManager.deleteItem(id);
      setHistory((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      console.error('Failed to delete history item:', err);
      setError('删除历史记录失败');
    }
  };

  // 清空所有历史记录
  const clearHistory = async () => {
    try {
      await indexedDBManager.clearAll();
      setHistory([]);
    } catch (err) {
      console.error('Failed to clear chat history:', err);
      setError('清空历史记录失败');
    }
  };

  // 根据 ID 获取历史记录
  const getHistoryItem = (id: string) => {
    return history.find((item) => item.id === id);
  };

  // 搜索和筛选
  const searchAndFilter = async (
    query: string,
    timeRange: 'all' | 'today' | 'week' | 'month'
  ) => {
    try {
      setIsLoading(true);
      const items = await indexedDBManager.searchAndFilter(query, timeRange);
      setHistory(items);
    } catch (err) {
      console.error('Failed to search history:', err);
      setError('搜索历史记录失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 重置筛选（显示所有记录）
  const resetFilter = async () => {
    await loadHistory();
  };

  return {
    history,
    isLoading,
    error,
    addHistoryItem,
    deleteHistoryItem,
    clearHistory,
    getHistoryItem,
    searchAndFilter,
    resetFilter,
    loadHistory,
  };
}
