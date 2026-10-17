import { OAuth2Client } from 'google-auth-library';

const SCOPES = ['openid', 'email', 'profile'];

export function appOrigin() {
  const fromEnv = process.env.AUTH_URL || process.env.NEXT_PUBLIC_APP_URL;
  return (fromEnv || 'http://localhost:3000').replace(/\/$/, '');
}

export function googleOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is not set');
  }
  return new OAuth2Client(clientId, clientSecret, `${appOrigin()}/api/auth/callback/google`);
}

export function googleAuthUrl(state: string) {
  return googleOAuthClient().generateAuthUrl({
    access_type: 'online',
    prompt: 'select_account',
    include_granted_scopes: false,
    scope: SCOPES,
    state,
  });
}
