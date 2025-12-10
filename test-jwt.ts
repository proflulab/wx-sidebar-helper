/**
 * 测试 JWT Token 获取
 */
import jwt from 'jsonwebtoken';
import 'dotenv/config';

const APP_ID = process.env.COZE_JWT_APP_ID || '';
const KEY_ID = process.env.COZE_JWT_KEY_ID || '';
const PRIVATE_KEY = (process.env.COZE_JWT_PRIVATE_KEY || '').replace(/\\n/g, '\n');
const API_BASE = process.env.VITE_COZE_API_BASE_URL || 'https://api.coze.cn';

console.log('=== JWT 配置检查 ===');
console.log('APP_ID:', APP_ID ? `${APP_ID.slice(0, 6)}...` : '❌ 未设置');
console.log('KEY_ID:', KEY_ID ? `${KEY_ID.slice(0, 10)}...` : '❌ 未设置');
console.log('PRIVATE_KEY:', PRIVATE_KEY ? `${PRIVATE_KEY.slice(0, 50)}...` : '❌ 未设置');
console.log('API_BASE:', API_BASE);

if (!APP_ID || !KEY_ID || !PRIVATE_KEY) {
  console.error('\n❌ 缺少必要的 JWT 配置');
  process.exit(1);
}

// 生成 JWT
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

async function testToken() {
  console.log('\n=== 生成 JWT ===');
  const jwtToken = generateJWT();
  console.log('JWT Token:', jwtToken.slice(0, 50) + '...');

  console.log('\n=== 请求 OAuth Token ===');
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

  console.log('Response Status:', response.status);
  const data = await response.json();
  console.log('Response:', JSON.stringify(data, null, 2));

  if (data.access_token) {
    console.log('\n✅ Token 获取成功!');
    console.log('Access Token:', data.access_token.slice(0, 30) + '...');
    console.log('Expires In:', data.expires_in, '秒');
  } else {
    console.log('\n❌ Token 获取失败');
  }
}

testToken().catch(console.error);
