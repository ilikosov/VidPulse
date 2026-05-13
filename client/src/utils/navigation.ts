export interface BackLocationState {
  from?: string;
}

export function getBackPath(state: unknown, fallback: string): string {
  if (
    typeof state === 'object' &&
    state !== null &&
    'from' in state &&
    typeof (state as BackLocationState).from === 'string' &&
    (state as BackLocationState).from?.startsWith('/')
  ) {
    return (state as BackLocationState).from as string;
  }

  return fallback;
}
