import { useCallback, useEffect, useState } from 'react';
import { Button, Modal, Popconfirm, Space, Table, Tabs, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { ErrorLogEntry, RequestLogEntry } from '@vidpulse/shared';

const { Text, Paragraph } = Typography;

async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  return (await res.json()) as T;
}

async function apiDelete(url: string): Promise<void> {
  const res = await fetch(url, { method: 'DELETE' });
  if (!res.ok) throw new Error(`DELETE ${url} → ${res.status}`);
}

function statusColor(code: number): string {
  if (code >= 500) return 'red';
  if (code >= 400) return 'orange';
  if (code >= 300) return 'gold';
  return 'green';
}

const time = (v: string) => new Date(v).toLocaleTimeString();

export interface MonitorProps {
  /** API base URL, e.g. http://localhost:3000/api */
  baseUrl: string;
  /** When false, the monitor renders nothing (gated by the server `monitorEnabled` flag). */
  enabled: boolean;
}

/**
 * A hideable, non-blocking floating window (Ant Modal with `mask={false}`) that shows the server's
 * error log and in-memory HTTP request log. Self-contained: it fetches from `${baseUrl}/errors` and
 * `${baseUrl}/requests` itself, so the host app only mounts `<Monitor baseUrl enabled />` once.
 */
export function Monitor({ baseUrl, enabled }: MonitorProps): JSX.Element | null {
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<ErrorLogEntry[]>([]);
  const [requests, setRequests] = useState<RequestLogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [e, r] = await Promise.all([
        apiGet<{ errors: ErrorLogEntry[] }>(`${baseUrl}/errors?limit=200`),
        apiGet<{ requests: RequestLogEntry[] }>(`${baseUrl}/requests`),
      ]);
      setErrors(e.errors);
      setRequests(r.requests);
    } catch {
      /* transient fetch errors are ignored — the monitor is best-effort */
    } finally {
      setLoading(false);
    }
  }, [baseUrl]);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  if (!enabled) return null;

  const errorColumns: ColumnsType<ErrorLogEntry> = [
    { title: 'Time', dataIndex: 'created_at', width: 100, render: time },
    {
      title: 'Type',
      dataIndex: 'name',
      width: 130,
      render: (v: string | null) => <Tag color="red">{v || 'Error'}</Tag>,
    },
    {
      title: 'Request',
      key: 'request',
      width: 220,
      render: (_, r) =>
        r.path ? (
          <Text code>
            {r.status_code ?? '—'} {r.method ?? ''} {r.path}
          </Text>
        ) : (
          '—'
        ),
    },
    { title: 'Message', dataIndex: 'message', render: (v: string) => <Text>{v}</Text> },
  ];

  const requestColumns: ColumnsType<RequestLogEntry> = [
    { title: 'Time', dataIndex: 'created_at', width: 100, render: time },
    { title: 'Method', dataIndex: 'method', width: 90 },
    { title: 'Path', dataIndex: 'path' },
    {
      title: 'Status',
      dataIndex: 'status_code',
      width: 90,
      render: (v: number) => <Tag color={statusColor(v)}>{v}</Tag>,
    },
    { title: 'ms', dataIndex: 'duration_ms', width: 80 },
  ];

  const clearButton = (label: string, url: string, disabled: boolean) => (
    <Popconfirm
      title={`Clear ${label}?`}
      okButtonProps={{ danger: true }}
      onConfirm={async () => {
        await apiDelete(url);
        void refresh();
      }}
    >
      <Button size="small" danger disabled={disabled} style={{ marginBottom: 8 }}>
        Clear
      </Button>
    </Popconfirm>
  );

  return (
    <>
      {!open && (
        <Button
          type="primary"
          onClick={() => setOpen(true)}
          style={{ position: 'fixed', right: 16, bottom: 16, zIndex: 1000 }}
        >
          Monitor
        </Button>
      )}
      <Modal
        title="Monitor"
        open={open}
        mask={false}
        maskClosable={false}
        onCancel={() => setOpen(false)}
        footer={null}
        width={880}
        style={{ top: 24 }}
      >
        <Tabs
          tabBarExtraContent={
            <Button size="small" onClick={() => void refresh()} loading={loading}>
              Refresh
            </Button>
          }
          items={[
            {
              key: 'errors',
              label: `Errors (${errors.length})`,
              children: (
                <Space direction="vertical" style={{ width: '100%' }} size={4}>
                  {clearButton('error log', `${baseUrl}/errors`, errors.length === 0)}
                  <Table<ErrorLogEntry>
                    rowKey="id"
                    size="small"
                    dataSource={errors}
                    columns={errorColumns}
                    loading={loading}
                    pagination={{ pageSize: 20, size: 'small' }}
                    expandable={{
                      rowExpandable: (r) => Boolean(r.stack || r.context),
                      expandedRowRender: (r) => (
                        <>
                          {r.context && (
                            <Paragraph>
                              <Text strong>Context</Text>
                              <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{r.context}</pre>
                            </Paragraph>
                          )}
                          {r.stack && (
                            <Paragraph style={{ marginBottom: 0 }}>
                              <Text strong>Stack</Text>
                              <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{r.stack}</pre>
                            </Paragraph>
                          )}
                        </>
                      ),
                    }}
                  />
                </Space>
              ),
            },
            {
              key: 'requests',
              label: `Requests (${requests.length})`,
              children: (
                <Space direction="vertical" style={{ width: '100%' }} size={4}>
                  {clearButton('request log', `${baseUrl}/requests`, requests.length === 0)}
                  <Table<RequestLogEntry>
                    rowKey="id"
                    size="small"
                    dataSource={requests}
                    columns={requestColumns}
                    loading={loading}
                    pagination={{ pageSize: 20, size: 'small' }}
                  />
                </Space>
              ),
            },
          ]}
        />
      </Modal>
    </>
  );
}
