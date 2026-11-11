# Production Deployment Checklist

## Data and Infrastructure

- [ ] Managed PostgreSQL backups and restore drill verified.
- [ ] Redis is persistent/managed, private, and monitored.
- [ ] `npx prisma migrate deploy` succeeds in pre-deploy against a backup-tested database.
- [ ] `/health` and `/ready` monitored separately.
- [ ] One Socket.IO instance is used, or a Redis adapter is implemented before horizontal scaling.

## Secrets and Configuration

- [ ] Independent 32+ character JWT access/refresh secrets.
- [ ] Exact production `CLIENT_URL`; no wildcard CORS.
- [ ] SMTP and Cloudinary credentials tested in staging.
- [ ] RevenueCat bearer token and signing secret configured; sandbox and production events verified.
- [ ] `SUBSCRIPTIONS_ENABLED` remains false until store products and webhook processing are verified.
- [ ] No `.env` files or store credentials committed.

## Application Verification

- [ ] GitHub Actions backend, integration, and mobile jobs pass on the release commit.
- [ ] Dependency audits reviewed without forced upgrades.
- [ ] Privacy tests confirm unselected workers cannot see customer contact or exact location.
- [ ] Concurrent offer/confirmation/cancellation tests pass against the release schema.
- [ ] Expo EAS iOS/Android builds and device smoke tests pass.
- [ ] Error reporting receives request IDs without private payloads.

## Push Notifications

Current behavior: notifications are stored in PostgreSQL and emitted to connected Socket.IO clients. `pushToUser` is intentionally a no-op placeholder.

Production requirements:

1. Add a device-token model tied to user, installation, platform, and last-seen time.
2. Add authenticated register/revoke token endpoints and remove tokens on account switch/logout.
3. Configure Firebase Admin credentials as a secret, never a mobile public variable.
4. Send bounded, non-sensitive payloads and delete invalid tokens after provider rejection.
5. Add delivery/failure metrics and retry only transient provider errors.
6. Test foreground, background, terminated, permission-denied, and account-switch behavior on both platforms.

Do not mark push notifications operational until those device tests pass.

## Release Operations

- [ ] Confirm Render is deploying the reviewed commit SHA.
- [ ] Review structured error/notification/webhook events after canary deployment.
- [ ] Document rollback version and migration compatibility.
- [ ] Confirm support, moderation, account deletion, privacy policy, and incident contacts.
