import { useState, useRef, useEffect, Fragment } from "react";
import loadingIconUrl from "./assets/loading.png";
import type { KeyboardEvent, ChangeEvent, SyntheticEvent } from "react";
import styled, { keyframes } from "styled-components";
import { CopyOutlined, ReloadOutlined } from "@ant-design/icons";
import { streamQuestion as streamCozeQuestion } from "./client_kn";
import { streamQuestion as streamDoubaoQuestion } from "./client_doubao";
import { buildMeetingNotice } from "./meetingNotice";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import doubaoCorpus from "./assets/resources/doubao-corpus.md?raw";

// 样式组件
const Container = styled.div`
  width: 360px;
  height: 100vh;
  padding: 12px;
  /* 禁用外层滚动，仅内部区域滚动 */
  overflow: hidden;
  background: #ffffff;
  border-radius: 14px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
    "Helvetica Neue", Arial;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  border: 1px solid #eef2f6;
  display: flex;
  flex-direction: column;
`;

// 顶部标签栏（仿 Bing：Chat / Meeting / History）
const TopBar = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  height: 40px;
  padding: 4px 8px 10px;
  border-bottom: 1px solid #eef2f6;
  margin-bottom: 10px;
`;

// 顶部栏右侧区域与刷新按钮样式
const FlexSpacer = styled.div`
  flex: 1;
`;

const RefreshButton = styled.button`
  border: none;
  background: transparent;
  cursor: pointer;
  padding: 6px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #8a9aa9;

  &:hover {
    background: #f4f7fb;
    color: #5b6b7a;
  }
`;

const RefreshIcon = styled(ReloadOutlined)`
  font-size: 18px;
`;

const Tab = styled.button<{ $active?: boolean }>`
  border: none;
  background: transparent;
  font-size: 13px;
  color: ${({ $active }) => ($active ? "#0b57d0" : "#5b6b7a")};
  font-weight: ${({ $active }) => ($active ? 600 : 500)};
  padding: 7px 8px;
  border-radius: 6px;
  cursor: pointer;
  position: relative;

  &:hover {
    background: #f4f7fb;
  }

  &::after {
    content: "";
    position: absolute;
    left: 10px;
    right: 10px;
    bottom: 0;
    height: 2px;
    background: ${({ $active }) => ($active ? "#0b57d0" : "transparent")};
    border-radius: 2px;
  }
`;

const ProviderToggle = styled.label<{ $disabled?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  border-radius: 999px;
  position: relative;
  cursor: ${({ $disabled }) => ($disabled ? "not-allowed" : "pointer")};
  opacity: ${({ $disabled }) => ($disabled ? 0.6 : 1)};
  user-select: none;
`;

const ToggleLabel = styled.span<{ $active?: boolean }>`
  font-size: 12px;
  font-weight: ${({ $active }) => ($active ? 600 : 500)};
  color: ${({ $active }) => ($active ? "#0b57d0" : "#8a9aa9")};
`;

const ToggleInput = styled.input`
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
  pointer-events: none;

  &:checked + span {
    background: #0b57d0;
  }

  &:checked + span::after {
    transform: translateX(16px);
  }
`;

const ToggleTrack = styled.span`
  width: 34px;
  height: 18px;
  background: #d7dde3;
  border-radius: 999px;
  position: relative;
  transition: background 0.2s ease;

  &::after {
    content: "";
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #ffffff;
    position: absolute;
    top: 2px;
    left: 2px;
    transition: transform 0.2s ease;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  }
`;

const InputContainer = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  align-items: flex-start;
  /* 移除内嵌 Enter 图标的定位上下文 */
  /* 底部粘性，始终可见 */
  position: sticky;
  bottom: 0;
  z-index: 2;
  background: #ffffff;
`;

const QuestionInput = styled.textarea`
  flex: 1;
  padding: 10px 16px;
  border: 1px solid #e6e6e6;
  border-radius: 8px;
  font-size: 14px;
  background: white;
  color: #333; /* 显式设置文字颜色，避免白底白字不可见 */
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.03);
  transition: all 0.3s ease;
  min-height: 42px;
  max-height: 126px; /* 5行文本的最大高度：14px * 1.5 * 5 + 10px * 2 = 126px */
  resize: none;
  line-height: 1.5;
  font-family: inherit;
  display: block;
  margin: 0;
  overflow-y: auto;

  /* 自定义滚动条样式 */
  &::-webkit-scrollbar {
    width: 4px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: #ccc;
    border-radius: 2px;
  }

  &::-webkit-scrollbar-thumb:hover {
    background: #999;
  }

  &::placeholder {
    color: #334155; /* 与 HeroCardText 保持一致 */
    font-size: 13px; /* 与卡片文字同尺寸 */
    font-weight: 400;
  }

  &:focus {
    outline: none;
    border-color: #1890ff;
    box-shadow: 0 2px 8px rgba(24, 144, 255, 0.1);
  }
`;

const MeetingForm = styled.div`
  display: grid;
  gap: 8px;
  margin-bottom: 12px;
  max-height: 42vh;
  overflow-y: auto;
  padding-right: 4px;
  margin-right: -4px;

  &::-webkit-scrollbar {
    width: 4px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: #ccc;
    border-radius: 2px;
  }

  &::-webkit-scrollbar-thumb:hover {
    background: #999;
  }
`;

const MeetingField = styled.label`
  display: grid;
  gap: 6px;
  font-size: 12px;
  color: #6b7280;
`;

const MeetingInput = styled.input`
  width: 100%;
  padding: 9px 12px;
  border: 1px solid #e6e6e6;
  border-radius: 8px;
  font-size: 14px;
  background: white;
  color: #333;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.03);
  transition: all 0.3s ease;
  line-height: 1.4;
  font-family: inherit;

  &:focus {
    outline: none;
    border-color: #1890ff;
    box-shadow: 0 2px 8px rgba(24, 144, 255, 0.1);
  }
`;

const MeetingPaste = styled.textarea`
  width: 100%;
  padding: 9px 12px;
  border: 1px dashed #d7dde3;
  border-radius: 8px;
  font-size: 13px;
  background: #f8fafc;
  color: #333;
  line-height: 1.5;
  font-family: inherit;
  resize: vertical;
  min-height: 76px;

  &:focus {
    outline: none;
    border-color: #1890ff;
    box-shadow: 0 2px 8px rgba(24, 144, 255, 0.08);
    background: #ffffff;
  }
`;

const MeetingHint = styled.div`
  font-size: 12px;
  color: #8a9aa9;
  margin-top: 2px;
`;

const MeetingGroup = styled.div`
  border: 1px solid #eef2f6;
  border-radius: 10px;
  padding: 10px;
  background: #fbfdff;
  display: grid;
  gap: 8px;
`;

const MeetingGroupTitle = styled.div`
  font-size: 12px;
  font-weight: 600;
  color: #3b4a59;
`;

const MeetingRow = styled.div`
  display: grid;
  grid-template-columns: 1.2fr 0.8fr;
  gap: 8px;
`;

const MeetingActions = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 4px;
`;

// 与 Hero 区右侧链接（Try it）一致的样式，用于发送
const SendLink = styled.a`
  color: #0b57d0;
  text-decoration: none;
  font-weight: 600;
  align-self: center;
  white-space: nowrap;

  &:hover { text-decoration: underline; }
`;

/* 删除 EnterOverlay 内嵌提示样式 */


const AnswersContainer = styled.div`
  max-height: calc(100vh - 120px);
  overflow-y: auto;
  padding-right: 4px;
  margin-right: -4px;
  /* 填充剩余空间，让输入区保持在底部 */
  flex: 1 1 auto;

  /* 自定义滚动条样式 */
  &::-webkit-scrollbar {
    width: 4px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: #ccc;
    border-radius: 2px;
  }

  &::-webkit-scrollbar-thumb:hover {
    background: #999;
  }
`;

const AnswerItem = styled.div`
  background: linear-gradient(180deg, #fbfdff 0%, #ffffff 100%);
  padding: 14px 16px;
  margin-bottom: 12px;
  border-radius: 12px;
  border: 1px solid #e8eef7;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  cursor: pointer;
  transition: all 0.25s ease;
  box-shadow: 0 2px 10px rgba(245, 196, 83, 0.05);
  border-left: 3px solid #F4D06F; /* 柔和金黄 */

  &:hover {
    border-color: #fde68a; /* 浅金黄边框 */
    box-shadow: 0 6px 16px rgba(245, 196, 83, 0.18);
    transform: translateY(-1px);
    background: linear-gradient(180deg, #fff7e6 0%, #ffffff 100%); /* 悬停渐变改为暖金黄 */
  }

  .answer-text {
    color: #1f2937;
    font-size: 14px;
    line-height: 1.7;
    flex: 1;
    margin-right: 16px;
    padding: 2px 0;
    word-break: break-word;
    white-space: normal;

    h1, h2, h3 {
      color: #0f172a;
      font-weight: 600;
      margin: 8px 0 6px;
      line-height: 1.3;
    }
    h1 { font-size: 16px; }
    h2 { font-size: 15px; }
    h3 { font-size: 14px; }

    p { margin: 6px 0; }

    ul, ol { margin: 6px 0 6px 18px; }
    li { margin: 4px 0; }

    a {
      color: #0b57d0;
      text-decoration: none;
    }
    a:hover { text-decoration: underline; }

    code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      background: #f3f5f7;
      border: 1px solid #e6e8eb;
      border-radius: 6px;
      padding: 0 4px;
      font-size: 13px;
      color: #0f172a;
    }
    pre {
      background: #0f172a;
      color: #e6edf3;
      border-radius: 10px;
      padding: 10px 12px;
      overflow: auto;
      border: 1px solid #0b1b35;
    }
    pre code {
      background: transparent;
      border: none;
      color: inherit;
      padding: 0;
      font-size: 13px;
    }

    blockquote {
      background: #f8fafc;
      border-left: 3px solid #e0e7ff;
      color: #334155;
      margin: 8px 0;
      padding: 6px 10px;
      border-radius: 6px;
    }
    hr {
      border: none;
      border-top: 1px dashed #e5e7eb;
      margin: 10px 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 8px 0;
    }
    th, td {
      border: 1px solid #e5e7eb;
      padding: 6px 8px;
      text-align: left;
    }
    th {
      background: #f3f6fb;
      color: #0f172a;
    }

    /* 使 Markdown 图片适应侧栏宽度 */
    img {
      max-width: 100%;
      height: auto;
      display: block;
      margin: 8px 0;
      border-radius: 6px;
    }
  }

  .icon-wrapper {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    transition: all 0.2s ease;
    margin-top: 2px;
    cursor: pointer;
    background: #f5fbff;
    border: 1px solid #e6f4ff;
    box-shadow: 0 1px 2px rgba(11, 87, 208, 0.06);

    &:hover {
      background: #e6f4ff;
      box-shadow: 0 2px 6px rgba(11, 87, 208, 0.12);
      transform: translateY(-1px);
    }
  }
`;

// 第二回答加载提示样式（显示在第一个回答下方）
const LoadingNotice = styled.div`
  color: #68707a;
  font-size: 13px;
  margin: -6px 0 10px 0;
  padding-left: 2px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
`;

const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

const LoadingIcon = styled.img`
  width: 20px;
  height: 20px;
  object-fit: contain;
  opacity: 0.85;
  animation: ${spin} 1.2s linear infinite;
  transform-origin: center;
`;

const SendIcon = styled(CopyOutlined)`
  color: #1890ff;
  font-size: 16px;
  opacity: 0.8;
  transition: all 0.3s ease;
  flex-shrink: 0;

  &:hover {
    opacity: 1;
  }
`;

// 推荐问题模块样式
const SuggestionsContainer = styled.div`
  background: white;
  padding: 12px 16px;
  margin-bottom: 12px;
  border-radius: 8px;
  border: 1px solid #f0f0f0;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.03);
`;

const SectionTitle = styled.div`
  font-size: 14px;
  color: #666;
  margin-bottom: 8px;
`;

const SuggestionList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const SuggestionCard = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: linear-gradient(180deg, #fbfdff 0%, #ffffff 100%);
  border: 1px solid #e8eef7;
  border-radius: 10px;
  padding: 10px 12px;
  cursor: pointer;
  transition: all 0.25s ease;
  box-shadow: 0 2px 8px rgba(11, 87, 208, 0.06);

  &:hover {
    background: linear-gradient(180deg, #f7faff 0%, #ffffff 100%);
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(11, 87, 208, 0.12);
  }
`;

const SuggestionText = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #1f2937;
`;

const CorpusContainer = styled.div`
  background: #ffffff;
  padding: 12px 16px;
  margin-bottom: 12px;
  border-radius: 10px;
  border: 1px dashed #d8e1ee;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.03);
`;

const CorpusFields = styled.div`
  display: grid;
  gap: 8px;
`;

const CorpusField = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const CorpusLabel = styled.label`
  font-size: 12px;
  color: #6b7280;
`;

const CorpusInput = styled.input`
  padding: 8px 12px;
  border: 1px solid #e6e6e6;
  border-radius: 8px;
  font-size: 13px;
  background: white;
  color: #1f2937;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.03);
  transition: all 0.2s ease;

  &:focus {
    outline: none;
    border-color: #1890ff;
    box-shadow: 0 2px 8px rgba(24, 144, 255, 0.1);
  }
`;

const CorpusTextarea = styled.textarea`
  padding: 8px 12px;
  border: 1px solid #e6e6e6;
  border-radius: 8px;
  font-size: 13px;
  background: white;
  color: #1f2937;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.03);
  transition: all 0.2s ease;
  min-height: 84px;
  resize: vertical;
  line-height: 1.5;
  font-family: inherit;

  &:focus {
    outline: none;
    border-color: #1890ff;
    box-shadow: 0 2px 8px rgba(24, 144, 255, 0.1);
  }
`;

const CorpusActions = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 8px;
`;

const CorpusHint = styled.div`
  font-size: 12px;
  color: #7a8794;
`;

const CorpusButton = styled.button`
  border: none;
  background: #0b57d0;
  color: #ffffff;
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: #0a4bb8;
  }

  &:disabled {
    background: #c7d2e0;
    cursor: not-allowed;
  }
`;

const CorpusStatus = styled.div<{ $error?: boolean }>`
  margin-top: 6px;
  font-size: 12px;
  color: ${({ $error }) => ($error ? "#d14343" : "#1b7a4b")};
`;

// 欢迎区与功能卡片（仿图示布局）

const Emoji = styled.span`
  font-size: 18px;
`;


// 历史记录样式
const HistoryContainer = styled.div`
  background: white;
  padding: 12px 16px;
  border-radius: 8px;
  border: 1px solid #f0f0f0;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.03);
`;

const HistoryTitle = styled.div`
  font-size: 14px;
  color: #666;
  margin-bottom: 8px;
`;

const HistoryList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const HistoryItem = styled.div`
  display: flex;
  align-items: center;
  background: #fafafa;
  border: 1px solid #eeeeee;
  border-radius: 10px;
  padding: 8px 10px;
  font-size: 13px;
  color: #1f2937;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: #f5f8fc;
    transform: translateY(-1px);
  }
`;

const HistoryEmpty = styled.div`
  font-size: 13px;
  color: #8a9aa9;
`;

// 流式输出：使用 Coze API 的 stream 接口逐步渲染回答
// 在 handleConfirm 中驱动状态更新以实现增量显示
// 兼容不同事件结构并增强错误可观测性
const extractAssistantText = (event: any): string | null => {
  // 若封装直接返回字符串（仅完成的纯文本），直接使用
  if (typeof event === "string") {
    return event;
  }

  // 优先解析官方流事件形态：evt.data.content
  if (event && typeof event === "object") {
    const content = event?.data?.content;
    if (typeof content === "string" && content.length) {
      // 排除明显是知识回溯/事件的 JSON 内容
      if (content.trim().startsWith("{")) {
        try {
          const obj = JSON.parse(content);
          if (obj?.msg_type === "knowledge_recall" || obj?.msg_type === "event") {
            return null;
          }
          if (typeof obj?.content === "string") return obj.content;
        } catch {
          // 非 JSON 字符串，按原文使用
        }
      }
      return content;
    }
  }

  const msg = event?.message || event;
  if (!msg) return null;

  const role = msg.role;
  const type = msg.content_type;
  let raw = msg.content || "";

  if (typeof raw === "string" && raw.trim().startsWith("{")) {
    try {
      const obj = JSON.parse(raw);
      if (obj && typeof obj === "object") {
        // 过滤事件完成类消息
        if (
          obj.msg_type === "generate_answer_finish" ||
          obj.msg_type === "event" ||
          obj.msg_type === "knowledge_recall"
        ) {
          return null;
        }
        // 若包含真实文本内容
        if (obj.content && typeof obj.content === "string") {
          raw = obj.content;
        }
      }
    } catch {
      // 非 JSON，按原文处理
    }
  }

  if (role === "assistant" && type === "text" && raw) {
    return raw;
  }
  return null;
};

// 识别是否为推荐问题：单段文本且以问号结尾
const isRecommendedQuestion = (text: string): boolean => {
  const t = (text || "").trim();
  if (!t) return false;
  const paragraphs = t.split(/\n{2,}/).filter((p) => p.trim().length > 0);
  const endsWithQuestion = /[?？]$/.test(t);
  return endsWithQuestion && paragraphs.length < 2;
};

// 清理知识回溯/来源标记
// 覆盖：^^[recall slice ...]、^^(recall slice ...)、^^（recall slice ...）、以及“答案来自知识库 ^^”变体
const cleanRecallSuffix = (text: string): string => {
  if (!text || typeof text !== "string") return text || "";
  let t = text;
  // 全局移除，不仅限结尾
  t = t.replace(/\s*\^{2}\s*\[[^\]]*recall\s*slice[^\]]*\]\s*/gi, ""); // 方括号
  t = t.replace(/\s*\^{2}\s*\([^)]*recall\s*slice[^)]*\)\s*/gi, "");    // 英文圆括号
  t = t.replace(/\s*\^{2}\s*（[^）]*recall\s*slice[^）]*）\s*/gi, "");     // 中文圆括号
  // 清理来源提示语（中英文）
  t = t.replace(/\s*答案来自知识库\s*\^{2}\s*/gi, "");
  t = t.replace(/\s*来源于知识库\s*\^{2}\s*/gi, "");
  t = t.replace(/\s*Answer\s*from\s*knowledge\s*base\s*\^{2}\s*/gi, "");
  // 清理零散的 ^^ 标记
  t = t.replace(/\s*\^{2}\s*/g, " ");
  return t.trim();
};

// 为推荐问题提供不重复的灵动表情符号（新批次）
const emojiPool = [
  "🔎", "🚀", "📚", "🧪", "🎯", "💬", "🧭", "🧩", "📈", "🛠️",
  "🌟", "🗣️", "🪄", "🖼️", "🎧", "🛰️", "🗺️", "🔬", "✏️", "📖",
  "💡", "📝", "🧠", "🎨", "🧮", "🔧", "🔮", "🧵", "🌀", "🪙"
];
// 推荐问题前三项使用与 Hero 卡片一致的图标
const heroEmojis: string[] = ["🧠", "🎨", "✍️"];
const getSuggestionEmoji = (index: number): string => {
  if (index >= 0 && index < heroEmojis.length) return heroEmojis[index];
  return emojiPool[index] ?? "🪄";
};

// 构建两种提示语
const buildShortPrompt = (q: string): string => `${q}（3句话以内）`;
const buildLongPrompt = (q: string): string => `${q}（详细回答）`;
const normalizePromptText = (value: string): string => value.replace(/\r\n/g, "\n");
const mergePromptParts = (prefix: string, input: string): string => {
  const left = normalizePromptText(prefix).replace(/\n+$/g, "");
  const right = normalizePromptText(input).replace(/^\n+/g, "");
  if (!left) return right;
  if (!right) return left;
  return `${left}\n${right}`;
};
const buildDoubaoPrompt = (q: string): string => mergePromptParts(doubaoCorpus, q);
const buildDoubaoShortPrompt = (q: string): string => buildDoubaoPrompt(buildShortPrompt(q));
const buildDoubaoLongPrompt = (q: string): string => buildDoubaoPrompt(buildLongPrompt(q));

// 统一规范化错误为可打印字符串
const getErrorMessage = (error: unknown): string => {
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const anyErr = error as { response?: { data?: unknown }; message?: string };
    const detail = anyErr.response?.data ?? anyErr.message ?? String(error);
    return typeof detail === "string" ? detail : JSON.stringify(detail);
  }
  return String(error);
};

type MeetingFormState = {
  link1: string;
  id1: string;
  topic1: string;
  link2: string;
  id2: string;
  topic2: string;
};

function App() {
  const [activeTab, setActiveTab] = useState<"Chat" | "Meeting" | "History">("Chat");
  const [useCoze, setUseCoze] = useState<boolean>(false);
  const [question, setQuestion] = useState<string>("");
  const [answers, setAnswers] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [doubaoEntry, setDoubaoEntry] = useState<{ question: string; answer: string }>({
    question: "",
    answer: "",
  });
  const [doubaoSaving, setDoubaoSaving] = useState<boolean>(false);
  const [doubaoStatus, setDoubaoStatus] = useState<string>("");
  const [doubaoError, setDoubaoError] = useState<string>("");
  const [history, setHistory] = useState<string[]>([]);
  const [, setHasConfirmed] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLoadingFirst, setIsLoadingFirst] = useState<boolean>(false);
  const [isLoadingSecond, setIsLoadingSecond] = useState<boolean>(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const chatSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const meetingBuildTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasChunkRef = useRef<boolean>(false);
  const [meetingForm, setMeetingForm] = useState<MeetingFormState>({
    link1: "",
    id1: "",
    topic1: "",
    link2: "",
    id2: "",
    topic2: "",
  });
  const [meetingPaste, setMeetingPaste] = useState<string>("");
  const [meetingResponse, setMeetingResponse] = useState<string>("");
  const [meetingLoading, setMeetingLoading] = useState<boolean>(false);
  const [meetingError, setMeetingError] = useState<string>("");

  const adjustTextareaHeight = (textarea: HTMLTextAreaElement | null): void => {
    if (textarea) {
      textarea.style.height = "auto";
      const newHeight = Math.min(Math.max(42, textarea.scrollHeight), 126);
      textarea.style.height = `${newHeight}px`;
    }
  };

  useEffect(() => {
    adjustTextareaHeight(textareaRef.current);
  }, [question]);

  const requestCozeSuggestions = async (prompt: string): Promise<void> => {
    try {
      const stream = await streamCozeQuestion(prompt);
      for await (const evt of stream) {
        const chunk = extractAssistantText(evt);
        if (!chunk) continue;
        const cleaned = cleanRecallSuffix(chunk);
        if (!cleaned) continue;
        if (isRecommendedQuestion(cleaned)) {
          setSuggestions((prev) => (prev.includes(cleaned) ? prev : [...prev, cleaned]));
        }
      }
    } catch (error) {
      const detail = getErrorMessage(error);
      console.warn("Failed to fetch Coze suggestions:", detail);
    }
  };

  const handleConfirm = async (): Promise<void> => {
    if (question.trim() && !isLoading) {
      // 发送前把问题缓存到历史（去重，最多10条）
      const q = question.trim();
      queueChatSave(question);
      setHistory((prev) => {
        const next = [q, ...prev.filter((it) => it !== q)];
        return next.slice(0, 10);
      });
      setQuestion("");
      setIsLoading(true);
      setIsLoadingFirst(true);
      setIsLoadingSecond(false);
      // 新问题开始时清空旧内容
      setAnswers([]);
      setSuggestions([]);
      hasChunkRef.current = false;

      // 每条 completed 消息独立展示，不再使用占位拼接

      try {
        if (useCoze) {
          // 第一次请求：短答（3句话以内）
          const shortPrompt = buildShortPrompt(q);
          const stream = await streamCozeQuestion(shortPrompt);
          let longStarted = false;
          let longPromise: Promise<void> | null = null;

          // 超时保护：若 25s 内无片段到达，提示失败
          const timeoutId = setTimeout(() => {
            if (!hasChunkRef.current) {
              setAnswers((prev) => [...prev, "Timeout: no response from bot"]);
              setIsLoading(false);
            }
          }, 25000);

          // 逐步消费流事件，拼接助手的文本片段
          for await (const evt of stream) {
            // 调试输出，便于定位事件结构
            // eslint-disable-next-line no-console
            console.debug("Coze stream event:", evt);
            const chunk = extractAssistantText(evt);
            if (!chunk) continue;
            const cleanedChunk = cleanRecallSuffix(chunk);
            if (!cleanedChunk) continue;
            hasChunkRef.current = true;
            // 分类：推荐问题（一句话） vs 正常回答
            if (isRecommendedQuestion(cleanedChunk)) {
              setSuggestions((prev) => (prev.includes(cleanedChunk) ? prev : [...prev, cleanedChunk]));
            } else {
              // 每条 completed 消息追加一个独立的回答框
              setAnswers((prev) => [...prev, cleanedChunk]);
            }

            // 在首次短答片段显示后，触发第二次请求：详细回答（不采集推荐问题）
            if (!longStarted) {
              longStarted = true;
              setIsLoadingSecond(true);
              const longPrompt = buildLongPrompt(q);
              longPromise = (async () => {
                try {
                  const longStream = await streamCozeQuestion(longPrompt);
                  for await (const evt2 of longStream) {
                    const chunk2 = extractAssistantText(evt2);
                    if (!chunk2) continue;
                    hasChunkRef.current = true;
                    // 仅追加回答，不处理推荐问题；若为一句话推荐则忽略
                    const cleaned = cleanRecallSuffix(chunk2);
                    if (!cleaned.trim()) continue;
                    if (isRecommendedQuestion(cleaned)) {
                      continue;
                    }
                    setAnswers((prev) => [...prev, cleaned]);
                  }
                } catch (error) {
                  const detail = getErrorMessage(error);
                  console.error("Error calling Coze API (long):", detail);
                  setAnswers((prev) => [...prev, "Error: Failed to get detailed answer"]);
                } finally {
                  setIsLoadingSecond(false);
                }
              })();
            }
          }

          // 短答流结束，关闭第一个回答的加载提示
          setIsLoadingFirst(false);

          // 等待第二次请求结束后再取消加载态
          if (longPromise) {
            await longPromise;
          }
          clearTimeout(timeoutId);
        } else {
          void requestCozeSuggestions(buildShortPrompt(q));

          const shortPrompt = buildDoubaoShortPrompt(q);
          const shortStream = await streamDoubaoQuestion(shortPrompt);
          let shortStarted = false;
          let shortHasChunk = false;

          // 超时保护：若 25s 内无片段到达，提示失败
          const shortTimeoutId = setTimeout(() => {
            if (!shortHasChunk) {
              setAnswers((prev) => [...prev, "Timeout: no response from bot"]);
              setIsLoading(false);
            }
          }, 25000);

          for await (const chunk of shortStream) {
            if (!chunk) continue;
            shortHasChunk = true;
            hasChunkRef.current = true;
            if (!shortStarted) {
              shortStarted = true;
              setIsLoadingFirst(false);
              setAnswers((prev) => [...prev, chunk]);
              continue;
            }
            setAnswers((prev) => {
              if (prev.length === 0) return [chunk];
              const next = [...prev];
              next[next.length - 1] = `${next[next.length - 1] ?? ""}${chunk}`;
              return next;
            });
          }
          clearTimeout(shortTimeoutId);
          setIsLoadingFirst(false);

          setIsLoadingSecond(true);
          const longPrompt = buildDoubaoLongPrompt(q);
          const longStream = await streamDoubaoQuestion(longPrompt);
          let longStarted = false;
          let longHasChunk = false;

          const longTimeoutId = setTimeout(() => {
            if (!longHasChunk) {
              setAnswers((prev) => [...prev, "Timeout: no response from bot"]);
              setIsLoading(false);
            }
          }, 25000);

          for await (const chunk of longStream) {
            if (!chunk) continue;
            longHasChunk = true;
            hasChunkRef.current = true;
            if (!longStarted) {
              longStarted = true;
              setIsLoadingSecond(false);
              setAnswers((prev) => [...prev, chunk]);
              continue;
            }
            setAnswers((prev) => {
              if (prev.length === 0) return [chunk];
              const next = [...prev];
              next[next.length - 1] = `${next[next.length - 1] ?? ""}${chunk}`;
              return next;
            });
          }
          clearTimeout(longTimeoutId);
          setIsLoadingSecond(false);
        }
      } catch (error) {
        const detail = getErrorMessage(error);
        console.error("Error calling chat API:", detail);
        setAnswers((prev) => [...prev, "Error: Failed to get response from bot"]);
      } finally {
        setHasConfirmed(true);
        setIsLoading(false);
        setIsLoadingFirst(false);
        setIsLoadingSecond(false);
      }
    }
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleConfirm();
    }
  };

  const handleInput = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setQuestion(value);
    queueChatSave(value);
  };

  const saveChatInput = async (text: string): Promise<void> => {
    if (!text.trim()) return;
    try {
      await fetch("/api/chat-save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        keepalive: true,
      });
    } catch (error) {
      console.warn("Failed to save chat input:", error);
    }
  };

  const queueChatSave = (text: string): void => {
    if (!text.trim()) return;
    if (chatSaveTimerRef.current) {
      window.clearTimeout(chatSaveTimerRef.current);
    }
    chatSaveTimerRef.current = window.setTimeout(() => {
      chatSaveTimerRef.current = null;
      void saveChatInput(text);
    }, 400);
  };

  const canSubmitDoubaoEntry =
    doubaoEntry.question.trim().length > 0 && doubaoEntry.answer.trim().length > 0;

  const handleDoubaoEntryChange =
    (field: "question" | "answer") =>
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
      const value = e.target.value;
      setDoubaoEntry((prev) => ({ ...prev, [field]: value }));
      setDoubaoStatus("");
      setDoubaoError("");
    };

  const handleDoubaoEntrySubmit = async (): Promise<void> => {
    if (doubaoSaving) return;
    const questionText = doubaoEntry.question.replace(/\r\n/g, "\n").trim();
    const answerText = doubaoEntry.answer.replace(/\r\n/g, "\n").trim();
    if (!questionText || !answerText) {
      setDoubaoError("请填写问题与答案");
      return;
    }

    setDoubaoSaving(true);
    setDoubaoError("");
    setDoubaoStatus("");

    try {
      const res = await fetch("/api/doubao-corpus-add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: questionText, answer: answerText }),
      });
      let payload: { index?: number; error?: string } | null = null;
      try {
        payload = await res.json();
      } catch {
        payload = null;
      }
      if (!res.ok) {
        const detail = payload?.error ?? `HTTP ${res.status}`;
        throw new Error(detail);
      }
      const savedIndex = typeof payload?.index === "number" ? payload.index : null;
      setDoubaoStatus(savedIndex === null ? "已写入" : `已写入：${savedIndex}`);
      setDoubaoEntry({ question: "", answer: "" });
    } catch (error) {
      setDoubaoError(getErrorMessage(error));
    } finally {
      setDoubaoSaving(false);
    }
  };

  const extractMeetingPair = (line: string): [string, string] | null => {
    const urlMatch = line.match(/https?:\/\/\S+/);
    const idMatch = line.match(/\d[\d-]{6,}/);
    if (!urlMatch || !idMatch) return null;
    return [urlMatch[0], idMatch[0]];
  };

  const parseMeetingPaste = (raw: string): MeetingFormState | null => {
    const lines = raw
      .replace(/\r\n/g, "\n")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length >= 6) {
      const [link1, id1, topic1, link2, id2, topic2] = lines;
      return { link1, id1, topic1, link2, id2, topic2 };
    }
    if (lines.length >= 4) {
      const [link1, id1, link2, id2] = lines;
      return { link1, id1, topic1: "", link2, id2, topic2: "" };
    }
    if (lines.length === 2) {
      const first = extractMeetingPair(lines[0]);
      const second = extractMeetingPair(lines[1]);
      if (first && second) {
        const [link1, id1] = first;
        const [link2, id2] = second;
        return { link1, id1, topic1: "", link2, id2, topic2: "" };
      }
    }
    return null;
  };

  const buildMeetingNoticeFromForm = (form: MeetingFormState, silent = false): void => {
    const link1 = form.link1.trim();
    const id1 = form.id1.trim();
    const topic1 = form.topic1.trim();
    const link2 = form.link2.trim();
    const id2 = form.id2.trim();
    const topic2 = form.topic2.trim();
    if (!link1 || !id1 || !link2 || !id2) {
      if (!silent) {
        setMeetingError("请填写完整的会议链接与会议号");
      } else {
        setMeetingError("");
      }
      setMeetingResponse("");
      return;
    }
    setMeetingResponse(buildMeetingNotice({ link1, id1, topic1, link2, id2, topic2 }));
    setMeetingError("");
    setMeetingLoading(false);
  };

  const queueMeetingBuild = (form: MeetingFormState): void => {
    if (meetingBuildTimerRef.current) {
      window.clearTimeout(meetingBuildTimerRef.current);
    }
    meetingBuildTimerRef.current = window.setTimeout(() => {
      meetingBuildTimerRef.current = null;
      buildMeetingNoticeFromForm(form, true);
    }, 400);
  };

  const updateMeetingForm = (field: keyof MeetingFormState) => (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setMeetingForm((prev) => {
      const next = { ...prev, [field]: value };
      queueMeetingBuild(next);
      return next;
    });
    setMeetingError("");
  };

  const handleMeetingPaste = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setMeetingPaste(value);
    const parsed = parseMeetingPaste(value);
    if (parsed) {
      setMeetingForm(parsed);
      queueMeetingBuild(parsed);
      setMeetingError("");
    }
  };

  const handleMeetingFieldKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      buildMeetingNoticeFromForm(meetingForm, false);
    }
  };

  // 清空回答（刷新）
  const handleRefresh = (): void => {
    setAnswers([]);
  };

  const focusHeroInput = (e?: SyntheticEvent): void => {
    try {
      if (e && typeof (e as any).preventDefault === "function") {
        (e as any).preventDefault();
      }
    } catch {}
    const el = textareaRef.current;
    if (el) {
      el.focus();
      try {
        const len = (el.value || "").length;
        el.setSelectionRange(len, len);
      } catch {}
      try {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      } catch {}
    }
  };

  const copyTextToClipboard = async (text: string): Promise<void> => {
    if (!text || !text.trim()) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return;
      }
    } catch {
      // fallback below
    }
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.top = "-1000px";
      ta.style.left = "-1000px";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    } catch {
      // ignore
    }
  };

  const handleCopyIconClick = async (e: SyntheticEvent<HTMLDivElement>): Promise<void> => {
    try {
      const parent = e.currentTarget?.parentElement;
      const textEl = parent?.querySelector?.(".answer-text") as HTMLElement | null;
      const text = ((textEl?.innerText ?? textEl?.textContent) ?? "").trim();
      await copyTextToClipboard(text);
    } catch {
      // ignore copy error
    }
  };


  return (
    <Container>
      <TopBar>
        <Tab $active={activeTab === "Chat"} onClick={() => setActiveTab("Chat")}>Chat</Tab>
        <Tab $active={activeTab === "Meeting"} onClick={() => setActiveTab("Meeting")}>Meeting</Tab>
        <Tab $active={activeTab === "History"} onClick={() => setActiveTab("History")}>History</Tab>
        <FlexSpacer />
        {activeTab === "Chat" && (
          <ProviderToggle $disabled={isLoading} title="切换 Coze 或豆包">
            <ToggleLabel $active={!useCoze}>豆包</ToggleLabel>
            <ToggleInput
              type="checkbox"
              checked={useCoze}
              onChange={() => setUseCoze((prev) => !prev)}
              disabled={isLoading}
              aria-label="切换 Coze 智能体"
            />
            <ToggleTrack />
            <ToggleLabel $active={useCoze}>Coze</ToggleLabel>
          </ProviderToggle>
        )}
        <RefreshButton
          aria-label="刷新回答"
          title="刷新回答"
          onClick={() => {
            handleRefresh();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleRefresh();
            }
          }}
        >
          <RefreshIcon />
        </RefreshButton>
      </TopBar>
      {activeTab === "History" ? (
        <HistoryContainer>
          <HistoryTitle>History</HistoryTitle>
          {history.length === 0 ? (
            <HistoryEmpty>暂无历史记录</HistoryEmpty>
          ) : (
            <HistoryList>
              {history.map((h, idx) => (
                <HistoryItem
                  key={idx}
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    setQuestion(h);
                    setActiveTab("Chat");
                    focusHeroInput(e as any);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setQuestion(h);
                      setActiveTab("Chat");
                      focusHeroInput(e as any);
                    }
                  }}
                >
                  {h}
                </HistoryItem>
              ))}
            </HistoryList>
          )}
        </HistoryContainer>
      ) : activeTab === "Meeting" ? (
        <>
          <MeetingForm id="meeting-form">
            <MeetingField>
              <span>快速粘贴（可选）</span>
              <MeetingPaste
                value={meetingPaste}
                onChange={handleMeetingPaste}
                placeholder={"链接1\n会议号1\n会议主题A\n链接2\n会议号2\n会议主题B"}
              />
              <MeetingHint>粘贴 6 行会自动填充，也支持 4 行或 2 行（每行含链接与会议号）。</MeetingHint>
            </MeetingField>
            <MeetingGroup>
              <MeetingGroupTitle>会场A（Level2&Level3）</MeetingGroupTitle>
              <MeetingRow>
                <MeetingField>
                  <span>会议链接1</span>
                  <MeetingInput
                    value={meetingForm.link1}
                    onChange={updateMeetingForm("link1")}
                    onKeyDown={handleMeetingFieldKeyDown}
                    placeholder="https://meeting.tencent.com/..."
                  />
                </MeetingField>
                <MeetingField>
                  <span>会议号1</span>
                  <MeetingInput
                    value={meetingForm.id1}
                    onChange={updateMeetingForm("id1")}
                    onKeyDown={handleMeetingFieldKeyDown}
                    placeholder="例如：422-7274-0163"
                  />
                </MeetingField>
              </MeetingRow>
              <MeetingField>
                <span>会议主题A</span>
                <MeetingInput
                  value={meetingForm.topic1}
                  onChange={updateMeetingForm("topic1")}
                  onKeyDown={handleMeetingFieldKeyDown}
                  placeholder="例如：结营&答疑"
                />
              </MeetingField>
            </MeetingGroup>
            <MeetingGroup>
              <MeetingGroupTitle>会场B（Level3&Level4&Level5）</MeetingGroupTitle>
              <MeetingRow>
                <MeetingField>
                  <span>会议链接2</span>
                  <MeetingInput
                    value={meetingForm.link2}
                    onChange={updateMeetingForm("link2")}
                    onKeyDown={handleMeetingFieldKeyDown}
                    placeholder="https://meeting.tencent.com/..."
                  />
                </MeetingField>
                <MeetingField>
                  <span>会议号2</span>
                  <MeetingInput
                    value={meetingForm.id2}
                    onChange={updateMeetingForm("id2")}
                    onKeyDown={handleMeetingFieldKeyDown}
                    placeholder="例如：366-2659-2605"
                  />
                </MeetingField>
              </MeetingRow>
              <MeetingField>
                <span>会议主题B</span>
                <MeetingInput
                  value={meetingForm.topic2}
                  onChange={updateMeetingForm("topic2")}
                  onKeyDown={handleMeetingFieldKeyDown}
                  placeholder="例如：训练营结营&项目成果展示"
                />
              </MeetingField>
            </MeetingGroup>
            <MeetingActions>
              <MeetingHint>已自动生成并实时保存到资源目录</MeetingHint>
            </MeetingActions>
          </MeetingForm>

          <AnswersContainer>
            {meetingLoading && !meetingResponse && (
              <LoadingNotice>
                <span>正在生成会议文案</span>
                <LoadingIcon src={loadingIconUrl} alt="loading" />
              </LoadingNotice>
            )}
            {meetingError && (
              <AnswerItem>
                <div className="answer-text">提示：{meetingError}</div>
              </AnswerItem>
            )}
            {meetingResponse && (
              <AnswerItem>
                <div className="answer-text">
                  <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{meetingResponse}</ReactMarkdown>
                </div>
                <div
                  className="icon-wrapper"
                  role="button"
                  title="复制该回答"
                  tabIndex={0}
                  onClick={handleCopyIconClick}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleCopyIconClick(e);
                    }
                  }}
                >
                  <SendIcon />
                </div>
              </AnswerItem>
            )}
          </AnswersContainer>
        </>
      ) : (
        <>
          {/* 欢迎区与卡片已移除，下面直接展示回答与输入区域 */}

          <AnswersContainer>
            {/* 第一个回答加载提示：在尚未产生任何回答时显示在顶部 */}
            {isLoadingFirst && answers.length === 0 && (
              <LoadingNotice>
                <span>正在加载第一个回答</span>
                <LoadingIcon src={loadingIconUrl} alt="loading" />
              </LoadingNotice>
            )}
            {answers.map((answer, index) => (
              <Fragment key={index}>
                <AnswerItem>
                  <div className="answer-text">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{answer}</ReactMarkdown>
                  </div>
                  <div
                    className="icon-wrapper"
                    role="button"
                    title="复制该回答"
                    tabIndex={0}
                    onClick={handleCopyIconClick}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleCopyIconClick(e);
                      }
                    }}
                  >
                    <SendIcon />
                  </div>
                </AnswerItem>
                {/* 第一个回答加载提示：在第一个回答下方显示，与第二个提示一致 */}
                {index === 0 && isLoadingFirst && (
                  <LoadingNotice>
                    <span>正在加载第一个回答</span>
                    <LoadingIcon src={loadingIconUrl} alt="loading" />
                  </LoadingNotice>
                )}
                {index === 0 && isLoadingSecond && (
                  <LoadingNotice>
                    <span>正在加载第二个回答</span>
                    <LoadingIcon src={loadingIconUrl} alt="loading" />
                  </LoadingNotice>
                )}
              </Fragment>
            ))}

            {useCoze && suggestions.length > 0 && (
              <SuggestionsContainer>
                <SectionTitle>推荐问题</SectionTitle>
                <SuggestionList>
                  {suggestions.map((s, i) => (
                    <SuggestionCard
                      key={i}
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        setQuestion(s);
                        focusHeroInput(e as any);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setQuestion(s);
                          focusHeroInput(e as any);
                        }
                      }}
                    >
                      <SuggestionText>
                        <Emoji>{getSuggestionEmoji(i)}</Emoji>
                        <span>{s}</span>
                      </SuggestionText>
                    </SuggestionCard>
                  ))}
                </SuggestionList>
              </SuggestionsContainer>
            )}

          </AnswersContainer>

          {!useCoze && (
            <CorpusContainer>
              <SectionTitle>追加语料</SectionTitle>
              <CorpusFields>
                <CorpusField>
                  <CorpusLabel>问题行</CorpusLabel>
                  <CorpusInput
                    value={doubaoEntry.question}
                    onChange={handleDoubaoEntryChange("question")}
                    placeholder="例如：训练营可以退款吗？"
                  />
                </CorpusField>
                <CorpusField>
                  <CorpusLabel>答：行</CorpusLabel>
                  <CorpusTextarea
                    value={doubaoEntry.answer}
                    onChange={handleDoubaoEntryChange("answer")}
                    placeholder="例如：本训练营为线上直播形式，服务开启后不支持退费。"
                  />
                </CorpusField>
              </CorpusFields>
              <CorpusActions>
                <CorpusHint>将按序号追加到 doubao-corpus.md</CorpusHint>
                <CorpusButton
                  type="button"
                  onClick={handleDoubaoEntrySubmit}
                  disabled={doubaoSaving || !canSubmitDoubaoEntry}
                >
                  {doubaoSaving ? "写入中..." : "写入语料"}
                </CorpusButton>
              </CorpusActions>
              {(doubaoError || doubaoStatus) && (
                <CorpusStatus $error={!!doubaoError}>
                  {doubaoError || doubaoStatus}
                </CorpusStatus>
              )}
            </CorpusContainer>
          )}

          {/* 输入框固定在底部，顶部内容可单独滚动 */}
          <InputContainer id="hero-input">
            <QuestionInput
              ref={textareaRef}
              placeholder="Ask complex questions (Enter to send)"
              value={question}
              onChange={handleInput}
              onKeyDown={handleKeyPress}
              rows={1}
            />
            <SendLink
              href="#hero-input"
              aria-label="send"
              title="Send"
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.preventDefault();
                handleConfirm();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleConfirm();
                }
              }}
            >
              Send
            </SendLink>
          </InputContainer>
        </>
      )}
    </Container>
  );
}

export default App;
