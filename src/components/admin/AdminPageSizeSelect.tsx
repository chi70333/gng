'use client';

import { adminGridInputClass } from '@/components/admin/AdminDataGrid';

type AdminPageSizeSelectProps = {
  action: string;
  name: string;
  value: number;
  options: number[];
  hiddenFields?: Array<{ name: string; value: string }>;
};

export function AdminPageSizeSelect({
  action,
  name,
  value,
  options,
  hiddenFields = [],
}: AdminPageSizeSelectProps) {
  return (
    <form action={action} method="get" className="flex items-center gap-1.5">
      {hiddenFields
        .filter((field) => field.name !== name && field.name !== 'page')
        .map((field, index) => (
          <input key={`${field.name}-${index}`} type="hidden" name={field.name} value={field.value} />
        ))}
      <label className="text-xs font-medium text-neutral-600" htmlFor={`${name}-page-size`}>
        페이지당
      </label>
      <select
        id={`${name}-page-size`}
        name={name}
        value={value}
        className={`${adminGridInputClass} w-24`}
        aria-label="페이지당 표시 개수"
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}개
          </option>
        ))}
      </select>
    </form>
  );
}
