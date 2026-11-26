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

export interface CheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  error?: string;
  containerClassName?: string;
}

export interface RadioOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface RadioGroupProps {
  name: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: RadioOption[];
  required?: boolean;
  error?: string;
  inline?: boolean;
  disabled?: boolean;
  containerClassName?: string;
}

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  activeLabel?: string;
  inactiveLabel?: string;
  required?: boolean;
  disabled?: boolean;
  containerClassName?: string;
}

const BASE_CONTROL_CLASS =
  'w-full rounded-lg border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-subtle transition-colors focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-zebra disabled:text-ink-muted';

function controlBorderClass(hasError: boolean): string {
  return hasError
    ? 'border-danger bg-danger-soft/20 focus:border-danger focus:ring-danger/25'
    : 'border-line focus:border-brand focus:ring-solar-amber/30';
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
    <div className={`space-y-1.5 ${containerClassName}`}>
      {label && (
        <label
          htmlFor={fieldId}
          className="block text-[13px] font-bold text-ink"
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
        <p className="text-xs font-medium text-danger">{error}</p>
      ) : hint ? (
        <p className="text-xs text-ink-muted">{hint}</p>
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
    <div className={`space-y-1.5 ${containerClassName}`}>
      {label && (
        <label
          htmlFor={fieldId}
          className="block text-[13px] font-bold text-ink"
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
        <p className="text-xs font-medium text-danger">{error}</p>
      ) : hint ? (
        <p className="text-xs text-ink-muted">{hint}</p>
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
    <div className={`space-y-1.5 ${containerClassName}`}>
      {label && (
        <label
          htmlFor={fieldId}
          className="block text-[13px] font-bold text-ink"
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
        <p className="text-xs font-medium text-danger">{error}</p>
      ) : hint ? (
        <p className="text-xs text-ink-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function Checkbox({
  label,
  error,
  id,
  className = '',
  containerClassName = '',
  ...props
}: CheckboxProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;

  return (
    <div className={`space-y-1 ${containerClassName}`}>
      <label
        htmlFor={fieldId}
        className="inline-flex cursor-pointer items-start gap-2.5 text-sm text-ink select-none"
      >
        <input
          id={fieldId}
          type="checkbox"
          className={`mt-0.5 h-4 w-4 rounded border-line-strong accent-brand focus:ring-2 focus:ring-solar-amber/40 ${className}`}
          {...props}
        />
        <span>{label}</span>
      </label>
      {error && <p className="text-xs font-medium text-danger">{error}</p>}
    </div>
  );
}

export function RadioGroup({
  name,
  label,
  value,
  onChange,
  options,
  required,
  error,
  inline = true,
  disabled = false,
  containerClassName = '',
}: RadioGroupProps) {
  return (
    <div className={`space-y-1.5 ${containerClassName}`}>
      {label && (
        <p className="text-[13px] font-bold text-ink">
          {label}
          {required && <span className="ml-0.5 text-danger">*</span>}
        </p>
      )}
      <div className={inline ? 'flex flex-wrap items-center gap-4 pt-1' : 'space-y-2 pt-1'}>
        {options.map((opt) => (
          <label
            key={opt.value}
            className="inline-flex cursor-pointer items-center gap-2 text-sm text-ink select-none"
          >
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={value === opt.value}
              disabled={disabled || opt.disabled}
              onChange={() => onChange(opt.value)}
              className="h-4 w-4 accent-brand focus:ring-2 focus:ring-solar-amber/40"
            />
            <span>{opt.label}</span>
          </label>
        ))}
      </div>
      {error && <p className="text-xs font-medium text-danger">{error}</p>}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  activeLabel = 'Aktif',
  inactiveLabel = 'Nonaktif',
  required,
  disabled = false,
  containerClassName = '',
}: ToggleProps) {
  return (
    <div className={`space-y-1.5 ${containerClassName}`}>
      {label && (
        <p className="text-[13px] font-bold text-ink">
          {label}
          {required && <span className="ml-0.5 text-danger">*</span>}
        </p>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className="inline-flex items-center gap-2.5 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span
          className={[
            'relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors',
            checked ? 'bg-success' : 'bg-line-strong',
          ].join(' ')}
        >
          <span
            className={[
              'pointer-events-none inline-block h-5 w-5 translate-y-0.5 rounded-full bg-white shadow transition-transform',
              checked ? 'translate-x-5.5' : 'translate-x-0.5',
            ].join(' ')}
          />
        </span>
        <span className="text-sm font-medium text-ink">
          {checked ? activeLabel : inactiveLabel}
        </span>
      </button>
    </div>
  );
}
