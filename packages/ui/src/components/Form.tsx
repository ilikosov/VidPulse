import { useState, type ReactNode } from 'react';

interface FormApi<T = any> {
  getFieldValue: (n: string) => unknown;
  setFieldValue: (n: string, v: unknown) => void;
  setFieldsValue: (v: Partial<T>) => void;
  getFieldsValue: () => T;
  resetFields: () => void;
  validateFields: () => Promise<T>;
}

function useForm<T = any>(): [FormApi<T>] {
  const [values, setValues] = useState<Record<string, unknown>>({});
  return [
    {
      getFieldValue: (n) => values[n],
      setFieldValue: (n, v) => setValues((s) => ({ ...s, [n]: v })),
      setFieldsValue: (v) => setValues((s) => ({ ...s, ...(v as Record<string, unknown>) })),
      getFieldsValue: () => values as T,
      resetFields: () => setValues({}),
      validateFields: () => Promise.resolve(values as T),
    },
  ];
}

interface FormProps {
  children?: ReactNode;
  layout?: 'horizontal' | 'vertical' | 'inline';
  form?: unknown;
  initialValues?: Record<string, unknown>;
  onFinish?: (v: Record<string, unknown>) => void;
  onValuesChange?: (changed: Record<string, unknown>, all: Record<string, unknown>) => void;
  className?: string;
  style?: React.CSSProperties;
  [key: string]: unknown;
}

function FormBase({ children, onFinish, className, style }: FormProps) {
  return (
    <form
      className={`kp-stack${className ? ' ' + className : ''}`}
      style={style}
      onSubmit={(e) => {
        e.preventDefault();
        onFinish?.({});
      }}
    >
      {children}
    </form>
  );
}

interface ItemProps {
  label?: ReactNode;
  name?: string | (string | number)[];
  children?: ReactNode;
  required?: boolean;
  rules?: unknown[];
  valuePropName?: string;
  extra?: ReactNode;
  help?: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  [key: string]: unknown;
}

function Item({ label, children, required, extra, help, className, style }: ItemProps) {
  return (
    <div className={`kp-field${className ? ' ' + className : ''}`} style={style}>
      {label && (
        <span className="kp-label">
          {label}
          {required && <span className="kp-txt-danger"> *</span>}
        </span>
      )}
      {children}
      {help && <span className="kp-txt-faint">{help}</span>}
      {extra && <span className="kp-txt-faint">{extra}</span>}
    </div>
  );
}

export const Form = Object.assign(FormBase, { Item, useForm });
