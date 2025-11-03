/*
 * @Author: 杨仕明 shiming.y@qq.com
 * @Date: 2025-10-25 15:18:51
 * @LastEditors: 杨仕明 shiming.y@qq.com
 * @LastEditTime: 2025-10-25 15:19:12
 * @FilePath: /trae_hackathon/src/client.js
 * @Description:
 *
 * Copyright (c) 2025 by ${git_name_email}, All Rights Reserved.
 */
import { CozeAPI, COZE_CN_BASE_URL } from "@coze/api";

// 创建 Coze API 客户端
export const client = new CozeAPI({
  token: import.meta.env.VITE_COZE_API_KEY,
  baseURL: import.meta.env.VITE_COZE_API_BASE_URL || COZE_CN_BASE_URL,
  allowPersonalAccessTokenInBrowser: true, // 允许在浏览器中使用 PAT
});

// 机器人 ID
export const botId = import.meta.env.VITE_COZE_BOT_ID;

// 工具函数
export const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

// 用户 ID（用于会话标识），可在 .env 设置 VITE_COZE_USER_ID
export const userId = import.meta.env.VITE_COZE_USER_ID || "web-user";
