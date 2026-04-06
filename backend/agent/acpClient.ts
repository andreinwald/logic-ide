import type { Client, SessionNotification, RequestPermissionRequest, RequestPermissionResponse } from '@agentclientprotocol/sdk';

const chunkCallbacks = new Map<string, (chunk: string) => void>();

export function listenResponse(sessionId: string, cb: (chunk: string) => void): void {
    chunkCallbacks.set(sessionId, cb);
}

export function stopListeningResponse(sessionId: string): void {
    chunkCallbacks.delete(sessionId);
}

export const acpClient: Client = {
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