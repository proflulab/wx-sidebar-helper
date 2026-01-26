// IndexedDB 工具类
export interface ChatHistoryItem {
  id: string;
  question: string;
  answers: string[];
  timestamp: number;
}

const DB_NAME = 'ChatHistoryDB';
const DB_VERSION = 1;
const STORE_NAME = 'chatHistory';

class IndexedDBManager {
  private db: IDBDatabase | null = null;

  // 初始化数据库
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('IndexedDB 打开失败:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // 创建对象存储空间
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          // 创建索引以便按时间戳排序和搜索
          objectStore.createIndex('timestamp', 'timestamp', { unique: false });
          objectStore.createIndex('question', 'question', { unique: false });
        }
      };
    });
  }

  // 确保数据库已初始化
  private async ensureDB(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.init();
    }
    if (!this.db) {
      throw new Error('数据库初始化失败');
    }
    return this.db;
  }

  // 添加记录
  async addItem(item: ChatHistoryItem): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(STORE_NAME);
      const request = objectStore.add(item);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // 获取所有记录（按时间戳降序）
  async getAllItems(): Promise<ChatHistoryItem[]> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const objectStore = transaction.objectStore(STORE_NAME);
      const index = objectStore.index('timestamp');
      const request = index.openCursor(null, 'prev'); // 降序

      const items: ChatHistoryItem[] = [];

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          items.push(cursor.value);
          cursor.continue();
        } else {
          resolve(items);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  // 根据 ID 获取记录
  async getItem(id: string): Promise<ChatHistoryItem | undefined> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const objectStore = transaction.objectStore(STORE_NAME);
      const request = objectStore.get(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // 删除记录
  async deleteItem(id: string): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(STORE_NAME);
      const request = objectStore.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // 清空所有记录
  async clearAll(): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(STORE_NAME);
      const request = objectStore.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // 搜索记录（按问题内容）
  async searchByQuestion(query: string): Promise<ChatHistoryItem[]> {
    const allItems = await this.getAllItems();
    const lowerQuery = query.toLowerCase().trim();
    
    if (!lowerQuery) {
      return allItems;
    }

    return allItems.filter(item => 
      item.question.toLowerCase().includes(lowerQuery)
    );
  }

  // 按时间范围筛选
  async filterByTimeRange(range: 'all' | 'today' | 'week' | 'month'): Promise<ChatHistoryItem[]> {
    const allItems = await this.getAllItems();
    
    if (range === 'all') {
      return allItems;
    }

    const now = Date.now();
    let startTime = 0;

    switch (range) {
      case 'today':
        // 今天 00:00:00
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        startTime = today.getTime();
        break;
      case 'week':
        // 7天前
        startTime = now - 7 * 24 * 60 * 60 * 1000;
        break;
      case 'month':
        // 30天前
        startTime = now - 30 * 24 * 60 * 60 * 1000;
        break;
    }

    return allItems.filter(item => item.timestamp >= startTime);
  }

  // 组合搜索和时间筛选
  async searchAndFilter(
    query: string,
    timeRange: 'all' | 'today' | 'week' | 'month'
  ): Promise<ChatHistoryItem[]> {
    let items = await this.filterByTimeRange(timeRange);
    
    const lowerQuery = query.toLowerCase().trim();
    if (lowerQuery) {
      items = items.filter(item => 
        item.question.toLowerCase().includes(lowerQuery)
      );
    }

    return items;
  }

  // 获取记录总数
  async getCount(): Promise<number> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const objectStore = transaction.objectStore(STORE_NAME);
      const request = objectStore.count();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // 删除最旧的记录（用于限制总数）
  async deleteOldestItems(count: number): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(STORE_NAME);
      const index = objectStore.index('timestamp');
      const request = index.openCursor(null, 'next'); // 升序，从最旧的开始

      let deleted = 0;

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor && deleted < count) {
          cursor.delete();
          deleted++;
          cursor.continue();
        } else {
          resolve();
        }
      };

      request.onerror = () => reject(request.error);
    });
  }
}

// 导出单例
export const indexedDBManager = new IndexedDBManager();
