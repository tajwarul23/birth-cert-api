import rateLimit from "express-rate-limit"

const makeLimiter = (limit: number, minutes: number) =>{
    return rateLimit({
        windowMs: minutes * 60 * 1000,
        limit,
        standardHeaders:"draft-7",
        legacyHeaders:false,
        message:{
            success:false,
            message:"Too many requests, please try again later",
            errors: null
        }
    })
}

export const apiLimiter = makeLimiter(100, 1);        
export const loginLimiter = makeLimiter(10, 15);
export const registerLimiter = makeLimiter(5, 60);
export const resendOtpLimiter = makeLimiter(3, 10);
export const verifyOtpLimiter = makeLimiter(10, 15);