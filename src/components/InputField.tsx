import { Tooltip } from './Tooltip';

interface InputFieldProps {
  label: string;
  value: number | string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  type?: 'number' | 'text';
  inputMode?: 'numeric' | 'decimal' | 'text';
  prefix?: string;
  suffix?: string;
  tooltip?: string;
  min?: number;
  step?: string;
}

export function InputField({
  label,
  value,
  onChange,
  onBlur,
  type = 'number',
  inputMode,
  prefix,
  suffix,
  tooltip,
  min = 0,
  step = 'any',
}: InputFieldProps) {
  return (
    <div>
      <label className="flex items-center gap-1 text-sm font-medium text-neutral-700 dark:text-neutral-300">
        {label}
        {tooltip && (
          <Tooltip content={tooltip}>
            <svg
              className="h-3.5 w-3.5 text-neutral-400 dark:text-neutral-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <circle cx="12" cy="17" r="0.5" fill="currentColor" />
            </svg>
          </Tooltip>
        )}
      </label>
      <div className="relative mt-1">
        {prefix && (
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-500 dark:text-neutral-400">
            {prefix}
          </span>
        )}
        <input
          type={type}
          inputMode={inputMode}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          min={min}
          step={step}
          className={`block w-full rounded-md border border-neutral-300 bg-white py-2 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100 ${
            prefix ? 'pl-7' : 'pl-3'
          } ${suffix ? 'pr-10' : 'pr-3'}`}
        />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-neutral-500 dark:text-neutral-400">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}
