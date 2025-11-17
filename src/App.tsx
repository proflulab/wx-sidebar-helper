import { useState, useRef, useEffect, Fragment } from "react";
import loadingIconUrl from "./assets/loading.png";
import type { KeyboardEvent, ChangeEvent, SyntheticEvent } from "react";
import styled, { keyframes } from "styled-components";
import { CopyOutlined } from "@ant-design/icons";
import { streamQuestion } from "./client_kn";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// 样式组件
const Container = styled.div`
  width: 360px;
  min-height: 100vh;
  padding: 16px;
  margin-top: 16px;
  background: #f7f7f7;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
    "Helvetica Neue", Arial;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
`;

const InputContainer = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
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
  background: #1890ff;
  border: none;
  border-radius: 8px;
  color: white;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
  white-space: nowrap;
  align-self: flex-start;
  line-height: 42px;

  &:hover {
    background: #40a9ff;
    box-shadow: 0 2px 8px rgba(24, 144, 255, 0.2);
  }

  &:active {
    background: #096dd9;
  }

  &:disabled {
    background: #d9d9d9;
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

  &:hover {
    border-color: #1890ff;
    box-shadow: 0 4px 12px rgba(24, 144, 255, 0.1);
    transform: translateY(-1px);
  }

  .answer-text {
    color: #333;
    font-size: 14px;
    line-height: 1.6;
    flex: 1;
    margin-right: 16px;
    padding: 2px 0;
    word-break: break-word;
    white-space: normal;

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
    box-shadow: 0 1px 2px rgba(24, 144, 255, 0.06);

    &:hover {
      background: #e6f4ff;
      box-shadow: 0 2px 6px rgba(24, 144, 255, 0.12);
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
  flex-wrap: wrap;
  gap: 8px;
`;

const SuggestionChip = styled.button`
  border: 1px solid #e6f4ff;
  background: #f5fbff;
  color: #1890ff;
  border-radius: 999px;
  padding: 6px 10px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: #e6f4ff;
  }
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
      setIsLoading(true);
      setIsLoadingSecond(false);
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
          // 调试输出，便于定位事件结构
          // eslint-disable-next-line no-console
          console.debug("Coze stream event:", evt);
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
            setIsLoadingSecond(true);
            const longPrompt = buildLongPrompt(question);
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
          {isLoading ? "请稍等..." : "确认"}
        </ConfirmButton>
      </InputContainer>

      <AnswersContainer>
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
                <SuggestionChip key={i} onClick={() => setQuestion(s)}>
                  {s}
                </SuggestionChip>
              ))}
            </SuggestionList>
          </SuggestionsContainer>
        )}
      </AnswersContainer>
    </Container>
  );
}

export default App;
