import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

export const adminSurfaceClass =
  'overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.045)] ring-1 ring-white';

export const adminSurfaceHeaderClass =
  'border-b border-neutral-200 bg-gradient-to-b from-white to-neutral-50 px-3 py-2.5';

export const adminFieldClass =
  'h-9 w-full rounded border border-neutral-300 bg-white px-2.5 text-[13px] font-medium text-neutral-950 shadow-inner shadow-neutral-950/[0.025] outline-none transition placeholder:text-neutral-400 hover:border-neutral-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100';

export const adminTextareaClass =
  'w-full rounded border border-neutral-300 bg-white px-2.5 py-2 text-[13px] leading-5 text-neutral-950 shadow-inner shadow-neutral-950/[0.025] outline-none transition placeholder:text-neutral-400 hover:border-neutral-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100';

export const adminPrimaryButtonClass =
  'inline-flex h-9 items-center justify-center gap-1.5 rounded border border-neutral-800 bg-neutral-900 px-3 text-[13px] font-bold text-white shadow-sm shadow-neutral-950/15 transition hover:-translate-y-px hover:bg-neutral-800 disabled:cursor-wait disabled:opacity-60';

export const adminSecondaryButtonClass =
  'inline-flex h-9 items-center justify-center gap-1.5 rounded border border-neutral-300 bg-white px-3 text-[13px] font-bold text-neutral-800 shadow-sm transition hover:-translate-y-px hover:bg-neutral-50';

export const adminDangerButtonClass =
  'inline-flex h-9 items-center justify-center gap-1.5 rounded border border-red-200 bg-red-50 px-3 text-[13px] font-bold text-red-700 shadow-sm transition hover:-translate-y-px hover:bg-red-100';

export function AdminPageHeader({
  title,
  description,
  eyebrow,
  actions,
  className,
}: {
  title: string;
  description?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-end justify-between gap-3 border-b border-neutral-200 pb-3',
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow ? <p className="text-xs font-bold text-neutral-500">{eyebrow}</p> : null}
        <h1
          className={cn(
            'text-2xl font-extrabold tracking-normal text-neutral-950',
            eyebrow && 'mt-1',
          )}
        >
          {title}
        </h1>
        {description ? <p className="mt-1 text-sm text-neutral-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function AdminSection({
  title,
  description,
  icon: Icon,
  children,
  className,
  bodyClassName,
  headerAction,
}: {
  title: string;
  description?: ReactNode;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  headerAction?: ReactNode;
}) {
  return (
    <section className={cn(adminSurfaceClass, className)}>
      <div
        className={cn(adminSurfaceHeaderClass, 'flex flex-wrap items-center justify-between gap-3')}
      >
        <div className="flex min-w-[180px] flex-1 items-center gap-2.5">
          {Icon ? (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-700 shadow-sm">
              <Icon size={16} />
            </span>
          ) : null}
          <div className="min-w-0">
            <h2 className="text-sm font-extrabold text-neutral-950">{title}</h2>
            {description ? (
              <p className="mt-0.5 text-xs font-medium text-neutral-500">{description}</p>
            ) : null}
          </div>
        </div>
        {headerAction ? <div className="ml-auto shrink-0">{headerAction}</div> : null}
      </div>
      <div className={cn('p-3', bodyClassName)}>{children}</div>
    </section>
  );
}

export function AdminInfoTile({
  label,
  value,
  icon: Icon,
  className,
}: {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <div
      className={cn(
        adminSurfaceClass,
        'p-4 transition hover:-translate-y-px hover:shadow-md',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-neutral-500">{label}</p>
        {Icon ? <Icon className="text-neutral-300" size={22} /> : null}
      </div>
      <p className="mt-3 text-2xl font-extrabold text-neutral-950">{value}</p>
    </div>
  );
}
