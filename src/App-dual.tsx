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
  padding: 12px;
  overflow: hidden;
  background: #ffffff;
  border-radius: 14px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  border: 1px solid #eef2f6;
  display: flex;
  flex-direction: column;
`;

const TopBar = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 4px 8px 10px;
  border-bottom: 1px solid #eef2f6;
  margin-bottom: 10px;
`;

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
  padding: 8px 10px;
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

const InputContainer = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  align-items: flex-start;
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
  color: #333;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.03);
  transition: all 0.3s ease;
  min-height: 42px;
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
    background: #ccc;
    border-radius: 2px;
  }

  &::-webkit-scrollbar-thumb:hover {
    background: #999;
  }

  &::placeholder {
    color: #334155;
    font-size: 13px;
    font-weight: 400;
  }

  &:focus {
    outline: none;
    border-color: #1890ff;
    box-shadow: 0 2px 8px rgba(24, 144, 255, 0.1);
  }
`;

const SendLink = styled.a`
  color: #0b57d0;
  text-decoration: none;
  font-weight: 600;
  align-self: center;
  white-space: nowrap;

  &:hover { text-decoration: underline; }
`;

const AnswersContainer = styled.div`
  max-height: calc(100vh - 120px);
  overflow-y: auto;
  padding-right: 4px;
  margin-right: -4px;
  flex: 1 1 auto;

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

// 答案区域标题
const AnswerSectionTitle = styled.div`
  font-size: 12px;
  font-weight: 600;
  color: #5b6b7a;
  margin: 12px 0 8px 0;
  padding-left: 4px;
  display: flex;
  align-items: center;
  gap: 6px;
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
  border-left: 3px solid #F4D06F;

  &:hover {
    border-color: #fde68a;
    box-shadow: 0 6px 16px rgba(245, 196, 83, 0.18);
    transform: translateY(-1px);
    background: linear-gradient(180deg, #fff7e6 0%, #ffffff 100%);
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

const Emoji = styled.span`
  font-size: 18px;
`;

// 辅助函数
const extractAssistantText = (event: any): string | null => {
  if (typeof event === "string") {
    return event;
  }

  if (event && typeof event === "object") {
    const content = event?.data?.content;
    if (typeof content === "string" && content.length) {
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
        if (
          obj.msg_type === "generate_answer_finish" ||
          obj.msg_type === "event" ||
          obj.msg_type === "knowledge_recall"
        ) {
          return null;
        }
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

const isRecommendedQuestion = (text: string): boolean => {
  const t = (text || "").trim();
  if (!t) return false;
  const paragraphs = t.split(/\n{2,}/).filter((p) => p.trim().length > 0);
  const endsWithQuestion = /[?？]$/.test(t);
  return endsWithQuestion && paragraphs.length < 2;
};

const cleanRecallSuffix = (text: string): string => {
  if (!text || typeof text !== "string") return text || "";
  let t = text;
  t = t.replace(/\s*\^{2}\s*\[[^\]]*recall\s*slice[^\]]*\]\s*/gi, "");
  t = t.replace(/\s*\^{2}\s*\([^)]*recall\s*slice[^)]*\)\s*/gi, "");
  t = t.replace(/\s*\^{2}\s*（[^）]*recall\s*slice[^）]*）\s*/gi, "");
  t = t.replace(/\s*答案来自知识库\s*\^{2}\s*/gi, "");
  t = t.replace(/\s*来源于知识库\s*\^{2}\s*/gi, "");
  t = t.replace(/\s*Answer\s*from\s*knowledge\s*base\s*\^{2}\s*/gi, "");
  t = t.replace(/\s*\^{2}\s*/g, " ");
  return t.trim();
};

const emojiPool = [
  "🔎", "🚀", "📚", "🧪", "🎯", "💬", "🧭", "🧩", "📈", "🛠️",
  "🌟", "🗣️", "🪄", "🖼️", "🎧", "🛰️", "🗺️", "🔬", "✏️", "📖",
  "💡", "📝", "🧠", "🎨", "🧮", "🔧", "🔮", "🧵", "🌀", "🪙"
];
const heroEmojis: string[] = ["🧠", "🎨", "✍️"];
const getSuggestionEmoji = (index: number): string => {
  if (index >= 0 && index < heroEmojis.length) return heroEmojis[index];
  return emojiPool[index] ?? "🪄";
};

const buildShortPrompt = (q: string): string => `${q}（3句话以内）`;
const buildLongPrompt = (q: string): string => `${q}（详细回答）`;

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
  // 分别存储短答和长答
  const [shortAnswer, setShortAnswer] = useState<string>("");
  const [longAnswer, setLongAnswer] = useState<string>("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLoadingShort, setIsLoadingShort] = useState<boolean>(false);
  const [isLoadingLong, setIsLoadingLong] = useState<boolean>(false);
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
      const q = question.trim();
      setQuestion("");
      setIsLoading(true);
      setIsLoadingShort(true);
      setIsLoadingLong(true);
      // 清空旧内容
      setShortAnswer("");
      setLongAnswer("");
      setSuggestions([]);
      hasChunkRef.current = false;

      try {
        const timeoutId = setTimeout(() => {
          if (!hasChunkRef.current) {
            setShortAnswer("Timeout: no response from bot");
            setIsLoading(false);
          }
        }, 25000);

        const shortPrompt = buildShortPrompt(q);
        const longPrompt = buildLongPrompt(q);
        
        console.log('[App] 同时发起短答和长答请求');
        
        // 短答请求 - 累积所有片段
        const shortPromise = (async () => {
          try {
            const stream = await streamQuestion(shortPrompt);
            console.log('[App] 短答流已建立');
            let accumulated = "";
            
            for await (const evt of stream) {
              const chunk = extractAssistantText(evt);
              if (!chunk) continue;
              const cleanedChunk = cleanRecallSuffix(chunk);
              if (!cleanedChunk) continue;
              hasChunkRef.current = true;
              
              if (isRecommendedQuestion(cleanedChunk)) {
                setSuggestions((prev) => (prev.includes(cleanedChunk) ? prev : [...prev, cleanedChunk]));
              } else {
                // 累积短答内容
                accumulated += (accumulated ? "\n\n" : "") + cleanedChunk;
                setShortAnswer(accumulated);
              }
            }
            
            console.log('[App] 短答流结束');
          } catch (error) {
            const detail = getErrorMessage(error);
            console.error("Error calling Coze API (short):", detail);
            setShortAnswer("Error: Failed to get short answer");
          } finally {
            setIsLoadingShort(false);
          }
        })();

        // 长答请求 - 累积所有片段
        const longPromise = (async () => {
          try {
            const longStream = await streamQuestion(longPrompt);
            console.log('[App] 长答流已建立');
            let accumulated = "";
            
            for await (const evt of longStream) {
              const chunk = extractAssistantText(evt);
              if (!chunk) continue;
              hasChunkRef.current = true;
              
              const cleaned = cleanRecallSuffix(chunk);
              if (!cleaned.trim()) continue;
              if (isRecommendedQuestion(cleaned)) {
                continue;
              }
              // 累积长答内容
              accumulated += (accumulated ? "\n\n" : "") + cleaned;
              setLongAnswer(accumulated);
            }
            
            console.log('[App] 长答流结束');
          } catch (error) {
            const detail = getErrorMessage(error);
            console.error("Error calling Coze API (long):", detail);
            setLongAnswer("Error: Failed to get detailed answer");
          } finally {
            setIsLoadingLong(false);
          }
        })();

        await Promise.all([shortPromise, longPromise]);
        clearTimeout(timeoutId);
      } catch (error) {
        const detail = getErrorMessage(error);
        console.error("Error calling Coze API:", detail);
        setShortAnswer("Error: Failed to get response from bot");
      } finally {
        setIsLoading(false);
        setIsLoadingShort(false);
        setIsLoadingLong(false);
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

  const handleRefresh = (): void => {
    setShortAnswer("");
    setLongAnswer("");
    setSuggestions([]);
  };

  const focusInput = (e?: SyntheticEvent): void => {
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
        <Tab $active={true}>Chat</Tab>
        <FlexSpacer />
        <RefreshButton
          aria-label="刷新回答"
          title="刷新回答"
          onClick={handleRefresh}
        >
          <RefreshIcon />
        </RefreshButton>
      </TopBar>

      <AnswersContainer>
        {/* 短答区域 */}
        {(isLoadingShort || shortAnswer) && (
          <>
            <AnswerSectionTitle>
              ⚡ 快速回答
              {isLoadingShort && <LoadingIcon src={loadingIconUrl} alt="loading" />}
            </AnswerSectionTitle>
            {shortAnswer && (
              <AnswerItem>
                <div className="answer-text">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{shortAnswer}</ReactMarkdown>
                </div>
                <div
                  className="icon-wrapper"
                  role="button"
                  title="复制该回答"
                  tabIndex={0}
                  onClick={handleCopyIconClick}
                >
                  <SendIcon />
                </div>
              </AnswerItem>
            )}
          </>
        )}

        {/* 长答区域 */}
        {(isLoadingLong || longAnswer) && (
          <>
            <AnswerSectionTitle>
              📚 详细回答
              {isLoadingLong && <LoadingIcon src={loadingIconUrl} alt="loading" />}
            </AnswerSectionTitle>
            {longAnswer && (
              <AnswerItem>
                <div className="answer-text">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{longAnswer}</ReactMarkdown>
                </div>
                <div
                  className="icon-wrapper"
                  role="button"
                  title="复制该回答"
                  tabIndex={0}
                  onClick={handleCopyIconClick}
                >
                  <SendIcon />
                </div>
              </AnswerItem>
            )}
          </>
        )}

        {/* 推荐问题 */}
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
                    focusInput(e as any);
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

      <InputContainer>
        <QuestionInput
          ref={textareaRef}
          placeholder="Ask complex questions (Enter to send)"
          value={question}
          onChange={handleInput}
          onKeyDown={handleKeyPress}
          rows={1}
        />
        <SendLink
          href="#"
          aria-label="send"
          title="Send"
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.preventDefault();
            handleConfirm();
          }}
        >
          Send
        </SendLink>
      </InputContainer>
    </Container>
  );
}

export default App;
