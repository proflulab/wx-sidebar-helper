/**
 * Vercel Serverless Function: 生成 Coze JWT OAuth Token
 * 
 * 安全特性：
 * 1. 请求来源验证（Referer/Origin 检查）
 * 2. 速率限制（防止滥用）
 * 3. 令牌缓存（减少 API 调用）
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import jwt from 'jsonwebtoken';

// 从环境变量读取配置
const APP_ID = process.env.COZE_JWT_APP_ID || '';
const KEY_ID = process.env.COZE_JWT_KEY_ID || '';
const PRIVATE_KEY = (process.env.COZE_JWT_PRIVATE_KEY || '').replace(/\\n/g, '\n');
const API_BASE = process.env.VITE_COZE_API_BASE_URL || 'https://api.coze.cn';

// 允许的域名列表（生产环境配置）
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

// 速率限制配置
const RATE_LIMIT_WINDOW = 60 * 1000; // 1分钟窗口
const RATE_LIMIT_MAX = 30; // 每分钟最多30次请求

// 简单的内存速率限制（生产环境建议使用 Redis）
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

// Token 缓存
let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * 获取客户端标识（用于速率限制）
 */
function getClientId(req: VercelRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0];
  return ip || req.socket?.remoteAddress || 'unknown';
}

/**
 * 检查速率限制
 */
function checkRateLimit(clientId: string): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const record = rateLimitMap.get(clientId);

  if (!record || now > record.resetAt) {
    rateLimitMap.set(clientId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1, resetIn: RATE_LIMIT_WINDOW };
  }

  if (record.count >= RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0, resetIn: record.resetAt - now };
  }

  record.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX - record.count, resetIn: record.resetAt - now };
}

/**
 * 验证请求来源
 */
function validateOrigin(req: VercelRequest): boolean {
  // 开发环境跳过验证
  if (process.env.NODE_ENV === 'development' || !ALLOWED_ORIGINS.length) {
    return true;
  }

  const origin = req.headers.origin || '';
  const referer = req.headers.referer || '';

  // 检查 Origin 或 Referer 是否在允许列表中
  return ALLOWED_ORIGINS.some(allowed => 
    origin.includes(allowed) || referer.includes(allowed)
  );
}

/**
 * 生成用于 OAuth 的 JWT
 */
function generateJWT(): string {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: APP_ID,
    aud: 'api.coze.cn',
    iat: now,
    exp: now + 3600,
    jti: `${now}-${Math.random().toString(36).slice(2)}`,
  };

  return jwt.sign(payload, PRIVATE_KEY, {
    algorithm: 'RS256',
    header: { alg: 'RS256', typ: 'JWT', kid: KEY_ID },
  });
}

/**
 * 调用 Coze OAuth 接口获取 access_token
 */
async function getAccessToken(): Promise<{ access_token: string; expires_in: number }> {
  // 检查缓存（提前 5 分钟刷新）
  if (cachedToken && cachedToken.expiresAt > Date.now() + 5 * 60 * 1000) {
    return { 
      access_token: cachedToken.token, 
      expires_in: Math.floor((cachedToken.expiresAt - Date.now()) / 1000) 
    };
  }

  const jwtToken = generateJWT();
  
  const response = await fetch(`${API_BASE}/api/permission/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${jwtToken}`,
    },
    body: JSON.stringify({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      duration_seconds: 86400,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Coze OAuth error:', response.status, errorText);
    throw new Error(`OAuth failed: ${response.status}`);
  }

  const data = await response.json();
  
  if (data.access_token) {
    cachedToken = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in || 86400) * 1000,
    };
    return { access_token: data.access_token, expires_in: data.expires_in || 86400 };
  }

  throw new Error('Invalid OAuth response');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 安全响应头
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  // CORS 配置
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGINS.length ? (ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]) : '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Request-Id');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // 只允许 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 验证请求来源
  if (!validateOrigin(req)) {
    console.warn('Blocked request from unauthorized origin:', req.headers.origin);
    return res.status(403).json({ error: 'Forbidden' });
  }

  // 速率限制检查
  const clientId = getClientId(req);
  const rateLimit = checkRateLimit(clientId);
  
  res.setHeader('X-RateLimit-Limit', RATE_LIMIT_MAX.toString());
  res.setHeader('X-RateLimit-Remaining', rateLimit.remaining.toString());
  res.setHeader('X-RateLimit-Reset', Math.ceil(rateLimit.resetIn / 1000).toString());

  if (!rateLimit.allowed) {
    return res.status(429).json({ 
      error: 'Too many requests',
      retryAfter: Math.ceil(rateLimit.resetIn / 1000),
    });
  }

  try {
    // 验证环境变量
    if (!APP_ID || !KEY_ID || !PRIVATE_KEY) {
      console.error('Missing JWT configuration');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const tokenData = await getAccessToken();
    
    // 返回 token（不暴露完整 token，只返回必要信息）
    return res.status(200).json({
      access_token: tokenData.access_token,
      expires_in: tokenData.expires_in,
      token_type: 'Bearer',
    });
  } catch (error) {
    console.error('Token generation error:', error);
    return res.status(500).json({ error: 'Failed to generate token' });
  }
}
