# Worker Pro Subscriptions Setup

Worker Pro is prepared for RevenueCat-managed store subscriptions. It is disabled by default and does not charge users until Google Play, Apple, and RevenueCat are configured.

## Identifiers

- RevenueCat entitlement ID: `worker_pro`
- RevenueCat offering ID: `default`
- Google Play subscription ID: `worker_pro_monthly`
- Google Play base plan ID: `monthly`
- Apple product ID: `com.workerapp.workerpro.monthly`
- Planned launch price: `₪100/month`

## Environment Variables

Mobile public variables:

```env
EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=
EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=
EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID=worker_pro
EXPO_PUBLIC_REVENUECAT_OFFERING_ID=default
EXPO_PUBLIC_GOOGLE_WORKER_PRO_PRODUCT_ID=worker_pro_monthly
EXPO_PUBLIC_APPLE_WORKER_PRO_PRODUCT_ID=com.workerapp.workerpro.monthly
```

Backend private variables:

```env
REVENUECAT_WEBHOOK_AUTH_TOKEN=
REVENUECAT_SECRET_API_KEY=
REVENUECAT_PROJECT_ID=
REVENUECAT_ENTITLEMENT_ID=worker_pro
SUBSCRIPTIONS_ENABLED=false
```

Never put RevenueCat secret API keys, webhook tokens, Google service-account JSON, or Apple private keys into `EXPO_PUBLIC_*` variables.

## Current Safe Behavior

- The mobile app shows Worker Pro as not configured when SDK keys are missing.
- Subscribe and restore actions are disabled when not configured.
- The backend returns safe subscription status from `GET /api/v1/subscriptions/me`.
- The RevenueCat webhook route exists at `POST /api/v1/webhooks/revenuecat`.
- The webhook route rejects requests while `REVENUECAT_WEBHOOK_AUTH_TOKEN` is missing.
- `SUBSCRIPTIONS_ENABLED=false` means no backend feature is locked behind Worker Pro.
- There is no fake activation endpoint and no manual paid-access grant.

## Google Play And RevenueCat Checklist

1. Create the Google Play developer account.
2. Upload an Android App Bundle to an internal testing track.
3. Create the Google Play subscription with subscription ID `worker_pro_monthly`.
4. Create the monthly auto-renewing base plan with base plan ID `monthly`.
5. Set the Israeli price to the intended amount.
6. Create the RevenueCat project.
7. Add the Android app using the exact Expo/EAS Android package ID.
8. Connect Google Play to RevenueCat with the required service credentials.
9. Import the `worker_pro_monthly` product.
10. Create the RevenueCat entitlement `worker_pro`.
11. Attach the imported product to the entitlement.
12. Create the RevenueCat offering `default`.
13. Add the monthly package to the `default` offering.
14. Copy the Android public RevenueCat SDK key into `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`.
15. Configure the RevenueCat webhook URL:

```text
https://worker-auth.onrender.com/api/v1/webhooks/revenuecat
```

16. Set the webhook authorization token in RevenueCat and the same value in Render as `REVENUECAT_WEBHOOK_AUTH_TOKEN`.
17. Add `REVENUECAT_SECRET_API_KEY` and `REVENUECAT_PROJECT_ID` to Render.
18. Keep `SUBSCRIPTIONS_ENABLED=false` until test purchases and webhook updates are verified.
19. Create a new Expo development build after adding RevenueCat keys.
20. Upload a build to Google Play internal testing.
21. Test with a Google Play license tester account.
22. Change `SUBSCRIPTIONS_ENABLED=true` only after configuration is complete and verified.
23. Repeat the equivalent Apple App Store Connect and RevenueCat setup later using product ID `com.workerapp.workerpro.monthly`.

## Local Commands

Backend:

```bash
cd /Users/yosefjirees/Documents/Codex/2026-06-20/i/run/worker-auth-4-fixed-clean/backend
npx prisma migrate deploy
npm run build
npm test
```

Mobile:

```bash
cd /Users/yosefjirees/Documents/Codex/2026-06-20/i/run/worker-auth-4-fixed-clean/mobile
npx tsc --noEmit
npx expo start -c
```

For purchase testing, use an Expo development build or a store/internal-testing build. Expo Go cannot run native RevenueCat purchases.

## Troubleshooting

Offering not found:
Check that RevenueCat has an offering with ID `default` and that the product is attached to that offering.

Package not found:
Check that the monthly package exists inside the `default` offering and points to the imported store product.

Wrong package/application ID:
Google Play, EAS, and RevenueCat must use the same Android package ID. If the app was uploaded under a different package, RevenueCat products will not load.

Wrong RevenueCat App User ID:
The app uses the backend user ID as the RevenueCat App User ID. Do not use email as the permanent identity.

Missing Google Play service credentials:
RevenueCat cannot validate Google subscriptions until Google Play is connected with the required credentials.

App installed outside Play internal testing:
Google subscription products may not appear or purchase correctly unless installed through the configured testing track.

Using Expo Go:
RevenueCat native purchases require a development build or store build. Expo Go is expected to show safe unavailable/not-configured states.

Sandbox versus production confusion:
Use sandbox/internal-testing accounts during setup. Do not enable `SUBSCRIPTIONS_ENABLED=true` for production enforcement until webhook updates are verified with the intended environment.
