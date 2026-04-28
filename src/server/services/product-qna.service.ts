// Legacy sources: goods_qna.php, goods_qna_write.php
// Cache: no-store for writes, product Q&A list can use ISR/RSC cache later.

import { prisma } from '@/server/db';
import { NotFoundError } from '@/lib/errors';
import type { CreateProductQnaInput } from '@/schemas/product-qna';

async function getUserIdByEmail(email: string | null): Promise<bigint | null> {
  if (!email) return null;

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  return user?.id ?? null;
}

export async function createProductQna(
  email: string | null,
  input: CreateProductQnaInput,
): Promise<{ id: string }> {
  const [userId, product] = await Promise.all([
    getUserIdByEmail(email),
    prisma.product.findFirst({
      where: { id: BigInt(input.productId), deletedAt: null },
      select: { id: true },
    }),
  ]);

  if (!product) throw new NotFoundError('상품을 찾을 수 없습니다.');

  const row = await prisma.productQna.create({
    data: {
      productId: product.id,
      userId,
      title: input.title,
      content: input.content,
      isPrivate: input.isPrivate,
    },
    select: { id: true },
  });

  return { id: row.id.toString() };
}
