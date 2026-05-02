'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  Banknote,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Search,
  Trash2,
  Truck,
  UserRound,
  WalletCards,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { FormattedNumberInput } from '@/components/ui/FormattedNumberInput';
import { formatKRW, formatNumber } from '@/lib/format';
import { createOrderAction } from './actions';

type PaymentAddress = {
  id: string;
  label: string | null;
  isDefault: boolean;
  receiver: string;
  phone: string;
  zipCode: string;
  address1: string;
  address2: string | null;
};

type PaymentCoupon = {
  id: string;
  label: string;
  discountType: 'percent' | 'amount';
  discountValue: number;
  minOrderAmount: number | null;
  maxDiscount: number | null;
};

type PaymentUser = {
  name: string | null;
  email: string | null;
  phone: string | null;
  defaultAddress: PaymentAddress | null;
  addresses: PaymentAddress[];
  pointBalance: number;
  coupons: PaymentCoupon[];
};

type PaymentCartItem = {
  skuId: string;
  name: string;
  thumbnail: string | null;
  optionSummary: string | null;
  unitPrice: string;
  quantity: number;
};

export type OrderPaymentFormProps = {
  orderUser: PaymentUser | null;
  sessionName: string | null;
  sessionEmail: string | null;
  cartItems: PaymentCartItem[];
  selectedSkuIds: string[];
  subtotal: number;
  shippingFee: number;
  hasUnavailableItem: boolean;
  bankInfo: {
    bankName: string;
    bankAccount: string;
    bankLogoText: string;
  };
  error?: string;
};

type DaumPostcodeData = {
  zonecode: string;
  roadAddress: string;
  jibunAddress: string;
  bname: string;
  buildingName: string;
  apartment: 'Y' | 'N';
  userSelectedType: 'R' | 'J';
};

type DaumPostcode = {
  embed: (element: HTMLElement) => void;
};

type DaumPostcodeConstructor = new (options: {
  oncomplete: (data: DaumPostcodeData) => void;
  onresize?: (size: { height: number }) => void;
  width?: string;
  height?: string;
}) => DaumPostcode;

type PostcodeWindow = Window & {
  kakao?: {
    Postcode: DaumPostcodeConstructor;
  };
  daum?: {
    Postcode: DaumPostcodeConstructor;
  };
};

const postcodeScriptId = 'daum-postcode-script';
const postcodeScriptSrc = 'https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
const fieldClass =
  'min-h-11 w-full min-w-0 rounded-md border border-neutral-300 bg-white px-3 text-sm text-neutral-900 outline-none transition focus:border-neutral-900 focus:ring-2 focus:ring-neutral-200 disabled:border-neutral-200 disabled:bg-neutral-50 disabled:text-neutral-400';
const selectClass = `${fieldClass} appearance-none pr-10`;
const labelClass = 'mb-1.5 block text-xs font-bold text-neutral-700';
const sectionClass = 'rounded-lg border border-neutral-200 bg-white p-4 shadow-sm sm:p-5';

function FormSection({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className={sectionClass}>
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-neutral-900 text-white">
          <Icon aria-hidden="true" size={18} />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-extrabold text-neutral-950">{title}</h2>
          {description && <p className="mt-1 text-sm leading-5 text-neutral-500">{description}</p>}
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function loadPostcodeScript(): Promise<void> {
  const postcodeWindow = window as PostcodeWindow;
  if (postcodeWindow.kakao?.Postcode || postcodeWindow.daum?.Postcode) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const existingScript = document.getElementById(postcodeScriptId) as HTMLScriptElement | null;
    const script = existingScript ?? document.createElement('script');

    script.id = postcodeScriptId;
    script.src = postcodeScriptSrc;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('POSTCODE_SCRIPT_LOAD_FAILED'));

    if (!existingScript) {
      document.head.appendChild(script);
    }
  });
}

function buildRoadAddress(data: DaumPostcodeData): string {
  if (data.userSelectedType !== 'R') return data.jibunAddress;

  const extras = [data.bname, data.buildingName && data.apartment === 'Y' ? data.buildingName : '']
    .filter(Boolean)
    .join(', ');

  return extras ? `${data.roadAddress} (${extras})` : data.roadAddress;
}

function toWon(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

function itemTotal(item: PaymentCartItem): number {
  return Number(item.unitPrice);
}

function checkoutShippingFee(subtotal: number): number {
  if (subtotal <= 0) return 0;
  return subtotal >= 50000 ? 0 : 3000;
}

function pointValue(value: string): number {
  if (!value) return 0;
  return toWon(Number(value.replace(/,/g, '')));
}

function calculateCouponDiscount(coupon: PaymentCoupon | undefined, subtotal: number): number {
  if (!coupon) return 0;
  if (coupon.minOrderAmount != null && subtotal < coupon.minOrderAmount) return 0;

  const raw =
    coupon.discountType === 'percent'
      ? Math.floor((subtotal * coupon.discountValue) / 100)
      : coupon.discountValue;
  const capped = coupon.maxDiscount != null ? Math.min(raw, coupon.maxDiscount) : raw;
  return Math.min(toWon(capped), subtotal);
}

function PaymentSubmitButton({
  finalTotal,
  payableBeforePoints,
  disabled,
}: {
  finalTotal: number;
  payableBeforePoints: number;
  disabled: boolean;
}) {
  const { pending } = useFormStatus();
  const showOriginalPrice = !pending && finalTotal === 0 && payableBeforePoints > 0;
  const purchaseLabel = finalTotal === 0 ? '0원 구매하기' : `${formatKRW(finalTotal)} 구매하기`;

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-neutral-900 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-500"
    >
      {showOriginalPrice && (
        <span className="shrink-0 text-xs font-semibold text-neutral-300 line-through">
          {formatKRW(payableBeforePoints)}
        </span>
      )}
      <span>{pending ? '처리 중' : purchaseLabel}</span>
    </button>
  );
}

async function deleteOrderItem(skuId: string): Promise<boolean> {
  const res = await fetch('/api/cart', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ skuId, quantity: 0 }),
  });
  return res.ok;
}

function SelectField({
  name,
  value,
  onChange,
  children,
}: {
  name: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="relative min-w-0">
      <select
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={selectClass}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        size={17}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500"
      />
    </div>
  );
}

function SummaryRows({
  subtotal,
  shippingFee,
  couponDiscount,
  appliedPoints,
  finalTotal,
  compact = false,
}: {
  subtotal: number;
  shippingFee: number;
  couponDiscount: number;
  appliedPoints: number;
  finalTotal: number;
  compact?: boolean;
}) {
  const totalBeforeDiscount = toWon(subtotal + shippingFee);
  const totalDiscount = toWon(couponDiscount + appliedPoints);
  const hasDiscount = totalDiscount > 0;

  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-neutral-500">상품 합계</span>
        <span className="font-bold text-neutral-900">{formatKRW(subtotal)}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-neutral-500">배송비</span>
        <span className="font-bold text-neutral-900">{formatKRW(shippingFee)}</span>
      </div>
      {couponDiscount > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-neutral-500">쿠폰 할인</span>
          <span className="font-bold text-blue-700">-{formatKRW(couponDiscount)}</span>
        </div>
      )}
      {appliedPoints > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-neutral-500">포인트 사용</span>
          <span className="font-bold text-blue-700">-{formatNumber(appliedPoints)} P</span>
        </div>
      )}
      {hasDiscount && (
        <div className="rounded-md bg-blue-50 px-3 py-2 text-blue-800">
          <div className="flex items-center justify-between">
            <span className="font-bold">총 할인</span>
            <span className="font-extrabold">-{formatKRW(totalDiscount)}</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-xs">
            <span>할인 전 금액</span>
            <span className="line-through">{formatKRW(totalBeforeDiscount)}</span>
          </div>
        </div>
      )}
      <div className="flex items-end justify-between border-t border-neutral-100 pt-4">
        <span className="font-bold text-neutral-900">최종 결제금액</span>
        <span
          className={
            compact
              ? 'text-2xl font-extrabold text-neutral-950'
              : 'text-xl font-extrabold text-neutral-950'
          }
        >
          {formatKRW(finalTotal)}
        </span>
      </div>
    </div>
  );
}

export function OrderPaymentForm({
  orderUser,
  sessionName,
  sessionEmail,
  cartItems,
  selectedSkuIds,
  hasUnavailableItem,
  bankInfo,
  error,
}: OrderPaymentFormProps) {
  const router = useRouter();
  const defaultAddress = orderUser?.defaultAddress ?? null;
  const [receiver, setReceiver] = useState(defaultAddress?.receiver ?? orderUser?.name ?? '');
  const [phone, setPhone] = useState(defaultAddress?.phone ?? orderUser?.phone ?? '');
  const [zipCode, setZipCode] = useState(defaultAddress?.zipCode ?? '');
  const [address1, setAddress1] = useState(defaultAddress?.address1 ?? '');
  const [address2, setAddress2] = useState(defaultAddress?.address2 ?? '');
  const [couponIssueId, setCouponIssueId] = useState('');
  const [pointsToUse, setPointsToUse] = useState('');
  const [postcodeOpen, setPostcodeOpen] = useState(false);
  const [postcodeError, setPostcodeError] = useState('');
  const [postcodeLayerHeight, setPostcodeLayerHeight] = useState(480);
  const [removedSkuIds, setRemovedSkuIds] = useState<Set<string>>(() => new Set());
  const [deletingSkuId, setDeletingSkuId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const detailAddressRef = useRef<HTMLInputElement>(null);
  const postcodeLayerRef = useRef<HTMLDivElement>(null);

  const visibleCartItems = useMemo(
    () => cartItems.filter((item) => !removedSkuIds.has(item.skuId)),
    [cartItems, removedSkuIds],
  );
  const visibleSkuIds = useMemo(() => {
    const visibleSkuIdSet = new Set(visibleCartItems.map((item) => item.skuId));
    return selectedSkuIds.filter((skuId) => visibleSkuIdSet.has(skuId));
  }, [selectedSkuIds, visibleCartItems]);
  const currentSubtotal = visibleCartItems.reduce((sum, item) => sum + itemTotal(item), 0);
  const currentShippingFee = checkoutShippingFee(currentSubtotal);
  const selectedCoupon = useMemo(
    () => orderUser?.coupons.find((coupon) => coupon.id === couponIssueId),
    [couponIssueId, orderUser?.coupons],
  );
  const couponDiscount = calculateCouponDiscount(selectedCoupon, currentSubtotal);
  const payableBeforePoints = toWon(currentSubtotal + currentShippingFee - couponDiscount);
  const maxUsablePoints = Math.min(orderUser?.pointBalance ?? 0, payableBeforePoints);
  const appliedPoints = Math.min(pointValue(pointsToUse), maxUsablePoints);
  const remainingPoints = Math.max(0, (orderUser?.pointBalance ?? 0) - appliedPoints);
  const finalTotal = toWon(payableBeforePoints - appliedPoints);
  const bankAccountLabel = [bankInfo.bankName, bankInfo.bankAccount].filter(Boolean).join(' ');

  useEffect(() => {
    if (pointValue(pointsToUse) > maxUsablePoints) {
      setPointsToUse(maxUsablePoints > 0 ? String(maxUsablePoints) : '');
    }
  }, [maxUsablePoints, pointsToUse]);

  useEffect(() => {
    if (!postcodeOpen) return;

    let ignore = false;

    const embedPostcode = async () => {
      setPostcodeError('');

      try {
        await loadPostcodeScript();
        if (ignore) return;

        const postcodeWindow = window as PostcodeWindow;
        const Postcode = postcodeWindow.kakao?.Postcode ?? postcodeWindow.daum?.Postcode;
        const layer = postcodeLayerRef.current;
        if (!Postcode || !layer) throw new Error('POSTCODE_API_UNAVAILABLE');

        layer.replaceChildren();

        new Postcode({
          width: '100%',
          height: '100%',
          onresize: (size) => setPostcodeLayerHeight(Math.max(size.height, 420)),
          oncomplete: (data) => {
            setZipCode(data.zonecode);
            setAddress1(buildRoadAddress(data));
            setPostcodeOpen(false);
            window.setTimeout(() => detailAddressRef.current?.focus(), 0);
          },
        }).embed(layer);
      } catch {
        setPostcodeOpen(false);
        setPostcodeError('주소 검색을 불러오지 못했습니다. 우편번호와 주소를 직접 입력해 주세요.');
      }
    };

    void embedPostcode();

    return () => {
      ignore = true;
    };
  }, [postcodeOpen]);

  const selectAddress = (address: PaymentAddress) => {
    setReceiver(address.receiver);
    setPhone(address.phone);
    setZipCode(address.zipCode);
    setAddress1(address.address1);
    setAddress2(address.address2 ?? '');
    window.setTimeout(() => detailAddressRef.current?.focus(), 0);
  };

  const updatePoint = (value: string) => {
    if (!value) {
      setPointsToUse('');
      return;
    }
    setPointsToUse(String(Math.min(pointValue(value), maxUsablePoints)));
  };

  const removeOrderItem = async (skuId: string) => {
    if (deletingSkuId) return;

    setDeletingSkuId(skuId);
    setDeleteError('');

    try {
      const ok = await deleteOrderItem(skuId);
      if (!ok) {
        setDeleteError('상품을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.');
        return;
      }

      setRemovedSkuIds((current) => {
        const next = new Set(current);
        next.add(skuId);
        return next;
      });
      router.refresh();
    } catch {
      setDeleteError('상품을 삭제하지 못했습니다. 네트워크 상태를 확인해 주세요.');
    } finally {
      setDeletingSkuId(null);
    }
  };

  return (
    <>
      <div className="bg-neutral-50">
        <div className="mx-auto grid max-w-6xl gap-4 px-4 py-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-6 lg:py-8">
          <section className="min-w-0">
            <div className="mb-4">
              <h1 className="mt-1 text-2xl font-extrabold text-neutral-950">주문서 작성</h1>
              <p className="mt-2 text-sm leading-6 text-neutral-600">
                배송 정보와 입금자 정보를 확인해 주세요. 주문 접수 후 관리자 입금 확인을 거쳐
                결제완료로 처리됩니다.
              </p>
            </div>
            {error && (
              <p className="mb-3 rounded-md border border-red-100 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                입력 정보를 확인해 주세요. 재고가 부족하거나 필수 정보가 누락되었을 수 있습니다.
              </p>
            )}
            {hasUnavailableItem && (
              <p className="mb-3 rounded-md border border-amber-100 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
                구매할 수 없는 상품이 있습니다. 장바구니에서 수량 또는 상품을 조정해 주세요.
              </p>
            )}

            <form action={createOrderAction} className="space-y-4">
              {visibleSkuIds.map((skuId) => (
                <input key={skuId} type="hidden" name="selectedSkuIds" value={skuId} />
              ))}
              <FormSection
                icon={UserRound}
                title="구매자 정보"
                description="주문 확인과 안내를 받을 연락처입니다."
              >
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="block">
                    <span className={labelClass}>이름</span>
                    <input
                      name="buyerName"
                      required
                      defaultValue={orderUser?.name ?? sessionName ?? ''}
                      className={fieldClass}
                    />
                  </label>
                  <label className="block">
                    <span className={labelClass}>연락처</span>
                    <input
                      name="buyerPhone"
                      type="tel"
                      required
                      defaultValue={orderUser?.phone ?? ''}
                      className={fieldClass}
                    />
                  </label>
                  <label className="block md:col-span-2">
                    <span className={labelClass}>이메일</span>
                    <input
                      name="buyerEmail"
                      type="email"
                      defaultValue={orderUser?.email ?? sessionEmail ?? ''}
                      className={fieldClass}
                    />
                  </label>
                </div>
              </FormSection>

              <FormSection
                icon={Truck}
                title="배송 정보"
                description="정확한 배송을 위해 받는 분과 주소를 확인해 주세요."
              >
                {orderUser && orderUser.addresses.length > 0 && (
                  <div className="mb-4 space-y-2">
                    <p className="text-xs font-bold text-neutral-700">저장된 배송지</p>
                    <div className="grid gap-2">
                      {orderUser.addresses.map((address) => (
                        <div
                          key={address.id}
                          className="rounded-md border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-bold text-neutral-950">
                                  {address.label || address.receiver}
                                </span>
                                {address.isDefault && (
                                  <span className="rounded-full bg-neutral-900 px-2 py-0.5 text-[11px] font-bold text-white">
                                    기본
                                  </span>
                                )}
                              </div>
                              <p className="mt-1 font-medium text-neutral-800">
                                {address.receiver} / {address.phone}
                              </p>
                              <p className="mt-1 leading-5 text-neutral-500">
                                [{address.zipCode}] {address.address1} {address.address2 ?? ''}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => selectAddress(address)}
                              className="min-h-11 shrink-0 rounded-md border border-neutral-300 bg-white px-3 text-xs font-bold text-neutral-900"
                            >
                              선택
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid gap-3 md:grid-cols-2">
                  <label className="block">
                    <span className={labelClass}>받는 분</span>
                    <input
                      name="receiver"
                      required
                      value={receiver}
                      onChange={(event) => setReceiver(event.target.value.slice(0, 50))}
                      className={fieldClass}
                    />
                  </label>
                  <label className="block">
                    <span className={labelClass}>연락처</span>
                    <input
                      name="phone"
                      type="tel"
                      required
                      value={phone}
                      onChange={(event) => setPhone(event.target.value.slice(0, 20))}
                      className={fieldClass}
                    />
                  </label>
                  <div className="block">
                    <span className={labelClass}>우편번호</span>
                    <div className="flex gap-2">
                      <input
                        name="zipCode"
                        required
                        value={zipCode}
                        onChange={(event) =>
                          setZipCode(event.target.value.replace(/[^0-9]/g, '').slice(0, 5))
                        }
                        inputMode="numeric"
                        autoComplete="postal-code"
                        className={fieldClass}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setPostcodeError('');
                          setPostcodeLayerHeight(480);
                          setPostcodeOpen(true);
                        }}
                        className="flex min-h-11 shrink-0 items-center justify-center gap-1 rounded-md border border-neutral-900 bg-white px-3 text-sm font-bold text-neutral-900"
                        aria-label="주소 검색"
                      >
                        <Search aria-hidden="true" size={16} />
                        검색
                      </button>
                    </div>
                    {postcodeError && (
                      <p className="mt-1 text-xs text-red-600" role="alert">
                        {postcodeError}
                      </p>
                    )}
                  </div>
                  <label className="block md:col-span-2">
                    <span className={labelClass}>주소</span>
                    <input
                      name="address1"
                      required
                      value={address1}
                      onChange={(event) => setAddress1(event.target.value.slice(0, 200))}
                      autoComplete="street-address"
                      className={fieldClass}
                    />
                  </label>
                  <label className="block md:col-span-2">
                    <span className={labelClass}>상세주소</span>
                    <input
                      ref={detailAddressRef}
                      name="address2"
                      value={address2}
                      onChange={(event) => setAddress2(event.target.value.slice(0, 200))}
                      autoComplete="address-line2"
                      className={fieldClass}
                    />
                  </label>
                </div>
                {orderUser && (
                  <label className="mt-4 flex min-h-11 items-center gap-2 rounded-md bg-neutral-50 px-3 text-sm text-neutral-700">
                    <input name="saveShippingAddress" type="checkbox" className="h-4 w-4" />
                    <span>이 배송지를 최근 배송지에 저장합니다.</span>
                  </label>
                )}
              </FormSection>

              {orderUser && (
                <FormSection
                  icon={WalletCards}
                  title="할인 적용"
                  description="쿠폰과 포인트는 결제 금액 한도 안에서 사용할 수 있습니다."
                >
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="block">
                      <span className={labelClass}>쿠폰</span>
                      <SelectField
                        name="couponIssueId"
                        value={couponIssueId}
                        onChange={setCouponIssueId}
                      >
                        <option value="">사용 안 함</option>
                        {orderUser.coupons.map((coupon) => (
                          <option key={coupon.id} value={coupon.id}>
                            {coupon.label}
                          </option>
                        ))}
                      </SelectField>
                    </label>
                    <div className="block">
                      <div className="mb-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs font-bold text-neutral-600">
                            사용 가능 포인트
                          </span>
                          <span className="text-base font-extrabold text-neutral-950">
                            {formatNumber(orderUser.pointBalance)} P
                          </span>
                        </div>
                        {appliedPoints > 0 && (
                          <div className="mt-1 flex items-center justify-between gap-3 text-xs">
                            <span className="text-neutral-500">사용 후 잔여</span>
                            <span className="font-bold text-emerald-700">
                              {formatNumber(remainingPoints)} P
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-[minmax(0,1fr)_88px] gap-2">
                        <FormattedNumberInput
                          name="pointsToUse"
                          min={0}
                          max={maxUsablePoints}
                          value={pointsToUse}
                          onValueChange={updatePoint}
                          className={fieldClass}
                          aria-label="사용할 포인트"
                        />
                        <button
                          type="button"
                          disabled={maxUsablePoints <= 0}
                          onClick={() => setPointsToUse(String(maxUsablePoints))}
                          className="min-h-11 shrink-0 rounded-md border border-neutral-900 bg-neutral-900 px-3 text-xs font-bold text-white transition-colors hover:bg-neutral-800 disabled:border-neutral-200 disabled:bg-neutral-100 disabled:text-neutral-300"
                        >
                          전액사용
                        </button>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-2 text-xs text-neutral-500">
                        <span>결제금액 한도 내에서 사용됩니다.</span>
                        {appliedPoints > 0 && (
                          <button
                            type="button"
                            onClick={() => setPointsToUse('')}
                            className="min-h-11 px-1 font-semibold text-neutral-700"
                          >
                            사용 취소
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </FormSection>
              )}

              <FormSection
                icon={Banknote}
                title="결제 정보"
                description="현재 결제수단은 무통장입금만 지원합니다."
              >
                <input type="hidden" name="paymentMethod" value="bank" />
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-white">
                      <CheckCircle2 aria-hidden="true" size={18} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-extrabold text-emerald-950">무통장입금</p>
                      <p className="mt-1 text-sm leading-5 text-emerald-800">
                        주문 접수 후 아래 계좌로 입금해 주세요. 입금 확인 뒤 배송 준비가 시작됩니다.
                      </p>
                      {bankAccountLabel && (
                        <div className="mt-3 rounded-md bg-white px-3 py-2">
                          <p className="text-xs font-bold text-neutral-500">입금 계좌</p>
                          <p className="mt-1 break-words text-base font-extrabold text-neutral-950">
                            {bankAccountLabel}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="block">
                    <span className={labelClass}>입금자명</span>
                    <input
                      name="depositorName"
                      defaultValue={orderUser?.name ?? sessionName ?? ''}
                      className={fieldClass}
                    />
                  </label>
                  <label className="block">
                    <span className={labelClass}>입금 예정일</span>
                    <div className="relative min-w-0">
                      <CalendarDays
                        aria-hidden="true"
                        size={17}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500"
                      />
                      <input
                        name="depositDueDate"
                        type="date"
                        className={`${fieldClass} pl-10 [color-scheme:light]`}
                      />
                    </div>
                  </label>
                </div>
              </FormSection>

              <section className={sectionClass}>
                <div className="mb-4">
                  <h2 className="text-base font-extrabold text-neutral-950">주문상세</h2>
                  <div className="mt-3 rounded-md border border-neutral-200 bg-neutral-50 p-3">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-sm font-bold text-neutral-900">결제 정보</span>
                      <span className="text-xs font-bold text-emerald-700">무통장입금</span>
                    </div>
                    <SummaryRows
                      subtotal={currentSubtotal}
                      shippingFee={currentShippingFee}
                      couponDiscount={couponDiscount}
                      appliedPoints={appliedPoints}
                      finalTotal={finalTotal}
                      compact
                    />
                  </div>
                </div>
                <label className="block">
                  <span className={labelClass}>배송 메모</span>
                  <textarea
                    name="memo"
                    rows={3}
                    className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-200"
                    placeholder="배송 전 연락, 부재 시 요청사항 등을 입력해 주세요."
                  />
                </label>
                <label className="mt-4 flex min-h-11 items-start gap-2 rounded-md bg-neutral-50 px-3 py-3 text-sm leading-5 text-neutral-700">
                  <input name="agree" type="checkbox" required className="h-4 w-4" />
                  <span>상품, 결제 금액, 배송 정보를 확인했으며 구매 진행에 동의합니다.</span>
                </label>
              </section>

              <PaymentSubmitButton
                finalTotal={finalTotal}
                payableBeforePoints={payableBeforePoints}
                disabled={
                  hasUnavailableItem || Boolean(deletingSkuId) || visibleCartItems.length === 0
                }
              />
            </form>
          </section>

          <aside className="order-first h-fit rounded-lg border border-neutral-200 bg-white p-4 shadow-sm lg:sticky lg:top-20 lg:order-none">
            <div className="mb-3 flex items-center gap-2">
              <ClipboardList aria-hidden="true" size={18} className="text-neutral-900" />
              <h2 className="text-base font-extrabold text-neutral-950">결제 요약</h2>
            </div>
            {deleteError && (
              <p className="mb-3 rounded-md border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                {deleteError}
              </p>
            )}
            <ul className="mb-4 space-y-3">
              {visibleCartItems.map((item) => (
                <li
                  key={item.skuId}
                  className="grid grid-cols-[56px_minmax(0,1fr)_auto] gap-3 text-sm"
                >
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-neutral-100">
                    {item.thumbnail && (
                      <Image
                        src={item.thumbnail}
                        alt={item.name}
                        fill
                        sizes="56px"
                        className="object-cover"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-bold leading-5 text-neutral-950">
                      {item.name}
                    </p>
                    {item.optionSummary && (
                      <p className="mt-0.5 line-clamp-1 text-xs text-neutral-500">
                        {item.optionSummary}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-neutral-500">1개 단위 구매</p>
                    <p className="mt-1 text-sm font-extrabold text-neutral-950">
                      {formatKRW(itemTotal(item))}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={Boolean(deletingSkuId)}
                    onClick={() => void removeOrderItem(item.skuId)}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-neutral-200 text-neutral-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:border-neutral-100 disabled:text-neutral-300"
                    aria-label={`${item.name} 삭제`}
                    title="삭제"
                  >
                    <Trash2 aria-hidden="true" size={17} />
                  </button>
                </li>
              ))}
            </ul>
            <div className="border-t border-neutral-100 pt-4">
              <SummaryRows
                subtotal={currentSubtotal}
                shippingFee={currentShippingFee}
                couponDiscount={couponDiscount}
                appliedPoints={appliedPoints}
                finalTotal={finalTotal}
              />
            </div>
          </aside>
        </div>
      </div>

      {postcodeOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/45 sm:items-center sm:px-4"
          role="dialog"
          aria-modal="true"
          aria-label="주소 검색"
        >
          <div className="w-full overflow-hidden rounded-t-lg bg-white shadow-xl sm:mx-auto sm:max-w-md sm:rounded-lg">
            <div className="flex h-12 items-center justify-between border-b border-neutral-200 px-4">
              <h2 className="text-base font-semibold text-neutral-900">주소 검색</h2>
              <button
                type="button"
                onClick={() => setPostcodeOpen(false)}
                className="flex h-11 w-11 items-center justify-center rounded-md text-neutral-700"
                aria-label="주소 검색 닫기"
              >
                <X aria-hidden="true" size={20} />
              </button>
            </div>
            <div
              ref={postcodeLayerRef}
              className="w-full"
              style={{ height: Math.min(postcodeLayerHeight, 560) }}
            />
          </div>
        </div>
      )}
    </>
  );
}
