import { createContext, useContext, useState, type ReactNode } from 'react';

interface FormApi {
  getFieldValue: (n: string) => unknown;
  setFieldValue: (n: string, v: unknown) => void;
  validateFields: () => Promise<Record<string, unknown>>;
}
const FormCtx = createContext<{
  values: Record<string, unknown>;
  set: (n: string, v: unknown) => void;
} | null>(null);

function useForm(): [FormApi] {
  const [values, setValues] = useState<Record<string, unknown>>({});
  return [
    {
      getFieldValue: (n) => values[n],
      setFieldValue: (n, v) => setValues((s) => ({ ...s, [n]: v })),
      validateFields: () => Promise.resolve(values),
    },
  ];
}

function Form({
  children,
  onFinish,
}: {
  children?: ReactNode;
  onFinish?: (v: Record<string, unknown>) => void;
}) {
  const [values, set] = useState<Record<string, unknown>>({});
  return (
    <FormCtx.Provider value={{ values, set: (n, v) => set((s) => ({ ...s, [n]: v })) }}>
      <form
        className="kp-stack"
        onSubmit={(e) => {
          e.preventDefault();
          onFinish?.(values);
        }}
      >
        {children}
      </form>
    </FormCtx.Provider>
  );
}

function Item({
  label,
  name,
  children,
}: {
  label?: ReactNode;
  name?: string;
  children: ReactNode;
}) {
  return (
    <div className="kp-field">
      {label && <span className="kp-label">{label}</span>}
      {children}
    </div>
  );
}

(Form as any).Item = Item;
(Form as any).useForm = useForm;
export { Form };
