import { Button, Card, Collapse, Space, Typography } from 'antd';
import type { ParserLog } from '../api';

const { Text } = Typography;

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
        <Button type="text" size="small" onClick={onClear}>
          Clear
        </Button>
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
