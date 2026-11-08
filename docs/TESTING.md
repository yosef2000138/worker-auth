# Testing Strategy

## Unit Tests

`npm test` runs Node's test runner through `tsx`. Unit suites cover schemas, JWT/session helpers, privacy serializers, matching, status rules, payment fail-closed behavior, reviews, subscriptions, upload signatures, and health metadata.

## Integration Tests

`npm run test:integration` performs these steps:

1. Refuses any non-local database or database not ending in `_test`.
2. Refuses Redis outside local database 15.
3. Type-checks source and integration tests.
4. Applies forward-only Prisma migrations.
5. Runs test files sequentially against real PostgreSQL and Redis.
6. Cleans fixture rows before and after suites.

Run the isolated suite and automatically remove its containers and volumes afterward:

```bash
cd backend
npm run test:integration:docker
```

`npm run test:integration` remains available when PostgreSQL and Redis are already running, including in GitHub Actions.

The test database and Redis use tmpfs and no production credentials. Integration coverage includes auth/session rotation, privacy/authorization, request/offer lifecycle, Socket.IO access and persistence, message validation/rate limits, and PostgreSQL concurrency final state.

## CI

`.github/workflows/ci.yml` runs on pull requests and pushes to `main`:

- Backend: clean install, Prisma validation, build, unit tests, production dependency audit.
- Integration: PostgreSQL/PostGIS and Redis service containers plus the complete integration suite.
- Mobile: clean install, TypeScript, localization, Expo dependency check, Expo Doctor.

CI never deploys. External credentialed services are intentionally excluded.

## Manual/Staging Tests

Before release, verify on real Android and iOS devices: registration, account switching, image upload, background/reconnect chat, RevenueCat sandbox purchases and restoration, SMTP delivery, Render cold start, request location permissions, RTL layouts, and failure behavior with interrupted connectivity.
