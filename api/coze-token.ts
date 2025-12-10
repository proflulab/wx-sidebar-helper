/**
 * Vercel Serverless Function: 生成 Coze JWT OAuth Token
 * 
 * 根据扣子 OAuth JWT 授权文档实现：
 * 1. 使用私钥签名生成 JWT
 * 2. 调用 Coze OAuth 接口获取 access_token
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
 * 生成用于 OAuth 的 JWT
 */
function generateJWT(): string {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: APP_ID,        // 应用 ID
    aud: 'api.coze.cn', // 固定值
    iat: now,           // 签发时间
    exp: now + 3600,    // 过期时间（1小时）
    jti: `${now}-${Math.random().toString(36).slice(2)}`, // 唯一标识
  };

  return jwt.sign(payload, PRIVATE_KEY, {
    algorithm: 'RS256',
    header: {
      alg: 'RS256',
      typ: 'JWT',
      kid: KEY_ID,
    },
  });
}

/**
 * 调用 Coze OAuth 接口获取 access_token
 */
async function getAccessToken(): Promise<{ access_token: string; expires_in: number }> {
  // 检查缓存是否有效（提前 60 秒刷新）
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60000) {
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
      duration_seconds: 86400, // 24小时有效期
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Coze OAuth error:', response.status, errorText);
    throw new Error(`OAuth failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  
  if (data.access_token) {
    // 缓存 token
    cachedToken = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in || 86400) * 1000,
    };
    return { access_token: data.access_token, expires_in: data.expires_in || 86400 };
  }

  throw new Error(`Invalid OAuth response: ${JSON.stringify(data)}`);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 设置 CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // 验证环境变量
    if (!APP_ID || !KEY_ID || !PRIVATE_KEY) {
      return res.status(500).json({ 
        error: 'Missing JWT configuration',
        details: {
          hasAppId: !!APP_ID,
          hasKeyId: !!KEY_ID,
          hasPrivateKey: !!PRIVATE_KEY,
        }
      });
    }

    const tokenData = await getAccessToken();
    return res.status(200).json(tokenData);
  } catch (error) {
    console.error('Token generation error:', error);
    return res.status(500).json({ 
      error: 'Failed to generate token',
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
