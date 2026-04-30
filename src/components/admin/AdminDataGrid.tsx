import type { ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/cn';
import {
  adminFieldClass,
  adminSecondaryButtonClass,
} from '@/components/admin/AdminUI';

export type AdminDataColumn = {
  key: string;
  label: ReactNode;
  align?: 'left' | 'center' | 'right';
  widthClassName?: string;
  priority?: 'primary' | 'normal' | 'low';
  sortKey?: string;
};

export type AdminSortDirection = 'asc' | 'desc';

type AdminDataGridProps<T> = {
  columns: AdminDataColumn[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  renderRow: (row: T, index: number) => ReactNode;
  renderMobileCard?: (row: T, index: number) => ReactNode;
  emptyText: string;
  caption?: string;
  density?: 'compact' | 'normal';
  minWidthClassName?: string;
  className?: string;
  scrollAreaClassName?: string;
  mobileScrollAreaClassName?: string;
  currentSortKey?: string;
  currentSortDirection?: AdminSortDirection;
  getSortHref?: (sortKey: string, direction: AdminSortDirection) => string;
  toolbarEnd?: ReactNode;
};

const alignClass = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

export const adminGridCellClass =
  'border-b border-neutral-200 px-2 py-1.5 align-middle text-xs font-medium text-neutral-700';

export const adminGridStickyCellClass = adminGridCellClass;

export const adminGridInputClass = cn(adminFieldClass, 'h-8 px-2 text-xs shadow-none');

export const adminGridButtonClass = cn(
  adminSecondaryButtonClass,
  'h-8 px-2 text-xs font-medium shadow-none hover:translate-y-0',
);

export function AdminMobileField({
  label,
  children,
  align = 'left',
}: {
  label: string;
  children: ReactNode;
  align?: 'left' | 'right';
}) {
  return (
    <div
      className={cn(
        'grid gap-1 rounded-md border border-neutral-200 bg-white px-3 py-2 shadow-sm shadow-neutral-950/[0.025]',
        align === 'right' && 'text-right',
      )}
    >
      <dt className="text-[11px] font-extrabold text-neutral-500">{label}</dt>
      <dd className="min-w-0 text-sm font-semibold text-neutral-900">{children}</dd>
    </div>
  );
}

export function AdminMobileCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <article
      className={cn(
        'rounded-lg border border-neutral-200 bg-white p-4 shadow-sm shadow-neutral-950/[0.03]',
        className,
      )}
    >
      {children}
    </article>
  );
}

export function AdminDataGrid<T>({
  columns,
  rows,
  rowKey,
  renderRow,
  renderMobileCard,
  emptyText,
  caption,
  density = 'normal',
  minWidthClassName = 'min-w-[920px]',
  className,
  scrollAreaClassName,
  mobileScrollAreaClassName,
  currentSortKey,
  currentSortDirection = 'desc',
  getSortHref,
  toolbarEnd,
}: AdminDataGridProps<T>) {
  const headerPadding = density === 'compact' ? 'px-2 py-1.5' : 'px-2 py-2';

  return (
    <div className={cn('overflow-hidden rounded-lg border border-neutral-200 bg-white', className)}>
      {caption ? <div className="sr-only">{caption}</div> : null}
      {toolbarEnd ? (
        <div className="flex items-center justify-end border-b border-neutral-200 bg-white px-2 py-1.5">
          {toolbarEnd}
        </div>
      ) : null}
      <div
        className={cn(
          renderMobileCard ? 'hidden md:block' : 'block',
          scrollAreaClassName ? 'overflow-auto' : 'overflow-x-auto',
          scrollAreaClassName,
        )}
      >
        <table className={cn('w-full border-separate border-spacing-0', minWidthClassName)}>
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <thead>
            <tr className="bg-white text-xs font-medium text-neutral-600">
              {columns.map((column) => {
                const nextDirection: AdminSortDirection =
                  currentSortKey === column.sortKey && currentSortDirection === 'asc'
                    ? 'desc'
                    : 'asc';
                const isSorted = currentSortKey === column.sortKey;
                const label = (
                  <span className="inline-flex items-center gap-1">
                    <span className="font-semibold">{column.label}</span>
                    {column.sortKey ? (
                      <span className="text-[10px] text-neutral-400">
                        {isSorted ? (currentSortDirection === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    ) : null}
                  </span>
                );

                return (
                  <th
                    key={column.key}
                    scope="col"
                    className={cn(
                      headerPadding,
                      alignClass[column.align ?? 'left'],
                      column.widthClassName,
                      'sticky top-0 z-[2] whitespace-nowrap border-b border-neutral-200 bg-white text-xs font-medium',
                    )}
                  >
                    {column.sortKey && getSortHref ? (
                      <Link
                        href={getSortHref(column.sortKey, nextDirection)}
                        className={cn(
                          'inline-flex min-h-6 items-center rounded px-1 text-xs font-medium underline-offset-2 hover:underline',
                          column.align === 'right' && 'justify-end',
                        )}
                      >
                        {label}
                      </Link>
                    ) : (
                      label
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="text-xs">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="h-24 px-4 text-center text-sm font-medium text-neutral-500"
                >
                  {emptyText}
                </td>
              </tr>
            ) : (
              rows.map((row, index) => renderRow(row, index))
            )}
          </tbody>
        </table>
      </div>
      {renderMobileCard ? (
        <div className={cn('grid gap-3 bg-white p-3 md:hidden', mobileScrollAreaClassName)}>
          {rows.length === 0 ? (
            <div className="rounded-lg border border-dashed border-neutral-200 bg-white px-4 py-10 text-center text-sm font-medium text-neutral-500">
              {emptyText}
            </div>
          ) : (
            rows.map((row, index) => (
              <div key={rowKey(row, index)}>{renderMobileCard(row, index)}</div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
