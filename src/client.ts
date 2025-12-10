/**
 * Coze API 客户端 - JWT OAuth 授权版本
 * 
 * 通过后端 API 获取 JWT Token，而非直接使用 PAT
 */
import { CozeAPI, COZE_CN_BASE_URL } from "@coze/api";

// 配置
const API_BASE_URL = import.meta.env.VITE_COZE_API_BASE_URL || COZE_CN_BASE_URL;
const JWT_TOKEN_URL = import.meta.env.VITE_COZE_JWT_TOKEN_URL || '/api/coze-token';

// Token 缓存
let tokenCache: { token: string; expiresAt: number } | null = null;

/**
 * 从后端获取 JWT OAuth Token
 */
async function getJWTToken(): Promise<string> {
  // 检查缓存（提前 5 分钟刷新）
  if (tokenCache && tokenCache.expiresAt > Date.now() + 5 * 60 * 1000) {
    console.debug('[Coze] Using cached token');
    return tokenCache.token;
  }

  console.debug('[Coze] Fetching new JWT token from:', JWT_TOKEN_URL);
  
  const response = await fetch(JWT_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  console.debug('[Coze] Token response status:', response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Coze] Token fetch failed:', response.status, errorText);
    throw new Error(`Failed to get JWT token: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  console.debug('[Coze] Token response:', data.access_token ? 'success' : 'no token');
  
  if (data.access_token) {
    tokenCache = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in || 86400) * 1000,
    };
    return data.access_token;
  }

  throw new Error(`Invalid token response: ${JSON.stringify(data)}`);
}

/**
 * 创建带动态 Token 的 Coze API 客户端
 * 使用 getAccessToken 回调实现 Token 自动刷新
 */
export const client = new CozeAPI({
  baseURL: API_BASE_URL,
  token: async () => {
    return await getJWTToken();
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
