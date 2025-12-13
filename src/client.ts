/**
 * Coze API 客户端 - JWT OAuth 授权版本
 * 
 * 安全特性：
 * 1. Token 自动刷新
 * 2. 请求重试机制
 * 3. 错误处理与恢复
 */
import { CozeAPI, COZE_CN_BASE_URL } from "@coze/api";

// 配置
const API_BASE_URL = import.meta.env.VITE_COZE_API_BASE_URL || COZE_CN_BASE_URL;
const JWT_TOKEN_URL = import.meta.env.VITE_COZE_JWT_TOKEN_URL || '/api/coze-token';

// 重试配置
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1秒

// Token 缓存（使用 sessionStorage 持久化）
interface TokenCache {
  token: string;
  expiresAt: number;
}

const TOKEN_CACHE_KEY = '__coze_token_cache__';

/**
 * 从 sessionStorage 获取缓存的 token
 */
function getCachedToken(): TokenCache | null {
  try {
    const cached = sessionStorage.getItem(TOKEN_CACHE_KEY);
    if (cached) {
      const data = JSON.parse(cached) as TokenCache;
      // 验证 token 是否过期（提前 5 分钟刷新）
      if (data.expiresAt > Date.now() + 5 * 60 * 1000) {
        return data;
      }
    }
  } catch {
    // 忽略解析错误
  }
  return null;
}

/**
 * 缓存 token 到 sessionStorage
 */
function setCachedToken(token: string, expiresIn: number): void {
  try {
    const cache: TokenCache = {
      token,
      expiresAt: Date.now() + expiresIn * 1000,
    };
    sessionStorage.setItem(TOKEN_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // 忽略存储错误
  }
}

/**
 * 清除缓存的 token
 */
function clearCachedToken(): void {
  try {
    sessionStorage.removeItem(TOKEN_CACHE_KEY);
  } catch {
    // 忽略错误
  }
}

/**
 * 延迟函数
 */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 生成请求 ID（用于追踪）
 */
function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 从后端获取 JWT OAuth Token（带重试）
 */
async function fetchTokenWithRetry(retries = MAX_RETRIES): Promise<{ token: string; expiresIn: number }> {
  const requestId = generateRequestId();
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.debug(`[Coze] Fetching token (attempt ${attempt}/${retries})`, { requestId });
      
      const response = await fetch(JWT_TOKEN_URL, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
        },
        credentials: 'same-origin',
      });

      // 处理速率限制
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('X-RateLimit-Reset') || '5', 10);
        console.warn(`[Coze] Rate limited, retrying after ${retryAfter}s`);
        if (attempt < retries) {
          await delay(retryAfter * 1000);
          continue;
        }
        throw new Error('Rate limit exceeded');
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      
      if (!data.access_token) {
        throw new Error('No access_token in response');
      }

      console.debug('[Coze] Token fetched successfully');
      return { token: data.access_token, expiresIn: data.expires_in || 86400 };
      
    } catch (error) {
      console.error(`[Coze] Token fetch failed (attempt ${attempt}):`, error);
      
      if (attempt < retries) {
        const backoff = RETRY_DELAY * Math.pow(2, attempt - 1); // 指数退避
        console.debug(`[Coze] Retrying in ${backoff}ms...`);
        await delay(backoff);
      } else {
        throw error;
      }
    }
  }
  
  throw new Error('Failed to fetch token after all retries');
}

/**
 * 获取 JWT Token（优先使用缓存）
 */
async function getJWTToken(): Promise<string> {
  // 检查缓存
  const cached = getCachedToken();
  if (cached) {
    console.debug('[Coze] Using cached token');
    return cached.token;
  }

  // 获取新 token
  const { token, expiresIn } = await fetchTokenWithRetry();
  
  // 缓存 token
  setCachedToken(token, expiresIn);
  
  return token;
}

/**
 * 刷新 Token（强制获取新 token）
 */
export async function refreshToken(): Promise<string> {
  clearCachedToken();
  return getJWTToken();
}

/**
 * 创建带动态 Token 的 Coze API 客户端
 */
export const client = new CozeAPI({
  baseURL: API_BASE_URL,
  token: async () => {
    try {
      return await getJWTToken();
    } catch (error) {
      console.error('[Coze] Failed to get token:', error);
      throw error;
    }
  },
  allowPersonalAccessTokenInBrowser: true,
});

// 机器人 ID
export const botId = import.meta.env.VITE_COZE_BOT_ID;

// 用户 ID（用于会话标识）
export const userId = import.meta.env.VITE_COZE_USER_ID || "web-user";

// 工具函数
export const sleep = (ms: number): Promise<void> => 
  new Promise((resolve) => setTimeout(resolve, ms));
