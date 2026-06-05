import { Button, Card, Form, Input, Space, Typography, message } from 'antd';
import { addVideo } from '../api';

function AddVideoPage() {
  const [form] = Form.useForm<{ url: string }>();

  const onSubmit = async () => {
    try {
      const values = await form.validateFields();
      await addVideo(values.url);
      message.success('Video added successfully');
      form.resetFields();
    } catch (error) {
      if (error instanceof Error) {
        message.error(error.message);
      }
    }
  };

  return (
    <Card>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Typography.Title level={2} style={{ margin: 0 }}>
          Add Single Video
        </Typography.Title>
        <Typography.Text type="secondary">
          Paste a YouTube video URL to fetch metadata and add it into the processing queue.
        </Typography.Text>

        <Form form={form} layout="vertical" style={{ maxWidth: 720 }}>
          <Form.Item
            label="YouTube Video URL"
            name="url"
            rules={[{ required: true, message: 'Please enter a YouTube video URL' }]}
          >
            <Input placeholder="https://www.youtube.com/watch?v=..." />
          </Form.Item>
          <Form.Item>
            <Button type="primary" onClick={() => void onSubmit()}>
              Add Video
            </Button>
          </Form.Item>
        </Form>
      </Space>
    </Card>
  );
}

export default AddVideoPage;
