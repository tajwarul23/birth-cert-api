import { Pool } from "pg";
import { env } from "../config/env";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";
const pool = new Pool({connectionString:env.DATABASE_URL});

pool.on("error", (err)=>{
    console.error("Idle DB client error:",err.message)
})
export const db = drizzle(pool, {schema});