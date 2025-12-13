/**
 * Coze API 客户端 - 代理模式
 * 
 * 所有请求通过后端代理，Token 不暴露给前端
 */

const CHAT_PROXY_URL = '/api/coze-chat';
const userId = import.meta.env.VITE_COZE_USER_ID || 'web-user';

interface ChatResponse {
  data?: {
    id: string;
    conversation_id: string;
    status: string;
  };
  messages?: Array<{
    role: string;
    content: string;
    content_type: string;
  }>;
  error?: string;
}

/**
 * 通过代理发送聊天消息（非流式）
 */
export async function sendMessage(message: string): Promise<string> {
  const response = await fetch(CHAT_PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, user_id: userId }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  const data: ChatResponse = await response.json();
  
  // 提取助手回复
  const assistantMessage = data.messages?.find(m => m.role === 'assistant' && m.content_type === 'text');
  return assistantMessage?.content || '暂无回答';
}

export { userId };
