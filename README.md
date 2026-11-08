# Birth Certificate API

The backend for a one-stop government service that handles **new birth certificate applications** and **corrections to approved certificates** in Bangladesh. Citizens register with their NID, verify by OTP and apply online. Union office operators then review, approve or reject the applications.

> This is an MVP. The NID registry and the SMS gateway are mocked.

## Live demo

| | URL |
|---|---|
| **Swagger UI (try the API here)** | https://birth-cert-api-lyrt.onrender.com/docs |
| Health check | https://birth-cert-api-lyrt.onrender.com/api/health |

The service runs on Render's free plan and sleeps when idle, so the first request can take 30–60 seconds while it wakes up.

### Test accounts

**Operator** (already seeded):

| Phone | Password |
|---|---|
| `+8801700000000` | `Operator@123` |

**Citizens:** register one yourself using a record from the mock NID registry ([src/db/mock_data.ts](src/db/mock_data.ts)). For example:

| Name | NID | Date of birth | Phone |
|---|---|---|---|
| Rahim Uddin | `1990123456789` | `1990-05-14` | `+8801711111111` |
| Ayesha Begum | `1992987654321` | `1992-08-02` | `+8801722222222` |

The NID, date of birth and phone must match the registry exactly. The password must be at least 8 characters with an uppercase letter, a lowercase letter, a number and a special character, such as `Citizen@123`.

### Walkthrough in Swagger

Authentication uses HttpOnly cookies, so once you log in, Swagger sends the cookies automatically. There's no **Authorize** step.

**As a citizen**

1. `POST /api/auth/register` with one of the NID records above. The OTP is mocked: **for the MVP demonstration, it is returned in the response as `data.otp`**.
2. `POST /api/auth/verify-otp` with `{ "otp": "<code>" }`. This creates the account and logs you in.
3. `POST /api/applications/new`. Put the form below in the `data` field and attach a PDF, JPEG or PNG (max 2 MB) for `birth_proof` and `address_proof`. You must be the child's father or mother.

   <details>
   <summary>Sample <code>data</code> for a new application</summary>

   ```json
   {
     "child": {
       "nameBn": "তাসনিম উদ্দিন",
       "nameEn": "Tasnim Uddin",
       "dateOfBirth": "2025-01-10",
       "gender": "female",
       "birthOrder": 1
     },
     "birthPlace": {
       "type": "hospital",
       "details": "Dhaka Medical College Hospital, Bakshibazar, Dhaka"
     },
     "father": { "nameBn": "রহিম উদ্দিন", "nameEn": "Rahim Uddin", "nid": "1990123456789" },
     "mother": { "nameBn": "আয়েশা বেগম", "nameEn": "Ayesha Begum", "nid": "1992987654321" },
     "permanentAddress": {
       "division": "Dhaka",
       "district": "Dhaka",
       "upazila": "Savar",
       "areaType": "union",
       "areaName": "Ashulia",
       "ward": 5,
       "postOffice": "Savar",
       "postCode": "1340",
       "addressLine": "House 5, Road 2"
     }
   }
   ```
   </details>

4. `GET /api/applications/me` to track the application.

**As the operator**

1. `POST /api/auth/login` with the operator account.
2. `GET /api/applications?status=pending` to see the queue.
3. `GET /api/applications/{applicationId}` for the full details, documents and history.
4. `PATCH /api/applications/{applicationId}/status` with `{ "status": "approved" }`, or `{ "status": "rejected", "reason": "..." }`. Approving a new application generates a 17-digit **BRN** (Birth Registration Number).

**Correction:** log back in as the citizen and call `POST /api/applications/correction` with the BRN, the fields to change and the two documents. Once an operator approves it, the original certificate is updated.

## Features

**Authentication**
- Registration checked against the NID registry (NID, date of birth and phone must all match; the applicant must be at least 18)
- 6-digit OTP with expiry, limited attempts and a resend cooldown
- Short-lived JWT access token and rotating refresh token, both in HttpOnly cookies
- Two roles, `citizen` and `operator`, with role-based access on every route

**Citizen**
- Apply for a new birth certificate. Only the child's father or mother can apply, and both parents' NIDs and English names must match the registry.
- Apply for a correction of an approved certificate. The old value is read from the database, never taken from the client.
- List your own applications and view their details and status history

**Operator**
- List applications, filtered by status and type, with cursor pagination
- Approve or reject pending applications. A rejection requires a reason.
- Search for a citizen by NID or phone, with their applications

## Business rules

- **One application per child.** A child (identified by the mother's NID, date of birth and birth order) can have only one pending or approved new application. Birth order lets twins apply separately.
- **One open correction per certificate.** A BRN can have only one pending correction at a time.
- Both rules are enforced by partial unique indexes in Postgres, so they hold even when two requests arrive at the same moment. The service also checks them first so it can return a clear message before uploading files.
- **Each application is reviewed once.** The status update only changes rows that are still `pending`, so two operators can't both review the same application.
- **Full audit trail.** Every status change is written to `status_logs` with who made it and why.
- **Correctable fields:** child's Bangla/English name, date of birth and gender; each parent's Bangla/English name; permanent address line.

## Security

- Passwords hashed with bcrypt. NIDs and OTPs hashed with HMAC-SHA256; refresh tokens hashed with SHA-256.
- Cookies are `HttpOnly`, `Secure` in production and `SameSite=Strict`.
- Rate limits on the whole API and stricter ones on register, login, verify-otp and resend-otp.
- Uploads: PDF, JPEG or PNG only, max 2 MB. The file's real type is checked from its contents, not just its extension. Files are stored on Cloudinary as `authenticated` (not public).
- A correction for someone else's BRN returns 404, the same as a BRN that doesn't exist, so BRNs can't be probed.
- `helmet` security headers, a 100 KB JSON body limit, and all input validated with Zod.

## Tech stack

| | |
|---|---|
| Runtime | Node.js, TypeScript |
| Framework | Express 5 |
| Database | PostgreSQL (Neon) with Drizzle ORM |
| Validation | Zod 4 |
| Auth | jsonwebtoken, bcrypt |
| File storage | Cloudinary (uploads with Multer) |
| Docs | OpenAPI 3 with swagger-ui-express |
| Hosting | Render |

## Project structure

```
src/
├── app.ts              Express app: middleware, routes, error handling
├── server.ts           Starts the server
├── config/             Environment (validated with Zod), cookies, Cloudinary
├── routes/             URL → middleware → controller
├── controllers/        Read the request, call a service, send the response
├── services/           Business logic and database queries
├── validators/         Zod schemas for every request
├── middlewares/        authenticate, authorize, validate, upload, rateLimit, errorHandler
├── db/                 Drizzle schema, connection, seed script, mock NID data
├── docs/openapi.ts     OpenAPI spec served at /docs
├── data/               Bangladesh divisions, districts and upazilas (address checks)
└── utils/              Hashing, tokens, OTP, mock SMS, Cloudinary storage, AppError
drizzle/                SQL migrations
```

## API overview

All routes are under `/api`. The full request and response details are in Swagger.

| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/auth/register` | Public | Check the NID and send an OTP |
| POST | `/auth/verify-otp` | Public | Verify the OTP, create the account and log in |
| POST | `/auth/resend-otp` | Public | Send a new OTP |
| POST | `/auth/login` | Public | Log in |
| POST | `/auth/refresh` | Public | Rotate the refresh token |
| POST | `/auth/logout` | Public | Log out |
| GET | `/auth/me` | Logged in | Current user |
| POST | `/applications/new` | Citizen | New birth certificate application |
| POST | `/applications/correction` | Citizen | Correction application |
| GET | `/applications/me` | Citizen | My applications |
| GET | `/applications/:applicationId` | Citizen (own) / Operator | Application details |
| GET | `/applications` | Operator | List applications |
| PATCH | `/applications/:applicationId/status` | Operator | Approve or reject |
| GET | `/users/search` | Operator | Find a citizen by NID or phone |

Errors always have the same shape:

```json
{ "success": false, "message": "Validation failed", "errors": [{ "field": "child.nameEn", "message": "..." }] }
```

## Running locally

**Requirements:** Node.js 20+, a PostgreSQL database (a free Neon database works) and a Cloudinary account.

```bash
git clone <repo-url>
cd birth-certi-api
npm install
```

Create a `.env` file in the project root:

```env
PORT=5000
NODE_ENV=development
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
JWT_ACCESS_SECRET=<at least 32 random characters>
HMAC_SECRET=<at least 32 random characters>
CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<cloud_name>

# Used only by the seed script
SEED_OPERATOR_PHONE=+8801700000000
SEED_OPERATOR_PASSWORD=Operator@123

# Optional (defaults shown)
ACCESS_TOKEN_MINUTES=10
REFRESH_TOKEN_DAYS=7
VERIFICATION_TOKEN_MINUTES=5
OTP_EXPIRY_MINUTES=5
OTP_MAX_ATTEMPTS=5
OTP_RESEND_COOLDOWN_SECONDS=60
```

You can generate a secret with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

Then create the tables, load the mock data and start the server:

```bash
npm run db:migrate   # apply the migrations in drizzle/
npm run db:seed      # load the mock NID registry and the operator account
npm run dev
```

Swagger UI is then at http://localhost:5000/docs.

### Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Start with auto-reload (tsx) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run the compiled build |
| `npm run db:generate` | Create a migration after changing `src/db/schema.ts` |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:seed` | Seed the NID registry and the operator |
| `npm run db:studio` | Browse the database in Drizzle Studio |

## Limitations (MVP)

- The **NID registry is mocked** with 25 records in [src/db/mock_data.ts](src/db/mock_data.ts).
- **SMS is mocked.** The OTP is written to the server log and, for the MVP demonstration only, returned in the register and resend-otp responses. This must be removed before connecting a real SMS provider.
- The BRN is randomly generated, not issued by a real registry.
- Operators see every application. There's no division by area (such as union or upazila) yet.
- No certificate PDF is generated.
