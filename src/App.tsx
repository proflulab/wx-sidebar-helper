import { useState, useRef, useEffect, lazy, Suspense, memo, useCallback } from "react";
import type { KeyboardEvent, ChangeEvent, SyntheticEvent } from "react";
import styled, { keyframes } from "styled-components";
import CopyIcon from "./components/icons/CopyIcon";
import { streamQuestion } from "./client_kn";
const MarkdownRenderer = lazy(() => import("./components/MarkdownRenderer"));

// 样式组件
const Container = styled.div`
  width: 380px;
  min-height: 100vh;
  padding: 16px;
  margin-top: 16px;
  background: #f7f7f7;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
    "Helvetica Neue", Arial;
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.08);
  border-radius: 12px;
  border: 1px solid #eee;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
`;

const Brand = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const BrandIcon = styled.div`
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: linear-gradient(135deg, #1677ff 0%, #69b1ff 100%);
  box-shadow: 0 2px 8px rgba(24, 144, 255, 0.3);
`;

const Title = styled.div`
  font-size: 16px;
  font-weight: 700;
  color: #1f1f1f;
  letter-spacing: 0.2px;
`;

const SubTitle = styled.div`
  font-size: 12px;
  color: #8c8c8c;
`;

const InputContainer = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  position: sticky;
  top: 0;
  z-index: 2;
  background: rgba(247, 247, 247, 0.9);
  padding-bottom: 8px;
  backdrop-filter: saturate(180%) blur(6px);
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.06);
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
    color: #999;
  }

  &:focus {
    outline: none;
    border-color: #1890ff;
    box-shadow: 0 2px 8px rgba(24, 144, 255, 0.1);
  }
`;

const ConfirmButton = styled.button`
  padding: 0 20px;
  height: 42px;
  background: linear-gradient(135deg, #1677ff 0%, #4096ff 100%);
  border: none;
  border-radius: 10px;
  color: white;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.25s ease;
  white-space: nowrap;
  align-self: flex-start;
  line-height: 42px;
  box-shadow: 0 6px 14px rgba(24, 144, 255, 0.25);

  &:hover {
    filter: brightness(1.06);
    transform: translateY(-1px);
    box-shadow: 0 10px 18px rgba(24, 144, 255, 0.28);
  }

  &:active {
    filter: brightness(0.96);
    transform: translateY(0);
  }

  &:disabled {
    background: #d9d9d9;
    cursor: not-allowed;
    box-shadow: none;
  }
`;

const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

const LoadingSpinner = styled.span`
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.6);
  border-top-color: #ffffff;
  border-radius: 50%;
  animation: ${spin} 0.8s linear infinite;
  vertical-align: middle;
`;

const GhostButton = styled.button`
  padding: 0 14px;
  height: 42px;
  background: #ffffff;
  border: 1px solid #e6e6e6;
  border-radius: 10px;
  color: #666;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.25s ease;
  white-space: nowrap;
  align-self: flex-start;
  line-height: 42px;

  &:hover {
    color: #333;
    border-color: #d9d9d9;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
    transform: translateY(-1px);
  }

  &:active {
    color: #222;
    border-color: #c9c9c9;
  }

  &:disabled {
    color: #bfbfbf;
    background: #fafafa;
    cursor: not-allowed;
    box-shadow: none;
  }
`;

const AnswersContainer = styled.div`
  max-height: calc(100vh - 120px);
  overflow-y: auto;
  padding-right: 4px;
  margin-right: -4px;

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

const fadeInUp = keyframes`
  from { transform: translateY(4px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
`;

const AnswerItem = styled.div`
  background: white;
  padding: 14px 16px;
  margin-bottom: 12px;
  border-radius: 8px;
  border: 1px solid #f0f0f0;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.03);
  border-left: 3px solid #e6f4ff;
  animation: ${fadeInUp} 0.25s ease;

  &:hover {
    border-color: #1890ff;
    box-shadow: 0 4px 12px rgba(24, 144, 255, 0.1);
    transform: translateY(-1px);
    border-left-color: #1890ff;
  }

  .answer-text {
    flex: 1;
    margin-right: 16px;
  }

  .answer-content {
    color: #333;
    font-size: 14px;
    line-height: 1.6;
    padding: 2px 0;
    word-break: break-word;
    white-space: normal;
    position: relative;
    content-visibility: auto;
    contain-intrinsic-size: 300px;

    /* Markdown 样式优化 */
    h1, h2, h3 {
      margin: 0.4em 0 0.3em;
      color: #222;
    }
    p { margin: 0.4em 0; }
    ul, ol { margin: 0.4em 0 0.4em 1.4em; }
    blockquote {
      margin: 0.6em 0;
      padding: 8px 12px;
      background: #f9fafb;
      border-left: 4px solid #e6f4ff;
      color: #555;
      border-radius: 6px;
    }
    code {
      background: #f5f5f5;
      border: 1px solid #eee;
      padding: 2px 6px;
      border-radius: 6px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      font-size: 12px;
    }
    pre code {
      display: block;
      padding: 10px 12px;
      border-radius: 8px;
      background: #f7f8fa;
      border: 1px solid #eee;
      overflow-x: auto;
    }
  }

  .answer-content.collapsed {
    max-height: 240px;
    overflow: hidden;
  }

  .answer-content.collapsed::after {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 48px;
    background: linear-gradient(to bottom, rgba(255, 255, 255, 0), #ffffff);
    pointer-events: none;
  }

  .action-row {
    display: flex;
    justify-content: flex-end;
    margin-top: 8px;
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
    box-shadow: 0 1px 2px rgba(24, 144, 255, 0.06);

    &:hover {
      background: #e6f4ff;
      box-shadow: 0 2px 6px rgba(24, 144, 255, 0.12);
      transform: translateY(-1px);
    }
  }
`;

const SendIcon = styled(CopyIcon)`
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
  flex-wrap: wrap;
  gap: 8px;
`;

type SuggestionItemProps = {
  text: string;
  onClick: (text: string, append: boolean) => void;
  onDoubleClick: (text: string) => void;
};

const SuggestionItem = memo(function SuggestionItem({ text, onClick, onDoubleClick }: SuggestionItemProps) {
  return (
    <SuggestionChip
      onClick={(e) => onClick(text, e.shiftKey || e.altKey)}
      onDoubleClick={() => onDoubleClick(text)}
    >
      {text}
    </SuggestionChip>
  );
});

const SuggestionChip = styled.button`
  border: 1px solid #e6f4ff;
  background: #f5fbff;
  color: #1890ff;
  border-radius: 999px;
  padding: 6px 10px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(24, 144, 255, 0.08);

  &:hover {
    background: #e6f4ff;
    transform: translateY(-1px);
  }

  &:focus-visible {
    outline: 2px solid #1677ff;
    outline-offset: 2px;
  }
`;

const HintText = styled.div`
  font-size: 12px;
  color: #8c8c8c;
  margin: -4px 0 8px 0;
`;

const ExpandButton = styled.button`
  border: 1px solid #e6f4ff;
  background: #f5fbff;
  color: #1890ff;
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  line-height: 1;

  &:hover {
    background: #e6f4ff;
  }

  &:focus-visible {
    outline: 2px solid #1677ff;
    outline-offset: 2px;
  }
`;

const Toast = styled.div`
  position: fixed;
  top: 12px;
  right: 12px;
  background: rgba(24, 144, 255, 0.95);
  color: #fff;
  padding: 8px 12px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(24, 144, 255, 0.2);
  font-size: 12px;
  z-index: 3;
`;

const Divider = styled.div`
  height: 1px;
  background: #eee;
  margin: 12px 0;
`;

type AnswerBlockProps = {
  answer: string;
  index: number;
  collapsed: boolean;
  onToggle: (index: number) => void;
  onCopy: (text: string, index: number) => void;
  copied: boolean;
};

const AnswerBlock = memo(function AnswerBlock(props: AnswerBlockProps) {
  const { answer, index, collapsed, onToggle, onCopy, copied } = props;
  const textRef = useRef<HTMLDivElement | null>(null);
  return (
    <AnswerItem key={index} data-index={index}>
      <div className="answer-text">
        <div ref={textRef} className={`answer-content ${collapsed ? "collapsed" : ""}`}>
          <Suspense fallback={<span style={{ color: "#999" }}>加载中…</span>}>
            <MarkdownRenderer text={answer} />
          </Suspense>
        </div>
        <div className="action-row">
          <ExpandButton onClick={() => onToggle(index)}>
            {collapsed ? "展开" : "收起"}
          </ExpandButton>
        </div>
      </div>
      <div
        className="icon-wrapper"
        role="button"
        title="复制该回答"
        tabIndex={0}
        onClick={() => {
          const t = ((textRef.current?.innerText ?? textRef.current?.textContent) ?? "").trim();
          if (t) onCopy(t, index);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            const t = ((textRef.current?.innerText ?? textRef.current?.textContent) ?? "").trim();
            if (t) onCopy(t, index);
          }
        }}
      >
        <SendIcon />
      </div>
      {copied && (
        <span style={{ marginLeft: 8, fontSize: 12, color: "#52c41a" }}>已复制</span>
      )}
    </AnswerItem>
  );
});

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

// 清理长答末尾的知识回溯后缀（如：^^（recall slice 1、recall slice 2...））
const cleanRecallSuffix = (text: string): string => {
  if (!text || typeof text !== "string") return text || "";
  let t = text;
  // 中文括号样式
  t = t.replace(/\s*\^{2}\s*（[^）]*recall\s*slice[^）]*）\s*$/i, "");
  // 英文括号样式
  t = t.replace(/\s*\^{2}\s*\([^)]*recall\s*slice[^)]*\)\s*$/i, "");
  return t;
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
  const [question, setQuestion] = useState<string>("");
  const [answers, setAnswers] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [, setHasConfirmed] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const hasChunkRef = useRef<boolean>(false);
  const [toast, setToast] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const requestIdRef = useRef<number>(0);

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

  // 预取 Markdown 渲染组件，降低首次展示等待
  useEffect(() => {
    if (isLoading) {
      // 动态导入以预热 chunk
      void import("./components/MarkdownRenderer");
    }
  }, [isLoading]);

  // 仅对超长回答默认折叠：长度超过 400 字或行数超过 6
  useEffect(() => {
    const shouldCollapse = (text: string): boolean => {
      const len = (text || "").length;
      const lines = (text || "").split(/\n/).length;
      return len > 400 || lines > 6;
    };
    setCollapsed((prev) => {
      const next = { ...prev };
      answers.forEach((ans, idx) => {
        if (!(idx in next)) {
          next[idx] = shouldCollapse(ans);
        }
      });
      return next;
    });
  }, [answers]);

  const handleConfirm = async (): Promise<void> => {
    if (question.trim() && !isLoading) {
      setIsLoading(true);
      const reqId = Date.now();
      requestIdRef.current = reqId;
      // 新问题开始时清空旧内容
      setAnswers([]);
      setSuggestions([]);
      hasChunkRef.current = false;

      // 每条 completed 消息独立展示，不再使用占位拼接

      try {
        // 第一次请求：短答（3句话以内）
        const shortPrompt = buildShortPrompt(question);
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
          // 若请求已被新的提交替换，停止处理
          if (reqId !== requestIdRef.current) break;
          // 调试输出仅在开发环境启用
          if (import.meta.env.DEV) {
            // eslint-disable-next-line no-console
            console.debug("Coze stream event:", evt);
          }
          const chunk = extractAssistantText(evt);
          if (!chunk) continue;
          hasChunkRef.current = true;
          // 分类：推荐问题（一句话） vs 正常回答
          if (isRecommendedQuestion(chunk)) {
            setSuggestions((prev) => (prev.includes(chunk) ? prev : [...prev, chunk]));
          } else {
            // 每条 completed 消息追加一个独立的回答框
            setAnswers((prev) => [...prev, chunk]);
          }

          // 在首次短答片段显示后，触发第二次请求：详细回答（不采集推荐问题）
          if (!longStarted) {
            longStarted = true;
            const longPrompt = buildLongPrompt(question);
            longPromise = (async () => {
              try {
                const longStream = await streamQuestion(longPrompt);
                for await (const evt2 of longStream) {
                  if (reqId !== requestIdRef.current) break;
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
              }
            })();
          }
        }

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

  const handleSuggestionClick = useCallback((s: string, append: boolean) => {
    if (append) {
      setQuestion((prev) => (prev ? `${prev}\n${s}` : s));
    } else {
      setQuestion(s);
    }
  }, []);

  const handleSuggestionDoubleClick = useCallback((s: string) => {
    setQuestion(s);
    setTimeout(() => handleConfirm(), 0);
  }, [handleConfirm]);

  const copyTextToClipboard = useCallback(async (text: string): Promise<void> => {
    if (!text || !text.trim()) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        setToast("已复制到剪贴板");
        setTimeout(() => setToast(null), 1500);
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
      setToast("已复制到剪贴板");
      setTimeout(() => setToast(null), 1500);
    } catch {
      // ignore
    }
  }, []);

  const onToggleAnswer = useCallback((idx: number) => {
    setCollapsed((prev) => ({ ...prev, [idx]: !prev[idx] }));
  }, []);

  const onCopyAnswer = useCallback(async (text: string, idx: number) => {
    await copyTextToClipboard(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 1200);
  }, [copyTextToClipboard]);

  const handleCopyIconClick = async (e: SyntheticEvent<HTMLDivElement>): Promise<void> => {
    try {
      const parent = e.currentTarget?.parentElement;
      const textEl = parent?.querySelector?.(".answer-content") as HTMLElement | null;
      const text = ((textEl?.innerText ?? textEl?.textContent) ?? "").trim();
      await copyTextToClipboard(text);
      const idxAttr = parent?.getAttribute("data-index");
      const idx = idxAttr ? parseInt(idxAttr, 10) : null;
      if (idx !== null && !Number.isNaN(idx)) {
        setCopiedIndex(idx);
        setTimeout(() => setCopiedIndex(null), 1200);
      }
    } catch {
      // ignore copy error
    }
  };

  return (
    <Container>
      {toast && <Toast>{toast}</Toast>}
      <Header>
        <Brand>
          <BrandIcon />
          <div>
            <Title>企业微信侧边栏</Title>
            <SubTitle>提问后会先给简答，再给详解</SubTitle>
          </div>
        </Brand>
      <GhostButton
        onClick={() => {
          setQuestion("");
          setAnswers([]);
          setSuggestions([]);
          setCollapsed({});
          setCopiedIndex(null);
          // 使当前进行中的请求失效
          requestIdRef.current = Date.now();
        }}
        disabled={isLoading || (!question.trim() && answers.length === 0 && suggestions.length === 0)}
      >
        清空内容
      </GhostButton>
      </Header>
      <InputContainer>
        <QuestionInput
          ref={textareaRef}
          placeholder="请输入问题"
          value={question}
          onChange={handleInput}
          onKeyDown={handleKeyPress}
          rows={1}
        />
        <ConfirmButton
          onClick={handleConfirm}
          disabled={!question.trim() || isLoading}
        >
          {isLoading ? <LoadingSpinner aria-label="loading" /> : "确认"}
        </ConfirmButton>
      </InputContainer>
      <HintText>Enter 提交，Shift+Enter 换行</HintText>
      <Divider />

      <AnswersContainer>
        {answers.map((answer, index) => (
          <AnswerBlock
            key={index}
            answer={answer}
            index={index}
            collapsed={!!collapsed[index]}
            onToggle={onToggleAnswer}
            onCopy={onCopyAnswer}
            copied={copiedIndex === index}
          />
        ))}

        {suggestions.length > 0 && (
          <SuggestionsContainer>
            <SectionTitle>推荐问题</SectionTitle>
            <HintText>单击填充，双击提交，Shift/Alt 点击追加</HintText>
            <SuggestionList>
              {suggestions.map((s, i) => (
                <SuggestionItem
                  key={i}
                  text={s}
                  onClick={handleSuggestionClick}
                  onDoubleClick={handleSuggestionDoubleClick}
                />
              ))}
            </SuggestionList>
          </SuggestionsContainer>
        )}
      </AnswersContainer>
    </Container>
  );
}

export default App;
