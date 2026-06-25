# Public Deployment

This app has two parts:

- `backend`: Express API, Prisma, Postgres, Redis, Socket.IO.
- `mobile`: Expo React Native app. This is not hosted like a normal website; it points to the public backend URL and runs in Expo Go or a built app.

## 1. Deploy The Backend

Use a service that can run Docker, for example Render, Railway, Fly.io, or your own VPS.

Set the Docker root/path to:

```text
backend/Dockerfile
```

The production container runs:

```sh
npx prisma migrate deploy && node dist/app.js
```

Required backend environment variables:

```env
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE
REDIS_URL=redis://HOST:PORT
JWT_ACCESS_SECRET=change-this-to-at-least-32-characters
JWT_REFRESH_SECRET=change-this-to-at-least-32-characters
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
BCRYPT_ROUNDS=12
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
EMAIL_FROM=noreply@example.com
CLIENT_URL=*
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

For first testing, `CLIENT_URL=*` is okay because the app is mobile. Later, replace it with your real public origins, separated by commas.

After deploy, test:

```sh
curl https://YOUR_BACKEND_DOMAIN/health
```

You should see:

```json
{"status":"ok"}
```

## 2. Point Expo To The Public Backend

Create `mobile/.env.local`:

```env
EXPO_PUBLIC_API_URL=https://YOUR_BACKEND_DOMAIN/api/v1
EXPO_PUBLIC_SOCKET_URL=https://YOUR_BACKEND_DOMAIN
```

Then run Expo:

```sh
cd mobile
npx expo start -c
```

Open the QR code in Expo Go. Login/register will now call the public backend, not `localhost`.

## 3. Build The Phone App

For real installable apps, use Expo EAS:

```sh
cd mobile
npx eas build:configure
npx eas build --platform android
```

For iPhone App Store/TestFlight, use:

```sh
npx eas build --platform ios
```
