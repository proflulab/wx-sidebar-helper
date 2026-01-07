import fs from 'fs/promises';
import path from 'path';

const RESOURCE_DIR = path.resolve(process.cwd(), 'src/assets/resources');
const DEFAULT_FILE_NAME = 'chat-input.md';

export type SaveChatInputResult = {
  fileName: string;
  relativePath: string;
};

export const saveChatInput = async (
  text: string,
  baseDir: string = RESOURCE_DIR,
  fileName: string = DEFAULT_FILE_NAME
): Promise<SaveChatInputResult> => {
  const normalized = text.replace(/\r\n/g, '\n');
  await fs.mkdir(baseDir, { recursive: true });
  const fullPath = path.join(baseDir, fileName);
  await fs.writeFile(fullPath, normalized, 'utf8');

  return {
    fileName,
    relativePath: path.relative(process.cwd(), fullPath),
  };
};
