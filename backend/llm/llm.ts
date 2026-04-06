import type { ClientSideConnection, Client, SessionNotification, RequestPermissionRequest, RequestPermissionResponse } from '@agentclientprotocol/sdk';

const chunkCallbacks = new Map<string, (chunk: string) => void>();

const acpClient: Client = {
  async requestPermission(params: RequestPermissionRequest): Promise<RequestPermissionResponse> {
    // Auto-approve by selecting first available option
    const optionId = params.options[0]?.optionId ?? 'allow_once';
    return { outcome: { outcome: 'selected', optionId } };
  },
  async sessionUpdate(params: SessionNotification): Promise<void> {
    const cb = chunkCallbacks.get(params.sessionId);
    if (!cb) return;
    const { update } = params;
    if (update.sessionUpdate === 'agent_message_chunk' && update.content.type === 'text') {
      cb(update.content.text);
    }
  },
  async writeTextFile() { throw new Error('Not supported'); },
  async readTextFile() { throw new Error('Not supported'); },
};

let connectionPromise: Promise<ClientSideConnection> | null = null;

async function getConnection(): Promise<ClientSideConnection> {
  if (!connectionPromise) {
    connectionPromise = initConnection();
  }
  return connectionPromise;
}

async function initConnection(): Promise<ClientSideConnection> {
  const { spawn } = await import('node:child_process');
  const { Readable, Writable } = await import('node:stream');
  const { createRequire } = await import('node:module');
  const { ClientSideConnection, ndJsonStream, PROTOCOL_VERSION } = await import('@agentclientprotocol/sdk');

  const req = createRequire(__filename);
  const agentBin = req.resolve('@agentclientprotocol/claude-agent-acp/dist/index.js');

  const agentProcess = spawn(process.execPath, [agentBin], {
    stdio: ['pipe', 'pipe', 'inherit'],
  });

  const input = Writable.toWeb(agentProcess.stdin!);
  const output = Readable.toWeb(agentProcess.stdout!) as ReadableStream<Uint8Array>;
  const stream = ndJsonStream(input, output);

  const connection = new ClientSideConnection(() => acpClient, stream);
  await connection.initialize({ protocolVersion: PROTOCOL_VERSION, clientCapabilities: {} });
  return connection;
}

export async function ask(message: string, onChunk?: (chunk: string) => void): Promise<string> {
  const conn = await getConnection();
  const { sessionId } = await conn.newSession({ cwd: process.cwd(), mcpServers: [] });

  let fullText = '';
  if (onChunk) {
    chunkCallbacks.set(sessionId, (chunk) => {
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
    chunkCallbacks.delete(sessionId);
  }

  return fullText;
}
