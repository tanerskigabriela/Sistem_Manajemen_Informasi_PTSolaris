import {
  useId,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

interface BaseFieldProps {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  containerClassName?: string;
}

export interface InputProps
  extends BaseFieldProps,
    Omit<InputHTMLAttributes<HTMLInputElement>, 'required'> {}

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps
  extends BaseFieldProps,
    Omit<SelectHTMLAttributes<HTMLSelectElement>, 'required'> {
  options: SelectOption[];
  placeholder?: string;
}

export interface TextareaProps
  extends BaseFieldProps,
    Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'required'> {}

const BASE_CONTROL_CLASS =
  'w-full rounded-lg border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-subtle transition-colors focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-ink-muted';

function controlBorderClass(hasError: boolean): string {
  return hasError
    ? 'border-danger focus:border-danger focus:ring-danger/25'
    : 'border-line-strong focus:border-brand focus:ring-brand/25';
}

export function Input({
  label,
  error,
  hint,
  required,
  id,
  className = '',
  containerClassName = '',
  ...props
}: InputProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;

  return (
    <div className={`space-y-1 ${containerClassName}`}>
      {label && (
        <label
          htmlFor={fieldId}
          className="block text-sm font-medium text-ink"
        >
          {label}
          {required && <span className="ml-0.5 text-danger">*</span>}
        </label>
      )}
      <input
        id={fieldId}
        required={required}
        aria-invalid={Boolean(error)}
        className={`${BASE_CONTROL_CLASS} ${controlBorderClass(Boolean(error))} ${className}`}
        {...props}
      />
      {error ? (
        <p className="text-xs text-danger">{error}</p>
      ) : hint ? (
        <p className="text-xs text-ink-subtle">{hint}</p>
      ) : null}
    </div>
  );
}

export function Select({
  label,
  error,
  hint,
  required,
  id,
  options,
  placeholder,
  className = '',
  containerClassName = '',
  ...props
}: SelectProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;

  return (
    <div className={`space-y-1 ${containerClassName}`}>
      {label && (
        <label
          htmlFor={fieldId}
          className="block text-sm font-medium text-ink"
        >
          {label}
          {required && <span className="ml-0.5 text-danger">*</span>}
        </label>
      )}
      <select
        id={fieldId}
        required={required}
        aria-invalid={Boolean(error)}
        className={`${BASE_CONTROL_CLASS} ${controlBorderClass(Boolean(error))} ${className}`}
        {...props}
      >
        {placeholder !== undefined && (
          <option value="">{placeholder}</option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </select>
      {error ? (
        <p className="text-xs text-danger">{error}</p>
      ) : hint ? (
        <p className="text-xs text-ink-subtle">{hint}</p>
      ) : null}
    </div>
  );
}

export function Textarea({
  label,
  error,
  hint,
  required,
  id,
  rows = 3,
  className = '',
  containerClassName = '',
  ...props
}: TextareaProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;

  return (
    <div className={`space-y-1 ${containerClassName}`}>
      {label && (
        <label
          htmlFor={fieldId}
          className="block text-sm font-medium text-ink"
        >
          {label}
          {required && <span className="ml-0.5 text-danger">*</span>}
        </label>
      )}
      <textarea
        id={fieldId}
        rows={rows}
        required={required}
        aria-invalid={Boolean(error)}
        className={`${BASE_CONTROL_CLASS} ${controlBorderClass(Boolean(error))} ${className}`}
        {...props}
      />
      {error ? (
        <p className="text-xs text-danger">{error}</p>
      ) : hint ? (
        <p className="text-xs text-ink-subtle">{hint}</p>
      ) : null}
    </div>
  );
}