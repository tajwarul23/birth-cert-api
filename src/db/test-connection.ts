import { sql } from "drizzle-orm";
import { db } from "./index";

const main = async () =>{
    try {
        const res = await db.execute(sql `select now()`);
        console.log("Connected!", res.rows[0]);
        process.exit(0);
    } catch (err) {
        if (err instanceof Error) {
      console.error("DB connection failed:", err.message, err.cause);
    } else {
      console.error("DB connection failed:", err);
    }
    process.exit(1);
    }
}

main()