import { useState, useRef, useEffect, Fragment } from "react";
import loadingIconUrl from "./assets/loading.png";
import type { KeyboardEvent, ChangeEvent, SyntheticEvent } from "react";
import styled, { keyframes } from "styled-components";
import { CopyOutlined, ReloadOutlined, SaveOutlined } from "@ant-design/icons";
import { streamQuestion } from "./client_kn";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { saveToHistory, updateLatestAnswer, getHistory, type HistoryRecord, type TimeFilter } from "./supabase";

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

// 顶部标签栏（仿 Bing：Chat / Compose / History）
const TopBar = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
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

// 保存选项开关
const SaveOptionContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #5b6b7a;
  padding: 4px 8px;
  background: #f8f9fa;
  border-radius: 6px;
  margin-left: 8px;
`;

const SaveOptionLabel = styled.span`
  font-weight: 500;
`;

const SaveOptionSwitch = styled.select`
  border: 1px solid #e0e0e0;
  background: white;
  color: #333;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  
  &:focus {
    outline: none;
    border-color: #1890ff;
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

const SaveIcon = styled(SaveOutlined)`
  color: #52c41a;
  font-size: 16px;
  opacity: 0.8;
  transition: all 0.3s ease;
  flex-shrink: 0;

  &:hover {
    opacity: 1;
  }
`;

// 保存选择面板（侧边栏内嵌）
const SavePanel = styled.div`
  background: linear-gradient(180deg, #fffbeb 0%, #ffffff 100%);
  padding: 16px;
  margin-bottom: 16px;
  border-radius: 12px;
  border: 1px solid #fde68a;
  border-left: 3px solid #F4D06F;
  box-shadow: 0 4px 16px rgba(245, 196, 83, 0.15);
  animation: slideIn 0.3s ease;
  position: relative;

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

const SavePanelTitle = styled.div`
  font-size: 15px;
  font-weight: 600;
  color: #92400e;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const SavePanelMessage = styled.div`
  font-size: 13px;
  color: #78350f;
  margin-bottom: 14px;
  display: flex;
  align-items: center;
  gap: 6px;
`;

const SavePanelButtons = styled.div`
  display: flex;
  gap: 8px;
`;

const SavePanelButton = styled.button<{ $primary?: boolean }>`
  flex: 1;
  padding: 11px 14px;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  
  ${({ $primary }) => $primary ? `
    background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
    color: white;
    box-shadow: 0 2px 8px rgba(245, 158, 11, 0.3);
    border: 1px solid #f59e0b;
    
    &:hover {
      background: linear-gradient(135deg, #fcd34d 0%, #fbbf24 100%);
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(245, 158, 11, 0.4);
    }
  ` : `
    background: white;
    color: #92400e;
    border: 1px solid #fde68a;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    
    &:hover {
      background: #fffbeb;
      border-color: #fbbf24;
      box-shadow: 0 2px 6px rgba(245, 196, 83, 0.15);
    }
  `}
  
  &:active {
    transform: scale(0.98);
  }
`;

const CountdownBadge = styled.span`
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  padding: 3px 10px;
  border-radius: 12px;
  font-weight: 700;
  font-size: 13px;
  border: 1px solid #fbbf24;
  color: #92400e;
  box-shadow: 0 1px 3px rgba(245, 158, 11, 0.2);
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

const SuggestionAction = styled.a`
  color: #0b57d0;
  text-decoration: none;
  font-weight: 600;

  &:hover { text-decoration: underline; }
`;

// 欢迎区与功能卡片（仿图示布局）
const HeroSection = styled.div`
  background: #ffffff;
  border: 1px solid #f0f0f0;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  padding: 12px 14px;
  margin: 10px 0 12px;
`;

const HeroTitle = styled.div`
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 8px;
`;

const HeroCards = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const HeroCard = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fafafa;
  border: 1px solid #eeeeee;
  border-radius: 10px;
  padding: 10px 12px;
`;

const HeroCardText = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #334155;

  a {
    color: #0b57d0;
    text-decoration: none;
    font-weight: 600;
  }
`;

const Emoji = styled.span`
  font-size: 18px;
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

// 历史记录样式
const HistoryContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 20px 16px 16px;
  background: linear-gradient(180deg, #fafbfc 0%, #ffffff 100%);
`;

const HistoryHeader = styled.div`
  margin-bottom: 18px;
  padding-bottom: 4px;
`;

const HistoryTitle = styled.div`
  font-size: 18px;
  font-weight: 700;
  color: #1f2937;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 10px;
  
  span:first-child {
    font-size: 24px;
  }
`;

const SearchInputWrapper = styled.div`
  position: relative;
  margin-bottom: 12px;
`;

const SearchIcon = styled.span`
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: #9ca3af;
  font-size: 16px;
  pointer-events: none;
  z-index: 1;
`;

const ClearSearchButton = styled.button`
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  background: #f3f4f6;
  border: none;
  color: #6b7280;
  cursor: pointer;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.2s ease;
  z-index: 1;

  &:hover {
    background: #e5e7eb;
    color: #374151;
  }
  
  &:active {
    transform: translateY(-50%) scale(0.95);
  }
`;

const HistorySearchInput = styled(QuestionInput)`
  padding-left: 42px;
  padding-right: 70px;
  min-height: 44px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  font-size: 14px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  transition: all 0.25s ease;
  
  &::placeholder {
    color: #9ca3af;
    font-size: 14px;
  }
  
  &:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1), 0 2px 8px rgba(0, 0, 0, 0.04);
    background: #fafbfc;
  }
  
  &:hover:not(:focus) {
    border-color: #d1d5db;
  }
`;

const HistoryStats = styled.div`
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 10px;
  padding: 8px 12px;
  background: linear-gradient(135deg, #f9fafb 0%, #ffffff 100%);
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  gap: 6px;
  
  &::before {
    content: '📊';
    font-size: 14px;
  }
`;

const HistoryListWrapper = styled.div`
  flex: 1;
  overflow-y: auto;
  margin: 0 -16px;
  padding: 0 16px;
  
  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: #d1d5db;
    border-radius: 3px;
  }

  &::-webkit-scrollbar-thumb:hover {
    background: #9ca3af;
  }
`;

const HistoryList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const HistoryItem = styled.div`
  display: flex;
  flex-direction: column;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 12px 14px;
  cursor: pointer;
  transition: all 0.25s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);

  &:hover {
    background: linear-gradient(180deg, #f9fafb 0%, #ffffff 100%);
    border-color: #3b82f6;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
  }

  &:active {
    transform: translateY(0);
  }
`;

const HistoryItemQuestion = styled.div`
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 6px;
  font-size: 13px;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  
  mark {
    background: #fef3c7;
    color: #92400e;
    padding: 2px 4px;
    border-radius: 3px;
    font-weight: 700;
  }
`;

const HistoryItemAnswer = styled.div`
  font-size: 12px;
  color: #6b7280;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  
  mark {
    background: #fef3c7;
    color: #92400e;
    padding: 1px 3px;
    border-radius: 2px;
  }
`;

const HistoryItemMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #f3f4f6;
  font-size: 11px;
  color: #9ca3af;
`;

const HistoryItemTime = styled.span`
  display: flex;
  align-items: center;
  gap: 4px;
`;

const HistoryItemActions = styled.div`
  display: flex;
  gap: 4px;
  margin-left: auto;
  opacity: 0;
  transition: opacity 0.2s ease;
  
  ${HistoryItem}:hover & {
    opacity: 1;
  }
`;

const HistoryActionButton = styled.button`
  background: transparent;
  border: none;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: #f3f4f6;
    color: #1f2937;
  }
`;

const SortButton = styled.button<{ $active?: boolean }>`
  background: ${({ $active }) => ($active ? "linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)" : "white")};
  border: 1px solid ${({ $active }) => ($active ? "#3b82f6" : "#e5e7eb")};
  color: ${({ $active }) => ($active ? "#1e40af" : "#6b7280")};
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: ${({ $active }) => ($active ? 600 : 500)};
  cursor: pointer;
  transition: all 0.25s ease;
  display: flex;
  align-items: center;
  gap: 6px;
  box-shadow: ${({ $active }) => 
    $active ? "0 2px 8px rgba(59, 130, 246, 0.2)" : "0 1px 3px rgba(0, 0, 0, 0.05)"};
  
  span {
    font-size: 14px;
    transition: transform 0.25s ease;
  }
  
  &:hover {
    background: ${({ $active }) => ($active ? "linear-gradient(135deg, #bfdbfe 0%, #93c5fd 100%)" : "#f0f9ff")};
    border-color: #3b82f6;
    transform: translateY(-1px);
    box-shadow: ${({ $active }) => 
      $active ? "0 4px 12px rgba(59, 130, 246, 0.3)" : "0 2px 6px rgba(59, 130, 246, 0.15)"};
    
    span {
      transform: scale(1.1);
    }
  }
  
  &:active {
    transform: translateY(0) scale(0.98);
  }
`;

const SortOptions = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
`;

const TimeFilterOptions = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-bottom: 14px;
`;

const TimeFilterButton = styled.button<{ $active?: boolean; disabled?: boolean }>`
  background: ${({ $active, disabled }) => 
    disabled ? "#f9fafb" : $active ? "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)" : "white"};
  border: 1px solid ${({ $active, disabled }) => 
    disabled ? "#e5e7eb" : $active ? "#fbbf24" : "#e5e7eb"};
  color: ${({ $active, disabled }) => 
    disabled ? "#9ca3af" : $active ? "#92400e" : "#6b7280"};
  padding: 10px 6px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: ${({ $active }) => ($active ? 600 : 500)};
  cursor: ${({ disabled }) => (disabled ? "not-allowed" : "pointer")};
  transition: all 0.25s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  opacity: ${({ disabled }) => (disabled ? 0.5 : 1)};
  box-shadow: ${({ $active }) => 
    $active ? "0 3px 10px rgba(251, 191, 36, 0.3)" : "0 2px 6px rgba(0, 0, 0, 0.04)"};
  position: relative;
  overflow: hidden;
  
  /* 激活状态的光泽效果 */
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
    transition: left 0.5s ease;
  }
  
  span:first-child {
    font-size: 20px;
    line-height: 1;
    transition: transform 0.25s ease;
  }
  
  span:last-child {
    line-height: 1.2;
    white-space: nowrap;
  }
  
  &:hover:not(:disabled) {
    background: ${({ $active, disabled }) => 
      disabled ? "#f9fafb" : $active ? "linear-gradient(135deg, #fde68a 0%, #fcd34d 100%)" : "#fffbeb"};
    border-color: ${({ disabled }) => (disabled ? "#e5e7eb" : "#fbbf24")};
    transform: ${({ disabled }) => (disabled ? "none" : "translateY(-2px)")};
    box-shadow: ${({ $active, disabled }) => 
      disabled ? "0 2px 6px rgba(0, 0, 0, 0.04)" : 
      $active ? "0 6px 16px rgba(251, 191, 36, 0.4)" : "0 4px 10px rgba(245, 196, 83, 0.2)"};
    
    span:first-child {
      transform: scale(1.1);
    }
    
    &::before {
      left: 100%;
    }
  }
  
  &:active:not(:disabled) {
    transform: ${({ disabled }) => (disabled ? "none" : "translateY(0) scale(0.96)")};
  }
`;

const TimeFilterHint = styled.div`
  font-size: 11px;
  color: #92400e;
  background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
  border: 1px solid #fde68a;
  border-left: 3px solid #f59e0b;
  padding: 12px 14px;
  border-radius: 10px;
  margin-bottom: 14px;
  display: flex;
  align-items: center;
  gap: 10px;
  line-height: 1.6;
  box-shadow: 0 2px 8px rgba(245, 158, 11, 0.1);
  
  span:first-child {
    font-size: 16px;
    flex-shrink: 0;
  }
  
  a {
    color: #f59e0b;
    text-decoration: underline;
    font-weight: 600;
    transition: color 0.2s ease;
    
    &:hover {
      color: #d97706;
    }
  }
`;

const HistoryEmpty = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
  color: #9ca3af;
`;

const HistoryEmptyIcon = styled.div`
  font-size: 48px;
  margin-bottom: 12px;
  opacity: 0.5;
`;

const HistoryEmptyText = styled.div`
  font-size: 14px;
  color: #6b7280;
  margin-bottom: 4px;
`;

const HistoryEmptyHint = styled.div`
  font-size: 12px;
  color: #9ca3af;
`;

// 历史详情弹窗样式
const HistoryDetailOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
  backdrop-filter: blur(4px);
`;

const HistoryDetailModal = styled.div`
  background: white;
  border-radius: 16px;
  width: 100%;
  max-width: 500px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  animation: slideUp 0.3s ease;

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

const HistoryDetailHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid #e5e7eb;
`;

const HistoryDetailTitle = styled.div`
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const HistoryDetailClose = styled.button`
  background: transparent;
  border: none;
  font-size: 24px;
  color: #9ca3af;
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  transition: all 0.2s ease;
  line-height: 1;

  &:hover {
    background: #f3f4f6;
    color: #6b7280;
  }
`;

const HistoryDetailContent = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 24px;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: #d1d5db;
    border-radius: 3px;
  }

  &::-webkit-scrollbar-thumb:hover {
    background: #9ca3af;
  }
`;

const HistoryDetailSection = styled.div`
  margin-bottom: 24px;

  &:last-child {
    margin-bottom: 0;
  }
`;

const HistoryDetailLabel = styled.div`
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
`;

const HistoryDetailText = styled.div`
  font-size: 14px;
  color: #1f2937;
  line-height: 1.6;
  background: #f9fafb;
  padding: 16px;
  border-radius: 10px;
  border: 1px solid #e5e7eb;
  white-space: pre-wrap;
  word-break: break-word;

  &.answer {
    background: linear-gradient(180deg, #f0f9ff 0%, #ffffff 100%);
    border-color: #bfdbfe;
    
    /* Markdown 样式 */
    h1, h2, h3 {
      color: #0f172a;
      font-weight: 600;
      margin: 12px 0 8px;
      line-height: 1.3;
    }
    h1 { font-size: 18px; }
    h2 { font-size: 16px; }
    h3 { font-size: 15px; }

    p { margin: 8px 0; }

    ul, ol { margin: 8px 0 8px 20px; }
    li { margin: 4px 0; }

    a {
      color: #3b82f6;
      text-decoration: none;
      &:hover { text-decoration: underline; }
    }

    code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      background: #f3f5f7;
      border: 1px solid #e6e8eb;
      border-radius: 4px;
      padding: 2px 6px;
      font-size: 13px;
      color: #0f172a;
    }
    
    pre {
      background: #0f172a;
      color: #e6edf3;
      border-radius: 8px;
      padding: 12px;
      overflow: auto;
      margin: 12px 0;
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
      border-left: 3px solid #3b82f6;
      color: #334155;
      margin: 12px 0;
      padding: 8px 12px;
      border-radius: 6px;
    }
    
    hr {
      border: none;
      border-top: 1px dashed #e5e7eb;
      margin: 16px 0;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 12px 0;
    }
    
    th, td {
      border: 1px solid #e5e7eb;
      padding: 8px 10px;
      text-align: left;
    }
    
    th {
      background: #f3f6fb;
      color: #0f172a;
      font-weight: 600;
    }

    img {
      max-width: 100%;
      height: auto;
      display: block;
      margin: 12px 0;
      border-radius: 8px;
    }
  }
`;

const HistoryDetailFooter = styled.div`
  display: flex;
  gap: 8px;
  padding: 16px 24px;
  border-top: 1px solid #e5e7eb;
  background: #f9fafb;
  border-radius: 0 0 16px 16px;
`;

const HistoryDetailButton = styled.button<{ $primary?: boolean }>`
  flex: 1;
  padding: 10px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid ${({ $primary }) => ($primary ? "#3b82f6" : "#e5e7eb")};
  background: ${({ $primary }) => ($primary ? "#3b82f6" : "white")};
  color: ${({ $primary }) => ($primary ? "white" : "#6b7280")};

  &:hover {
    background: ${({ $primary }) => ($primary ? "#2563eb" : "#f9fafb")};
    border-color: ${({ $primary }) => ($primary ? "#2563eb" : "#3b82f6")};
    color: ${({ $primary }) => ($primary ? "white" : "#3b82f6")};
  }

  &:active {
    transform: scale(0.98);
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
  const [activeTab, setActiveTab] = useState<"Chat" | "Compose" | "History">("Chat");
  const [question, setQuestion] = useState<string>("");
  const [answers, setAnswers] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [dbHistory, setDbHistory] = useState<HistoryRecord[]>([]); // Supabase历史记录
  const [hasCreatedAtColumn, setHasCreatedAtColumn] = useState<boolean>(true); // 表是否有 created_at 列
  const [historySearch, setHistorySearch] = useState<string>(""); // 历史记录搜索
  const [historySortBy, setHistorySortBy] = useState<"time" | "relevance">("time"); // 排序方式
  const [historyTimeFilter, setHistoryTimeFilter] = useState<TimeFilter>("all"); // 时间筛选
  const [selectedHistory, setSelectedHistory] = useState<HistoryRecord | null>(null); // 选中的历史记录
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false); // 加载历史记录
  const [, setHasConfirmed] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLoadingFirst, setIsLoadingFirst] = useState<boolean>(false);
  const [isLoadingSecond, setIsLoadingSecond] = useState<boolean>(false);
  const [showSavePrompt, setShowSavePrompt] = useState<boolean>(false); // 显示保存提示
  const [countdown, setCountdown] = useState<number>(5); // 倒计时
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const hasChunkRef = useRef<boolean>(false);
  const currentQuestionRef = useRef<string>("");
  const shortAnswerRef = useRef<string>("");
  const longAnswerRef = useRef<string>("");
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 从 Supabase 加载历史记录
  const loadHistory = async (timeFilter: TimeFilter = historyTimeFilter) => {
    console.log('App: 开始加载历史记录，时间筛选:', timeFilter);
    setIsLoadingHistory(true);
    try {
      const records = await getHistory(timeFilter);
      console.log('App: 获取到', records.length, '条历史记录');
      setDbHistory(records);
      
      // 检查是否有时间字段（time 或 created_at）
      if (records.length > 0) {
        const hasTime = records[0].time || records[0].created_at;
        console.log('检测时间字段:', { time: records[0].time, created_at: records[0].created_at, hasTime });
        setHasCreatedAtColumn(!!hasTime);
        
        // 如果没有时间列，重置时间筛选为 "all"
        if (!hasTime && timeFilter !== 'all') {
          setHistoryTimeFilter('all');
        }
      } else {
        // 如果没有记录，假设有时间列（避免误判）
        console.log('没有历史记录，假设有时间列');
        setHasCreatedAtColumn(true);
      }
    } catch (error) {
      console.error('App: 加载历史记录失败:', error);
      if (error instanceof Error) {
        console.error('App: 错误详情:', error.message);
      }
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // 当切换到 History 标签或时间筛选改变时加载历史记录
  useEffect(() => {
    if (activeTab === 'History') {
      console.log('切换到 History 标签或时间筛选改变，触发加载');
      loadHistory(historyTimeFilter);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, historyTimeFilter]);

  // 保存回答到 Supabase（type: 'short' | 'long'）
  const handleSaveAnswer = async (type: 'short' | 'long'): Promise<void> => {
    // 清除倒计时
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    setShowSavePrompt(false);
    
    const question = currentQuestionRef.current;
    const answer = type === 'short' ? shortAnswerRef.current : longAnswerRef.current;
    
    // 使用更新函数而不是插入新记录
    const success = await updateLatestAnswer(question || '', answer || '');
    
    // 静默保存，不显示弹窗
    console.log(success ? `✓ 已保存${type === 'short' ? '短' : '长'}回答` : '✗ 保存失败');
  };

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
      const questionTime = new Date(); // 记录提问时间
      
      setHistory((prev) => {
        const next = [q, ...prev.filter((it) => it !== q)];
        return next.slice(0, 10);
      });
      setIsLoading(true);
      setIsLoadingFirst(true);
      setIsLoadingSecond(true);
      setAnswers([]);
      setSuggestions([]);
      hasChunkRef.current = false;
      currentQuestionRef.current = q;
      shortAnswerRef.current = "";
      longAnswerRef.current = "";

      // 立即保存问题和提问时间到数据库
      console.log('保存问题到数据库，时间:', questionTime.toISOString());
      await saveToHistory({
        question: q,
        answer: null, // 先保存问题，答案稍后更新
        time: questionTime,
      });

      const shortPrompt = buildShortPrompt(q);
      const longPrompt = buildLongPrompt(q);

      // 并行请求短答和长答，提升速度
      const shortTask = (async () => {
        try {
          console.log('开始短答请求，问题:', shortPrompt);
          const stream = await streamQuestion(shortPrompt);
          console.log('短答 stream 已获取');
          let accumulatedShort = "";
          let chunkCount = 0;
          for await (const text of stream) {
            chunkCount++;
            console.log(`短答 chunk ${chunkCount}:`, text);
            // streamQuestion 直接返回字符串，不需要 extractAssistantText
            if (!text) continue;
            const cleaned = cleanRecallSuffix(text);
            if (!cleaned) continue;
            hasChunkRef.current = true;
            if (isRecommendedQuestion(cleaned)) {
              setSuggestions((prev) => (prev.includes(cleaned) ? prev : [...prev, cleaned]));
            } else {
              accumulatedShort = cleaned; // 保存完整回答
              shortAnswerRef.current = cleaned;
              setAnswers((prev) => {
                const newArr = [...prev];
                newArr[0] = cleaned;
                return newArr;
              });
            }
          }
          console.log('短答完成，总共', chunkCount, '个chunk，内容:', accumulatedShort);
        } catch (error) {
          console.error("Error (short):", getErrorMessage(error));
          setAnswers((prev) => {
            const newArr = [...prev];
            newArr[0] = "Error: Failed to get short answer";
            return newArr;
          });
        } finally {
          setIsLoadingFirst(false);
        }
      })();

      const longTask = (async () => {
        try {
          console.log('开始长答请求，问题:', longPrompt);
          const stream = await streamQuestion(longPrompt);
          console.log('长答 stream 已获取');
          let accumulatedLong = "";
          let chunkCount = 0;
          for await (const text of stream) {
            chunkCount++;
            console.log(`长答 chunk ${chunkCount}:`, text);
            // streamQuestion 直接返回字符串，不需要 extractAssistantText
            if (!text) continue;
            const cleaned = cleanRecallSuffix(text);
            if (!cleaned || isRecommendedQuestion(cleaned)) continue;
            hasChunkRef.current = true;
            accumulatedLong = cleaned; // 保存完整回答
            longAnswerRef.current = cleaned;
            setAnswers((prev) => {
              const newArr = [...prev];
              newArr[1] = cleaned;
              return newArr;
            });
          }
          console.log('长答完成，总共', chunkCount, '个chunk，内容:', accumulatedLong);
        } catch (error) {
          console.error("Error (long):", getErrorMessage(error));
          setAnswers((prev) => {
            const newArr = [...prev];
            newArr[1] = "Error: Failed to get detailed answer";
            return newArr;
          });
        } finally {
          setIsLoadingSecond(false);
        }
      })();

      // 超时保护
      const timeoutId = setTimeout(() => {
        if (!hasChunkRef.current) {
          setAnswers(["Timeout: no response from bot"]);
          setIsLoading(false);
        }
      }, 25000);

      await Promise.all([shortTask, longTask]);
      clearTimeout(timeoutId);
      
      // 显示保存提示框，启动5秒倒计时
      setShowSavePrompt(true);
      setCountdown(5);
      
      let remainingTime = 5;
      const countdownInterval = setInterval(() => {
        remainingTime--;
        setCountdown(remainingTime);
        if (remainingTime <= 0) {
          clearInterval(countdownInterval);
        }
      }, 1000);
      
      // 5秒后自动保存短回答
      saveTimerRef.current = setTimeout(async () => {
        clearInterval(countdownInterval);
        setShowSavePrompt(false);
        
        const questionToSave = currentQuestionRef.current;
        const answerToSave = shortAnswerRef.current;
        
        console.log('自动保存短回答 - 问题:', questionToSave, '回答长度:', answerToSave?.length || 0);
        // 使用更新函数而不是插入新记录
        const saved = await updateLatestAnswer(questionToSave || '', answerToSave || '');
        console.log('保存结果:', saved ? '成功' : '失败');
      }, 5000);
      
      setHasConfirmed(true);
      setIsLoading(false);
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

  // 高亮搜索关键词
  const highlightText = (text: string, search: string): React.ReactElement => {
    if (!search.trim()) return <>{text}</>;
    
    const parts = text.split(new RegExp(`(${search})`, 'gi'));
    return (
      <>
        {parts.map((part, i) => 
          part.toLowerCase() === search.toLowerCase() ? (
            <mark key={i}>{part}</mark>
          ) : (
            <Fragment key={i}>{part}</Fragment>
          )
        )}
      </>
    );
  };

  // 计算相关性分数
  const calculateRelevance = (record: HistoryRecord, search: string): number => {
    if (!search.trim()) return 0;
    const searchLower = search.toLowerCase();
    const question = (record.question || "").toLowerCase();
    const answer = (record.answer || "").toLowerCase();
    
    let score = 0;
    // 问题标题匹配权重更高
    if (question.includes(searchLower)) {
      score += question.startsWith(searchLower) ? 10 : 5;
    }
    // 答案匹配
    if (answer.includes(searchLower)) {
      score += 2;
    }
    return score;
  };

  // 过滤和排序历史记录
  const filteredDbHistory = dbHistory
    .filter((record) => {
      if (!historySearch.trim()) return true;
      const searchLower = historySearch.toLowerCase();
      const questionMatch = (record.question || "").toLowerCase().includes(searchLower);
      const answerMatch = (record.answer || "").toLowerCase().includes(searchLower);
      return questionMatch || answerMatch;
    })
    .sort((a, b) => {
      if (historySortBy === "relevance" && historySearch.trim()) {
        return calculateRelevance(b, historySearch) - calculateRelevance(a, historySearch);
      }
      // 按时间排序（假设有 created_at 字段，否则按数组顺序）
      return 0; // 保持原顺序
    });

  // 格式化时间
  const formatTime = (timestamp?: string | Date): string => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    
    // 检查日期是否有效
    if (isNaN(date.getTime())) return "";
    
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return "刚刚";
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;
    if (days < 30) return `${Math.floor(days / 7)}周前`;
    
    // 超过30天显示具体日期
    return date.toLocaleDateString('zh-CN', { 
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      month: 'long', 
      day: 'numeric' 
    });
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
        <Tab $active={activeTab === "Compose"} onClick={() => setActiveTab("Compose")}>Compose</Tab>
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
            <HistoryTitle>
              <span>📚</span>
              <span>历史记录</span>
            </HistoryTitle>
            
            {/* 时间筛选选项 - 只在有时间字段时显示 */}
            {hasCreatedAtColumn ? (
              <TimeFilterOptions>
                <TimeFilterButton
                  $active={historyTimeFilter === "all"}
                  onClick={() => setHistoryTimeFilter("all")}
                >
                  <span>📅</span>
                  <span>全部</span>
                </TimeFilterButton>
                <TimeFilterButton
                  $active={historyTimeFilter === "today"}
                  onClick={() => setHistoryTimeFilter("today")}
                >
                  <span>☀️</span>
                  <span>今天</span>
                </TimeFilterButton>
                <TimeFilterButton
                  $active={historyTimeFilter === "week"}
                  onClick={() => setHistoryTimeFilter("week")}
                >
                  <span>📆</span>
                  <span>本周</span>
                </TimeFilterButton>
                <TimeFilterButton
                  $active={historyTimeFilter === "month"}
                  onClick={() => setHistoryTimeFilter("month")}
                >
                  <span>📊</span>
                  <span>本月</span>
                </TimeFilterButton>
              </TimeFilterOptions>
            ) : (
              <TimeFilterHint>
                <span>⚠️</span>
                <span>数据库缺少时间字段，无法按时间筛选。<a href="SUPABASE_SETUP.md" target="_blank" style={{ color: '#f59e0b', textDecoration: 'underline' }}>查看设置指南</a></span>
              </TimeFilterHint>
            )}
            
            <SearchInputWrapper>
              <SearchIcon>🔍</SearchIcon>
              <HistorySearchInput
                placeholder="搜索问题或答案..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
              />
              {historySearch && (
                <ClearSearchButton
                  onClick={() => setHistorySearch("")}
                  aria-label="清空搜索"
                >
                  清空
                </ClearSearchButton>
              )}
            </SearchInputWrapper>
            
            {/* 排序选项 */}
            {historySearch && filteredDbHistory.length > 0 && (
              <SortOptions>
                <SortButton
                  $active={historySortBy === "relevance"}
                  onClick={() => setHistorySortBy("relevance")}
                >
                  <span>🎯</span>
                  <span>相关性</span>
                </SortButton>
                <SortButton
                  $active={historySortBy === "time"}
                  onClick={() => setHistorySortBy("time")}
                >
                  <span>🕐</span>
                  <span>时间</span>
                </SortButton>
              </SortOptions>
            )}
            
            {!isLoadingHistory && filteredDbHistory.length > 0 && (
              <HistoryStats>
                {historySearch
                  ? `找到 ${filteredDbHistory.length} 条匹配记录`
                  : `共 ${dbHistory.length} 条历史记录（最多显示50条）`}
              </HistoryStats>
            )}
          </HistoryHeader>

          <HistoryListWrapper>
            {isLoadingHistory ? (
              <HistoryEmpty>
                <HistoryEmptyIcon>⏳</HistoryEmptyIcon>
                <HistoryEmptyText>加载中...</HistoryEmptyText>
              </HistoryEmpty>
            ) : filteredDbHistory.length === 0 ? (
              <HistoryEmpty>
                <HistoryEmptyIcon>{historySearch ? "🔍" : "📭"}</HistoryEmptyIcon>
                <HistoryEmptyText>
                  {historySearch ? "未找到匹配的历史记录" : "暂无历史记录"}
                </HistoryEmptyText>
                <HistoryEmptyHint>
                  {historySearch ? "试试其他关键词" : "开始对话后会自动保存"}
                </HistoryEmptyHint>
              </HistoryEmpty>
            ) : (
              <HistoryList>
                {filteredDbHistory.map((record, idx) => (
                  <HistoryItem
                    key={idx}
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      // 阻止按钮点击事件冒泡
                      if ((e.target as HTMLElement).closest('button')) {
                        return;
                      }
                      // 打开详情弹窗
                      setSelectedHistory(record);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedHistory(record);
                      }
                    }}
                  >
                    <HistoryItemQuestion>
                      {highlightText(record.question || "(无问题)", historySearch)}
                    </HistoryItemQuestion>
                    <HistoryItemAnswer>
                      {highlightText(record.answer || "(无回答)", historySearch)}
                    </HistoryItemAnswer>
                    <HistoryItemMeta>
                      <HistoryItemTime>
                        <span>🕐</span>
                        <span>{formatTime(record.created_at)}</span>
                      </HistoryItemTime>
                      <HistoryItemActions>
                        <HistoryActionButton
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedHistory(record);
                          }}
                          title="查看详情"
                        >
                          👁️ 查看
                        </HistoryActionButton>
                        <HistoryActionButton
                          onClick={(e) => {
                            e.stopPropagation();
                            copyTextToClipboard(record.question || "");
                          }}
                          title="复制问题"
                        >
                          📋 复制
                        </HistoryActionButton>
                        <HistoryActionButton
                          onClick={(e) => {
                            e.stopPropagation();
                            if (record.question) {
                              setQuestion(record.question);
                              setActiveTab("Chat");
                              setHistorySearch("");
                            }
                          }}
                          title="重新提问"
                        >
                          🔄 重问
                        </HistoryActionButton>
                      </HistoryItemActions>
                    </HistoryItemMeta>
                  </HistoryItem>
                ))}
              </HistoryList>
            )}
          </HistoryListWrapper>
        </HistoryContainer>
      ) : (
        <>
          {/* 欢迎区与卡片已移除，下面直接展示回答与输入区域 */}

          <AnswersContainer>
            {/* 保存选择面板 */}
            {showSavePrompt && (
              <SavePanel>
                <SavePanelTitle>
                  <span>💾</span>
                  <span>选择保存的回答</span>
                </SavePanelTitle>
                <SavePanelMessage>
                  <span>⏱️</span>
                  <span>
                    <CountdownBadge>{countdown}秒</CountdownBadge> 后自动保存短回答
                  </span>
                </SavePanelMessage>
                <SavePanelButtons>
                  <SavePanelButton onClick={() => handleSaveAnswer('short')} $primary>
                    💬 保存短回答
                  </SavePanelButton>
                  <SavePanelButton onClick={() => handleSaveAnswer('long')}>
                    📝 保存长回答
                  </SavePanelButton>
                </SavePanelButtons>
              </SavePanel>
            )}
            
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
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <div
                      className="icon-wrapper"
                      role="button"
                      title={`保存${index === 0 ? '短' : '长'}回答`}
                      tabIndex={0}
                      onClick={() => handleSaveAnswer(index === 0 ? 'short' : 'long')}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleSaveAnswer(index === 0 ? 'short' : 'long');
                        }
                      }}
                    >
                      <SaveIcon />
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

      {/* 历史详情弹窗 */}
      {selectedHistory && (
        <HistoryDetailOverlay
          onClick={() => setSelectedHistory(null)}
        >
          <HistoryDetailModal
            onClick={(e) => e.stopPropagation()}
          >
            <HistoryDetailHeader>
              <HistoryDetailTitle>
                <span>💬</span>
                <span>对话详情</span>
              </HistoryDetailTitle>
              <HistoryDetailClose
                onClick={() => setSelectedHistory(null)}
                aria-label="关闭"
              >
                ×
              </HistoryDetailClose>
            </HistoryDetailHeader>

            <HistoryDetailContent>
              <HistoryDetailSection>
                <HistoryDetailLabel>
                  <span>❓</span>
                  <span>问题</span>
                </HistoryDetailLabel>
                <HistoryDetailText>
                  {selectedHistory.question || "(无问题)"}
                </HistoryDetailText>
              </HistoryDetailSection>

              <HistoryDetailSection>
                <HistoryDetailLabel>
                  <span>💡</span>
                  <span>回答</span>
                </HistoryDetailLabel>
                <HistoryDetailText className="answer">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {selectedHistory.answer || "(无回答)"}
                  </ReactMarkdown>
                </HistoryDetailText>
              </HistoryDetailSection>

              {selectedHistory.created_at && (
                <HistoryDetailSection>
                  <HistoryDetailLabel>
                    <span>🕐</span>
                    <span>时间</span>
                  </HistoryDetailLabel>
                  <HistoryDetailText>
                    {formatTime(selectedHistory.created_at)}
                  </HistoryDetailText>
                </HistoryDetailSection>
              )}
            </HistoryDetailContent>

            <HistoryDetailFooter>
              <HistoryDetailButton
                onClick={() => {
                  copyTextToClipboard(selectedHistory.question || "");
                }}
              >
                📋 复制问题
              </HistoryDetailButton>
              <HistoryDetailButton
                onClick={() => {
                  copyTextToClipboard(selectedHistory.answer || "");
                }}
              >
                📋 复制答案
              </HistoryDetailButton>
              <HistoryDetailButton
                $primary
                onClick={() => {
                  if (selectedHistory.question) {
                    setQuestion(selectedHistory.question);
                    setActiveTab("Chat");
                    setSelectedHistory(null);
                    setHistorySearch("");
                  }
                }}
              >
                🔄 重新提问
              </HistoryDetailButton>
            </HistoryDetailFooter>
          </HistoryDetailModal>
        </HistoryDetailOverlay>
      )}
    </Container>
  );
}

export default App;
