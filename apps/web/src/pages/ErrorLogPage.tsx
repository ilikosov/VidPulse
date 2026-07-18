import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePaginationSearchParams } from '../hooks/usePaginationSearchParams';
import { Button, Card, Popconfirm, Space, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ErrorLogEntry, clearErrors, getErrors } from '../api';

const { Text, Paragraph } = Typography;

function formatContext(context: string | null): string {
  if (!context) return '';
  try {
    return JSON.stringify(JSON.parse(context), null, 2);
  } catch {
    return context;
  }
}

export default function ErrorLogPage() {
  const [errors, setErrors] = useState<ErrorLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [total, setTotal] = useState(0);
  const { page, limit, setPagination } = usePaginationSearchParams(50);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getErrors({ page, limit });
      setErrors(response.errors);
      setTotal(response.pagination.total);
    } finally {
      setLoading(false);
    }
  }, [page, limit]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleClear() {
    setClearing(true);
    try {
      await clearErrors();
      message.success('Error log cleared');
      await load();
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Failed to clear error log');
    } finally {
      setClearing(false);
    }
  }

  const columns: ColumnsType<ErrorLogEntry> = useMemo(
    () => [
      {
        title: 'Time',
        dataIndex: 'created_at',
        key: 'created_at',
        width: 200,
        render: (value: string) => new Date(value).toLocaleString(),
      },
      {
        title: 'Type',
        dataIndex: 'name',
        key: 'name',
        width: 140,
        render: (value: string | null) => <Tag color="red">{value || 'Error'}</Tag>,
      },
      {
        title: 'Request',
        key: 'request',
        width: 240,
        render: (_, record) =>
          record.path ? (
            <Text code>
              {record.status_code ?? '—'} {record.method ?? ''} {record.path}
            </Text>
          ) : (
            '-'
          ),
      },
      {
        title: 'Message',
        dataIndex: 'message',
        key: 'message',
        render: (value: string) => <Text>{value}</Text>,
      },
    ],
    [],
  );

  return (
    <Card
      title="Error Log"
      extra={
        <Space>
          <Button onClick={() => void load()}>Refresh</Button>
          <Popconfirm
            title="Clear the entire error log?"
            onConfirm={() => void handleClear()}
            okButtonProps={{ danger: true }}
          >
            <Button danger loading={clearing} disabled={total === 0}>
              Clear
            </Button>
          </Popconfirm>
        </Space>
      }
    >
      <Table<ErrorLogEntry>
        rowKey="id"
        dataSource={errors}
        loading={loading}
        columns={columns}
        expandable={{
          rowExpandable: (record) => Boolean(record.stack || record.context),
          expandedRowRender: (record) => (
            <>
              {record.context && (
                <Paragraph>
                  <Text strong>Context</Text>
                  <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
                    {formatContext(record.context)}
                  </pre>
                </Paragraph>
              )}
              {record.stack && (
                <Paragraph style={{ marginBottom: 0 }}>
                  <Text strong>Stack</Text>
                  <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{record.stack}</pre>
                </Paragraph>
              )}
            </>
          ),
        }}
        pagination={{
          current: page,
          pageSize: limit,
          total,
          showSizeChanger: true,
          pageSizeOptions: [20, 50, 100],
          onChange: (nextPage, nextPageSize) => {
            setPagination({ page: nextPage, limit: nextPageSize });
          },
        }}
      />
    </Card>
  );
}
