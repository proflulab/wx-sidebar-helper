// 浏览器封装：导出 streamQuestion(question)，供页面调用
import { RoleType, ChatEventType } from '@coze/api';
import { client, botId, userId } from './client';

export async function streamQuestion(
  question: string,
  options: Record<string, unknown> = {}
): Promise<AsyncGenerator<string, void, unknown>> {
  const q = typeof question === 'string' ? question.trim() : '';
  if (!q) throw new Error('Question is required');
  const stream: AsyncIterable<any> = await client.chat.stream({
    bot_id: botId,
    user_id: userId,
    additional_messages: [
      {
        role: RoleType.User,
        content: q,
        content_type: 'text',
        type: 'question',
      },
    ],
    ...options,
  });

  async function sendCompletedLog(text: string): Promise<void> {
    try {
      // 优先使用 sendBeacon，避免浏览器因页面更新或空响应而取消请求
      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        const blob = new Blob([JSON.stringify({ text })], { type: 'application/json' });
        navigator.sendBeacon('/__coze_log', blob);
        return;
      }
      // 回退到常规 fetch（不使用 keepalive）
      await fetch('/__coze_log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
    } catch {
      // 忽略网络/日志错误
      void 0;
    }
  }

  // 仅传递“消息完成”中的纯文本答案；忽略知识回溯等非文本内容
  async function* onlyCompletedText(): AsyncGenerator<string, void, unknown> {
    for await (const evt of stream) {
      if (evt?.event !== ChatEventType.CONVERSATION_MESSAGE_COMPLETED) continue;
      const type = evt?.data?.content_type;
      const raw = evt?.data?.content;
      let text = '';

      const rawStr = typeof raw === 'string' ? raw.trim() : '';
      // 优先识别 JSON：仅当 msg_type === 'answer' 时采纳
      if (rawStr && rawStr.startsWith('{')) {
        try {
          const obj = JSON.parse(rawStr);
          if (obj?.msg_type === 'answer' && typeof obj?.content === 'string') {
            text = obj.content;
          }
        } catch {
          // ignore malformed JSON; ensure block is non-empty for lint
          void 0;
        }
      } else if (type === 'text' && rawStr) {
        // 非 JSON 的纯文本内容直接使用
        text = rawStr;
      }

      if (text && text.trim()) {
        // 将完成消息发送到终端日志端点
        sendCompletedLog(text);
        yield text;
      }
    }
  }
  return onlyCompletedText();
}