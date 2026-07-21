import { Button } from './components/Button';
import { Card } from './components/Card';
import { Collapse } from './components/Collapse';
import { Space } from './components/Space';
import { Tag } from './components/Tag';
import { Typography } from './components/Typography';
import { message } from './components/message';
import type { ParserLog, ParserTraceStep } from '@vidpulse/shared';

const { Text } = Typography;

function extractTrace(output: unknown): ParserTraceStep[] {
  const trace = (output as { trace?: unknown })?.trace;
  return Array.isArray(trace) ? (trace as ParserTraceStep[]) : [];
}

function ParserTraceBlock({ steps }: { steps: ParserTraceStep[] }) {
  if (steps.length === 0) return <Text type="secondary">No trace available.</Text>;
  return (
    <div className="kp-timeline" style={{ marginTop: 4 }}>
      {steps.map((step, i) => {
        const changes = step.changes ?? {};
        const changeKeys = Object.keys(changes);
        return (
          <div className="kp-timeline-item" key={i}>
            <span className="kp-timeline-dot" />
            <div className="kp-timeline-body">
              <Space size={6}>
                <Text strong>{step.stage}</Text>
                {step.confidence != null && <Tag color="geekblue">conf {step.confidence}</Tag>}
              </Space>
              {step.detail && (
                <div className="kp-txt-faint" style={{ fontSize: 12.5, marginTop: 2 }}>
                  {step.detail}
                </div>
              )}
              {changeKeys.length > 0 && (
                <div className="kp-row2" style={{ gap: 6, marginTop: 6 }}>
                  {changeKeys.map((key) => (
                    <Tag key={key}>
                      {key}={String((changes as any)[key] ?? '∅')}
                    </Tag>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function formatTraceChanges(changes: Record<string, unknown> | undefined): string {
  if (!changes) return '';
  return Object.keys(changes)
    .map((key) => `${key}=${changes[key] === undefined ? '∅' : String(changes[key])}`)
    .join(' | ');
}

function formatReparseCopy(log: { input?: unknown; output?: unknown; error?: string }): string {
  const input = (log.input as any) ?? {};
  const out = (log.output as any) ?? {};
  const meta = out.metadata ?? out;
  const tags: string[] | undefined = input.tags;
  const inputLines = [
    `title: ${input.title ?? ''}`,
    `publishedAt: ${input.publishedAt ?? '(none)'}`,
    `tags: ${tags?.length ? tags.join(', ') : '(none)'}`,
    `description: ${input.description ?? '(none)'}`,
  ];
  const steps = extractTrace(log.output);
  const traceLines = steps.length
    ? steps.map((step, i) => {
        const lines = [
          `${i + 1}. ${step.stage}${step.confidence != null ? ` (conf ${step.confidence})` : ''}`,
        ];
        if (step.detail) lines.push(`   note: ${step.detail}`);
        const changes = formatTraceChanges(step.changes);
        if (changes) lines.push(`   ${changes}`);
        return lines.join('\n');
      })
    : ['(no trace)'];
  const resultFields = [
    meta.group_name != null && `group_name=${meta.group_name}`,
    meta.artist_name != null && `artist_name=${meta.artist_name}`,
    meta.song_title != null && `song_title=${meta.song_title}`,
    Array.isArray(meta.song_titles) && `song_titles=[${meta.song_titles.join(', ')}]`,
    meta.event != null && `event=${meta.event}`,
    meta.camera_type != null && `camera_type=${meta.camera_type}`,
    meta.perf_date != null && `perf_date=${meta.perf_date}`,
    meta.is_fancam != null && `is_fancam=${meta.is_fancam}`,
    meta.fancam_confidence != null && `fancam_confidence=${meta.fancam_confidence}`,
    meta.is_own_group_song != null && `is_own_group_song=${meta.is_own_group_song}`,
    meta.is_own_artist_song != null && `is_own_artist_song=${meta.is_own_artist_song}`,
    meta.confidence != null && `confidence=${meta.confidence}`,
    out.needsReview != null && `needs_review=${out.needsReview}`,
  ]
    .filter(Boolean)
    .join(' | ');
  const sections = [
    '=== Reparse Log ===',
    `[INPUT]\n${inputLines.join('\n')}`,
    `[TRACE]\n${traceLines.join('\n')}`,
    `[RESULT]\n${resultFields || '(empty)'}`,
  ];
  if (log.error) sections.push(`[ERROR]\n${log.error}`);
  return sections.join('\n\n');
}

export interface OperationLogWidgetProps {
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
  <pre className="kp-json">{JSON.stringify(data, null, 2)}</pre>
);

function OperationLogWidget({ type, log, onClear }: OperationLogWidgetProps) {
  const title = type === 'reparse' ? 'Reparse Log' : 'Resync Log';
  return (
    <Card
      title={title}
      style={{ marginTop: 16 }}
      extra={
        <Space size={4}>
          {type === 'reparse' && (
            <Button
              type="text"
              size="small"
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
