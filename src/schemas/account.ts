import { z } from 'zod';

export const accountRecoverSchema = z.object({
  email: z.string().trim().email().max(255),
});

export type AccountRecoverInput = z.infer<typeof accountRecoverSchema>;
