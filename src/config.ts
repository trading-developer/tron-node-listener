import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
    TRON_FULLNODE: z.string().url(),
    TRON_SOLIDITYNODE: z.string().url().optional(),
    USDT_CONTRACT: z.string().min(34),

    START_BLOCK: z.coerce.number().int().nonnegative(),
    CONFIRMATIONS: z.coerce.number().int().min(1).default(12),
    SCAN_STEP: z.coerce.number().int().min(1).max(1000).default(200),
    TICK_MS: z.coerce.number().int().min(1000).default(5000),

    DB_HOST: z.string(),
    DB_PORT: z.coerce.number().default(3306),
    DB_NAME: z.string(),
    DB_USER: z.string(),
    DB_PASS: z.string(),

    WEBHOOK_URL: z.string().url(),
    WEBHOOK_SIGNING_SECRET: z.string().optional(),
    WATCH_MAX_IDLE_HOURS: z.coerce.number().int().optional()
});

export const cfg = envSchema.parse(process.env);
