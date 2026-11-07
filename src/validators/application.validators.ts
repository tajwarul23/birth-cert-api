import { z } from "zod";
import { nidSchema } from "./auth.validators";
import { checkAddress } from "../utils/geo";

// current date in Bangladesh (UTC+6) as YYYY-MM-DD
const today = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date());

const nameBn = z
  .string()
  .trim()
  .min(1, "Bangla name is required")
  .max(100)
  .regex(
    /^[\u0981-\u0983\u0985-\u09B9\u09BC-\u09CD\u09CE\u09D7\u09DC-\u09E3\u09F0-\u09F1\u200C\u200D .]+$/,
    "Bangla name must be written in Bangla letters",
  );
const nameEn = z
  .string()
  .trim()
  .min(1, "English name is required")
  .max(100)
  .regex(/^[A-Za-z .'-]+$/, "English name can only have letters, spaces, . ' -");

const childDob = z.iso
  .date({ error: "Date of birth must look like YYYY-MM-DD", abort: true })
  .refine((date) => date <= today(), "Date of birth can't be in the future");

const gender = z.enum(["male", "female", "other"]);

const addressLine = z.string().trim().min(1).max(300);

const addressSchema = z
  .object({
    division: z.string().trim().min(1, "Division is required"),
    district: z.string().trim().min(1, "District is required"),
    upazila: z.string().trim().min(1, "Upazila is required"),
    areaType: z.enum(["union", "city_corporation", "municipality"]),
    areaName: z.string().trim().min(1).max(100), 
    ward: z.coerce.number().int().min(1).max(99),
    postOffice: z.string().trim().min(1).max(100),
    postCode: z.string().regex(/^\d{4}$/, "Post code must be 4 digits"),
    addressLine,
  })
  
  .superRefine((address, ctx) => {
    const result = checkAddress(address.division, address.district, address.upazila);
    if (!result.ok) {
      ctx.addIssue({ code: "custom", path: [result.field], message: result.message });
    }
  });

const parentSchema = z.object({
    nameBn,
    nameEn,
    nid:nidSchema,
    nationality: z.enum(["Bangladeshi"], {error:"Only Bangladeshi nationality is supported for now"}).default("Bangladeshi")
});

//New application: Form data
export const newApplicationFormSchema = z.object({
  child: z.object({
    nameBn,
    nameEn,
    dateOfBirth: childDob,
    gender,
    birthOrder: z.coerce.number().int().min(1).max(20), // 1st child, 2nd child...
  }),
  birthPlace: z.object({
    type: z.enum(["hospital", "home", "other"]),
    details: z.string().trim().min(1).max(200), // hospital name + address, or home address
  }),
  father: parentSchema,
  mother: parentSchema,
  permanentAddress: addressSchema,
  presentAddress: addressSchema.optional(), // empty = same as permanent
}).refine((form) => form.father.nid !== form.mother.nid, {
  path: ["mother", "nid"],
  message: "Father and mother can't have the same NID",
});

//correction: each field validates newValue with the same rules as the new application form.
//oldValue is NOT taken from the client; the service reads the current value from the DB by brn.
const correctionItem = z.discriminatedUnion("field", [
  z.object({ field: z.literal("child.nameBn"), newValue: nameBn }),
  z.object({ field: z.literal("child.nameEn"), newValue: nameEn }),
  z.object({ field: z.literal("child.dateOfBirth"), newValue: childDob }),
  z.object({ field: z.literal("child.gender"), newValue: gender }),
  z.object({ field: z.literal("father.nameBn"), newValue: nameBn }),
  z.object({ field: z.literal("father.nameEn"), newValue: nameEn }),
  z.object({ field: z.literal("mother.nameBn"), newValue: nameBn }),
  z.object({ field: z.literal("mother.nameEn"), newValue: nameEn }),
  z.object({ field: z.literal("permanentAddress.addressLine"), newValue: addressLine }),
]);

export type CorrectionItem = z.infer<typeof correctionItem>;
export type CorrectableField = CorrectionItem["field"];
export const CORRECTABLE_FIELDS = correctionItem.options.map(
  (o) => o.shape.field.value,
) as CorrectableField[];

export const correctionFormSchema = z.object({
  brn: z.string().regex(/^\d{17}$/, "Birth Registration Number must be 17 digits"),
  reason: z.string().trim().min(10, "Explain the reason in at least 10 characters").max(500),
  items: z
    .array(correctionItem)
    .min(1, "At least one field to correct")
    .refine(
      (items) => new Set(items.map((i) => i.field)).size === items.length,
      "Each field can only be corrected once per request",
    ),
});

export type NewApplicationForm = z.infer<typeof newApplicationFormSchema>;
export type CorrectionForm = z.infer<typeof correctionFormSchema>;