import { AutoComplete, Form } from '@vidpulse/ui';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { dictionaryApi } from '../api/dictionary';

type AutocompleteType = 'group' | 'artist' | 'song' | 'event';

interface AutocompleteFieldProps {
  type: AutocompleteType;
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  style?: CSSProperties;
  label?: string; // Добавлен пропс label
}

const DEFAULT_LIMIT = 15;

function AutocompleteField({
  type,
  value,
  onChange,
  placeholder,
  style,
  label,
}: AutocompleteFieldProps) {
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

  // Сам элемент инпута вынесен в переменную для удобной обертки
  const inputElement = (
    <AutoComplete
      value={value}
      options={options}
      onSearch={setQuery}
      onChange={(next) => onChange?.(next)}
      placeholder={placeholder}
      filterOption={false}
      allowClear
      style={{ width: '100%' }}
    />
  );

  // Если label передан, оборачиваем в Form.Item для идеального совпадения с дизайн-системой Ant Design
  if (label) {
    return (
      <Form.Item label={label} style={{ marginBottom: 0, width: '100%', ...style }}>
        {inputElement}
      </Form.Item>
    );
  }

  // Если label нет — возвращаем просто инпут без лишних оберток
  return <div style={{ width: '100%', ...style }}>{inputElement}</div>;
}

export default AutocompleteField;
