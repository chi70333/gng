import { z } from 'zod';

const optionalMileageAmountSchema = z.preprocess(
  (value) => (value === '' || value == null ? undefined : value),
  z.coerce.number().int().min(0).max(999_999_999).optional(),
);

export const ADMIN_ORDER_MILEAGE_EXCEPTION_VALUE = 2_000_000;
export const ADMIN_ORDER_MILEAGE_EXCEPTION_QUERY = 'mileage-not-2000000';

export const adminOrderStatusSchema = z.enum([
  'pending',
  'paid',
  'preparing',
  'shipping',
  'delivered',
  'cancelled',
  'refunded',
]);

export const adminOrderListQuerySchema = z.object({
  card: z.enum(['0', '1', '2']).optional().default('0'),
  paym: z.enum(['0', 'card', 'hand', 'iche', 'cyber', 'bank', 'point']).optional().default('0'),
  status: z
    .union([adminOrderStatusSchema, z.enum(['-', '11'])])
    .optional()
    .default('-'),
  search: z
    .enum(['total', 't.name', 't.ceo_name', 't.tradecode', 't.userid', 't.rname', 'g.name'])
    .optional()
    .default('total'),
  searchstring: z.string().trim().max(100).optional().default(''),
  year: z.coerce.number().int().min(2018).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  day: z.coerce.number().int().min(1).max(31).optional(),
  year2: z.coerce.number().int().min(2018).max(2100).optional(),
  month2: z.coerce.number().int().min(1).max(12).optional(),
  day2: z.coerce.number().int().min(1).max(31).optional(),
  serhs: z.coerce.number().int().min(0).max(1).optional().default(1),
  fis: z.enum(['1', '2']).optional().default('2'),
  point_min: optionalMileageAmountSchema,
  point_max: optionalMileageAmountSchema,
  exception: z.enum([ADMIN_ORDER_MILEAGE_EXCEPTION_QUERY]).optional(),
  trade_list_cnt: z.coerce.number().int().min(20).max(1000).optional().default(30),
  page: z.coerce.number().int().min(1).max(1000).optional().default(1),
});

export const adminOrderStatusFormSchema = z.object({
  orderNo: z.string().trim().min(1).max(80),
  status: adminOrderStatusSchema,
  reason: z.string().trim().max(300).optional().or(z.literal('')),
});

export const adminShipmentFormSchema = z.object({
  orderNo: z.string().trim().min(1).max(80),
  carrier: z.string().trim().max(80).optional().or(z.literal('')),
  trackingNo: z.string().trim().max(120).optional().or(z.literal('')),
  status: z.enum(['ready', 'shipping', 'delivered']).default('ready'),
});
