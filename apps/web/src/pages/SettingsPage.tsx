import { Card, Checkbox, Typography } from '@vidpulse/ui';
import { useSettings } from '../settingsContext';

const OPTIONS = [
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
  { label: 'Mixed', value: 'mixed' },
];

export default function SettingsPage() {
  const { visibleGroupTypes, setVisibleGroupTypes } = useSettings();
  return (
    <Card>
      <Typography.Title level={4}>Dictionary Visibility</Typography.Title>
      <Checkbox.Group
        options={OPTIONS}
        value={visibleGroupTypes}
        onChange={(values) =>
          void setVisibleGroupTypes(values as Array<'male' | 'female' | 'mixed'>)
        }
      />
    </Card>
  );
}
