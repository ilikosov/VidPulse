import { CopyOutlined } from '@ant-design/icons';
import { Button, Card, Collapse, Space, Tag, Timeline, Typography, message } from 'antd';
import type { ParserLog, ParserTraceStep } from '../api';

const { Text } = Typography;

/** Pull the parser trace out of a parse result (reparseLog.output / parseLog.output). */
function extractTrace(output: unknown): ParserTraceStep[] {
  const trace = (output as { trace?: unknown })?.trace;
  return Array.isArray(trace) ? (trace as ParserTraceStep[]) : [];
}

function ParserTraceBlock({ steps }: { steps: ParserTraceStep[] }) {
  if (steps.length === 0) {
    return <Text type="secondary">No trace available.</Text>;
  }
  return (
    <Timeline
      style={{ marginTop: 4 }}
      items={steps.map((step) => {
        const changes = step.changes ?? {};
        const changeKeys = Object.keys(changes);
        return {
          children: (
            <Space direction="vertical" size={2} style={{ width: '100%' }}>
              <Space size={6} wrap>
                <Text strong>{step.stage}</Text>
                {step.confidence != null && (
                  <Tag color="blue" style={{ margin: 0 }}>
                    conf {step.confidence}
                  </Tag>
                )}
              </Space>
              {step.detail && <Text type="secondary">{step.detail}</Text>}
              {changeKeys.length > 0 && (
                <Space size={[4, 4]} wrap>
                  {changeKeys.map((key) => (
                    <Tag key={key} style={{ margin: 0 }}>
                      {key}={String(changes[key] ?? '∅')}
                    </Tag>
                  ))}
                </Space>
              )}
            </Space>
          ),
        };
      })}
    />
  );
}

function formatReparseCopy(log: { input?: unknown; output?: unknown }): string {
  const title = (log.input as any)?.title ?? '';
  const out = (log.output as any) ?? {};
  const meta = out.metadata ?? out;

  const fields = [
    meta.group_name != null && `group_name=${meta.group_name}`,
    meta.artist_name != null && `artist_name=${meta.artist_name}`,
    meta.song_title != null && `song_title=${meta.song_title}`,
    meta.event != null && `event=${meta.event}`,
    meta.camera_type != null && `camera_type=${meta.camera_type}`,
    meta.perf_date != null && `perf_date=${meta.perf_date}`,
    meta.is_fancam != null && `is_fancam=${meta.is_fancam}`,
    meta.confidence != null && `confidence=${meta.confidence}`,
    out.needsReview != null && `needs_review=${out.needsReview}`,
  ]
    .filter(Boolean)
    .join(' | ');

  return `input: ${title}\noutput: ${fields}`;
}

interface OperationLogWidgetProps {
  type: 'reparse' | 'resync';
  log: {
    input?: unknown;
    output?: unknown;
    error?: string;
    youtubeResponse?: unknown;
    youtubeError?: string;
    parseLog?: ParserLog;
  };
  onClear: () => void;
}

const JsonBlock = ({ data }: { data: unknown }) => (
  <pre
    style={{
      margin: 0,
      background: '#fafafa',
      border: '1px solid #f0f0f0',
      borderRadius: 8,
      padding: 12,
      maxHeight: 280,
      overflow: 'auto',
      fontSize: 12,
      lineHeight: 1.45,
    }}
  >
    {JSON.stringify(data, null, 2)}
  </pre>
);

function OperationLogWidget({ type, log, onClear }: OperationLogWidgetProps) {
  const title = type === 'reparse' ? 'Reparse Log' : 'Resync Log';

  return (
    <Card
      title={title}
      size="small"
      style={{ marginTop: 16, background: '#fcfcfc' }}
      extra={
        <Space size={4}>
          {type === 'reparse' && (
            <Button
              type="text"
              size="small"
              icon={<CopyOutlined />}
              onClick={() => {
                navigator.clipboard.writeText(formatReparseCopy(log));
                message.success('Copied!');
              }}
            >
              Copy
            </Button>
          )}
          <Button type="text" size="small" onClick={onClear}>
            Clear
          </Button>
        </Space>
      }
    >
      <Collapse
        defaultActiveKey={['details']}
        items={[
          {
            key: 'details',
            label: 'Operation details',
            children:
              type === 'reparse' ? (
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  <Text strong>Input</Text>
                  <JsonBlock data={log.input ?? {}} />
                  <Text strong>Parser trace</Text>
                  <ParserTraceBlock steps={extractTrace(log.output)} />
                  <Text strong>Output</Text>
                  <JsonBlock data={log.output ?? {}} />
                  {log.error ? (
                    <>
                      <Text strong type="danger">
                        Error
                      </Text>
                      <JsonBlock data={{ error: log.error }} />
                    </>
                  ) : null}
                </Space>
              ) : (
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  <Text strong>YouTube API Response</Text>
                  <JsonBlock data={log.youtubeResponse ?? { error: log.youtubeError || null }} />
                  <Text strong>Parser Log Input</Text>
                  <JsonBlock data={log.parseLog?.input ?? {}} />
                  <Text strong>Parser trace</Text>
                  <ParserTraceBlock steps={extractTrace(log.parseLog?.output)} />
                  <Text strong>Parser Log Output</Text>
                  <JsonBlock data={log.parseLog?.output ?? {}} />
                  {log.parseLog?.error ? (
                    <>
                      <Text strong type="danger">
                        Parser Error
                      </Text>
                      <JsonBlock data={{ error: log.parseLog.error }} />
                    </>
                  ) : null}
                </Space>
              ),
          },
        ]}
      />
    </Card>
  );
}

export default OperationLogWidget;
