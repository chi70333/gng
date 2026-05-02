import { z } from 'zod';

export const adminCategoryFormSchema = z.object({
  id: z.coerce.bigint().optional(),
  parentId: z.coerce.bigint().optional(),
  code: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(120),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(160)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug는 영문 소문자, 숫자, 하이픈만 사용할 수 있습니다.'),
  depth: z.coerce.number().int().min(0).max(5).default(0),
  sortOrder: z.coerce.number().int().min(0).max(999999).default(0),
  isActive: z.coerce.boolean().default(false),
  showOnDashboard: z.coerce.boolean().default(false),
});
