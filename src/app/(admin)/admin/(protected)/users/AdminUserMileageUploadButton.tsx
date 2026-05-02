'use client';

import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import { useFormStatus } from 'react-dom';
import { Download, Upload, X } from 'lucide-react';
import {
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
} from '@/components/admin/AdminUI';

const ACCEPTED_MILEAGE_FILES =
  '.xlsx,.xls,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv';

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  redirectTo: string;
};

function SubmitButton({ hasFile }: { hasFile: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={!hasFile || pending}
      className={`${adminPrimaryButtonClass} h-11 w-full sm:w-auto`}
    >
      <Upload size={18} />
      {pending ? '업로드 중' : '업로드'}
    </button>
  );
}

export function AdminUserMileageUploadButton({ action, redirectTo }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState('');

  const closeModal = useCallback(() => {
    setIsOpen(false);
    setIsDragging(false);
    setFileName('');
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') closeModal();
    }

    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [closeModal, isOpen]);

  function openFilePicker() {
    inputRef.current?.click();
  }

  function setSelectedFiles(files: FileList | null) {
    const file = files?.[0];
    setFileName(file?.name ?? '');

    if (inputRef.current && files) {
      inputRef.current.files = files;
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    setSelectedFiles(event.dataTransfer.files);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`${adminSecondaryButtonClass} h-11`}
      >
        <Upload size={18} />
        마일리지 엑셀 업로드
      </button>

      {isOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mileage-upload-title"
        >
          <div className="max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-5 text-left shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="mileage-upload-title" className="text-base font-extrabold text-neutral-950">
                  마일리지 엑셀 업로드
                </h2>
                <p className="mt-1 text-sm text-neutral-500">.xlsx, .xls, .csv 파일을 지원합니다.</p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100"
                aria-label="마일리지 엑셀 업로드 팝업 닫기"
              >
                <X size={18} />
              </button>
            </div>

            <form action={action} className="mt-4 grid gap-4">
              <input type="hidden" name="redirectTo" value={redirectTo} />
              <input
                ref={inputRef}
                type="file"
                name="mileageFile"
                accept={ACCEPTED_MILEAGE_FILES}
                required
                className="sr-only"
                onChange={(event) => setSelectedFiles(event.currentTarget.files)}
              />

              <div
                onDragEnter={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={() => setIsDragging(false)}
                onDrop={onDrop}
                className={`grid min-h-40 cursor-pointer place-items-center rounded-lg border-2 border-dashed p-5 text-center transition ${
                  isDragging
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-neutral-300 bg-neutral-50 hover:border-neutral-400 hover:bg-white'
                }`}
                role="button"
                tabIndex={0}
                onClick={openFilePicker}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openFilePicker();
                  }
                }}
              >
                <div className="grid gap-2">
                  <Upload className="mx-auto text-neutral-400" size={28} />
                  <p className="text-sm font-extrabold text-neutral-900">
                    파일을 끌어오거나 클릭해서 선택
                  </p>
                  <p className="text-xs font-semibold text-neutral-500">
                    ID, 마일리지, 처리방식, 사유를 입력한 파일
                  </p>
                  {fileName ? (
                    <p className="mt-2 break-all rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs font-bold text-neutral-700">
                      {fileName}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <a
                  href="/api/admin/users/mileage-template"
                  className={`${adminSecondaryButtonClass} h-11 w-full sm:w-auto`}
                >
                  <Download size={18} />
                  양식 다운로드
                </a>
                <SubmitButton hasFile={Boolean(fileName)} />
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
