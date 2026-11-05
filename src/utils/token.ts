import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../config/env";

export type Role = "citizen" | "operator";

export interface AccessTokenPayload{
    sub: string;
    role: Role;
};

export const signAccessToken = (payload: AccessTokenPayload) =>
    jwt.sign(payload, env.JWT_ACCESS_SECRET, {expiresIn:`${env.ACCESS_TOKEN_MINUTES}m`});


export const verifyAccessToken = (token: string) =>
    jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;


export const generateRefreshToken = ()=> crypto.randomBytes(32).toString("hex");

export const refreshTokenExpiryDate = () =>
  new Date(Date.now() + env.REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);