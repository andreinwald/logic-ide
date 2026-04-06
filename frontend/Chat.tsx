import { useState, useRef, useEffect } from 'react';
import { marked } from 'marked';
import type { ChatEvent } from '@bridge';

type TextBlock = { type: 'text'; messageId: string; text: string };
type ThoughtBlock = { type: 'thought'; messageId: string; text: string };
type ToolBlock = { type: 'tool'; toolCallId: string; title: string; kind?: string; status: string };

type ChatBlock = TextBlock | ThoughtBlock | ToolBlock;

export type ChatMessage = {
  id: string;
  role: 'user' | 'agent';
  blocks: ChatBlock[];
};

type Props = {
  messages: ChatMessage[];
  isRunning: boolean;
  onSend: (message: string) => void;
  onStop: () => void;
};

const TOOL_KIND_ICONS: Record<string, string> = {
  read: '📖',
  edit: '✏️',
  delete: '🗑',
  move: '📦',
  search: '🔍',
  execute: '⚡',
  think: '💭',
  fetch: '🌐',
  switch_mode: '🔀',
  other: '🔧',
};

const STATUS_ICONS: Record<string, string> = {
  pending: '○',
  in_progress: '◌',
  completed: '✓',
  failed: '✗',
  cancelled: '⊘',
};

function ToolCallBlock({ block }: { block: ToolBlock }) {
  const icon = TOOL_KIND_ICONS[block.kind ?? 'other'] ?? '🔧';
  const statusIcon = STATUS_ICONS[block.status] ?? '○';
  const isInProgress = block.status === 'in_progress' || block.status === 'pending';
  return (
    <div className={`chat-tool-call chat-tool-${block.status}`}>
      <span className="chat-tool-icon">{icon}</span>
      <span className="chat-tool-title">{block.title}</span>
      <span className={`chat-tool-status ${isInProgress ? 'chat-tool-spinning' : ''}`}>{statusIcon}</span>
    </div>
  );
}

function ThoughtBlockComp({ block }: { block: ThoughtBlock }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="chat-thought">
      <button className="chat-thought-toggle" onClick={() => setExpanded(e => !e)}>
        <span className="chat-thought-arrow">{expanded ? '▾' : '▸'}</span>
        Thinking…
      </button>
      {expanded && (
        <div className="chat-thought-body">{block.text}</div>
      )}
    </div>
  );
}

function AgentMessage({ message }: { message: ChatMessage }) {
  return (
    <div className="chat-message chat-message-agent">
      <div className="chat-message-label">Agent</div>
      <div className="chat-message-blocks">
        {message.blocks.map((block, i) => {
          if (block.type === 'thought') return <ThoughtBlockComp key={i} block={block} />;
          if (block.type === 'tool') return <ToolCallBlock key={block.toolCallId} block={block} />;
          const html = marked.parse(block.text) as string;
          return <div key={i} className="chat-text" dangerouslySetInnerHTML={{ __html: html }} />;
        })}
      </div>
    </div>
  );
}

function UserMessage({ message }: { message: ChatMessage }) {
  const text = message.blocks.find(b => b.type === 'text') as TextBlock | undefined;
  return (
    <div className="chat-message chat-message-user">
      <div className="chat-message-label">You</div>
      <div className="chat-text chat-user-text">{text?.text ?? ''}</div>
    </div>
  );
}

export function applyEvent(messages: ChatMessage[], event: ChatEvent): ChatMessage[] {
  if (event.type === 'agent_text_chunk' || event.type === 'agent_thought_chunk') {
    const blockType = event.type === 'agent_text_chunk' ? 'text' : 'thought';
    const last = messages[messages.length - 1];
    if (last?.role === 'agent') {
      const blocks = [...last.blocks];
      const lastBlock = blocks[blocks.length - 1];
      if (lastBlock?.type === blockType && lastBlock.messageId === event.messageId) {
        blocks[blocks.length - 1] = { ...lastBlock, text: lastBlock.text + event.text };
      } else {
        blocks.push({ type: blockType, messageId: event.messageId, text: event.text });
      }
      return [...messages.slice(0, -1), { ...last, blocks }];
    } else {
      return [...messages, {
        id: event.messageId,
        role: 'agent',
        blocks: [{ type: blockType, messageId: event.messageId, text: event.text }],
      }];
    }
  }

  if (event.type === 'tool_call') {
    const last = messages[messages.length - 1];
    const toolBlock: ToolBlock = { type: 'tool', toolCallId: event.toolCallId, title: event.title, kind: event.kind, status: event.status };
    if (last?.role === 'agent') {
      return [...messages.slice(0, -1), { ...last, blocks: [...last.blocks, toolBlock] }];
    } else {
      return [...messages, { id: event.toolCallId, role: 'agent', blocks: [toolBlock] }];
    }
  }

  if (event.type === 'tool_call_update') {
    return messages.map(msg => {
      if (msg.role !== 'agent') return msg;
      const blocks = msg.blocks.map(b => {
        if (b.type === 'tool' && b.toolCallId === event.toolCallId) {
          return { ...b, ...(event.title && { title: event.title }), ...(event.status && { status: event.status }), ...(event.kind && { kind: event.kind }) };
        }
        return b;
      });
      return { ...msg, blocks };
    });
  }

  return messages;
}

export function Chat({ messages, isRunning, onSend, onStop }: Props) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  function handleSend() {
    const text = input.trim();
    if (!text || isRunning) return;
    setInput('');
    onSend(text);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="chat-panel">
      <div className="chat-header">Agent Chat</div>
      <div className="chat-messages" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="chat-empty">Send a message to start chatting with the agent.</div>
        )}
        {messages.map(msg =>
          msg.role === 'user'
            ? <UserMessage key={msg.id} message={msg} />
            : <AgentMessage key={msg.id} message={msg} />
        )}
        {isRunning && messages[messages.length - 1]?.role !== 'agent' && (
          <div className="chat-message chat-message-agent">
            <div className="chat-message-label">Agent</div>
            <div className="chat-thinking-indicator"><span /><span /><span /></div>
          </div>
        )}
      </div>
      <div className="chat-input-area">
        <textarea
          ref={textareaRef}
          className="chat-textarea"
          placeholder="Message the agent… (Enter to send, Shift+Enter for newline)"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={3}
          disabled={isRunning}
        />
        <div className="chat-input-actions">
          {isRunning
            ? <button className="chat-btn chat-btn-stop" onClick={onStop}>■ Stop</button>
            : <button className="chat-btn chat-btn-send" onClick={handleSend} disabled={!input.trim()}>Send</button>
          }
        </div>
      </div>
    </div>
  );
}
