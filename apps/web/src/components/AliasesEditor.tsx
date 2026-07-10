import { StarFilled, StarOutlined } from '@ant-design/icons';
import { Button, Input, Space, Tag, Typography, message } from 'antd';
import { useEffect, useState } from 'react';
import {
  dictionaryApi,
  type DictionaryAlias,
  type DictionaryAliasEntityType,
} from '../api/dictionary';

interface Props {
  entityType: DictionaryAliasEntityType;
  entityId: number | string;
}

export default function AliasesEditor({ entityType, entityId }: Props) {
  const [aliases, setAliases] = useState<DictionaryAlias[]>([]);
  const [value, setValue] = useState('');

  const load = async () => {
    try {
      setAliases(await dictionaryApi.getAliases(entityType, entityId));
    } catch {
      message.error('Failed to load aliases');
    }
  };
  useEffect(() => {
    void load();
  }, [entityType, entityId]);

  const addAlias = async () => {
    const alias = value.trim();
    if (!alias) return;
    try {
      const created = await dictionaryApi.addAlias(entityType, entityId, alias);
      setAliases((prev) => [...prev, created]);
      setValue('');
    } catch (e: any) {
      message.error(e.message || 'Failed to add alias');
    }
  };

  const removeAlias = async (aliasId: number) => {
    try {
      await dictionaryApi.deleteAlias(entityType, entityId, aliasId);
      setAliases((prev) => prev.filter((a) => a.id !== aliasId));
    } catch {
      message.error('Failed to remove alias');
    }
  };

  const togglePrimary = async (alias: DictionaryAlias) => {
    const isPrimary = !alias.is_primary;
    try {
      await dictionaryApi.setPrimaryAlias(entityType, entityId, alias.id, isPrimary);
      setAliases((prev) =>
        prev.map((a) => ({
          ...a,
          is_primary: a.id === alias.id ? isPrimary : isPrimary ? false : a.is_primary,
        })),
      );
    } catch {
      message.error('Failed to update primary alias');
    }
  };

  return (
    <Space direction="vertical" style={{ width: '100%', marginTop: 16 }}>
      <Typography.Text strong>Aliases</Typography.Text>
      <div>
        {aliases.map((a) => (
          <Tag
            key={a.id}
            color={a.is_primary ? 'gold' : undefined}
            icon={
              <span
                onClick={() => void togglePrimary(a)}
                style={{ cursor: 'pointer', marginRight: 4 }}
                title={a.is_primary ? 'Primary alias — click to unset' : 'Set as primary alias'}
              >
                {a.is_primary ? <StarFilled /> : <StarOutlined />}
              </span>
            }
            closable
            onClose={(e) => {
              e.preventDefault();
              void removeAlias(a.id);
            }}
          >
            {a.alias}
          </Tag>
        ))}
      </div>
      <Space.Compact style={{ width: 320 }}>
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onPressEnter={() => void addAlias()}
          placeholder="Add new alias"
        />
        <Button type="primary" onClick={() => void addAlias()}>
          Add
        </Button>
      </Space.Compact>
    </Space>
  );
}
