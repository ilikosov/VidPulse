import type { ParsedMetadata } from './parser/parser.types';

const SYSTEM_PROMPT =
  'You are a K-pop metadata extractor. Given a video title, extract performance date (YYMMDD), group name, artist name, song title, event (with @ prefix), and camera type. Return ONLY a JSON object with these fields (omit any that are missing). Use null for missing values.';

function cleanParsedMetadata(raw: unknown): Partial<ParsedMetadata> {
  if (!raw || typeof raw !== 'object') return {};
  const source = raw as Record<string, unknown>;
  const result: Partial<ParsedMetadata> = {};

  const setIfString = (key: keyof ParsedMetadata) => {
    const value = source[key as string];
    if (typeof value === 'string' && value.trim()) {
      result[key] = value.trim() as never;
    }
  };

  setIfString('perf_date');
  setIfString('group_name');
  setIfString('artist_name');
  setIfString('song_title');
  setIfString('event');
  setIfString('camera_type');

  return result;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      return null;
    }
  }
}

export async function parseTitleWithLLM(title: string): Promise<Partial<ParsedMetadata>> {
  const endpoint = process.env.LM_STUDIO_URL;
  const model = process.env.LM_STUDIO_MODEL;
  const timeoutMs = Number(process.env.LM_STUDIO_TIMEOUT || '30000');

  if (!endpoint || !model) {
    throw new Error('LM Studio is not configured. Please set LM_STUDIO_URL and LM_STUDIO_MODEL');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (process.env.LM_STUDIO_API_KEY) {
      headers.Authorization = `Bearer ${process.env.LM_STUDIO_API_KEY}`;
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: title },
        ],
        temperature: 0,
        max_tokens: 200,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`LM Studio request failed (${response.status}): ${errText}`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = payload.choices?.[0]?.message?.content;
    if (!content) return {};

    return cleanParsedMetadata(safeJsonParse(content));
  } finally {
    clearTimeout(timeout);
  }
}
