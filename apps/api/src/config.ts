import { z } from 'zod'

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required').default('redis://localhost:6379'),
  PORT_API: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0'),
  PORT_GATEWAY: z.coerce.number().int().positive().default(3001),
  PORT_SIMULATOR: z.coerce.number().int().positive().default(3002),
  PORT_WEB: z.coerce.number().int().positive().default(5173),
  CORS_ORIGINS: z
    .string()
    .optional()
    .default('http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173'),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  REFRESH_TOKEN_SECRET: z
    .string()
    .min(1, 'REFRESH_TOKEN_SECRET is required')
    .default('super_secret_refresh_key_xatxoot_dev_only'),
  GOOGLE_CLIENT_ID: z.string().optional().default(''),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(''),
  GOOGLE_CALLBACK_URL: z
    .string()
    .optional()
    .default('http://localhost:3000/api/v1/auth/google/callback'),
  GOOGLE_ALLOWED_DOMAINS: z.string().optional().default(''),
  WHATSAPP_CLOUD_API_URL: z.string().optional().default('https://graph.facebook.com/v18.0'),
  WHATSAPP_CLOUD_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_CLOUD_WEBHOOK_VERIFY_TOKEN: z.string().optional().default('xatxoot_verify_token'),
  WHATSAPP_GRAPH_API_URL: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  META_APP_SECRET: z.string().optional(),
  META_WEBHOOK_VERIFY_TOKEN: z.string().optional(),
  MEDIA_DIR: z.string().optional(),
  WA_GATEWAY_DUMP_MESSAGES: z.string().optional().default('true'),
  WA_GATEWAY_DUMP_RETENTION_DAYS: z.coerce.number().optional().default(14),
  TEST_DATABASE_URL: z.string().optional(),
})

export type Config = z.infer<typeof envSchema>

export function validateConfig(rawEnv: Record<string, unknown> = process.env): Config {
  const result = envSchema.safeParse(rawEnv)

  if (!result.success) {
    const errorDetails = result.error.issues
      .map((issue) => ` - ${issue.path.join('.') || 'root'}: ${issue.message}`)
      .join('\n')

    const message = `[FATAL] Configuration validation error (Fail-Fast Startup):\n${errorDetails}`
    throw new Error(message)
  }

  return result.data
}

let cachedConfig: Config | null = null

export function getConfig(): Config {
  if (!cachedConfig) {
    cachedConfig = validateConfig(process.env)
  }
  return cachedConfig
}

export const config = new Proxy({} as Config, {
  get(_target, prop: string) {
    const active = getConfig()
    return active[prop as keyof Config]
  },
})
