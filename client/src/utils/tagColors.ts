export function getTagColor(name: string): string {
  const normalized = name.trim().toLowerCase();

  if (normalized === 'short') return 'green';
  if (normalized === 'private') return 'orange';
  if (normalized === 'длинное видео') return 'blue';
  if (normalized === 'игнорировать видео') return 'red';

  return 'default';
}
