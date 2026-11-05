import "dotenv/config"
import z from "zod";
import bcrypt from "bcrypt"
import { mockNids } from "./mock_data";
import { passwordSchema, phoneSchema } from "../validators/common";
import { db } from "./index";
import { nidRegistry, users } from "./schema";

const seedEnv = z.object({
    SEED_OPERATOR_PHONE: phoneSchema,
    SEED_OPERATOR_PASSWORD: passwordSchema,
}).parse(process.env)

const {SEED_OPERATOR_PHONE, SEED_OPERATOR_PASSWORD} = seedEnv;

const main = async()=>{
    try {
        await db.insert(nidRegistry).values(mockNids).onConflictDoNothing();
        console.log(`NID Registry : ${mockNids.length} record ready`);
        
        const passwordHash = await bcrypt.hash(SEED_OPERATOR_PASSWORD, 10);
        await db.insert(users).values({
            name:"Union Office Operator",
            phone:SEED_OPERATOR_PHONE,
            passwordHash,
            role:"operator",
            phoneVerified:true
        }).onConflictDoNothing();
        console.log(`Operator ready : ${SEED_OPERATOR_PHONE}`);
        process.exit(0);
    } catch (error : any) {
        console.log("Seed failed",error.message);
        process.exit(1);
    }
}

main();