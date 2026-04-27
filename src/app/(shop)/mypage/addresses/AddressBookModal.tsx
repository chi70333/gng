'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';

type Address = {
  id: string;
  label: string | null;
  receiver: string;
  phone: string;
  zipCode: string;
  address1: string;
  address2: string | null;
  isDefault: boolean;
};

type AddressForm = {
  label: string;
  receiver: string;
  phone: string;
  zipCode: string;
  address1: string;
  address2: string;
  isDefault: boolean;
};

type AddressApiSuccess = { ok: true; data: Address } | { ok: true; data: { id: string } };
type AddressApiResponse =
  | { ok: true; data: Address }
  | { ok: true; data: { id: string } }
  | { ok: false; error?: { message?: string } };

const emptyForm: AddressForm = {
  label: '',
  receiver: '',
  phone: '',
  zipCode: '',
  address1: '',
  address2: '',
  isDefault: false,
};

function toForm(address: Address): AddressForm {
  return {
    label: address.label ?? '',
    receiver: address.receiver,
    phone: address.phone,
    zipCode: address.zipCode,
    address1: address.address1,
    address2: address.address2 ?? '',
    isDefault: address.isDefault,
  };
}

function isAddress(data: AddressApiSuccess['data']): data is Address {
  return 'receiver' in data;
}

async function readAddressResponse(response: Response): Promise<AddressApiSuccess> {
  const payload = (await response.json()) as AddressApiResponse;
  if (!response.ok || !payload.ok) {
    const message = payload.ok ? undefined : payload.error?.message;
    throw new Error(message || '배송지 처리 중 문제가 발생했습니다.');
  }
  return payload;
}

export function AddressBookModal({
  initialAddresses,
  initiallyOpen = false,
}: {
  initialAddresses: Address[];
  initiallyOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(initiallyOpen);
  const [addresses, setAddresses] = useState(initialAddresses);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AddressForm>(emptyForm);
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const editingAddress = useMemo(
    () => addresses.find((address) => address.id === editingId) ?? null,
    [addresses, editingId],
  );
  const formTitle = editingAddress ? '배송지 수정' : '새 배송지 등록';

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    window.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setMessage(null);
  };

  const updateField = (field: keyof AddressForm, value: string | boolean) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const editAddress = (address: Address) => {
    setEditingId(address.id);
    setForm(toForm(address));
    setMessage(null);
  };

  const submitAddress = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch(
        editingId
          ? `/api/mypage/addresses?id=${encodeURIComponent(editingId)}`
          : '/api/mypage/addresses',
        {
          method: editingId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        },
      );
      const payload = await readAddressResponse(response);
      if (isAddress(payload.data)) {
        const savedAddress = payload.data;
        setAddresses((current) => {
          const normalized = savedAddress.isDefault
            ? current.map((address) => ({ ...address, isDefault: false }))
            : current;
          const withoutUpdated = normalized.filter((address) => address.id !== savedAddress.id);
          const next = [savedAddress, ...withoutUpdated];
          return next.sort((a, b) => Number(b.isDefault) - Number(a.isDefault)).slice(0, 10);
        });
      }
      resetForm();
      setMessage(editingId ? '배송지를 수정했습니다.' : '배송지를 등록했습니다.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '배송지 처리 중 문제가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteAddress = async (address: Address) => {
    if (!window.confirm('선택한 배송지를 삭제할까요?')) return;
    setDeletingId(address.id);
    setMessage(null);

    try {
      const response = await fetch(`/api/mypage/addresses?id=${encodeURIComponent(address.id)}`, {
        method: 'DELETE',
      });
      await readAddressResponse(response);
      setAddresses((current) => current.filter((item) => item.id !== address.id));
      if (editingId === address.id) resetForm();
      setMessage('배송지를 삭제했습니다.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '배송지 삭제 중 문제가 발생했습니다.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <section className="mt-5 rounded-lg bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-neutral-900">등록된 배송지</h2>
            <p className="mt-1 text-sm text-neutral-500">{addresses.length}개 등록됨</p>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-neutral-900 px-4 text-sm font-semibold text-white"
          >
            <Plus aria-hidden="true" size={18} />
            관리
          </button>
        </div>
      </section>

      {isOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/45 px-0 sm:items-center sm:px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="address-book-title"
        >
          <div className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-lg bg-white shadow-xl sm:mx-auto sm:max-w-2xl sm:rounded-lg">
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-neutral-200 px-4">
              <div>
                <h2 id="address-book-title" className="text-base font-bold text-neutral-900">
                  배송지 관리
                </h2>
                <p className="text-xs text-neutral-500">최근 배송지는 최대 10개까지 보관됩니다.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100"
                aria-label="배송지 관리 팝업 닫기"
              >
                <X aria-hidden="true" size={20} />
              </button>
            </div>

            <div className="grid min-h-0 flex-1 gap-0 overflow-y-auto md:grid-cols-[1fr_280px]">
              <section className="border-b border-neutral-200 p-4 md:border-b-0 md:border-r">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-bold text-neutral-900">등록된 배송지</h3>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-neutral-200 px-3 text-sm font-semibold text-neutral-700"
                  >
                    <Plus aria-hidden="true" size={16} />새 배송지
                  </button>
                </div>

                {addresses.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-neutral-200 px-4 py-10 text-center text-sm text-neutral-400">
                    등록된 배송지가 없습니다.
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {addresses.map((address) => (
                      <li key={address.id} className="rounded-lg border border-neutral-200 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 text-sm">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold text-neutral-900">
                                {address.label || address.receiver}
                              </p>
                              {address.isDefault ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-neutral-900 px-2 py-1 text-xs text-white">
                                  <Check aria-hidden="true" size={12} />
                                  기본
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-2 text-neutral-700">
                              {address.receiver} / {address.phone}
                            </p>
                            <p className="mt-1 break-words text-neutral-500">
                              [{address.zipCode}] {address.address1} {address.address2 ?? ''}
                            </p>
                          </div>
                          <div className="flex shrink-0 gap-1">
                            <button
                              type="button"
                              onClick={() => editAddress(address)}
                              className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-neutral-200 text-neutral-700"
                              aria-label={`${address.label || address.receiver} 배송지 수정`}
                            >
                              <Pencil aria-hidden="true" size={17} />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteAddress(address)}
                              disabled={deletingId === address.id}
                              className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-neutral-200 text-neutral-700 disabled:opacity-50"
                              aria-label={`${address.label || address.receiver} 배송지 삭제`}
                            >
                              <Trash2 aria-hidden="true" size={17} />
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="p-4">
                <h3 className="text-sm font-bold text-neutral-900">{formTitle}</h3>
                <form onSubmit={submitAddress} className="mt-3 grid gap-3">
                  <label className="grid gap-1 text-sm font-medium text-neutral-700">
                    배송지명
                    <input
                      value={form.label}
                      onChange={(event) => updateField('label', event.target.value.slice(0, 40))}
                      className="min-h-11 rounded-lg border border-neutral-300 px-3 text-input font-normal text-neutral-900 outline-none focus:ring-2 focus:ring-neutral-300"
                    />
                  </label>
                  <label className="grid gap-1 text-sm font-medium text-neutral-700">
                    받는 분
                    <input
                      value={form.receiver}
                      onChange={(event) => updateField('receiver', event.target.value.slice(0, 50))}
                      required
                      minLength={2}
                      className="min-h-11 rounded-lg border border-neutral-300 px-3 text-input font-normal text-neutral-900 outline-none focus:ring-2 focus:ring-neutral-300"
                    />
                  </label>
                  <label className="grid gap-1 text-sm font-medium text-neutral-700">
                    연락처
                    <input
                      value={form.phone}
                      onChange={(event) => updateField('phone', event.target.value.slice(0, 20))}
                      type="tel"
                      required
                      minLength={9}
                      className="min-h-11 rounded-lg border border-neutral-300 px-3 text-input font-normal text-neutral-900 outline-none focus:ring-2 focus:ring-neutral-300"
                    />
                  </label>
                  <label className="grid gap-1 text-sm font-medium text-neutral-700">
                    우편번호
                    <input
                      value={form.zipCode}
                      onChange={(event) => updateField('zipCode', event.target.value.slice(0, 10))}
                      required
                      minLength={4}
                      className="min-h-11 rounded-lg border border-neutral-300 px-3 text-input font-normal text-neutral-900 outline-none focus:ring-2 focus:ring-neutral-300"
                    />
                  </label>
                  <label className="grid gap-1 text-sm font-medium text-neutral-700">
                    주소
                    <input
                      value={form.address1}
                      onChange={(event) =>
                        updateField('address1', event.target.value.slice(0, 200))
                      }
                      required
                      minLength={3}
                      className="min-h-11 rounded-lg border border-neutral-300 px-3 text-input font-normal text-neutral-900 outline-none focus:ring-2 focus:ring-neutral-300"
                    />
                  </label>
                  <label className="grid gap-1 text-sm font-medium text-neutral-700">
                    상세주소
                    <input
                      value={form.address2}
                      onChange={(event) =>
                        updateField('address2', event.target.value.slice(0, 200))
                      }
                      className="min-h-11 rounded-lg border border-neutral-300 px-3 text-input font-normal text-neutral-900 outline-none focus:ring-2 focus:ring-neutral-300"
                    />
                  </label>
                  <label className="flex min-h-11 items-center justify-between gap-3 text-sm font-medium text-neutral-700">
                    <span>기본 배송지로 설정</span>
                    <input
                      checked={form.isDefault}
                      onChange={(event) => updateField('isDefault', event.target.checked)}
                      type="checkbox"
                      className="h-5 w-5"
                    />
                  </label>
                  {message ? (
                    <p className="rounded-lg bg-neutral-100 px-3 py-2 text-sm text-neutral-700">
                      {message}
                    </p>
                  ) : null}
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="inline-flex min-h-11 items-center justify-center rounded-lg bg-neutral-900 px-4 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {isSaving ? '처리 중' : editingAddress ? '수정하기' : '등록하기'}
                  </button>
                </form>
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
