export const CHANNELS = {
  OPEN_FOLDER: 'dialog:openFolder',
  FILE_EXISTS: 'fs:fileExists',
  LIST_RECENT_FILES: 'fs:listRecentFiles',
  LIST_TREE: 'fs:listTree',
  EXPLAIN_FILE: 'llm:explainFile',
  EXPLAIN_CHUNK: 'llm:chunk',
  EXPLAIN_DONE: 'llm:done',
  EXPLAIN_ERROR: 'llm:error',
} as const;
