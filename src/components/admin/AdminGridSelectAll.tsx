'use client';

import { useId, useState } from 'react';
import { cn } from '@/lib/cn';

type AdminGridSelectAllProps = {
  name: string;
  formId?: string;
  label?: string;
  className?: string;
};

function isVisibleCheckbox(checkbox: HTMLInputElement): boolean {
  return checkbox.getClientRects().length > 0;
}

export function AdminGridSelectAll({
  name,
  formId,
  label = '전체',
  className,
}: AdminGridSelectAllProps) {
  const id = useId();
  const [checked, setChecked] = useState(false);

  return (
    <label
      htmlFor={id}
      className={cn('inline-flex min-h-6 cursor-pointer items-center justify-center gap-1', className)}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        aria-label={`${label} 선택`}
        className="h-3.5 w-3.5 rounded border-neutral-300 accent-neutral-900"
        onChange={(event) => {
          const nextChecked = event.currentTarget.checked;
          setChecked(nextChecked);
          const formSelector = formId ? `[form="${CSS.escape(formId)}"]` : '';
          const selector = `input[type="checkbox"][name="${CSS.escape(name)}"]${formSelector}`;
          document.querySelectorAll<HTMLInputElement>(selector).forEach((checkbox) => {
            if (!isVisibleCheckbox(checkbox)) return;
            checkbox.checked = nextChecked;
          });
        }}
      />
      <span className="text-xs font-medium text-neutral-600">{label}</span>
    </label>
  );
}
