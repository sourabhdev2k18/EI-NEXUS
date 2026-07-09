import { api, unwrap } from './api.js';

export const chatService = {
  getHistory: () => unwrap(api.get('/chat/history')),
  sendMessage: ({ message, useLlm = true }) => unwrap(api.post('/chat', { message, use_llm: useLlm }))
};
