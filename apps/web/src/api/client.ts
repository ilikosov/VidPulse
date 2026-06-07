const DEFAULT_API_BASE = 'http://localhost:3000/api';

type ErrorPayload = {
  error?: string | { message?: string; code?: string };
  message?: string;
};

export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

export const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || DEFAULT_API_BASE;

export const apiUrl = (path: string): string => `${API_BASE_URL}${path}`;

const parseResponseBody = async (response: Response): Promise<unknown> => {
  if (response.status === 204) {
    return undefined;
  }

  const text = await response.text();
  if (!text) {
    return undefined;
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return JSON.parse(text);
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const messageFromPayload = (payload: unknown, status: number): string => {
  if (payload && typeof payload === 'object') {
    const data = payload as ErrorPayload;
    if (typeof data.error === 'string') {
      return data.error;
    }
    if (data.error && typeof data.error === 'object' && typeof data.error.message === 'string') {
      return data.error.message;
    }
    if (typeof data.message === 'string') {
      return data.message;
    }
  }

  if (typeof payload === 'string' && payload.trim()) {
    return payload;
  }

  return `HTTP ${status}`;
};

export const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Request failed';
};

export async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const isFormData = options?.body instanceof FormData;
  const response = await fetch(apiUrl(endpoint), {
    ...options,
    headers: isFormData
      ? options?.headers
      : {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
  });

  const body = await parseResponseBody(response);

  if (!response.ok) {
    throw new ApiError(messageFromPayload(body, response.status), response.status, body);
  }

  return body as T;
}

export function parseXhrResponse<T>(xhr: XMLHttpRequest): T {
  if (xhr.status === 204 || !xhr.responseText) {
    return undefined as T;
  }

  try {
    return JSON.parse(xhr.responseText) as T;
  } catch {
    return xhr.responseText as T;
  }
}

export function createXhrError(xhr: XMLHttpRequest): ApiError {
  const payload = parseXhrResponse<unknown>(xhr);
  return new ApiError(messageFromPayload(payload, xhr.status), xhr.status, payload);
}
