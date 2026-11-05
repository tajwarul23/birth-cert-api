import bcrypt from "bcrypt";
import crypto from "node:crypto";
import { env } from "../config/env";

//passwords
export const hashPassword = async(password: string) => await bcrypt.hash(password,10);
export const comparePassword = async(password: string, hash:string) => await bcrypt.compare(password, hash);

//NID and OTP hashed with HMAC
export const hmac = (value: string) => crypto.createHmac("sha256", env.HMAC_SECRET).update(value).digest("hex");

//REFRESH TOKEN hashed with sha-256
export const sha256 = (value: string) => crypto.createHash("sha256").update(value).digest("hex");


//comparing two hashes
export const safeEqual = (a:string, b:string) =>{
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);

    return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
};