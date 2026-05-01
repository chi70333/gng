'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/server/auth';
import type { CartIdentity } from '@/server/services/cart.service';
import { createOrderFromCart } from '@/server/services/order.service';
import { createOrderSchema } from '@/schemas/order';
import { formDataValue, formDataValues } from '@/lib/form-data';

const CART_COOKIE = 'gng_cart_id';

async function resolveCartIdentity(): Promise<CartIdentity | null> {
  const session = await auth();
  if (session?.user?.email) return { type: 'user', id: session.user.email };

  const guestId = cookies().get(CART_COOKIE)?.value;
  return guestId ? { type: 'guest', id: guestId } : null;
}

export async function createOrderAction(formData: FormData): Promise<void> {
  const identity = await resolveCartIdentity();
  if (!identity) redirect('/cart');
  if (formDataValue(formData, 'agree') !== 'on') redirect('/order?error=validation');
  const selectedSkuIds = formDataValues(formData, 'selectedSkuIds').filter(
    (value): value is string => typeof value === 'string' && value !== '',
  );

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
    cashReceiptType: formDataValue(formData, 'cashReceiptType'),
    cashReceiptIdentity: formDataValue(formData, 'cashReceiptIdentity') ?? '',
    taxInvoiceRequested: formDataValue(formData, 'taxInvoiceRequested') === 'on',
    taxInvoiceCompanyName: formDataValue(formData, 'taxInvoiceCompanyName') ?? '',
    taxInvoiceBusinessNumber: formDataValue(formData, 'taxInvoiceBusinessNumber') ?? '',
    saveShippingAddress: formDataValue(formData, 'saveShippingAddress') === 'on',
    couponIssueId: formDataValue(formData, 'couponIssueId'),
    pointsToUse: formDataValue(formData, 'pointsToUse'),
    selectedSkuIds: selectedSkuIds.length > 0 ? selectedSkuIds : undefined,
  });

  if (!parsed.success) redirect('/order?error=validation');

  let orderDetailUrl: string;
  try {
    const order = await createOrderFromCart(identity, parsed.data);
    const guestOrderParams = new URLSearchParams();
    if (identity.type === 'guest') {
      guestOrderParams.set('phone', parsed.data.buyerPhone ?? parsed.data.phone);
    }
    const queryString = guestOrderParams.toString();
    orderDetailUrl = `/mypage/orders/${encodeURIComponent(order.orderNo)}${
      queryString ? `?${queryString}` : ''
    }`;
  } catch {
    redirect('/order?error=failed');
  }

  redirect(orderDetailUrl);
}
