import fs from 'fs/promises';
import path from 'path';

const RESOURCE_DIR = path.resolve(process.cwd(), 'src/assets/resources');
const DEFAULT_FILE_NAME = 'meeting-input.md';
const TEMPLATE_FILE_NAME = 'meeting-notice.md';
const MERGED_FILE_NAME = 'meeting-notice-with-input.md';

export type SaveMeetingInputResult = {
  fileName: string;
  relativePath: string;
  mergedFileName: string;
  mergedRelativePath: string;
};

export const saveMeetingInput = async (
  text: string,
  baseDir: string = RESOURCE_DIR,
  fileName: string = DEFAULT_FILE_NAME
): Promise<SaveMeetingInputResult> => {
  const normalized = text.replace(/\r\n/g, '\n');
  await fs.mkdir(baseDir, { recursive: true });
  const fullPath = path.join(baseDir, fileName);
  await fs.writeFile(fullPath, normalized, 'utf8');

  const templatePath = path.join(baseDir, TEMPLATE_FILE_NAME);
  let template = '';
  try {
    template = await fs.readFile(templatePath, 'utf8');
  } catch {
    template = '';
  }

  const normalizedTemplate = template.replace(/\r\n/g, '\n');
  const stripTrailingNewlines = (value: string): string => value.replace(/\n+$/g, '');
  const stripLeadingNewlines = (value: string): string => value.replace(/^\n+/g, '');
  const trimmedTemplate = stripTrailingNewlines(normalizedTemplate);
  const trimmedInput = stripLeadingNewlines(normalized);
  const mergedContent =
    trimmedTemplate && trimmedInput
      ? `${trimmedTemplate}\n${trimmedInput}`
      : trimmedTemplate || trimmedInput;
  const mergedPath = path.join(baseDir, MERGED_FILE_NAME);
  await fs.writeFile(mergedPath, mergedContent, 'utf8');

  return {
    fileName,
    relativePath: path.relative(process.cwd(), fullPath),
    mergedFileName: MERGED_FILE_NAME,
    mergedRelativePath: path.relative(process.cwd(), mergedPath),
  };
};
