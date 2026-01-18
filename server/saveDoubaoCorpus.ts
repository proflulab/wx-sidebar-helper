import fs from 'fs/promises';
import path from 'path';

const RESOURCE_DIR = path.resolve(process.cwd(), 'src/assets/resources');
const DEFAULT_FILE_NAME = 'doubao-corpus.md';
const INSTRUCTION_LINE = '根据上述内容回答下面问题：';

export type SaveDoubaoCorpusResult = {
  fileName: string;
  relativePath: string;
  index: number;
};

const normalizeNewlines = (value: string): string => value.replace(/\r\n/g, '\n');
const stripTrailingWhitespace = (value: string): string => value.replace(/\s+$/g, '');

const dropTrailingQuote = (value: string): { text: string; removed: boolean } => {
  const trimmed = stripTrailingWhitespace(value);
  if (trimmed.endsWith('”')) {
    return { text: trimmed.slice(0, -1), removed: true };
  }
  return { text: trimmed, removed: false };
};

const findNextIndex = (value: string): number => {
  const regex = /(?:^|\n)(\d+)\./g;
  let max = -1;
  let match: RegExpExecArray | null = null;
  while ((match = regex.exec(value)) !== null) {
    const parsed = Number.parseInt(match[1], 10);
    if (!Number.isNaN(parsed)) {
      max = Math.max(max, parsed);
    }
  }
  return max + 1;
};

const normalizeQuestionLine = (value: string): string => {
  return normalizeNewlines(value)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ');
};

export const appendDoubaoCorpusEntry = async (
  question: string,
  answer: string,
  baseDir: string = RESOURCE_DIR,
  fileName: string = DEFAULT_FILE_NAME
): Promise<SaveDoubaoCorpusResult> => {
  const cleanQuestion = normalizeQuestionLine(question || '');
  const cleanAnswer = normalizeNewlines(answer || '').trim();
  if (!cleanQuestion || !cleanAnswer) {
    throw new Error('Question and answer are required');
  }

  const fullPath = path.join(baseDir, fileName);
  let content = '';
  try {
    content = await fs.readFile(fullPath, 'utf8');
  } catch (error) {
    throw new Error('Corpus file not found');
  }

  const normalized = normalizeNewlines(content);
  const markerIndex = normalized.indexOf(`\n${INSTRUCTION_LINE}`);
  const fallbackIndex = markerIndex === -1 ? normalized.indexOf(INSTRUCTION_LINE) : markerIndex;
  const before = fallbackIndex === -1 ? normalized : normalized.slice(0, fallbackIndex);
  const after = fallbackIndex === -1 ? '' : normalized.slice(fallbackIndex);

  const { text: beforeWithoutQuote, removed: hadQuote } = dropTrailingQuote(before);
  const nextIndex = findNextIndex(beforeWithoutQuote);

  const entry = `${nextIndex}.${cleanQuestion}\n答：${cleanAnswer}`;
  const trimmedBefore = stripTrailingWhitespace(beforeWithoutQuote);
  const separator = trimmedBefore ? '\n\n' : '';
  const mergedBefore = `${trimmedBefore}${separator}${entry}`;
  const quoteSuffix = hadQuote ? '”' : '';

  let mergedAfter = after;
  if (quoteSuffix && mergedAfter && !mergedAfter.startsWith('\n')) {
    mergedAfter = `\n${mergedAfter}`;
  }

  const updated = `${mergedBefore}${quoteSuffix}${mergedAfter}`;
  await fs.writeFile(fullPath, updated, 'utf8');

  return {
    fileName,
    relativePath: path.relative(process.cwd(), fullPath),
    index: nextIndex,
  };
};
