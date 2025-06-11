import type { Context } from 'hono';
import type { Bindings } from '@/types/bindings';

export const healthHandler = (c: Context<{ Bindings: Bindings }>) => {
  return c.json({ success: true }, 200);
};