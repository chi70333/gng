import { z } from 'zod';

export const adminProductImageUploadSchema = z.object({
  fileName: z.string().trim().min(1).max(180),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']),
  size: z.coerce.number().int().min(1).max(10 * 1024 * 1024),
});

export type AdminProductImageUploadInput = z.infer<typeof adminProductImageUploadSchema>;
