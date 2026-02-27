import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Environment variable validation schema
 * Requirement 15.6: Environment variable protection
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().default('3000'),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  GEMINI_API_KEY: z.string().optional(),
  ALLOWED_ORIGINS: z.string().default('*'),
  FIREBASE_CONFIG: z.string().optional(),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
});

export const validateEnv = () => {
  const result = envSchema.safeParse(process.env);
  
  if (!result.success) {
    console.error('❌ Invalid environment variables:', result.error.flatten().fieldErrors);
    if (process.env['NODE_ENV'] === 'production') {
      process.exit(1);
    }
    return null;
  }
  
  return result.data;
};

export const env = validateEnv() || ({} as z.infer<typeof envSchema>);
