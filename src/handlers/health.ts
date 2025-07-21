import type { Bindings } from "@/types/bindings";
import type { Context } from "hono";

export const healthHandler = (c: Context<{ Bindings: Bindings }>) => {
	return c.json({ success: true }, 200);
};
