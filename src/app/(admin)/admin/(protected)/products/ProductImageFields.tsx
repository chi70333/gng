'use client';

import { ImagePlus, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { adminFieldClass, adminSecondaryButtonClass } from '@/components/admin/AdminUI';

type InitialImageRow = {
  url: string;
  alt: string;
};

type ImageRow = InitialImageRow & {
  key: string;
  uploading: boolean;
  error: string;
};

type PresignResponse =
  | {
      ok: true;
      data: {
        key: string;
        uploadUrl: string;
        publicUrl: string;
        headers: Record<string, string>;
      };
    }
  | {
      ok: false;
      error: { message: string };
    };

const EMPTY_ROW: ImageRow = { url: '', key: '', alt: '', uploading: false, error: '' };
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

export function ProductImageFields({
  initialImages,
  initialMainIndex,
}: {
  initialImages: InitialImageRow[];
  initialMainIndex: number;
}) {
  const [rows, setRows] = useState<ImageRow[]>(
    initialImages.length > 0
      ? initialImages.map((image) => ({ ...EMPTY_ROW, ...image }))
      : [{ ...EMPTY_ROW }],
  );
  const [mainIndex, setMainIndex] = useState(initialMainIndex);

  function updateRow(index: number, nextRow: Partial<ImageRow>) {
    setRows((current) =>
      current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...nextRow } : row)),
    );
  }

  function removeRow(index: number) {
    setRows((current) => {
      const next = current.filter((_, rowIndex) => rowIndex !== index);
      return next.length > 0 ? next : [{ ...EMPTY_ROW }];
    });
    setMainIndex((current) => (current > index ? current - 1 : 0));
  }

  async function uploadImage(index: number, file: File | undefined) {
    if (!file) return;
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      updateRow(index, { error: 'jpg, png, webp, avif, gif 이미지만 업로드할 수 있습니다.' });
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      updateRow(index, { error: '이미지는 10MB 이하로 업로드해 주세요.' });
      return;
    }

    updateRow(index, { uploading: true, error: '' });
    try {
      const presignResponse = await fetch('/api/admin/product-images/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type,
          size: file.size,
        }),
      });
      const presign = (await presignResponse.json()) as PresignResponse;
      if (!presign.ok) throw new Error(presign.error.message);

      const uploadResponse = await fetch(presign.data.uploadUrl, {
        method: 'PUT',
        headers: presign.data.headers,
        body: file,
      });
      if (!uploadResponse.ok) throw new Error('CDN 업로드에 실패했습니다.');

      updateRow(index, {
        url: presign.data.publicUrl,
        key: presign.data.key,
        alt: rows[index]?.alt || file.name.replace(/\.[^.]+$/, ''),
        uploading: false,
        error: '',
      });
    } catch (error) {
      updateRow(index, {
        uploading: false,
        error: error instanceof Error ? error.message : '이미지 업로드에 실패했습니다.',
      });
    }
  }

  return (
    <div className="space-y-2.5">
      <input type="hidden" name="mainImageIndex" value={mainIndex.toString()} />
      {rows.map((row, index) => (
        <div
          key={index}
          className="grid gap-3 rounded-md border border-neutral-200 bg-white p-3 shadow-sm shadow-neutral-950/[0.04] md:grid-cols-[80px_1fr_auto]"
        >
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-md border border-neutral-100 bg-neutral-100">
            {row.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={row.url}
                alt={row.alt || '상품 이미지 미리보기'}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="px-2 text-center text-xs text-neutral-400">미리보기</span>
            )}
          </div>
          <div className="grid gap-2">
            <input type="hidden" name="imageKeys" value={row.key} />
            <input type="hidden" name="imageUrls" value={row.url} />
            <label className="block rounded-md border border-dashed border-neutral-300 bg-neutral-50 p-2">
              <span className={`${adminSecondaryButtonClass} flex h-11 cursor-pointer md:h-10`}>
                <ImagePlus size={18} />
                {row.uploading ? '업로드 중...' : '이미지 파일 선택'}
              </span>
              <input
                type="file"
                accept={ACCEPTED_IMAGE_TYPES.join(',')}
                disabled={row.uploading}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.currentTarget.value = '';
                  uploadImage(index, file);
                }}
                className="sr-only"
              />
            </label>
            {row.url ? <p className="truncate text-xs text-neutral-500">{row.url}</p> : null}
            {row.error ? <p className="text-xs font-semibold text-red-600">{row.error}</p> : null}
            <label className="block">
              <span className="text-xs font-bold text-neutral-700">이미지 설명</span>
              <input
                name="imageAlts"
                value={row.alt}
                onChange={(event) => updateRow(index, { alt: event.target.value })}
                placeholder="검색과 접근성을 위한 이미지 설명"
                className={`mt-1 ${adminFieldClass} h-11 md:h-10`}
              />
            </label>
          </div>
          <div className="flex items-center gap-2 md:flex-col md:items-end">
            <label className={`${adminSecondaryButtonClass} h-11 md:h-10`}>
              <input
                type="radio"
                checked={mainIndex === index}
                onChange={() => setMainIndex(index)}
              />
              대표
            </label>
            <button
              type="button"
              onClick={() => removeRow(index)}
              aria-label="이미지 삭제"
              className={`${adminSecondaryButtonClass} h-11 px-3 text-neutral-600 md:h-10`}
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => setRows((current) => [...current, { ...EMPTY_ROW }])}
        className={`${adminSecondaryButtonClass} h-11 md:h-10`}
      >
        <Plus size={18} />
        이미지 추가
      </button>
    </div>
  );
}
