export const CHANNELS = {
  OPEN_FOLDER: 'dialog:openFolder',
  FILE_EXISTS: 'fs:fileExists',
  LIST_RECENT_FILES: 'fs:listRecentFiles',
  LIST_TREE: 'fs:listTree',
  EXPLAIN_FILE: 'claude:explainFile',
  EXPLAIN_CHUNK: 'claude:chunk',
  EXPLAIN_DONE: 'claude:done',
  EXPLAIN_ERROR: 'claude:error',
} as const;
