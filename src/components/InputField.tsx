import { Tooltip } from './Tooltip';

interface InputFieldProps {
  label: string;
  value: number | string;
  onChange: (value: string) => void;
  type?: 'number' | 'text';
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
  type = 'number',
  prefix,
  suffix,
  tooltip,
  min = 0,
  step = 'any',
}: InputFieldProps) {
  return (
    <div>
      <label className="flex items-center gap-1 text-sm font-medium text-gray-700">
        {label}
        {tooltip && (
          <Tooltip content={tooltip}>
            <svg
              className="h-3.5 w-3.5 text-gray-400"
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
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
            {prefix}
          </span>
        )}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          min={min}
          step={step}
          className={`block w-full rounded-md border border-gray-300 bg-white py-2 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 ${
            prefix ? 'pl-7' : 'pl-3'
          } ${suffix ? 'pr-10' : 'pr-3'}`}
        />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}
