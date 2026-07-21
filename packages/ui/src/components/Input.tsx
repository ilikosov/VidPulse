import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  prefix?: ReactNode;
  allowClear?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { prefix, allowClear, className, ...rest },
  ref,
) {
  if (prefix) {
    return (
      <div className="kp-input-wrap">
        {prefix}
        <input ref={ref} className={`kp-input ${className ?? ''}`} {...rest} />
      </div>
    );
  }
  return <input ref={ref} className={`kp-input ${className ?? ''}`} {...rest} />;
});

function Search({ placeholder = 'Search…', ...rest }: InputProps) {
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
      <input className="kp-input" placeholder={placeholder} {...rest} />
    </div>
  );
}
function TextArea({ className, ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`kp-textarea ${className ?? ''}`} {...rest} />;
}
(Input as any).Search = Search;
(Input as any).TextArea = TextArea;
