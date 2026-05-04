export interface SuggestedMetadata {
  group_name?: string;
  artist_name?: string;
  song_title?: string;
  event?: string;
  perf_date?: string;
  camera_type?: string;
}

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

export async function suggestMetadata(
  title: string,
  description: string,
): Promise<SuggestedMetadata> {
  const endpoint = process.env.LM_STUDIO_API_URL;
  const model = process.env.LM_STUDIO_MODEL;

  if (!endpoint || !model) {
    throw new Error(
      'LM Studio is not configured. Please set LM_STUDIO_API_URL and LM_STUDIO_MODEL.',
    );
  }

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SUGGESTION_SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Title: ${title}\n\nDescription:\n${description || '(empty)'}`,
          },
        ],
        temperature: 0,
      }),
    });
  } catch (error) {
    throw new Error(
      `LM Studio is not reachable: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`LM Studio returned ${response.status}: ${body}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('LM Studio response does not contain suggestion content.');
  }

  try {
    const parsed = JSON.parse(stripCodeFences(content));
    return cleanSuggestedMetadata(parsed);
  } catch (error) {
    throw new Error(
      `Failed to parse LM Studio JSON response: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
