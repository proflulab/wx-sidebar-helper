/**
 * Vercel Serverless Function: 生成 Coze OAuth JWT Access Token
 * 
 * 流程：
 * 1. 使用私钥生成 JWT Token
 * 2. 用 JWT Token 换取 access_token
 * 3. 返回 access_token 给前端
 * 
 * 参考文档: https://www.coze.cn/docs/developer_guides/oauth_jwt
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import jwt from 'jsonwebtoken';

// 从环境变量读取配置
const APP_ID = process.env.COZE_JWT_APP_ID || '';
const KEY_ID = process.env.COZE_JWT_KEY_ID || '';
const PRIVATE_KEY = (process.env.COZE_JWT_PRIVATE_KEY || '').replace(/\\n/g, '\n');
const API_BASE = process.env.VITE_COZE_API_BASE_URL || 'https://api.coze.cn';

// Token 缓存（简单内存缓存，Vercel 冷启动会重置）
let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * 生成 JWT Token
 */
function generateJWT(): string {
  const now = Math.floor(Date.now() / 1000);
  
  const payload = {
    iss: APP_ID,           // OAuth 应用 ID
    aud: 'api.coze.cn',    // 固定值
    iat: now,              // 签发时间
    exp: now + 3600,       // 1小时后过期
    jti: `${now}-${Math.random().toString(36).slice(2)}`, // 唯一标识
  };

  const token = jwt.sign(payload, PRIVATE_KEY, {
    algorithm: 'RS256',
    header: {
      alg: 'RS256',
      typ: 'JWT',
      kid: KEY_ID,         // 公钥指纹
    },
  });

  return token;
}

/**
 * 用 JWT 换取 access_token
 */
async function getAccessToken(): Promise<{ access_token: string; expires_in: number }> {
  // 检查缓存是否有效（提前 5 分钟刷新）
  if (cachedToken && cachedToken.expiresAt > Date.now() + 5 * 60 * 1000) {
    return { access_token: cachedToken.token, expires_in: Math.floor((cachedToken.expiresAt - Date.now()) / 1000) };
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
      duration_seconds: 86399, // 约 24 小时
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get access token: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  
  if (!data.access_token) {
    throw new Error(`Invalid response: ${JSON.stringify(data)}`);
  }

  // 缓存 token
  const expiresIn = data.expires_in || 86399;
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + expiresIn * 1000,
  };

  return { access_token: data.access_token, expires_in: expiresIn };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS 处理
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // 验证环境变量
  if (!APP_ID || !KEY_ID || !PRIVATE_KEY) {
    return res.status(500).json({
      error: 'Missing JWT configuration',
      details: {
        hasAppId: !!APP_ID,
        hasKeyId: !!KEY_ID,
        hasPrivateKey: !!PRIVATE_KEY,
      },
    });
  }

  try {
    const { access_token, expires_in } = await getAccessToken();
    return res.status(200).json({ access_token, expires_in });
  } catch (error) {
    console.error('Error getting access token:', error);
    return res.status(500).json({
      error: 'Failed to get access token',
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
