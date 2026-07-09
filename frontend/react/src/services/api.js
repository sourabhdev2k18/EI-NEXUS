import axios from 'axios';

export const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' }
});

export async function unwrap(request) {
  const response = await request;
  return response.data;
}
