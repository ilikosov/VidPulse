import type { ReactNode } from 'react';

export interface UploadProps {
  children?: ReactNode;
  hint?: string;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  showUploadList?: boolean;
  beforeUpload?: (file: any) => boolean | void | Promise<boolean | void>;
  onChange?: (info: { file: File | null; fileList: File[] }) => void;
  customRequest?: (options: unknown) => void;
  fileList?: unknown[];
  maxCount?: number;
  listType?: string;
  [key: string]: unknown;
}

function UploadBase({
  children,
  hint = 'Перетащите файл или нажмите для выбора',
  accept,
  multiple,
  disabled,
  beforeUpload,
  onChange,
}: UploadProps) {
  return (
    <label className={`kp-upload${disabled ? ' kp-upload--disabled' : ''}`}>
      <input
        type="file"
        hidden
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          files.forEach((f) => beforeUpload?.(f));
          onChange?.({ file: files[0] ?? null, fileList: files });
        }}
      />
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

export const Upload = Object.assign(UploadBase, { Dragger: UploadBase });
