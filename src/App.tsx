import { useState, useRef, useEffect, Fragment } from "react";
import loadingIconUrl from "./assets/loading.png";
import type { KeyboardEvent, ChangeEvent, SyntheticEvent } from "react";
import styled, { keyframes } from "styled-components";
import { CopyOutlined, ReloadOutlined } from "@ant-design/icons";
import { streamQuestion } from "./client_kn";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// 样式组件
const Container = styled.div`
  width: 360px;
  height: 100vh;
  padding: 16px;
  overflow: hidden;
  background: linear-gradient(180deg, #f8faff 0%, #ffffff 50%, #fafbff 100%);
  border-radius: 20px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
    "Helvetica Neue", Arial;
  box-shadow: 
    0 4px 24px rgba(99, 102, 241, 0.08),
    0 1px 3px rgba(0, 0, 0, 0.04),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(226, 232, 240, 0.8);
  display: flex;
  flex-direction: column;
`;

// 顶部标签栏
const TopBar = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  height: 48px;
  padding: 6px 12px 12px;
  border-bottom: 1px solid rgba(226, 232, 240, 0.6);
  margin-bottom: 12px;
  background: linear-gradient(180deg, rgba(255,255,255,0.9) 0%, transparent 100%);
`;

// 顶部栏右侧区域与刷新按钮样式
const FlexSpacer = styled.div`
  flex: 1;
`;

const RefreshButton = styled.button`
  border: none;
  background: rgba(99, 102, 241, 0.06);
  cursor: pointer;
  padding: 8px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6366f1;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    background: rgba(99, 102, 241, 0.12);
    transform: rotate(90deg);
    color: #4f46e5;
  }

  &:active {
    transform: rotate(180deg) scale(0.95);
  }
`;

const RefreshIcon = styled(ReloadOutlined)`
  font-size: 16px;
`;

const Tab = styled.button<{ $active?: boolean }>`
  border: none;
  background: ${({ $active }) => ($active ? "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)" : "transparent")};
  font-size: 13px;
  color: ${({ $active }) => ($active ? "#ffffff" : "#64748b")};
  font-weight: 600;
  padding: 8px 16px;
  border-radius: 10px;
  cursor: pointer;
  position: relative;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: ${({ $active }) => ($active ? "0 2px 8px rgba(99, 102, 241, 0.3)" : "none")};

  &:hover {
    background: ${({ $active }) => ($active ? "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)" : "rgba(99, 102, 241, 0.08)")};
    color: ${({ $active }) => ($active ? "#ffffff" : "#6366f1")};
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }
`;

const InputContainer = styled.div`
  display: flex;
  gap: 10px;
  padding: 12px;
  margin: 8px -4px 0;
  align-items: flex-end;
  position: sticky;
  bottom: 0;
  z-index: 2;
  background: linear-gradient(180deg, transparent 0%, rgba(248, 250, 255, 0.95) 20%, #f8faff 100%);
  border-radius: 16px;
`;

const QuestionInput = styled.textarea`
  flex: 1;
  padding: 12px 16px;
  border: 2px solid rgba(226, 232, 240, 0.8);
  border-radius: 14px;
  font-size: 14px;
  background: rgba(255, 255, 255, 0.9);
  color: #1e293b;
  box-shadow: 
    0 2px 8px rgba(99, 102, 241, 0.04),
    inset 0 1px 2px rgba(0, 0, 0, 0.02);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  min-height: 44px;
  max-height: 126px;
  resize: none;
  line-height: 1.5;
  font-family: inherit;
  display: block;
  margin: 0;
  overflow-y: auto;

  &::-webkit-scrollbar {
    width: 4px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(99, 102, 241, 0.2);
    border-radius: 4px;
  }

  &::-webkit-scrollbar-thumb:hover {
    background: rgba(99, 102, 241, 0.4);
  }

  &::placeholder {
    color: #94a3b8;
    font-size: 13px;
    font-weight: 400;
  }

  &:focus {
    outline: none;
    border-color: #6366f1;
    background: #ffffff;
    box-shadow: 
      0 0 0 4px rgba(99, 102, 241, 0.1),
      0 4px 12px rgba(99, 102, 241, 0.08);
  }
`;

// 发送按钮
const SendLink = styled.a`
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: #ffffff;
  text-decoration: none;
  font-weight: 600;
  font-size: 13px;
  padding: 12px 18px;
  border-radius: 12px;
  white-space: nowrap;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);

  &:hover { 
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(99, 102, 241, 0.4);
  }

  &:active {
    transform: translateY(0);
    box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
  }
`;

/* 删除 EnterOverlay 内嵌提示样式 */


const AnswersContainer = styled.div`
  max-height: calc(100vh - 140px);
  overflow-y: auto;
  padding-right: 6px;
  margin-right: -6px;
  flex: 1 1 auto;

  &::-webkit-scrollbar {
    width: 5px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
    border-radius: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: linear-gradient(180deg, rgba(99, 102, 241, 0.2) 0%, rgba(139, 92, 246, 0.2) 100%);
    border-radius: 4px;
  }

  &::-webkit-scrollbar-thumb:hover {
    background: linear-gradient(180deg, rgba(99, 102, 241, 0.4) 0%, rgba(139, 92, 246, 0.4) 100%);
  }
`;

const AnswerItem = styled.div`
  background: linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,255,0.9) 100%);
  padding: 16px 18px;
  margin-bottom: 14px;
  border-radius: 16px;
  border: 1px solid rgba(226, 232, 240, 0.6);
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 
    0 2px 12px rgba(99, 102, 241, 0.06),
    0 1px 3px rgba(0, 0, 0, 0.02);
  border-left: 3px solid transparent;
  border-image: linear-gradient(180deg, #6366f1 0%, #8b5cf6 100%) 1;
  position: relative;
  overflow: hidden;

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: linear-gradient(90deg, #6366f1 0%, #8b5cf6 50%, #a78bfa 100%);
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  &:hover {
    border-color: rgba(99, 102, 241, 0.2);
    box-shadow: 
      0 8px 24px rgba(99, 102, 241, 0.12),
      0 2px 8px rgba(0, 0, 0, 0.04);
    transform: translateY(-2px);
    background: linear-gradient(135deg, #ffffff 0%, #f5f3ff 100%);

    &::before {
      opacity: 1;
    }
  }

  .answer-text {
    color: #1e293b;
    font-size: 14px;
    line-height: 1.75;
    flex: 1;
    margin-right: 16px;
    padding: 2px 0;
    word-break: break-word;
    white-space: normal;

    h1, h2, h3 {
      color: #0f172a;
      font-weight: 600;
      margin: 10px 0 8px;
      line-height: 1.4;
    }
    h1 { font-size: 17px; background: linear-gradient(135deg, #6366f1, #8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    h2 { font-size: 15px; }
    h3 { font-size: 14px; }

    p { margin: 8px 0; }

    ul, ol { margin: 8px 0 8px 20px; }
    li { margin: 5px 0; }

    a {
      color: #6366f1;
      text-decoration: none;
      font-weight: 500;
      transition: color 0.2s ease;
    }
    a:hover { color: #4f46e5; text-decoration: underline; }

    code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
      border: 1px solid rgba(99, 102, 241, 0.1);
      border-radius: 6px;
      padding: 2px 6px;
      font-size: 13px;
      color: #6366f1;
    }
    pre {
      background: linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%);
      color: #e2e8f0;
      border-radius: 12px;
      padding: 14px 16px;
      overflow: auto;
      border: 1px solid rgba(99, 102, 241, 0.2);
      box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);
    }
    pre code {
      background: transparent;
      border: none;
      color: inherit;
      padding: 0;
      font-size: 13px;
    }

    blockquote {
      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
      border-left: 3px solid #6366f1;
      color: #475569;
      margin: 10px 0;
      padding: 10px 14px;
      border-radius: 0 10px 10px 0;
    }
    hr {
      border: none;
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(99, 102, 241, 0.2), transparent);
      margin: 12px 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 10px 0;
      border-radius: 8px;
      overflow: hidden;
    }
    th, td {
      border: 1px solid rgba(226, 232, 240, 0.8);
      padding: 8px 10px;
      text-align: left;
    }
    th {
      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
      color: #1e293b;
      font-weight: 600;
    }

    img {
      max-width: 100%;
      height: auto;
      display: block;
      margin: 10px 0;
      border-radius: 10px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    }
  }

  .icon-wrapper {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 10px;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    margin-top: 2px;
    cursor: pointer;
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(139, 92, 246, 0.08) 100%);
    border: 1px solid rgba(99, 102, 241, 0.15);

    &:hover {
      background: linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(139, 92, 246, 0.15) 100%);
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.2);
      transform: translateY(-2px) scale(1.05);
    }
  }
`;

// 加载提示样式
const LoadingNotice = styled.div`
  color: #6366f1;
  font-size: 13px;
  margin: -4px 0 12px 0;
  padding: 8px 14px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.06) 0%, rgba(139, 92, 246, 0.06) 100%);
  border-radius: 20px;
  border: 1px solid rgba(99, 102, 241, 0.1);
`;

const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

const pulse = keyframes`
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
`;

const LoadingIcon = styled.img`
  width: 18px;
  height: 18px;
  object-fit: contain;
  animation: ${spin} 1s linear infinite, ${pulse} 1.5s ease-in-out infinite;
  transform-origin: center;
  filter: hue-rotate(220deg) saturate(1.2);
`;

const SendIcon = styled(CopyOutlined)`
  color: #6366f1;
  font-size: 15px;
  transition: all 0.25s ease;
  flex-shrink: 0;
`;

// 推荐问题模块样式
const SuggestionsContainer = styled.div`
  background: linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(248,250,255,0.85) 100%);
  padding: 14px 16px;
  margin-bottom: 14px;
  border-radius: 16px;
  border: 1px solid rgba(226, 232, 240, 0.6);
  box-shadow: 0 2px 12px rgba(99, 102, 241, 0.06);
  backdrop-filter: blur(8px);
`;

const SectionTitle = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: #6366f1;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 6px;

  &::before {
    content: "✨";
    font-size: 14px;
  }
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
  background: linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,255,0.9) 100%);
  border: 1px solid rgba(226, 232, 240, 0.5);
  border-radius: 12px;
  padding: 11px 14px;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.04);

  &:hover {
    background: linear-gradient(135deg, #ffffff 0%, #f5f3ff 100%);
    transform: translateX(4px);
    border-color: rgba(99, 102, 241, 0.2);
    box-shadow: 0 4px 16px rgba(99, 102, 241, 0.12);
  }
`;

const SuggestionText = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: #334155;
  font-weight: 500;
`;


// 欢迎区与功能卡片（仿图示布局）

const Emoji = styled.span`
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%);
  border-radius: 8px;
`;


// 历史记录样式
const HistoryContainer = styled.div`
  background: linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(248,250,255,0.85) 100%);
  padding: 16px 18px;
  border-radius: 16px;
  border: 1px solid rgba(226, 232, 240, 0.6);
  box-shadow: 0 2px 12px rgba(99, 102, 241, 0.06);
  backdrop-filter: blur(8px);
`;

const HistoryTitle = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: #6366f1;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 6px;

  &::before {
    content: "📜";
    font-size: 14px;
  }
`;

const HistoryList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const HistoryItem = styled.div`
  display: flex;
  align-items: center;
  background: linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,255,0.9) 100%);
  border: 1px solid rgba(226, 232, 240, 0.5);
  border-radius: 12px;
  padding: 10px 14px;
  font-size: 13px;
  color: #334155;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  font-weight: 500;

  &:hover {
    background: linear-gradient(135deg, #ffffff 0%, #f5f3ff 100%);
    transform: translateX(4px);
    border-color: rgba(99, 102, 241, 0.2);
    box-shadow: 0 4px 16px rgba(99, 102, 241, 0.12);
  }

  &::before {
    content: "💬";
    margin-right: 10px;
    font-size: 12px;
  }
`;

const HistoryEmpty = styled.div`
  font-size: 13px;
  color: #94a3b8;
  text-align: center;
  padding: 20px 0;
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

function App() {
  const [activeTab, setActiveTab] = useState<"Chat" | "History">("Chat");
  const [question, setQuestion] = useState<string>("");
  const [answers, setAnswers] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [, setHasConfirmed] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLoadingFirst, setIsLoadingFirst] = useState<boolean>(false);
  const [isLoadingSecond, setIsLoadingSecond] = useState<boolean>(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const hasChunkRef = useRef<boolean>(false);

  const adjustHeight = (): void => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      const newHeight = Math.min(Math.max(42, textarea.scrollHeight), 126);
      textarea.style.height = `${newHeight}px`;
    }
  };

  useEffect(() => {
    adjustHeight();
  }, [question]);

  const handleConfirm = async (): Promise<void> => {
    if (question.trim() && !isLoading) {
      // 发送前把问题缓存到历史（去重，最多10条）
      const q = question.trim();
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
        // 第一次请求：短答（3句话以内）
        const shortPrompt = buildShortPrompt(q);
        const stream = await streamQuestion(shortPrompt);
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
                const longStream = await streamQuestion(longPrompt);
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
      } catch (error) {
        const detail = getErrorMessage(error);
        console.error("Error calling Coze API:", detail);
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
    setQuestion(e.target.value);
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
        <Tab $active={activeTab === "History"} onClick={() => setActiveTab("History")}>History</Tab>
        <FlexSpacer />
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

          {suggestions.length > 0 && (
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
