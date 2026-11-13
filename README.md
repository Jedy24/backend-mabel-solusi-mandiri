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

The test setup migrates and seeds a fresh SQLite database under an ignored temporary directory in `prisma/`. The suite removes that directory on teardown. The tests cover authentication, filters, date boundaries, creation, validation, status persistence, and entity fallback.

## Known limitations

The demo uses one shared account and one visit list. It has no registration, token revocation, pagination, or master-data editor. SQLite uses a local file and the search case folding is limited to ASCII. The demo credentials are public by design and are for local evaluation.

## AI Usage Disclosure

Codex assisted with most of the initial implementation, including the Express routes, authentication, Prisma schema, seed data, filtering, and API tests. The project author defined the requirements and requested a database-backed sales catalog. Codex implemented the sales endpoint, visit validation, migration, and related tests. Verification included ESLint, 28 API tests, and a migration check that preserved the recorded sales names on 26 existing visits. A project-wide percentage was not measured.
