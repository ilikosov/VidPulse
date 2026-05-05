import { AutoComplete } from 'antd';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { dictionaryApi } from '../api/dictionary';

type AutocompleteType = 'group' | 'artist' | 'song' | 'event';

interface AutocompleteFieldProps {
  type: AutocompleteType;
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  style?: CSSProperties;
}

const DEFAULT_LIMIT = 15;

function AutocompleteField({ type, value, onChange, placeholder, style }: AutocompleteFieldProps) {
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<{ value: string; label: string }[]>([]);

  const fetcher = useMemo(() => {
    if (type === 'group')
      return (q: string) => dictionaryApi.getGroupsList({ q, limit: DEFAULT_LIMIT });
    if (type === 'artist')
      return (q: string) => dictionaryApi.getArtistsList({ q, limit: DEFAULT_LIMIT });
    if (type === 'song')
      return (q: string) => dictionaryApi.getSongsList({ q, limit: DEFAULT_LIMIT });
    return (q: string) => dictionaryApi.getEventsList({ q, limit: DEFAULT_LIMIT });
  }, [type]);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      const trimmed = query.trim();
      if (!trimmed) {
        setOptions([]);
        return;
      }
      try {
        const response = await fetcher(trimmed);
        const rows = response.items;
        const mapped = rows.map((row) => {
          if (type === 'song') {
            const song = row as { title: string };
            return { value: song.title, label: song.title };
          }
          const named = row as { name: string };
          return { value: named.name, label: named.name };
        });
        setOptions(mapped);
      } catch {
        setOptions([]);
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [fetcher, query, type]);

  return (
    <AutoComplete
      value={value}
      options={options}
      onSearch={setQuery}
      onChange={(next) => onChange?.(next)}
      placeholder={placeholder}
      filterOption={false}
      allowClear
      style={style}
    />
  );
}

export default AutocompleteField;
