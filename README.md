# Visit Flow Backend

Visit Flow is a recruitment prototype for planning field visits and recording whether they happened. This repository contains the REST API, SQLite schema and migration, fictional demo data, and API tests.

## Run locally

Use Node.js 22.12+ and npm. Run these commands from this repository.

```powershell
npm ci
Copy-Item .env.example .env
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Use the generated value as `JWT_SECRET` in `.env`. On macOS and Linux, use `cp .env.example .env` to copy the example.

```sh
npm run db:setup
npm run db:seed
npm run dev
```

`db:setup` applies committed migrations and generates the Prisma client. The seeder creates one demo account, 13 fictional entities, four demo salespeople, and 26 visits. Rerunning it preserves existing rows and creates any missing seed rows. Use `npm start` to run the server without watch mode.

| Variable       | Local value                                                        |
| -------------- | ------------------------------------------------------------------ |
| `PORT`         | `3001`                                                             |
| `DATABASE_URL` | `file:./dev.db` (relative to `prisma/schema.prisma`)               |
| `JWT_SECRET`   | A random local secret                                              |
| `FRONTEND_URL` | `http://localhost:5173` (the exact browser origin allowed by CORS) |

If Prisma reports an empty schema engine error on Windows and the shell sets RUST_LOG=warn, run `Remove-Item Env:RUST_LOG` before database setup or tests. Stop the backend before rerunning setup so Windows can replace the Prisma client library.

The frontend is a separate repository. Set its `VITE_API_URL` to `http://localhost:3001/api`, then follow its README. The seeded login is **demo@visitflow.test** / **Demo12345!**.

## Try an admin account

The seed account has role USER. To try ADMIN, create a separate local account after applying migrations. Run these commands from the backend repository in PowerShell 7.

```powershell
$env:BOOTSTRAP_ADMIN_EMAIL = 'admin@visitflow.test'
$env:BOOTSTRAP_ADMIN_PASSWORD = Read-Host 'Choose an admin password' -MaskInput
try {
    node prisma/bootstrapAdmin.js
} finally {
    Remove-Item Env:BOOTSTRAP_ADMIN_EMAIL, Env:BOOTSTRAP_ADMIN_PASSWORD
}
```

Use at least 12 characters and at most 72 UTF-8 bytes. On other shells, set the same two variables for the bootstrap command. Sign in with that email and password, then open **Admin**. Admins can also use the regular visit dashboard. Regular users can plan and update visits with the shared catalog.

## API

Every route except login requires an `Authorization: Bearer <token>` header. Tokens expire after eight hours.

| Method and route            | Input and result                                                                                                                                               |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/auth/login`      | Email and password. Returns a token and public user fields.                                                                                                    |
| `GET /api/auth/me`          | Returns the signed-in user.                                                                                                                                    |
| `GET /api/activities`       | Optional `search`, `segment`, `status`, `from`, and `to`. Includes entity details and sorts by visit date, newest first.                                       |
| `POST /api/activities`      | Requires `entityId`, `segment`, `visitDate`, and `salesId`. Legacy callers can supply `salesName` instead. Returns 201 and creates the visit as `NOT_VISITED`. |
| `PATCH /api/activities/:id` | Accepts `VISITED` or `NOT_VISITED` in `status`. Returns the saved activity.                                                                                    |
| `GET /api/sales`            | Lists salespeople by name. Accepts an optional `search` parameter.                                                                                             |
| `GET /api/entities`         | Optional `segment` and `search`. Returns matching master choices or unique matching history choices if the master list is empty.                               |

All endpoints under `/api/admin` require role ADMIN. Requests without valid authentication receive 401. Authenticated users with role USER receive 403.

| Admin route               | Available operations                                                          |
| ------------------------- | ----------------------------------------------------------------------------- |
| `/api/admin/users`        | GET to list accounts. POST to create an ADMIN or USER.                        |
| `/api/admin/entities`     | GET to list and POST to create. PATCH or DELETE at `/:id` to edit or archive. |
| `/api/admin/sales`        | GET to list and POST to create. PATCH or DELETE at `/:id` to edit or archive. |
| `/api/admin/audit?page=1` | GET to list recent audit entries in pages of 25.                              |

Archived entities and salespeople disappear from new visit choices while existing visits retain their references and sales-name history. In the Admin UI, edit an archived item and enable **Active** to restore it. The audit log records successful sign-ins, account creation, catalog changes, and visit creation or status changes. Entries record the actor, time, target, and change details where applicable.

Dates use `YYYY-MM-DD` with inclusive boundaries. Segments are `B2G` and `B2B`. Search uses SQLite's case-insensitive matching for ASCII names. New visits in the dashboard link to a salesperson and keep their display name on the visit. The migration links existing visits to a catalog entry using their recorded sales name.

Examples in PowerShell:

```powershell
$base = 'http://localhost:3001/api'
$credentials = @{ email = 'demo@visitflow.test'; password = 'Demo12345!' } | ConvertTo-Json
$session = Invoke-RestMethod "$base/auth/login" -Method Post -ContentType 'application/json' -Body $credentials
$headers = @{ Authorization = "Bearer $($session.data.token)" }

Invoke-RestMethod "$base/auth/me" -Headers $headers
Invoke-RestMethod "$base/activities?segment=B2G&status=VISITED&from=2026-03-01&to=2026-03-31&search=melati" -Headers $headers
Invoke-RestMethod "$base/entities?segment=B2G&search=cemara" -Headers $headers

$sales = Invoke-RestMethod "$base/sales?search=andi" -Headers $headers
$visit = @{ entityId = 'ent-001'; segment = 'B2G'; visitDate = '2026-03-15'; salesId = $sales.data[0].id } | ConvertTo-Json
$created = Invoke-RestMethod "$base/activities" -Method Post -Headers $headers -ContentType 'application/json' -Body $visit
Invoke-RestMethod "$base/activities/$($created.data.id)" -Method Patch -Headers $headers -ContentType 'application/json' -Body '{"status":"VISITED"}'
```

Success responses include `success: true` and `data`. Errors include `success: false` and a `message`. Validation errors return 400 and include a field-keyed `errors` object. Authentication failures return 401, unknown visit IDs return 404, and unexpected errors return 500 with a generic message.

## Stack and decisions

- Express uses a small route, middleware, controller, and service structure. Express Validator checks input at the route boundary.
- Prisma keeps the schema, migrations, and database queries together. SQLite keeps setup local to one file. Visit dates are stored at UTC midnight and serialized as calendar dates.
- bcryptjs hashes the demo password. jsonwebtoken signs and verifies Bearer tokens. dotenv loads local configuration and cors allows the configured frontend origin.
- Vitest and Supertest exercise real HTTP handlers and SQLite queries. ESLint checks source and Prettier keeps formatting consistent.

## Tests

```sh
npm test
npm run lint
```

The test setup migrates and seeds a fresh SQLite database under an ignored temporary directory in `prisma/`. API test files each use a copy of that seeded database. The tests cover authentication, role enforcement, account creation, catalog archive and restore, audit attribution, filters, date boundaries, and visit persistence.

## Known limitations

The demo uses a shared visit list. It has no public registration, token revocation, or visit pagination. The audit screen covers application events from the time the feature is enabled. SQLite uses a local file and the search case folding is limited to ASCII. The demo credentials are public by design and are for local evaluation.

## AI Usage Disclosure

- **Project author** supplied the requirements, requested the database-backed sales catalog, and applied the RBAC and audit changes from the Visit Flow guide, including the Prisma migration and admin bootstrap setup.
- **Codex** assisted with the initial Express and Prisma implementation, the sales catalog, and the guide's RBAC and audit code. Codex added automated coverage for role checks, the admin API, catalog history, and audit attribution.

This disclosure describes the work by feature. A project-wide percentage was not measured.
