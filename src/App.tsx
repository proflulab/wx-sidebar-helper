import { useState, useRef, useEffect, Fragment } from "react";
import loadingIconUrl from "./assets/loading.png";
import type { KeyboardEvent, ChangeEvent, SyntheticEvent } from "react";
import styled, { keyframes } from "styled-components";
import { CopyOutlined, ReloadOutlined, DeleteOutlined, SearchOutlined } from "@ant-design/icons";
import { streamQuestion as streamDoubaoQuestion } from "./client_doubao";
import { buildMeetingNotice } from "./meetingNotice";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import doubaoCorpus from "./assets/resources/doubao-corpus.md?raw";
import { useChatHistory } from "./hooks/useChatHistory";

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

const SectionTitle = styled.div`
  font-size: 14px;
  color: #666;
  margin-bottom: 8px;
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

// 历史记录样式
const HistoryContainer = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const HistoryHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding: 0 4px;
`;

const HistoryTitle = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: #3b4a59;
`;

const ClearButton = styled.button`
  border: none;
  background: transparent;
  color: #8a9aa9;
  font-size: 12px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: all 0.2s ease;

  &:hover {
    background: #f4f7fb;
    color: #d14343;
  }
`;

const HistoryFilters = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 12px;
  padding: 0 4px;
`;

const SearchBox = styled.div`
  position: relative;
  display: flex;
  align-items: center;
`;

const SearchInput = styled.input`
  width: 100%;
  padding: 8px 12px 8px 36px;
  border: 1px solid #e6e6e6;
  border-radius: 8px;
  font-size: 13px;
  background: white;
  color: #333;
  transition: all 0.2s ease;

  &::placeholder {
    color: #8a9aa9;
  }

  &:focus {
    outline: none;
    border-color: #1890ff;
    box-shadow: 0 2px 8px rgba(24, 144, 255, 0.1);
  }
`;

const SearchIcon = styled(SearchOutlined)`
  position: absolute;
  left: 12px;
  font-size: 14px;
  color: #8a9aa9;
  pointer-events: none;
`;

const TimeFilterButtons = styled.div`
  display: flex;
  gap: 6px;
`;

const TimeFilterButton = styled.button<{ $active?: boolean }>`
  flex: 1;
  border: 1px solid ${({ $active }) => ($active ? "#1890ff" : "#e6e6e6")};
  background: ${({ $active }) => ($active ? "#e6f4ff" : "white")};
  color: ${({ $active }) => ($active ? "#1890ff" : "#5b6b7a")};
  font-size: 12px;
  font-weight: ${({ $active }) => ($active ? 600 : 400)};
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: #1890ff;
    background: ${({ $active }) => ($active ? "#e6f4ff" : "#f5f8fc")};
  }
`;

const HistoryListContainer = styled.div`
  flex: 1;
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

const HistoryList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const HistoryItem = styled.div`
  background: linear-gradient(180deg, #fbfdff 0%, #ffffff 100%);
  border: 1px solid #e8eef7;
  border-left: 3px solid #0b57d0;
  border-radius: 10px;
  padding: 12px;
  transition: all 0.25s ease;
  box-shadow: 0 2px 8px rgba(11, 87, 208, 0.05);
  cursor: pointer;

  &:hover {
    border-color: #1890ff;
    box-shadow: 0 4px 12px rgba(11, 87, 208, 0.15);
    transform: translateY(-1px);
    background: linear-gradient(180deg, #f0f7ff 0%, #ffffff 100%);
  }

  &:focus {
    outline: 2px solid #1890ff;
    outline-offset: 2px;
  }
`;

const HistoryItemHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 8px;
`;

const HistoryQuestion = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: #0f172a;
  line-height: 1.5;
  flex: 1;
  word-break: break-word;
  transition: color 0.2s ease;
`;

const HistoryActions = styled.div`
  display: flex;
  gap: 4px;
  flex-shrink: 0;
`;

const HistoryActionButton = styled.button`
  border: none;
  background: transparent;
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #8a9aa9;
  transition: all 0.2s ease;

  &:hover {
    background: #f4f7fb;
    color: #5b6b7a;
  }

  &.delete:hover {
    color: #d14343;
    background: #fff1f0;
  }
`;

const HistoryAnswers = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const HistoryAnswerPreview = styled.div`
  font-size: 12px;
  color: #5b6b7a;
  line-height: 1.6;
  padding: 8px 10px;
  background: #f8fafc;
  border-radius: 6px;
  border: 1px solid #eef2f6;
  max-height: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  transition: all 0.2s ease;
`;

const HistoryTimestamp = styled.div`
  font-size: 11px;
  color: #8a9aa9;
  margin-top: 6px;
`;

const HistoryEmpty = styled.div`
  font-size: 13px;
  color: #8a9aa9;
  text-align: center;
  padding: 40px 20px;
`;

const HistoryLoading = styled.div`
  font-size: 13px;
  color: #8a9aa9;
  text-align: center;
  padding: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
`;

const HistoryError = styled.div`
  font-size: 13px;
  color: #d14343;
  text-align: center;
  padding: 20px;
  background: #fff1f0;
  border-radius: 8px;
  margin: 0 4px;
`;

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
  const [question, setQuestion] = useState<string>("");
  const [answers, setAnswers] = useState<string[]>([]);
  const [doubaoEntry, setDoubaoEntry] = useState<{ question: string; answer: string }>({
    question: "",
    answer: "",
  });
  const [doubaoSaving, setDoubaoSaving] = useState<boolean>(false);
  const [doubaoStatus, setDoubaoStatus] = useState<string>("");
  const [doubaoError, setDoubaoError] = useState<string>("");
  
  // 使用 IndexedDB Hook 管理历史记录
  const { 
    history, 
    isLoading: historyLoading,
    error: historyError,
    addHistoryItem, 
    deleteHistoryItem, 
    clearHistory,
    searchAndFilter,
    resetFilter,
  } = useChatHistory();
  
  // 历史记录筛选状态
  const [historySearchQuery, setHistorySearchQuery] = useState<string>("");
  const [historyTimeFilter, setHistoryTimeFilter] = useState<"all" | "today" | "week" | "month">("all");
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const [, setHasConfirmed] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLoadingFirst, setIsLoadingFirst] = useState<boolean>(false);
  const [isLoadingSecond, setIsLoadingSecond] = useState<boolean>(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const chatSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const meetingBuildTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  // 处理历史记录搜索
  const handleHistorySearch = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setHistorySearchQuery(value);
    
    // 防抖搜索
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }
    
    searchTimerRef.current = setTimeout(() => {
      searchAndFilter(value, historyTimeFilter);
    }, 300);
  };

  // 处理时间筛选
  const handleTimeFilter = (filter: "all" | "today" | "week" | "month") => {
    setHistoryTimeFilter(filter);
    searchAndFilter(historySearchQuery, filter);
  };

  // 格式化时间戳
  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "刚刚";
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;
    
    return date.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // 从历史记录加载问题和回答
  const loadHistoryItem = (id: string, e?: SyntheticEvent): void => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const item = history.find((h) => h.id === id);
    if (item) {
      setQuestion(item.question);
      setAnswers(item.answers);
      setActiveTab("Chat");
      // 使用 setTimeout 确保标签页切换完成后再聚焦
      setTimeout(() => {
        focusHeroInput();
      }, 100);
    }
  };

  const handleConfirm = async (): Promise<void> => {
    if (question.trim() && !isLoading) {
      const q = question.trim();
      queueChatSave(question);
      setQuestion("");
      setIsLoading(true);
      setIsLoadingFirst(true);
      setIsLoadingSecond(false);
      // 新问题开始时清空旧内容
      setAnswers([]);

      // 用于收集所有回答
      const collectedAnswers: string[] = [];

      try {
        const shortPrompt = buildDoubaoShortPrompt(q);
        const shortStream = await streamDoubaoQuestion(shortPrompt);
        let shortStarted = false;
        let shortHasChunk = false;
        let shortAnswer = "";

        // 超时保护：若 25s 内无片段到达，提示失败
        const shortTimeoutId = setTimeout(() => {
          if (!shortHasChunk) {
            const errorMsg = "Timeout: no response from bot";
            setAnswers((prev) => [...prev, errorMsg]);
            collectedAnswers.push(errorMsg);
            setIsLoading(false);
          }
        }, 25000);

        for await (const chunk of shortStream) {
          if (!chunk) continue;
          shortHasChunk = true;
          shortAnswer += chunk;
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
        if (shortAnswer) {
          collectedAnswers.push(shortAnswer);
        }

        setIsLoadingSecond(true);
        const longPrompt = buildDoubaoLongPrompt(q);
        const longStream = await streamDoubaoQuestion(longPrompt);
        let longStarted = false;
        let longHasChunk = false;
        let longAnswer = "";

        const longTimeoutId = setTimeout(() => {
          if (!longHasChunk) {
            const errorMsg = "Timeout: no response from bot";
            setAnswers((prev) => [...prev, errorMsg]);
            collectedAnswers.push(errorMsg);
            setIsLoading(false);
          }
        }, 25000);

        for await (const chunk of longStream) {
          if (!chunk) continue;
          longHasChunk = true;
          longAnswer += chunk;
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
        if (longAnswer) {
          collectedAnswers.push(longAnswer);
        }

        // 保存到 IndexedDB
        if (collectedAnswers.length > 0) {
          await addHistoryItem(q, collectedAnswers);
        }
      } catch (error) {
        const detail = getErrorMessage(error);
        console.error("Error calling chat API:", detail);
        const errorMsg = "Error: Failed to get response from bot";
        setAnswers((prev) => [...prev, errorMsg]);
        collectedAnswers.push(errorMsg);
        // 即使出错也保存到历史记录
        await addHistoryItem(q, collectedAnswers);
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
      clearTimeout(chatSaveTimerRef.current);
    }
    chatSaveTimerRef.current = setTimeout(() => {
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
      clearTimeout(meetingBuildTimerRef.current);
    }
    meetingBuildTimerRef.current = setTimeout(() => {
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
          <HistoryHeader>
            <HistoryTitle>对话历史</HistoryTitle>
            {history.length > 0 && (
              <ClearButton onClick={clearHistory}>清空全部</ClearButton>
            )}
          </HistoryHeader>

          <HistoryFilters>
            <SearchBox>
              <SearchIcon />
              <SearchInput
                type="text"
                placeholder="搜索问题..."
                value={historySearchQuery}
                onChange={handleHistorySearch}
              />
            </SearchBox>
            <TimeFilterButtons>
              <TimeFilterButton
                $active={historyTimeFilter === "all"}
                onClick={() => handleTimeFilter("all")}
              >
                全部
              </TimeFilterButton>
              <TimeFilterButton
                $active={historyTimeFilter === "today"}
                onClick={() => handleTimeFilter("today")}
              >
                今天
              </TimeFilterButton>
              <TimeFilterButton
                $active={historyTimeFilter === "week"}
                onClick={() => handleTimeFilter("week")}
              >
                本周
              </TimeFilterButton>
              <TimeFilterButton
                $active={historyTimeFilter === "month"}
                onClick={() => handleTimeFilter("month")}
              >
                本月
              </TimeFilterButton>
            </TimeFilterButtons>
          </HistoryFilters>

          {historyLoading ? (
            <HistoryLoading>
              <LoadingIcon src={loadingIconUrl} alt="loading" />
              <span>加载中...</span>
            </HistoryLoading>
          ) : historyError ? (
            <HistoryError>{historyError}</HistoryError>
          ) : history.length === 0 ? (
            <HistoryEmpty>
              {historySearchQuery || historyTimeFilter !== "all"
                ? "没有找到匹配的记录"
                : "暂无历史记录"}
            </HistoryEmpty>
          ) : (
            <HistoryListContainer>
              <HistoryList>
                {history.map((item) => (
                  <HistoryItem
                    key={item.id}
                    onClick={(e) => loadHistoryItem(item.id, e)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        loadHistoryItem(item.id);
                      }
                    }}
                  >
                    <HistoryItemHeader>
                      <HistoryQuestion>{item.question}</HistoryQuestion>
                      <HistoryActions>
                        <HistoryActionButton
                          className="delete"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteHistoryItem(item.id);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              e.stopPropagation();
                              deleteHistoryItem(item.id);
                            }
                          }}
                          title="删除"
                          tabIndex={0}
                        >
                          <DeleteOutlined style={{ fontSize: 14 }} />
                        </HistoryActionButton>
                      </HistoryActions>
                    </HistoryItemHeader>
                    <HistoryAnswers>
                      {item.answers.map((answer, idx) => (
                        <HistoryAnswerPreview key={idx}>
                          {answer}
                        </HistoryAnswerPreview>
                      ))}
                    </HistoryAnswers>
                    <HistoryTimestamp>
                      {formatTimestamp(item.timestamp)}
                    </HistoryTimestamp>
                  </HistoryItem>
                ))}
              </HistoryList>
            </HistoryListContainer>
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

          </AnswersContainer>

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
