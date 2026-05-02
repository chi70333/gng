'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { adminFieldClass, adminSecondaryButtonClass } from '@/components/admin/AdminUI';

type InitialOption = {
  name: string;
  values: unknown;
};

type InitialSku = {
  code: string;
  optionValues: unknown;
  priceDelta: { toString(): string } | string;
  stock: number;
  isActive: boolean;
};

type OptionRow = {
  name: string;
  valueText: string;
};

type SkuDraft = {
  code: string;
  priceDelta: string;
  stock: string;
  isActive: boolean;
};

type GeneratedSku = SkuDraft & {
  key: string;
  label: string;
  optionValues: Record<string, string>;
};

const EMPTY_OPTION: OptionRow = { name: '', valueText: '' };
const MAX_OPTIONS = 3;
const MAX_SKUS = 120;

function stringValues(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim() !== '')
    : [];
}

function optionValuesRecord(value: unknown): Record<string, string> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const entries = Object.entries(value).filter(
    (entry): entry is [string, string] =>
      typeof entry[0] === 'string' && typeof entry[1] === 'string',
  );
  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

function splitValues(valueText: string): string[] {
  return [
    ...new Set(
      valueText
        .split(/[\n,]/)
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ];
}

function comboKey(optionValues: Record<string, string>): string {
  return Object.keys(optionValues)
    .sort()
    .map((key) => `${key}:${optionValues[key]}`)
    .join('|');
}

function cartesianOptions(options: { name: string; values: string[] }[]): Record<string, string>[] {
  return options.reduce<Record<string, string>[]>(
    (acc, option) =>
      acc.flatMap((current) =>
        option.values.map((value) => ({ ...current, [option.name]: value })),
      ),
    [{}],
  );
}

function initialOptionRows(initialOptions: InitialOption[]): OptionRow[] {
  if (initialOptions.length === 0) return [{ ...EMPTY_OPTION }];
  return initialOptions.map((option) => ({
    name: option.name,
    valueText: stringValues(option.values).join(', '),
  }));
}

function initialSkuMap(initialSkus: InitialSku[]): Map<string, SkuDraft> {
  const map = new Map<string, SkuDraft>();
  for (const sku of initialSkus) {
    const optionValues = optionValuesRecord(sku.optionValues);
    if (!optionValues) continue;
    map.set(comboKey(optionValues), {
      code: sku.code,
      priceDelta: sku.priceDelta.toString(),
      stock: String(sku.stock),
      isActive: sku.isActive,
    });
  }
  return map;
}

export function ProductOptionFields({
  initialOptions,
  initialSkus,
}: {
  initialOptions: InitialOption[];
  initialSkus: InitialSku[];
}) {
  const [options, setOptions] = useState<OptionRow[]>(() => initialOptionRows(initialOptions));
  const [skuDrafts, setSkuDrafts] = useState<Map<string, SkuDraft>>(() =>
    initialSkuMap(initialSkus),
  );

  const generatedSkus = useMemo<GeneratedSku[]>(() => {
    const normalizedOptions = options
      .map((option) => ({
        name: option.name.trim(),
        values: splitValues(option.valueText),
      }))
      .filter((option) => option.name !== '' && option.values.length > 0);

    if (normalizedOptions.length === 0) return [];

    return cartesianOptions(normalizedOptions)
      .slice(0, MAX_SKUS)
      .map((optionValues) => {
        const key = comboKey(optionValues);
        const draft = skuDrafts.get(key);
        return {
          key,
          label: Object.entries(optionValues)
            .map(([name, value]) => `${name}: ${value}`)
            .join(' / '),
          optionValues,
          code: draft?.code ?? '',
          priceDelta: draft?.priceDelta ?? '0',
          stock: draft?.stock ?? '0',
          isActive: draft?.isActive ?? true,
        };
      });
  }, [options, skuDrafts]);

  function updateOption(index: number, next: Partial<OptionRow>) {
    setOptions((current) =>
      current.map((option, optionIndex) =>
        optionIndex === index ? { ...option, ...next } : option,
      ),
    );
  }

  function removeOption(index: number) {
    setOptions((current) => {
      const next = current.filter((_, optionIndex) => optionIndex !== index);
      return next.length > 0 ? next : [{ ...EMPTY_OPTION }];
    });
  }

  function updateSku(key: string, next: Partial<SkuDraft>) {
    setSkuDrafts((current) => {
      const draft = current.get(key) ?? {
        code: '',
        priceDelta: '0',
        stock: '0',
        isActive: true,
      };
      const nextMap = new Map(current);
      nextMap.set(key, { ...draft, ...next });
      return nextMap;
    });
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {options.map((option, index) => (
          <div
            key={index}
            className="grid gap-2 rounded-md border border-neutral-200 bg-white p-3 md:grid-cols-[160px_1fr_auto]"
          >
            <label className="block">
              <span className="text-xs font-bold text-neutral-700">옵션명</span>
              <input
                name="optionNames"
                value={option.name}
                onChange={(event) => updateOption(index, { name: event.target.value })}
                placeholder="예: 색상"
                className={`mt-1 ${adminFieldClass} h-11 md:h-10`}
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold text-neutral-700">옵션값</span>
              <input
                name="optionValueTexts"
                value={option.valueText}
                onChange={(event) => updateOption(index, { valueText: event.target.value })}
                placeholder="예: 블랙, 화이트 또는 줄바꿈 입력"
                className={`mt-1 ${adminFieldClass} h-11 md:h-10`}
              />
            </label>
            <button
              type="button"
              onClick={() => removeOption(index)}
              aria-label="옵션 삭제"
              className={`${adminSecondaryButtonClass} h-11 self-end px-3 text-neutral-600 md:h-10`}
            >
              <Trash2 size={18} />
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() =>
          setOptions((current) =>
            current.length >= MAX_OPTIONS ? current : [...current, { ...EMPTY_OPTION }],
          )
        }
        disabled={options.length >= MAX_OPTIONS}
        className={`${adminSecondaryButtonClass} h-11 md:h-10`}
      >
        <Plus size={18} />
        옵션 추가
      </button>

      {generatedSkus.length > 0 ? (
        <div className="overflow-x-auto rounded-md border border-neutral-200 bg-white">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead className="bg-neutral-50 text-neutral-600">
              <tr>
                <th className="px-3 py-2 font-extrabold">옵션 조합</th>
                <th className="w-44 px-3 py-2 font-extrabold">SKU 코드</th>
                <th className="w-32 px-3 py-2 font-extrabold">추가 금액</th>
                <th className="w-28 px-3 py-2 font-extrabold">재고</th>
                <th className="w-24 px-3 py-2 font-extrabold">판매</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {generatedSkus.map((sku, index) => (
                <tr key={sku.key}>
                  <td className="px-3 py-2 font-semibold text-neutral-800">
                    <input
                      type="hidden"
                      name="skuOptionValues"
                      value={JSON.stringify(sku.optionValues)}
                    />
                    <span>{sku.label}</span>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      name="skuCodes"
                      value={sku.code}
                      onChange={(event) => updateSku(sku.key, { code: event.target.value })}
                      placeholder={`자동 생성 ${index + 1}`}
                      className={`${adminFieldClass} h-10`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      name="skuPriceDeltas"
                      value={sku.priceDelta}
                      onChange={(event) => updateSku(sku.key, { priceDelta: event.target.value })}
                      inputMode="decimal"
                      className={`${adminFieldClass} h-10`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      name="skuStocks"
                      value={sku.stock}
                      onChange={(event) => updateSku(sku.key, { stock: event.target.value })}
                      inputMode="numeric"
                      className={`${adminFieldClass} h-10`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input type="hidden" name="skuIsActives" value={sku.isActive ? '1' : '0'} />
                    <label className="inline-flex min-h-10 items-center gap-2 font-bold text-neutral-700">
                      <input
                        type="checkbox"
                        checked={sku.isActive}
                        onChange={(event) => updateSku(sku.key, { isActive: event.target.checked })}
                        className="h-4 w-4 accent-neutral-900"
                      />
                      판매
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-md border border-dashed border-neutral-300 bg-neutral-50 px-3 py-3 text-sm font-semibold text-neutral-500">
          옵션을 사용하지 않으면 기본 상품으로 판매됩니다.
        </p>
      )}
    </div>
  );
}
