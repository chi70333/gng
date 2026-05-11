'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/server/auth';
import type { CartIdentity } from '@/server/services/cart.service';
import { createOrderFromCart, createOrderFromDirectItem } from '@/server/services/order.service';
import { createOrderSchema } from '@/schemas/order';
import { formDataValue, formDataValues } from '@/lib/form-data';
import { legacyClientIpFromHeaders } from '@/lib/legacy-order-code';
import { logger } from '@/lib/logger';

const CART_COOKIE = 'gng_cart_id';

async function resolveCartIdentity(): Promise<CartIdentity | null> {
  const session = await auth();
  if (session?.user?.email) return { type: 'user', id: session.user.email };

  const guestId = cookies().get(CART_COOKIE)?.value;
  return guestId ? { type: 'guest', id: guestId } : null;
}

function parseDirectQuantity(value: FormDataEntryValue | null): number {
  const parsed = Number(typeof value === 'string' ? value : '1');
  if (!Number.isInteger(parsed)) return 1;
  return Math.min(Math.max(parsed, 1), 99);
}

function isSkuId(value: FormDataEntryValue | null): value is string {
  return typeof value === 'string' && /^[0-9]+$/.test(value);
}

function orderErrorUrl(
  error: 'failed' | 'validation',
  source: {
    directSkuId: string | null;
    directQuantity: number;
    selectedSkuIds: string[];
  },
): string {
  const params = new URLSearchParams({ error });
  if (source.directSkuId) {
    params.set('directSkuId', source.directSkuId);
    params.set('quantity', String(source.directQuantity));
  } else if (source.selectedSkuIds.length > 0) {
    params.set('items', source.selectedSkuIds.join(','));
  }
  return `/order?${params.toString()}`;
}

export async function createOrderAction(formData: FormData): Promise<void> {
  const identity = await resolveCartIdentity();
  const directSkuIdInput = formDataValue(formData, 'directSkuId');
  const directSkuId = isSkuId(directSkuIdInput) ? directSkuIdInput : null;
  const directQuantity = parseDirectQuantity(formDataValue(formData, 'directQuantity'));
  const selectedSkuIds = formDataValues(formData, 'selectedSkuIds').filter(
    (value): value is string => typeof value === 'string' && value !== '',
  );
  const errorSource = { directSkuId, directQuantity, selectedSkuIds };

  if (!identity && !directSkuId) redirect('/cart');
  if (formDataValue(formData, 'agree') !== 'on') redirect(orderErrorUrl('validation', errorSource));

  const parsed = createOrderSchema.safeParse({
    buyerName: formDataValue(formData, 'buyerName'),
    buyerEmail: formDataValue(formData, 'buyerEmail'),
    buyerPhone: formDataValue(formData, 'buyerPhone'),
    receiver: formDataValue(formData, 'receiver'),
    phone: formDataValue(formData, 'phone'),
    receiverEmail: formDataValue(formData, 'receiverEmail'),
    receiverPhone2: formDataValue(formData, 'receiverPhone2'),
    zipCode: formDataValue(formData, 'zipCode'),
    address1: formDataValue(formData, 'address1'),
    address2: formDataValue(formData, 'address2'),
    memo: formDataValue(formData, 'memo'),
    channel: formDataValue(formData, 'channel'),
    deliveryType: formDataValue(formData, 'deliveryType'),
    paymentMethod: formDataValue(formData, 'paymentMethod'),
    depositorName: formDataValue(formData, 'depositorName'),
    depositDueDate: formDataValue(formData, 'depositDueDate'),
    cashReceiptType: 'none',
    cashReceiptIdentity: '',
    taxInvoiceRequested: false,
    taxInvoiceCompanyName: '',
    taxInvoiceBusinessNumber: '',
    saveShippingAddress: formDataValue(formData, 'saveShippingAddress') === 'on',
    couponIssueId: formDataValue(formData, 'couponIssueId'),
    pointsToUse: formDataValue(formData, 'pointsToUse'),
    selectedSkuIds: !directSkuId && selectedSkuIds.length > 0 ? selectedSkuIds : undefined,
  });

  if (!parsed.success) redirect(orderErrorUrl('validation', errorSource));

  let orderDetailUrl: string;
  try {
    const orderIdentity =
      identity ?? ({ type: 'guest', id: 'direct-checkout' } satisfies CartIdentity);
    const clientIp = legacyClientIpFromHeaders(headers());
    const order = directSkuId
      ? await createOrderFromDirectItem({
          identity: orderIdentity,
          orderInput: parsed.data,
          skuId: directSkuId,
          quantity: directQuantity,
          clientIp,
        })
      : await createOrderFromCart(orderIdentity, parsed.data, { clientIp });
    const guestOrderParams = new URLSearchParams();
    if (orderIdentity.type === 'guest') {
      guestOrderParams.set('phone', parsed.data.buyerPhone ?? parsed.data.phone);
    }
    const queryString = guestOrderParams.toString();
    orderDetailUrl = `/mypage/orders/${encodeURIComponent(order.orderNo)}${
      queryString ? `?${queryString}` : ''
    }`;
  } catch (err) {
    logger.error(
      {
        err,
        checkoutSource: directSkuId ? 'direct' : 'cart',
        directSkuId,
        directQuantity,
        selectedSkuIds,
        hasIdentity: Boolean(identity),
        identityType: identity?.type ?? null,
        pointsToUse: parsed.data.pointsToUse,
        couponIssueId: parsed.data.couponIssueId?.toString() ?? null,
      },
      'checkout order creation failed',
    );
    redirect(orderErrorUrl('failed', errorSource));
  }

  redirect(orderDetailUrl);
}
