import { AutoComplete, Input } from 'antd';
import { useMemo, useRef, useState } from 'react';
import { getDictionary } from '../api';

type DictType = 'groups' | 'artists' | 'songs' | 'events';

interface Props {
  value: string;
  type: DictType;
  placeholder?: string;
  label: string;
  onChange: (next: string) => void;
}

function AutocompleteInput({ value, type, placeholder, label, onChange }: Props) {
  const [options, setOptions] = useState<{ value: string }[]>([]);
  const timer = useRef<number>();

  const handleSearch = (query: string) => {
    if (timer.current) {
      window.clearTimeout(timer.current);
    }

    if (query.length < 2) {
      setOptions([]);
      return;
    }

    timer.current = window.setTimeout(async () => {
      try {
        const response = await getDictionary(type, query);
        setOptions(response.results.map((result) => ({ value: result })));
      } catch {
        setOptions([]);
      }
    }, 200);
  };

  const control = useMemo(
    () => (
      <AutoComplete
        value={value}
        options={options}
        onSearch={handleSearch}
        onChange={onChange}
        filterOption={false}
      >
        <Input placeholder={placeholder} />
      </AutoComplete>
    ),
    [onChange, options, placeholder, value],
  );

  return (
    <div>
      <div style={{ marginBottom: 6, fontWeight: 500 }}>{label}</div>
      {control}
    </div>
  );
}

export default AutocompleteInput;
