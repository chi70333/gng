'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/server/auth';
import type { CartIdentity } from '@/server/services/cart.service';
import { createOrderFromCart } from '@/server/services/order.service';
import { createOrderSchema } from '@/schemas/order';

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
  if (formData.get('agree') !== 'on') redirect('/order?error=validation');

  const parsed = createOrderSchema.safeParse({
    buyerName: formData.get('buyerName'),
    buyerEmail: formData.get('buyerEmail'),
    buyerPhone: formData.get('buyerPhone'),
    receiver: formData.get('receiver'),
    phone: formData.get('phone'),
    receiverEmail: formData.get('receiverEmail'),
    receiverPhone2: formData.get('receiverPhone2'),
    zipCode: formData.get('zipCode'),
    address1: formData.get('address1'),
    address2: formData.get('address2'),
    memo: formData.get('memo'),
    channel: formData.get('channel'),
    deliveryType: formData.get('deliveryType'),
    paymentMethod: formData.get('paymentMethod'),
    depositorName: formData.get('depositorName'),
    depositDueDate: formData.get('depositDueDate'),
    cashReceiptType: formData.get('cashReceiptType'),
    cashReceiptIdentity: formData.get('cashReceiptIdentity'),
    taxInvoiceRequested: formData.get('taxInvoiceRequested') === 'on',
    taxInvoiceCompanyName: formData.get('taxInvoiceCompanyName'),
    taxInvoiceBusinessNumber: formData.get('taxInvoiceBusinessNumber'),
    saveShippingAddress: formData.get('saveShippingAddress') === 'on',
    couponIssueId: formData.get('couponIssueId'),
    pointsToUse: formData.get('pointsToUse'),
  });

  if (!parsed.success) redirect('/order?error=validation');

  try {
    const order = await createOrderFromCart(identity, parsed.data);
    redirect(`/order/complete?orderNo=${encodeURIComponent(order.orderNo)}`);
  } catch {
    redirect('/order?error=failed');
  }
}
