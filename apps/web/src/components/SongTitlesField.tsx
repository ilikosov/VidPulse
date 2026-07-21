import { Form, Select } from '@vidpulse/ui';
import { useEffect, useState, type CSSProperties } from 'react';
import { dictionaryApi } from '../api/dictionary';

interface SongTitlesFieldProps {
  /** The full set of song titles linked to the video. */
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  style?: CSSProperties;
  label?: string;
}

const DEFAULT_LIMIT = 15;

/**
 * Multi-value input for the songs of a video. A video can contain several
 * songs; this edits the full set (free-text entries are allowed and become new
 * dictionary songs on save). Pasting a `+`-joined title splits into entries.
 */
function SongTitlesField({ value, onChange, placeholder, style, label }: SongTitlesFieldProps) {
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      const trimmed = query.trim();
      if (!trimmed) {
        setOptions([]);
        return;
      }
      try {
        const response = await dictionaryApi.getSongsList({ q: trimmed, limit: DEFAULT_LIMIT });
        setOptions(response.items.map((song) => ({ value: song.title, label: song.title })));
      } catch {
        setOptions([]);
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [query]);

  const handleChange = (next: string[]) => {
    // Split any pasted "A + B" entry and trim/dedupe while preserving order.
    const expanded = next
      .flatMap((entry) => entry.split(/\s*\+\s*/))
      .map((entry) => entry.trim())
      .filter(Boolean);
    onChange([...new Map(expanded.map((title) => [title.toLowerCase(), title])).values()]);
  };

  const input = (
    <Select
      mode="tags"
      value={value}
      options={options}
      onSearch={setQuery}
      onChange={handleChange}
      placeholder={placeholder}
      filterOption={false}
      tokenSeparators={['+']}
      allowClear
      style={{ width: '100%' }}
    />
  );

  if (label) {
    return (
      <Form.Item label={label} style={{ marginBottom: 0, width: '100%', ...style }}>
        {input}
      </Form.Item>
    );
  }

  return <div style={{ width: '100%', ...style }}>{input}</div>;
}

export default SongTitlesField;
