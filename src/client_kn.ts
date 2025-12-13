/**
 * Coze 聊天客户端 - 代理模式
 * 
 * 所有请求通过后端代理，Token 不暴露给前端
 */

const STREAM_PROXY_URL = '/api/coze-stream';
const userId = import.meta.env.VITE_COZE_USER_ID || 'web-user';

/**
 * 解析 SSE 事件
 */
function parseSSEEvent(line: string): { event?: string; data?: any } | null {
  if (!line.trim() || line.startsWith(':')) return null;
  
  if (line.startsWith('event:')) {
    return { event: line.slice(6).trim() };
  }
  
  if (line.startsWith('data:')) {
    const dataStr = line.slice(5).trim();
    if (!dataStr || dataStr === '[DONE]') return null;
    try {
      return { data: JSON.parse(dataStr) };
    } catch {
      return { data: dataStr };
    }
  }
  
  return null;
}

/**
 * 流式提问（通过代理）
 */
export async function streamQuestion(
  question: string
): Promise<AsyncGenerator<string, void, unknown>> {
  const q = typeof question === 'string' ? question.trim() : '';
  if (!q) throw new Error('Question is required');

  const response = await fetch(STREAM_PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: q, user_id: userId }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const streamReader = reader; // 确保类型安全

  async function* processStream(): AsyncGenerator<string, void, unknown> {
    const decoder = new TextDecoder();
    let buffer = '';
    let currentEvent = '';

    try {
      while (true) {
        const { done, value } = await streamReader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const parsed = parseSSEEvent(line);
          if (!parsed) continue;

          if (parsed.event) {
            currentEvent = parsed.event;
          }

          if (parsed.data && currentEvent === 'conversation.message.completed') {
            const content = parsed.data?.content;
            const contentType = parsed.data?.content_type;
            const msgType = parsed.data?.type;
            
            // 只处理 answer 类型的文本消息
            if (contentType === 'text' && content && msgType === 'answer') {
              let text = content;
              
              // 处理 JSON 格式的内容
              if (typeof content === 'string' && content.trim().startsWith('{')) {
                try {
                  const obj = JSON.parse(content);
                  // 过滤非内容事件
                  if (obj?.msg_type === 'generate_answer_finish' || 
                      obj?.msg_type === 'knowledge_recall' || 
                      obj?.msg_type === 'event' ||
                      obj?.msg_type === 'verbose') {
                    continue;
                  }
                  // 提取实际内容
                  if (obj?.msg_type === 'answer' && typeof obj?.content === 'string') {
                    text = obj.content;
                  } else if (typeof obj?.content === 'string') {
                    text = obj.content;
                  }
                } catch {
                  // 使用原始内容
                }
              }

              // 再次检查是否为系统事件消息
              if (text && typeof text === 'string') {
                const trimmed = text.trim();
                // 过滤掉系统事件 JSON
                if (trimmed.startsWith('{') && trimmed.includes('msg_type')) {
                  try {
                    const check = JSON.parse(trimmed);
                    if (check?.msg_type && check.msg_type !== 'answer') {
                      continue;
                    }
                  } catch {
                    // 不是 JSON，继续处理
                  }
                }
                if (trimmed && !trimmed.includes('"msg_type":"generate_answer_finish"')) {
                  yield trimmed;
                }
              }
            }
          }
        }
      }
    } finally {
      streamReader.releaseLock();
    }
  }

  return processStream();
}

export { userId };
