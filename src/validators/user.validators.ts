import { z } from "zod";
import { nidSchema } from "./auth.validators";
import { phoneSchema } from "./common";

export const searchCitizenSchema = z
  .object({
    nid: nidSchema.optional(),
    phone: phoneSchema.optional(),
  })
  .refine((query) => Boolean(query.nid) !== Boolean(query.phone), {
    message: "Search with either NID or phone number",
  });

export type searchCitizenQuery = z.infer<typeof searchCitizenSchema>;
