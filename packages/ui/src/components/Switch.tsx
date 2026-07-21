export interface SwitchProps {
  checked?: boolean;
  onChange?: (v: boolean) => void;
}

export function Switch({ checked, onChange }: SwitchProps) {
  return (
    <button
      className={`kp-switch${checked ? ' on' : ''}`}
      aria-pressed={checked}
      onClick={() => onChange?.(!checked)}
    />
  );
}
