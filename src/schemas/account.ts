import { z } from 'zod';

export const accountRecoverSchema = z.object({
  loginId: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
});

export type AccountRecoverInput = z.infer<typeof accountRecoverSchema>;
