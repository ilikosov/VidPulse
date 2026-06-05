import type { ParsedMetadata } from './parser/parser.types';
import { logger } from '../lib/logger';

export interface SuggestedMetadata {
  group_name?: string;
  artist_name?: string;
  song_title?: string;
  event?: string;
  perf_date?: string;
  camera_type?: string;
}

type LLMResponsePayload = {
  choices?: Array<{ message?: { content?: string } }>;
};

const SUGGESTION_SYSTEM_PROMPT = `You extract K-pop performance metadata from YouTube title/description.
Return ONLY valid JSON object with keys:
group_name, artist_name, song_title, event, perf_date, camera_type.
Rules:
- Use empty string for unknown fields.
- perf_date must be YYMMDD when confidently available.
- event should include @ prefix only when clear.
- No markdown, no explanations.
Example:
{"group_name":"IVE","artist_name":"IVE","song_title":"LOVE DIVE","event":"@MCOUNTDOWN","perf_date":"220414","camera_type":"Fancam"}`;

const PARSER_SYSTEM_PROMPT =
  'You are a K-pop metadata extractor. Given a video title and description, extract perf_date (YYMMDD), group_name, artist_name, song_title, event (with @ prefix), and camera_type. Return ONLY a JSON object with these fields. Use null for missing values.';

function stripCodeFences(content: string): string {
  return content
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
}

function cleanSuggestedMetadata(raw: unknown): SuggestedMetadata {
  if (!raw || typeof raw !== 'object') {
    return {};
  }

  const source = raw as Record<string, unknown>;
  const keys: Array<keyof SuggestedMetadata> = [
    'group_name',
    'artist_name',
    'song_title',
    'event',
    'perf_date',
    'camera_type',
  ];

  const result: SuggestedMetadata = {};
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) {
      result[key] = value.trim();
    }
  }

  return result;
}

function cleanParsedMetadata(raw: unknown): Partial<ParsedMetadata> {
  if (!raw || typeof raw !== 'object') {
    return {};
  }

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

function parseJsonContent(content: string): Record<string, unknown> {
  return JSON.parse(stripCodeFences(content));
}

export class AIService {
  async callLLM(prompt: string): Promise<string> {
    const endpoint = process.env.LM_STUDIO_API_URL || process.env.LM_STUDIO_URL;
    const model = process.env.LM_STUDIO_MODEL;
    const timeoutMs = Number(process.env.LM_STUDIO_TIMEOUT || '30000');

    if (!endpoint || !model) {
      throw new Error(
        'LM Studio is not configured. Please set LM_STUDIO_API_URL or LM_STUDIO_URL, and LM_STUDIO_MODEL.',
      );
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
          messages: [{ role: 'user', content: prompt }],
          temperature: 0,
          max_tokens: 1500,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`LM Studio returned ${response.status}: ${body}`);
      }

      const payload = (await response.json()) as LLMResponsePayload;
      logger.info(payload.choices?.[0]?.message);
      const content = payload.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error('LM Studio response does not contain suggestion content.');
      }

      return content;
    } catch (error) {
      logger.error('AIService callLLM failed:', error);
      throw new Error(
        `LM Studio request failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  async parseTitleWithLLM(title: string, description: string): Promise<Partial<ParsedMetadata>> {
    const prompt = `${PARSER_SYSTEM_PROMPT}\n\nTitle: ${title}\n\nDescription:\n${description || '(empty)'}`;
    const content = await this.callLLM(prompt);

    try {
      return cleanParsedMetadata(parseJsonContent(content));
    } catch (error) {
      logger.error('AIService parseTitleWithLLM parse failed:', error);
      return {};
    }
  }
}

const aiService = new AIService();

export const parseTitleWithLLM = (title: string, description: string) =>
  aiService.parseTitleWithLLM(title, description);
