import "dotenv/config"
import {z} from "zod"

const envSchema = z.object({
    PORT: z.coerce.number().default(5000),
    NODE_ENV: z.enum(["development", "production"]).default("development"),
    DATABASE_URL: z.string().url()
});

export const env = envSchema.parse(process.env)