import type { ReactNode } from 'react';

export interface UploadProps {
  children?: ReactNode;
  hint?: string;
  onChange?: (files: FileList | null) => void;
}

export function Upload({
  children,
  hint = 'Перетащите файл или нажмите для выбора',
  onChange,
}: UploadProps) {
  return (
    <label className="kp-upload">
      <input type="file" hidden onChange={(e) => onChange?.(e.target.files)} />
      <svg
        viewBox="0 0 24 24"
        width={26}
        height={26}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 16V4M7 9l5-5 5 5M5 20h14" />
      </svg>
      <span>{children ?? hint}</span>
      <span className="kp-upload-hint">MP4, MOV до 4 ГБ</span>
    </label>
  );
}
