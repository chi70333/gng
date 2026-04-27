import { z } from 'zod';

export const createProductQnaSchema = z.object({
  productId: z.string().regex(/^\d+$/),
  title: z.string().trim().min(2).max(120),
  content: z.string().trim().min(5).max(2000),
  isPrivate: z.coerce.boolean().default(false),
});

export type CreateProductQnaInput = z.infer<typeof createProductQnaSchema>;
