import { unstable_v2_createSession } from "@anthropic-ai/claude-agent-sdk";
import type { SDKSession, SDKSessionOptions } from "@anthropic-ai/claude-agent-sdk";

const defaultSessionOptions: SDKSessionOptions = {
    model: "sonnet",
    allowedTools: [],
};

let session: SDKSession | null = null;

function getSession(): SDKSession {
    if (!session) {
        session = unstable_v2_createSession({ ...defaultSessionOptions });
    }
    return session;
}

export function resetSession(): void {
    session?.close();
    session = null;
}

export async function ask(
    message: string,
    onChunk?: (chunk: string) => void,
): Promise<string> {
    const sess = getSession();
    await sess.send(message);

    let fullResponse = "";

    for await (const msg of sess.stream()) {
        if (msg.type === "assistant") {
            for (const block of msg.message.content || []) {
                if ("text" in block && typeof block.text === "string") {
                    const textChunk = block.text;
                    fullResponse += textChunk;

                    if (onChunk) {
                        onChunk(textChunk);
                    }
                }
            }
        }
        if (msg.type === "result") {
            break;
        }
    }

    return fullResponse.trim();
}

