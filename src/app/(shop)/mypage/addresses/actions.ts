'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '@/server/auth';
import { prisma } from '@/server/db';
import { userAddressSchema } from '@/schemas/order';

async function getUserId(): Promise<bigint> {
  const session = await auth();
  if (!session?.user?.email) redirect('/login?callbackUrl=/mypage/addresses');

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!user) redirect('/login?callbackUrl=/mypage/addresses');
  return user.id;
}

export async function createAddressAction(formData: FormData): Promise<void> {
  const userId = await getUserId();
  const parsed = userAddressSchema.safeParse({
    label: formData.get('label'),
    receiver: formData.get('receiver'),
    phone: formData.get('phone'),
    zipCode: formData.get('zipCode'),
    address1: formData.get('address1'),
    address2: formData.get('address2'),
    isDefault: formData.get('isDefault') === 'on',
  });
  if (!parsed.success) redirect('/mypage/addresses?error=validation');

  await prisma.$transaction(async (tx) => {
    if (parsed.data.isDefault) {
      await tx.userAddress.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }
    const count = await tx.userAddress.count({ where: { userId } });
    if (count >= 10) {
      const oldest = await tx.userAddress.findFirst({
        where: { userId, isDefault: false },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      if (oldest) await tx.userAddress.delete({ where: { id: oldest.id } });
    }
    await tx.userAddress.create({
      data: {
        userId,
        label: parsed.data.label || null,
        receiver: parsed.data.receiver,
        phone: parsed.data.phone,
        zipCode: parsed.data.zipCode,
        address1: parsed.data.address1,
        address2: parsed.data.address2 || null,
        isDefault: parsed.data.isDefault,
      },
    });
  });

  revalidatePath('/mypage/addresses');
}

export async function deleteAddressAction(addressId: string): Promise<void> {
  const userId = await getUserId();
  const id = BigInt(addressId);
  const address = await prisma.userAddress.findUnique({
    where: { id },
    select: { userId: true },
  });
  if (!address || address.userId !== userId) redirect('/mypage/addresses?error=not_found');

  await prisma.userAddress.delete({ where: { id } });
  revalidatePath('/mypage/addresses');
}
