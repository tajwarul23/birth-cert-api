import { and, eq, or, sql, lt } from "drizzle-orm";
import { env, isProduction } from "../config/env";
import { db } from "../db";
import { nidRegistry, otps, refreshTokens, users } from "../db/schema";
import { comparePassword, hashPassword, hmac, safeEqual, sha256 } from "../utils/hash";
import {
  generateRefreshToken,
  refreshTokenExpiryDate,
  Role,
  signAccessToken,
} from "../utils/token";
import { LoginInput, RegisterInput } from "../validators/auth.validators";
import { AppError } from "../utils/AppError";
import { generateOtp, otpExpiryDate } from "../utils/otp";
import { sendSms } from "../utils/sms";

/**
 * @name otpMessage
 * @description Create the otp message (helper function)
 */
const otpMessage = (code: string) =>
  `Your birth certificate portal code is ${code}. It expires in ${env.OTP_EXPIRY_MINUTES} minutes`;

/**
 * @name createSession
 * @description Create access token and refresh token for logged in user
 * @access Logged in user only
 */
export const createSession = async (userId: string, role: Role) => {
  const accessToken = signAccessToken({ sub: userId, role });
  const refreshToken = generateRefreshToken();

  await db.insert(refreshTokens).values({
    userId,
    tokenHash: sha256(refreshToken),
    expiresAt: refreshTokenExpiryDate(),
  });

  return { accessToken, refreshToken };
};

/**
 * @name register
 * @description register new user to the system
 * @access citizen whose NID is in mock NID system
 */

export const register = async (input: RegisterInput) => {
  const { nid, dob, phone, password } = input;

  //first check the mock NID db
  const record = await db.query.nidRegistry.findFirst({
    where: eq(nidRegistry.nidNumber, nid),
  });

  if (!record || record.dob !== dob || record.phone !== phone)
    throw new AppError(400, "NID details don't match our records");

  //check if user already exists or not
  const nidHash = hmac(nid);
  const existingUser = await db.query.users.findFirst({
    where: or(eq(users.nidHash, nidHash), eq(users.phone, phone)),
  });
  if (existingUser)
    throw new AppError(409, "An account already exists for this NID or phone");

  const existingOtp = await db.query.otps.findFirst({
    where: eq(otps.nidHash, nidHash),
  });
  if (existingOtp) {
    const secs = (Date.now() - existingOtp.createdAt.getTime()) / 1000;
    if (secs < env.OTP_RESEND_COOLDOWN_SECONDS) {
      throw new AppError(
        429,
        `Please wait ${Math.ceil(env.OTP_RESEND_COOLDOWN_SECONDS - secs)} seconds before asking for a new code`,
      );
    }
  }

  //prepare hashes and upsert user's data
  const passwordHash = await hashPassword(password);
  const otp = generateOtp();
  const otpHash = hmac(otp);
  const expiresAt = otpExpiryDate();

  const [pending] = await db
    .insert(otps)
    .values({
      nidHash,
      name: record.name,
      phone: record.phone,
      passwordHash,
      codeHash: otpHash,
      expiresAt,
    })
    .onConflictDoUpdate({
      target: otps.nidHash,
      set: {
        name: record.name,
        phone: record.phone,
        passwordHash,
        codeHash: otpHash,
        expiresAt,
        attempts: 0,
        createdAt: new Date(),
      },
    })
    .returning({ id: otps.id });

  //send the otp
  await sendSms(record.phone, otpMessage(otp));

  //the controller will set the cookie for otp
  return { verificationId: pending.id, ...(isProduction ? {} : { otp }) };
};

/**
 * @name verifyOtp
 * @description verify the otp user inputs, against our saved and hashed otp and then log the user
 * @access only registered users
 */
export const verifyOtp = async (verificationId: string, otp: string) => {
  const pending = await db.query.otps.findFirst({
    where: eq(otps.id, verificationId),
  });

  if (!pending) {
    throw new AppError(400, "Registration not found, please register again");
  }

  if (pending.expiresAt < new Date()) {
    throw new AppError(400, "Code expired, please request a new code");
  }
  const [claimed] = await db
    .update(otps)
    .set({
      attempts: sql`${otps.attempts} + 1`,
    })
    .where(
      and(eq(otps.id, verificationId), lt(otps.attempts, env.OTP_MAX_ATTEMPTS)),
    )
    .returning({ attempts: otps.attempts });

  if (!claimed)
    throw new AppError(
      429,
      "Too many wrong attempts, please request a new code",
    );

  if (!safeEqual(hmac(otp), pending.codeHash)) {
    throw new AppError(
      400,
      `Wrong code, ${env.OTP_MAX_ATTEMPTS - claimed.attempts} attempts left`,
    );
  }
  //transactions => create the user from pending row, remove the pending registration, log in the user

  return db.transaction(async (tx) => {
    //1. pending reg is finished, remove it
    const deleted = await tx
      .delete(otps)
      .where(eq(otps.id, pending.id))
      .returning({ id: otps.id });
    if (!deleted.length)
      throw new AppError(400, "Registration already completed");

    //2. create the user from pending row
    const [user] = await tx
      .insert(users)
      .values({
        name: pending.name,
        phone: pending.phone,
        passwordHash: pending.passwordHash,
        nidHash: pending.nidHash,
        role: "citizen",
      })
      .returning({
        id: users.id,
        name: users.name,
        phone: users.phone,
        role: users.role,
      });

    //3. log the user in

    const accessToken = signAccessToken({ sub: user.id, role: user.role });
    const refreshToken = generateRefreshToken();
    await tx.insert(refreshTokens).values({
      userId: user.id,
      tokenHash: sha256(refreshToken),
      expiresAt: refreshTokenExpiryDate(),
    });
    return { user, accessToken, refreshToken };
  });
};

/**
 * @name resendOtp
 * @description generate new code after a cooldown
 * @access only registered users
 */
export const resendOtp = async (verificationId: string) => {
  const pending = await db.query.otps.findFirst({
    where: eq(otps.id, verificationId),
  });

  if (!pending) {
    throw new AppError(400, "Registration not found, please register again");
  }
  const secondSinceLastOtp = (Date.now() - pending.createdAt.getTime()) / 1000;
  if (secondSinceLastOtp < env.OTP_RESEND_COOLDOWN_SECONDS) {
    const wait = Math.ceil(
      env.OTP_RESEND_COOLDOWN_SECONDS - secondSinceLastOtp,
    );
    throw new AppError(
      429,
      `Please wait ${wait} seconds before asking for a new code`,
    );
  }

  const otp = generateOtp();
  await db
    .update(otps)
    .set({
      codeHash: hmac(otp),
      attempts: 0,
      createdAt: new Date(),
      expiresAt: otpExpiryDate(),
    })
    .where(eq(otps.id, pending.id));

  await sendSms(pending.phone, otpMessage(otp));
  return { ...(isProduction ? {} : { otp }) };
};

/**
 * @name login
 * @description Authenticates a registered user using their credentials and generates new access and refresh tokens.
 * @access only registered users
 */
export const login = async(input: LoginInput) =>{

    const {phone, password} = input;

    const user = await db.query.users.findFirst({
        where:eq(users.phone, phone),
    })
    if(!user){
        throw new AppError(401, "Wrong phone number or password");
    }
    const isMatched = await comparePassword(password, user.passwordHash);
    if(!isMatched){
        throw new AppError(401, "Wrong phone number or password");
    }
    const {accessToken, refreshToken} = await createSession(user.id, user.role);
    return {
        user:{id:user.id, role:user.role, phone:user.phone, name:user.name},
        accessToken,
        refreshToken
    }

}