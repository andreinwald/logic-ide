import type { ClientSideConnection } from '@agentclientprotocol/sdk';
import { acpClient } from './acpClient';

let connectionPromise: Promise<ClientSideConnection> | null = null;

export async function getAcpConnection(): Promise<ClientSideConnection> {
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