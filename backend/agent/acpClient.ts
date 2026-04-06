import type { Client, SessionNotification, RequestPermissionRequest, RequestPermissionResponse } from '@agentclientprotocol/sdk';

const chunkCallbacks = new Map<string, (chunk: string) => void>();
const updateCallbacks = new Map<string, (notification: SessionNotification) => void>();

export function listenResponse(sessionId: string, cb: (chunk: string) => void): void {
    chunkCallbacks.set(sessionId, cb);
}

export function stopListeningResponse(sessionId: string): void {
    chunkCallbacks.delete(sessionId);
}

export function listenUpdates(sessionId: string, cb: (notification: SessionNotification) => void): void {
    updateCallbacks.set(sessionId, cb);
}

export function stopListeningUpdates(sessionId: string): void {
    updateCallbacks.delete(sessionId);
}

export const acpClient: Client = {
    async requestPermission(params: RequestPermissionRequest): Promise<RequestPermissionResponse> {
        // Auto-approve by selecting first available option
        const optionId = params.options[0]?.optionId ?? 'allow_once';
        return { outcome: { outcome: 'selected', optionId } };
    },
    async sessionUpdate(params: SessionNotification): Promise<void> {
        const { update } = params;
        const cb = chunkCallbacks.get(params.sessionId);
        if (cb && update.sessionUpdate === 'agent_message_chunk' && update.content.type === 'text') {
            cb(update.content.text);
        }
        const updateCb = updateCallbacks.get(params.sessionId);
        if (updateCb) updateCb(params);
    },
    async writeTextFile() { throw new Error('Not supported'); },
    async readTextFile() { throw new Error('Not supported'); },
};