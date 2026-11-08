// OpenAPI (Swagger) description of the whole API.
// swagger-ui-express turns this object into the page at /docs.

const errorResponse = (description: string) => ({
  description,
  content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
});

const ok = (description: string) => ({
  description,
  content: { "application/json": { schema: { $ref: "#/components/schemas/Success" } } },
});

const applicationIdParam = {
  name: "applicationId",
  in: "path",
  required: true,
  schema: { type: "string", format: "uuid" },
};

export const openapiSpec = {
  openapi: "3.0.3",
  info: {
    title: "One-Stop Government Services API: Birth Certificate",
    version: "1.0.0",
    description:
      "MVP for new birth certificate applications and corrections.\n\n" +
      "**How to try it:** call `POST /api/auth/login` first. The server sets HttpOnly cookies, " +
      "and your browser sends them automatically on the next requests.\n\n" +
      "Test operator: `+8801787573220` / `Operator@123`. OTP is mocked: register and resend-otp return it in `data.otp` (MVP demonstration only).",

  },
  servers: [{ url: "/" }],
  tags: [
    { name: "Auth", description: "Register with NID + OTP, login, refresh, logout" },
    { name: "Citizen", description: "Apply, correct, track my applications" },
    { name: "Operator", description: "List, review, approve/reject, search citizens" },
  ],
  components: {
    securitySchemes: {
      cookieAuth: { type: "apiKey", in: "cookie", name: "access_token" },
    },
    schemas: {
      Success: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          message: { type: "string" },
          data: { type: "object" },
        },
      },
      Error: {
        type: "object",
        properties: {
          success: { type: "boolean", example: false },
          message: { type: "string", example: "Validation failed" },
          errors: { nullable: true },
        },
      },
      Address: {
        type: "object",
        required: ["division", "district", "upazila", "areaType", "areaName", "ward", "postOffice", "postCode", "addressLine"],
        properties: {
          division: { type: "string", example: "Dhaka" },
          district: { type: "string", example: "Dhaka" },
          upazila: { type: "string", example: "Savar" },
          areaType: { type: "string", enum: ["union", "city_corporation", "municipality"] },
          areaName: { type: "string", example: "Ashulia" },
          ward: { type: "integer", minimum: 1, maximum: 99, example: 5 },
          postOffice: { type: "string", example: "Savar" },
          postCode: { type: "string", example: "1340" },
          addressLine: { type: "string", example: "House 5, Road 2" },
        },
      },
      Parent: {
        type: "object",
        required: ["nameBn", "nameEn", "nid"],
        properties: {
          nameBn: { type: "string" },
          nameEn: { type: "string" },
          nid: { type: "string", description: "10, 13 or 17 digits; must exist in the NID registry" },
          nationality: { type: "string", enum: ["Bangladeshi"], default: "Bangladeshi" },
        },
      },
      NewApplicationForm: {
        type: "object",
        description: "Sent as a JSON string in the multipart field `data`.",
        required: ["child", "birthPlace", "father", "mother", "permanentAddress"],
        properties: {
          child: {
            type: "object",
            required: ["nameBn", "nameEn", "dateOfBirth", "gender", "birthOrder"],
            properties: {
              nameBn: { type: "string", example: "তাসনিম চৌধুরী" },
              nameEn: { type: "string", example: "Tasnim Chowdhury" },
              dateOfBirth: { type: "string", format: "date", example: "2025-01-10" },
              gender: { type: "string", enum: ["male", "female", "other"] },
              birthOrder: { type: "integer", minimum: 1, example: 1 },
            },
          },
          birthPlace: {
            type: "object",
            required: ["type", "details"],
            properties: {
              type: { type: "string", enum: ["hospital", "home", "other"] },
              details: { type: "string", example: "Dhaka Medical College Hospital, Bakshibazar, Dhaka" },
            },
          },
          father: { $ref: "#/components/schemas/Parent" },
          mother: { $ref: "#/components/schemas/Parent" },
          permanentAddress: { $ref: "#/components/schemas/Address" },
          presentAddress: { $ref: "#/components/schemas/Address" },
        },
      },
      CorrectionForm: {
        type: "object",
        description: "Sent as a JSON string in the multipart field `data`.",
        required: ["brn", "reason", "items"],
        properties: {
          brn: { type: "string", example: "20251234567890123", description: "17-digit BRN of an approved certificate" },
          reason: { type: "string", example: "Spelling mistake in the child's English name" },
          items: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              required: ["field", "newValue"],
              properties: {
                field: {
                  type: "string",
                  enum: [
                    "child.nameBn", "child.nameEn", "child.dateOfBirth", "child.gender",
                    "father.nameBn", "father.nameEn", "mother.nameBn", "mother.nameEn",
                    "permanentAddress.addressLine",
                  ],
                },
                newValue: { type: "string", example: "Tasnim Chowdhuri" },
              },
            },
          },
        },
      },
    },
  },
  paths: {
    // ---------------- Auth ----------------
    "/api/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Start registration (checks the NID registry, sends a mock OTP)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["nid", "dob", "phone", "password"],
                properties: {
                  nid: { type: "string", example: "1990123456789" },
                  dob: { type: "string", format: "date", example: "1990-05-14" },
                  phone: { type: "string", example: "+8801711111111" },
                  password: { type: "string", example: "Citizen@123" },
                },
              },
            },
          },
        },
        responses: {
          201: ok("OTP sent; a verification_id cookie is set"),
          400: errorResponse("Validation failed or NID details don't match"),
          409: errorResponse("Already registered"),
          429: errorResponse("Too many requests"),
        },
      },
    },
    "/api/auth/verify-otp": {
      post: {
        tags: ["Auth"],
        summary: "Verify the OTP, create the account and log in",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", required: ["otp"], properties: { otp: { type: "string", example: "123456" } } },
            },
          },
        },
        responses: {
          201: ok("Account created; access and refresh cookies set"),
          400: errorResponse("Wrong or expired code"),
          401: errorResponse("No verification cookie"),
          429: errorResponse("Too many requests"),
        },
      },
    },
    "/api/auth/resend-otp": {
      post: {
        tags: ["Auth"],
        summary: "Send a new OTP (uses the verification cookie)",
        responses: {
          200: ok("New OTP sent"),
          401: errorResponse("No verification cookie"),
          429: errorResponse("Too many requests"),
        },
      },
    },
    "/api/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Log in (citizen or operator)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["phone", "password"],
                properties: {
                  phone: { type: "string", example: "+8801787573220" },
                  password: { type: "string", example: "Operator@123" },
                },
              },
            },
          },
        },
        responses: {
          200: ok("Logged in; access and refresh cookies set"),
          401: errorResponse("Invalid phone or password"),
          429: errorResponse("Too many requests"),
        },
      },
    },
    "/api/auth/refresh": {
      post: {
        tags: ["Auth"],
        summary: "Get a new access token (rotates the refresh token)",
        responses: { 200: ok("New cookies set"), 401: errorResponse("Missing, invalid or expired refresh token") },
      },
    },
    "/api/auth/logout": {
      post: { tags: ["Auth"], summary: "Log out (deletes the refresh token)", responses: { 200: ok("Logged out") } },
    },
    "/api/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Who am I",
        security: [{ cookieAuth: [] }],
        responses: { 200: ok("Current user"), 401: errorResponse("Not logged in") },
      },
    },

    // ---------------- Citizen ----------------
    "/api/applications/new": {
      post: {
        tags: ["Citizen"],
        summary: "Apply for a new birth certificate",
        description:
          "Only the child's father or mother can apply. Both parents' NIDs and English names must match the NID registry. " +
          "Files: PDF, JPEG or PNG, max 2 MB each.",
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["data", "birth_proof", "address_proof"],
                properties: {
                  data: { type: "string", description: "NewApplicationForm as JSON text (see Schemas below)" },
                  birth_proof: { type: "string", format: "binary" },
                  address_proof: { type: "string", format: "binary" },
                },
              },
            },
          },
        },
        responses: {
          201: ok("Application created with status pending"),
          400: errorResponse("Validation failed, wrong files, or parent details don't match"),
          403: errorResponse("You are not the child's father or mother"),
          409: errorResponse("An application for this child is already pending or approved"),
        },
      },
    },
    "/api/applications/correction": {
      post: {
        tags: ["Citizen"],
        summary: "Apply for a correction of an approved certificate",
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["data", "current_certificate", "correction_proof"],
                properties: {
                  data: { type: "string", description: "CorrectionForm as JSON text (see Schemas below)" },
                  current_certificate: { type: "string", format: "binary" },
                  correction_proof: { type: "string", format: "binary" },
                },
              },
            },
          },
        },
        responses: {
          201: ok("Correction created with status pending"),
          400: errorResponse("Validation failed, wrong files, or new value equals the current value"),
          403: errorResponse("You are not the child's father or mother"),
          404: errorResponse("No approved certificate with this BRN"),
          409: errorResponse("A correction for this BRN is already pending"),
        },
      },
    },
    "/api/applications/me": {
      get: {
        tags: ["Citizen"],
        summary: "My applications (newest first)",
        security: [{ cookieAuth: [] }],
        responses: { 200: ok("{ count, applications }"), 401: errorResponse("Not logged in") },
      },
    },
    "/api/applications/{applicationId}": {
      get: {
        tags: ["Citizen", "Operator"],
        summary: "Application details with documents, correction items and status history",
        description: "Citizens can only open their own applications; operators can open any.",
        security: [{ cookieAuth: [] }],
        parameters: [applicationIdParam],
        responses: { 200: ok("Application details"), 404: errorResponse("Application not found") },
      },
    },

    // ---------------- Operator ----------------
    "/api/applications": {
      get: {
        tags: ["Operator"],
        summary: "List applications (oldest first, cursor pagination)",
        security: [{ cookieAuth: [] }],
        parameters: [
          { name: "status", in: "query", schema: { type: "string", enum: ["pending", "approved", "rejected"] } },
          { name: "type", in: "query", schema: { type: "string", enum: ["new", "correction"] } },
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 20, default: 10 } },
          {
            name: "cursor",
            in: "query",
            description: "nextCursor from the previous page",
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          200: ok("{ total, applications, nextCursor } (nextCursor is null on the last page)"),
          400: errorResponse("Invalid filter, limit or cursor"),
          403: errorResponse("Operators only"),
        },
      },
    },
    "/api/applications/{applicationId}/status": {
      patch: {
        tags: ["Operator"],
        summary: "Approve or reject a pending application",
        description:
          "Approving a new application generates a 17-digit BRN. Approving a correction updates the original certificate. " +
          "Every change is written to the status history.",
        security: [{ cookieAuth: [] }],
        parameters: [applicationIdParam],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                oneOf: [
                  {
                    type: "object",
                    required: ["status"],
                    properties: { status: { type: "string", enum: ["approved"] } },
                  },
                  {
                    type: "object",
                    required: ["status", "reason"],
                    properties: {
                      status: { type: "string", enum: ["rejected"] },
                      reason: { type: "string", example: "Birth proof is not clear" },
                    },
                  },
                ],
              },
              examples: {
                approve: { value: { status: "approved" } },
                reject: { value: { status: "rejected", reason: "Birth proof is not clear" } },
              },
            },
          },
        },
        responses: {
          200: ok("Status updated"),
          400: errorResponse("Invalid body (reason required when rejecting)"),
          403: errorResponse("Operators only"),
          404: errorResponse("Application not found"),
          409: errorResponse("Application is not pending (already reviewed)"),
        },
      },
    },
    "/api/users/search": {
      get: {
        tags: ["Operator"],
        summary: "Find a citizen by NID or phone, with their applications",
        security: [{ cookieAuth: [] }],
        parameters: [
          { name: "nid", in: "query", schema: { type: "string", example: "1990123456789" } },
          { name: "phone", in: "query", schema: { type: "string", example: "+8801711111111" } },
        ],
        responses: {
          200: ok("{ citizen, applications }"),
          400: errorResponse("Send nid or phone"),
          403: errorResponse("Operators only"),
          404: errorResponse("No citizen found"),
        },
      },
    },
  },
};
