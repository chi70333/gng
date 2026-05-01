'use client';

import { useState } from 'react';

type SocialConnectPhoneFieldProps = {
  label: string;
  name: string;
  autoComplete: string;
  inputMode?: 'email' | 'numeric' | 'tel' | 'text';
  maxLength?: number;
  placeholder?: string;
  required?: boolean;
  defaultValue?: string;
};

function formatPhone(value: string) {
  const digits = value.replace(/[^0-9]/g, '').slice(0, 11);

  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;

  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

export function SocialConnectPhoneField({
  label,
  name,
  autoComplete,
  inputMode = 'tel',
  maxLength = 13,
  placeholder,
  required = true,
  defaultValue = '',
}: SocialConnectPhoneFieldProps) {
  const [value, setValue] = useState(formatPhone(defaultValue));

  return (
    <label className="block">
      <span className="mb-1 flex items-center justify-between gap-3 text-sm font-medium text-neutral-700">
        <span>{label}</span>
        {required ? (
          <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-red-500">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500" aria-hidden="true" />
            필수
          </span>
        ) : null}
      </span>
      <input
        name={name}
        required={required}
        value={value}
        autoComplete={autoComplete}
        inputMode={inputMode}
        maxLength={maxLength}
        type="tel"
        placeholder={placeholder}
        onChange={(event) => setValue(formatPhone(event.target.value))}
        className="h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-base outline-none focus:ring-2 focus:ring-neutral-300"
      />
    </label>
  );
}
