import axios from 'axios';
import { API_BASE_URL } from '../constants/env';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

export async function unwrap<T>(request: Promise<{ data: T }>): Promise<T> {
  const response = await request;
  return response.data;
}
