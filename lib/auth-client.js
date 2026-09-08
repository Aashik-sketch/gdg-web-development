import { createAuthClient } from "better-auth/react";
import { adminClient } from "better-auth/client/plugins";

// Always call Better Auth on the origin currently serving the browser.
// This avoids OAuth/session failures when BETTER_AUTH_URL points at a different
// hostname (for example, a Vercel deployment URL while the user opens a custom
// domain).
export const authClient = createAuthClient({
  baseURL: typeof window !== "undefined" ? window.location.origin : undefined,
  plugins: [adminClient()],
});
