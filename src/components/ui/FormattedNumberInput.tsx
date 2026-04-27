'use client';

import { useEffect, useState, type InputHTMLAttributes } from 'react';

type FormattedNumberInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'defaultValue' | 'name' | 'onChange' | 'type' | 'value'
> & {
  name?: string;
  defaultValue?: number | string | null;
  value?: string;
  onValueChange?: (value: string) => void;
  allowDecimal?: boolean;
};

function cleanNumber(value: string, allowDecimal: boolean): string {
  const normalized = value.replace(/,/g, '').replace(/[^\d.]/g, '');
  if (!allowDecimal) return normalized.replace(/\D/g, '');

  const [integer = '', ...fractions] = normalized.split('.');
  const fraction = fractions.join('').slice(0, 2);
  return fractions.length > 0 ? `${integer}.${fraction}` : integer;
}

function formatNumberText(value: string): string {
  if (!value) return '';

  const [integer = '', fraction] = value.split('.');
  const formattedInteger = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fraction == null ? formattedInteger : `${formattedInteger}.${fraction}`;
}

export function FormattedNumberInput({
  name,
  defaultValue,
  value,
  onValueChange,
  allowDecimal = false,
  form,
  ...props
}: FormattedNumberInputProps) {
  const initialValue = cleanNumber(defaultValue == null ? '' : String(defaultValue), allowDecimal);
  const [innerValue, setInnerValue] = useState(initialValue);
  const rawValue = value == null ? innerValue : cleanNumber(value, allowDecimal);

  useEffect(() => {
    if (value == null) setInnerValue(initialValue);
  }, [initialValue, value]);

  return (
    <>
      {name ? <input type="hidden" name={name} value={rawValue} form={form} /> : null}
      <input
        {...props}
        form={form}
        type="text"
        inputMode={allowDecimal ? 'decimal' : 'numeric'}
        value={formatNumberText(rawValue)}
        onChange={(event) => {
          const nextValue = cleanNumber(event.target.value, allowDecimal);
          if (value == null) setInnerValue(nextValue);
          onValueChange?.(nextValue);
        }}
      />
    </>
  );
}
