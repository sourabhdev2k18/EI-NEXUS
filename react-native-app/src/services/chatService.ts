import { api, unwrap } from './api';
import type { ChatMessage } from '../types/dashboard';

export const chatService = {
  getHistory: () => unwrap<ChatMessage[]>(api.get('/chat/history')),
  sendMessage: ({ message, useLlm = true }: { message: string; useLlm?: boolean }) =>
    unwrap<{ reply: string; used_llm: boolean }>(api.post('/chat', { message, use_llm: useLlm })),
};
