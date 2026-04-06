import { listenResponse, stopListeningResponse } from './acpClient';
import { getAcpConnection } from './acpConnection';

export async function ask(message: string, onChunk?: (chunk: string) => void): Promise<string> {
  const conn = await getAcpConnection();
  const { sessionId } = await conn.newSession({ cwd: process.cwd(), mcpServers: [] });

  let fullText = '';
  if (onChunk) {
    listenResponse(sessionId, (chunk) => {
      fullText += chunk;
      onChunk(chunk);
    });
  }

  try {
    await conn.prompt({
      sessionId,
      prompt: [{ type: 'text', text: message }],
    });
  } finally {
    stopListeningResponse(sessionId);
  }

  return fullText;
}
