import { forwardRef, type InputHTMLAttributes, type KeyboardEvent, type ReactNode } from 'react';

// Omit the DOM `prefix` (string) and `size` (number); repurpose them. `onPressEnter` mirrors antd.
export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix' | 'size'> {
  prefix?: ReactNode;
  suffix?: ReactNode;
  allowClear?: boolean;
  size?: 'small' | 'middle' | 'large';
  onPressEnter?: (e: KeyboardEvent<HTMLInputElement>) => void;
  onSearch?: (value: string) => void;
}

const InputBase = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    prefix,
    suffix,
    allowClear: _allowClear,
    size,
    onPressEnter,
    onSearch,
    onKeyDown,
    className,
    ...rest
  },
  ref,
) {
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(e);
    if (e.key === 'Enter') {
      onPressEnter?.(e);
      onSearch?.((e.target as HTMLInputElement).value);
    }
  };
  const input = (
    <input
      ref={ref}
      className={`kp-input ${className ?? ''}`}
      onKeyDown={onPressEnter || onSearch || onKeyDown ? handleKeyDown : undefined}
      {...rest}
    />
  );
  if (prefix || suffix) {
    return (
      <div className="kp-input-wrap">
        {prefix}
        {input}
        {suffix}
      </div>
    );
  }
  return input;
});

interface TextAreaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'prefix'> {
  onPressEnter?: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  autoSize?: boolean | { minRows?: number; maxRows?: number };
}
function TextArea({ className, autoSize: _autoSize, onPressEnter, ...rest }: TextAreaProps) {
  return <textarea className={`kp-textarea ${className ?? ''}`} {...rest} />;
}

function Search({
  prefix: _prefix,
  suffix: _suffix,
  allowClear: _allowClear,
  size: _size,
  onPressEnter,
  onSearch,
  onKeyDown,
  placeholder = 'Search…',
  className,
  ...rest
}: InputProps) {
  return (
    <div className="kp-input-wrap">
      <svg
        viewBox="0 0 24 24"
        width={18}
        height={18}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z" />
        <path d="M21 21l-4-4" />
      </svg>
      <input
        className={`kp-input ${className ?? ''}`}
        placeholder={placeholder}
        onKeyDown={(e) => {
          onKeyDown?.(e);
          if (e.key === 'Enter') {
            onPressEnter?.(e);
            onSearch?.((e.target as HTMLInputElement).value);
          }
        }}
        {...rest}
      />
    </div>
  );
}

export const Input = Object.assign(InputBase, { Search, TextArea });
