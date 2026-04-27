'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '@/server/auth';
import { prisma } from '@/server/db';
import { issueCouponToUser } from '@/server/services/coupon.service';

export async function issueCouponAction(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.email) redirect('/login?callbackUrl=/mypage/coupons');

  const couponId = formData.get('couponId');
  if (typeof couponId !== 'string' || !/^\d+$/.test(couponId)) {
    redirect('/mypage/coupons?error=invalid');
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!user) redirect('/login?callbackUrl=/mypage/coupons');

  try {
    await issueCouponToUser({ couponId: BigInt(couponId), userId: user.id });
    revalidatePath('/mypage/coupons');
    redirect('/mypage/coupons?issued=1');
  } catch {
    redirect('/mypage/coupons?error=issue');
  }
}
