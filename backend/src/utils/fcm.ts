// Replace the stub below with real Firebase Admin SDK calls
// once you add firebase-admin to package.json and set GOOGLE_APPLICATION_CREDENTIALS.
//
// import admin from 'firebase-admin';
// admin.initializeApp({ credential: admin.credential.applicationDefault() });

export async function pushToUser(
  _userId: string,
  _title: string,
  _body: string,
  _data?: Record<string, string>,
): Promise<void> {
  // TODO: look up the user's FCM token from a `device_tokens` table,
  // then call admin.messaging().send({ token, notification: { title, body }, data });
}
