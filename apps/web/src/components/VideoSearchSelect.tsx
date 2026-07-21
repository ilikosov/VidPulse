import { useEffect, useMemo, useState } from 'react';
import { Select } from '@vidpulse/ui';
import { getVideos } from '../api';

interface VideoOption {
  value: number;
  label: string;
}

interface VideoSearchSelectProps {
  value: number | null;
  onChange: (videoId: number | null) => void;
  /** Display label for `value` before any search has run — without it the Select falls back
   * to showing the raw video id until the user types a query. */
  currentLabel?: string | null;
  placeholder?: string;
  disabled?: boolean;
}

const DEBOUNCE_MS = 300;

/** Searchable video picker by title/youtube_id, used to link a file to a video. */
export default function VideoSearchSelect({
  value,
  onChange,
  currentLabel,
  placeholder,
  disabled,
}: VideoSearchSelectProps) {
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<VideoOption[]>([]);
  const [loading, setLoading] = useState(false);

  // Search results only cover what the user has typed — without this, the currently linked
  // video (set before any search ran) would render as its bare numeric id.
  const displayOptions = useMemo(() => {
    if (value == null || options.some((o) => o.value === value)) return options;
    return [{ value, label: currentLabel || `Video #${value}` }, ...options];
  }, [options, value, currentLabel]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setOptions([]);
      return;
    }
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const res = await getVideos({ search: trimmed, limit: 10, includeIgnored: true });
        setOptions(
          res.videos.map((v) => ({ value: v.id, label: `${v.original_title} (${v.youtube_id})` })),
        );
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [query]);

  return (
    <Select
      showSearch
      allowClear
      disabled={disabled}
      value={value ?? undefined}
      placeholder={placeholder ?? 'Search by title or youtube_id...'}
      filterOption={false}
      loading={loading}
      onSearch={setQuery}
      onChange={(next) => onChange(next ?? null)}
      options={displayOptions}
      style={{ width: '100%' }}
    />
  );
}
