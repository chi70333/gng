'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '@/server/auth';
import { prisma } from '@/server/db';
import { cancelUserOrder } from '@/server/services/order.service';
import { AppError } from '@/lib/errors';

export async function cancelOrderAction(orderNo: string, formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.email) redirect('/login?callbackUrl=/mypage/orders');

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!user) redirect('/login?callbackUrl=/mypage/orders');

  const reason = String(formData.get('reason') ?? '').trim();
  try {
    await cancelUserOrder({ orderNo, userId: user.id, reason });
  } catch (err) {
    if (err instanceof AppError) {
      redirect(`/mypage/orders/${orderNo}?cancelError=${encodeURIComponent(err.code)}`);
    }
    throw err;
  }
  revalidatePath('/mypage/orders');
  revalidatePath(`/mypage/orders/${orderNo}`);
}
