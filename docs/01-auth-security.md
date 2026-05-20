# Domain 1: 🔐 Auth & Security

> **Priority:** 🔴 HIGH — Do this first  
> **Estimated effort:** 1 chat session  
> **Dependencies:** None

---

## Scope

Login, Signup, Email Verification, Forgot Password, OAuth (Google/Facebook), Session Management, Middleware, Rate Limiting

---

## Files Involved

### Configuration

| File                     | Size  | Role                                                                     |
| ------------------------ | ----- | ------------------------------------------------------------------------ |
| `src/lib/auth.ts`        | 4.2KB | Better Auth server config (email verification, OAuth, session, DB hooks) |
| `src/lib/auth-client.ts` | 299B  | Better Auth client — `baseURL` falls back to localhost                   |
| `.env`                   | 2.2KB | All secrets — `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`, etc.                |
| `.env.example`           | 1.3KB | Template — missing `NEXT_PUBLIC_BASE_URL`                                |

### Server

| File                               | Size  | Role                                                                            |
| ---------------------------------- | ----- | ------------------------------------------------------------------------------- |
| `src/middleware.ts`                | 1.5KB | Edge middleware — checks `better-auth.session_token` cookie for `/admin` routes |
| `src/server/trpc.ts`               | 2.2KB | tRPC context creation — extracts session, fetches role                          |
| `src/server/utils/auth-helpers.ts` | 2.1KB | `requireAuth()`, `requireAdmin()`, `getUserRole()`, `isAdmin()`                 |
| `src/server/utils/rate-limiter.ts` | 4.6KB | In-memory rate limiter (NOT using Upstash yet despite it being in deps)         |
| `src/server/routers/auth.ts`       | 1KB   | `getEmailByPhone` — public lookup for phone-based login                         |
| `src/types/auth.ts`                | 1.1KB | Auth type definitions                                                           |

### Components

| File                                                 | Size  | Role                                                      |
| ---------------------------------------------------- | ----- | --------------------------------------------------------- |
| `src/components/auth/login/LoginForm.tsx`            | 4.9KB | Email/phone login form                                    |
| `src/components/auth/login/LoginCard.tsx`            | 1.4KB | Card wrapper with OAuth buttons                           |
| `src/components/auth/login/GoogleSignInButton.tsx`   | 1.9KB | Google OAuth button                                       |
| `src/components/auth/login/FacebookSignInButton.tsx` | 1.4KB | Facebook OAuth button                                     |
| `src/components/auth/login/index.ts`                 | 208B  | Barrel export                                             |
| `src/components/auth/signup/SignupForm.tsx`          | 8.3KB | Full signup form (name, email, phone, birthday, password) |
| `src/components/auth/signup/SignupCard.tsx`          | 1.5KB | Card wrapper                                              |
| `src/components/auth/signup/index.ts`                | 88B   | Barrel export                                             |

### Pages

| File                                      | Role                        |
| ----------------------------------------- | --------------------------- |
| `src/app/(auth)/layout.tsx`               | Auth layout                 |
| `src/app/(auth)/login/page.tsx`           | Login page                  |
| `src/app/(auth)/signup/page.tsx`          | Signup page                 |
| `src/app/(auth)/check-email/page.tsx`     | Check email page            |
| `src/app/(auth)/forgot-password/page.tsx` | Forgot password page        |
| `src/app/(auth)/verify-email/page.tsx`    | Email verification callback |
| `src/app/api/auth/[...all]/route.ts`      | Better Auth API catch-all   |

---

## Issues & Tasks

### Issue 1: 🔴 OAuth URLs hardcoded to localhost

**Problem:** Three separate files fall back to `http://localhost:3000`:

```typescript
// src/lib/auth-client.ts (line 4)
baseURL: (process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000",
  // src/infrastructure/services/resend-email.service.ts (line 32)
  (this.baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"));

// src/application/checkout/use-cases/create-checkout-session.use-case.ts (line 52)
const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
```

And `.env` has:

```
BETTER_AUTH_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

But `NEXT_PUBLIC_BASE_URL` is **not defined** at all.

**Fix:**

1. Add `NEXT_PUBLIC_BASE_URL` to `.env` and `.env.example`
2. When deploying, set all three URL env vars to your production domain
3. In Google Cloud Console → OAuth → Add `https://yourdomain.com/api/auth/callback/google`
4. In Facebook Developer Console → Add `https://yourdomain.com/api/auth/callback/facebook`

---

### Issue 2: 🟡 Email verification disabled

**Current code in `src/lib/auth.ts` line 37:**

```typescript
requireEmailVerification: false, // Disabled so users can sign up without email verification
```

**Task:** Before going to production, set to `true`. Users should verify their email. The email sending infrastructure (Resend) is already wired up and working.

---

### Issue 3: 🟡 console.log statements in auth

**Location:** `src/lib/auth.ts` lines 16, 17, 25, 39, 47

```typescript
console.log("[Auth] Sending verification email to:", user.email);
console.log("[Auth] Verification URL:", url);
console.log("[Auth] Verification email sent successfully");
console.log("[Auth] Sending password reset email to:", user.email);
console.log("[Auth] Password reset email sent successfully");
```

**Task:** Remove all console.log or replace with a proper logger. Verification URLs in logs are a security risk.

---

### Issue 4: 🟡 Rate limiter is in-memory, not using Upstash

**Problem:** `src/server/utils/rate-limiter.ts` implements a custom in-memory `RateLimiter` class. But `@upstash/ratelimit` and `@upstash/redis` are already in `devDependencies`, and `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` are configured in `.env`.

**Task:** The in-memory rate limiter won't work in serverless (Vercel) because each function invocation has its own memory. Either:

- Migrate to Upstash rate limiting (recommended for Vercel)
- Or keep in-memory if running on a single server

---

### Issue 5: 🟢 OAuth buttons are near-identical

**Problem:** `GoogleSignInButton.tsx` and `FacebookSignInButton.tsx` share 90% identical code. Only differ in provider name, icon SVG, and error message.

**Task:** Create a shared `SocialSignInButton` component:

```typescript
interface SocialSignInButtonProps {
  provider: "google" | "facebook";
  icon: React.ReactNode;
  label: string;
}
```

---

### Issue 6: 🟢 Auth router directly queries DB

**Problem:** `src/server/routers/auth.ts` line 29-33 queries `db` directly instead of going through the repository layer:

```typescript
const [foundUser] = await db
  .select({ email: user.email })
  .from(user)
  .where(eq(user.phone, formattedPhone))
  .limit(1);
```

**Task:** Should use a repository method like `customerRepository.findByPhone()` to maintain Onion Architecture consistency.

---

## Checklist

- [ ] Add `NEXT_PUBLIC_BASE_URL` to `.env` and `.env.example`
- [ ] Document OAuth redirect URI setup for Google and Facebook
- [ ] Remove console.log from `auth.ts` (or add proper logger)
- [ ] Decide: Upstash rate limiting vs in-memory
- [ ] Create shared `SocialSignInButton` component
- [ ] Move direct DB query in auth router to repository layer
- [ ] Plan for `requireEmailVerification: true` in production
