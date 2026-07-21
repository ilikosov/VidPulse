import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';

// Omit the DOM `prefix` (string) and `size` (number) — repurposed as a ReactNode adornment and a
// control-size token. Non-DOM props are destructured out before spreading onto <input>.
export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix' | 'size'> {
  prefix?: ReactNode;
  suffix?: ReactNode;
  allowClear?: boolean;
  size?: 'small' | 'middle' | 'large';
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { prefix, suffix, allowClear: _allowClear, size, className, ...rest },
  ref,
) {
  const input = <input ref={ref} className={`kp-input ${className ?? ''}`} {...rest} />;
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

function Search({
  prefix: _prefix,
  suffix: _suffix,
  allowClear: _allowClear,
  size: _size,
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
      <input className={`kp-input ${className ?? ''}`} placeholder={placeholder} {...rest} />
    </div>
  );
}

function TextArea({ className, ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`kp-textarea ${className ?? ''}`} {...rest} />;
}

(Input as any).Search = Search;
(Input as any).TextArea = TextArea;
