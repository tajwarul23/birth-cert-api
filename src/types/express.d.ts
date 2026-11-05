import { Role } from "../utils/token";


declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: Role };
    }
  }
}
 
export {};
 