# Going live on valkyrie-eg.com

Everything that has to change **outside this repository** now that the site is
served from `https://www.valkyrie-eg.com`.

Nothing in here is a code change. Every item is a value you set in a hosting
dashboard or a third-party console, and **none of them fail loudly** — the
build succeeds, the site renders, and the damage shows up as a customer who
cannot log in, an email nobody receives, or an order that is never marked paid.

Written 2026-09-11, when the domain went live.

**Related, and deliberately not duplicated here:**

- `docs/POST-LAUNCH.md` — the cutover checks that are about the _application_
  (`UPSTASH_*`, `NODE_ENV`, the currency defaults, the smoke test, the
  unapplied migrations). Read it alongside this file; it owns everything this
  one does not.
- `docs/ISSUES.md` — the defect catalogue. Nothing here is a defect.

---

## 0. The thing that is wrong right now

Three environment variables still point at the old Vercel deployment:

```
NEXT_PUBLIC_APP_URL=https://val-store.vercel.app
NEXT_PUBLIC_BASE_URL=https://val-store.vercel.app
BETTER_AUTH_URL=https://val-store.vercel.app
```

Verified by building the site on 2026-09-11: the generated `robots.txt` says
`Host: https://val-store.vercel.app` and every one of the 30 URLs in
`sitemap.xml` carries that domain. Until these change, you are telling Google
to index the old host.

They are three variables rather than one because three different systems read
them, and they are read in different places:

| Variable               | Read by                                                                                   | What breaks if it is wrong                                                             |
| ---------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_APP_URL`  | `src/lib/site-url.ts` → sitemap, robots, canonical, OG, Stripe redirects, all email links | Google indexes the wrong host; a paying customer is redirected off-site after checkout |
| `NEXT_PUBLIC_BASE_URL` | `src/lib/auth-client.ts`                                                                  | Browser-side auth calls go to the old origin and fail CORS                             |
| `BETTER_AUTH_URL`      | Better Auth server                                                                        | OAuth state mismatch — Google/Facebook sign-in fails                                   |

Set all three to `https://www.valkyrie-eg.com` **in your hosting provider's
environment settings**, not only in the local `.env`. The local file is
gitignored and is not what production reads.

> **Pick `www` or bare and never mix.** Everything below assumes
> `https://www.valkyrie-eg.com`. If you decide the canonical host is
> `https://valkyrie-eg.com` instead, every URL in this document changes with
> it — including the OAuth redirect URIs, which match on the exact string.

After changing them you must **redeploy**, not just restart. `sitemap.xml`,
`robots.txt` and `manifest.webmanifest` are prerendered at build time, so they
keep the old value until the next build.

---

## 1. Google Cloud Console — OAuth (the login you asked about)

**Where:** [console.cloud.google.com](https://console.cloud.google.com) → your
project → **APIs & Services → Credentials** → your **OAuth 2.0 Client ID** (the
one whose value is in `GOOGLE_CLIENT_ID`).

Two separate fields, and people routinely fill in only the first:

### Authorised JavaScript origins

Origin only — no path, no trailing slash.

```
https://www.valkyrie-eg.com
```

### Authorised redirect URIs

Full path, exact match. Google compares this string character for character;
a trailing slash or `http` instead of `https` is a rejection.

```
https://www.valkyrie-eg.com/api/auth/callback/google
```

That path is Better Auth's convention — the handler is mounted at
`/api/auth/[...all]` and routes social callbacks to
`/api/auth/callback/{providerId}` (confirmed against the installed
`better-auth` package, not assumed).

**Keep the existing localhost entries.** They are what makes `pnpm dev` work:

```
http://localhost:3000
http://localhost:3000/api/auth/callback/google
```

**Symptom if you miss this:** `Error 400: redirect_uri_mismatch` on a Google
error page, before the user ever returns to the site. The error page names the
exact URI it was sent — paste that into the field.

### OAuth consent screen

Same project → **OAuth consent screen**. Worth doing now because it is what a
customer actually reads on the permission dialog:

- **App name** — `Valkyrie` (this is the name in "Valkyrie wants access to…")
- **App logo** — `public/icons/icon-512.png`, newly generated
- **Application home page** — `https://www.valkyrie-eg.com`
- **Privacy policy** — `https://www.valkyrie-eg.com/privacy`
- **Terms of service** — `https://www.valkyrie-eg.com/terms`
- **Authorised domain** — `valkyrie-eg.com` (bare, no scheme, no `www`)

If the app is still in **Testing**, only accounts on the test-user list can
sign in and everyone else gets "app is blocked". Publish it. Because the app
only requests `email` and `profile` — non-sensitive scopes — publishing does
not require Google's verification review.

---

## 2. Facebook — OAuth

**Where:** [developers.facebook.com](https://developers.facebook.com) → your
app → **Facebook Login → Settings**.

**Valid OAuth Redirect URIs:**

```
https://www.valkyrie-eg.com/api/auth/callback/facebook
```

Then under **Settings → Basic**:

- **App Domains** — `valkyrie-eg.com`
- **Privacy Policy URL** — `https://www.valkyrie-eg.com/privacy`
- **Terms of Service URL** — `https://www.valkyrie-eg.com/terms`
- **Site URL** (under Website) — `https://www.valkyrie-eg.com`

Facebook will not let you take the app **Live** without the privacy policy URL,
and while it is in Development mode only app admins/testers can sign in.

> Facebook login is optional. `src/lib/auth.ts` enables each provider only when
> its client ID is present (`enabled: !!process.env.FACEBOOK_CLIENT_ID`), so
> leaving `FACEBOOK_CLIENT_ID` unset disables the button cleanly rather than
> breaking the page.

---

## 3. Stripe — live keys and the webhook

This is the one where a mistake costs money rather than traffic.

### 3a. Switch to live keys

Stripe Dashboard → toggle **Test mode off** → **Developers → API keys**:

| Variable                 | Value                                              |
| ------------------------ | -------------------------------------------------- |
| `STRIPE_SECRET_KEY`      | `sk_live_…`                                        |
| `STRIPE_PUBLISHABLE_KEY` | `pk_live_…`                                        |
| `STRIPE_WEBHOOK_SECRET`  | `whsec_…` from the **live** endpoint created below |

Test-mode keys are `sk_test_`/`pk_test_`. If the site is live on test keys,
checkout appears to work and no money ever moves.

### 3b. Create the live webhook endpoint

**Developers → Webhooks → Add endpoint**, in **live** mode.

**Endpoint URL:**

```
https://www.valkyrie-eg.com/api/webhook/stripe
```

**Events to send** — exactly the four the handler switches on
(`src/app/api/webhook/stripe/route.ts`):

- `checkout.session.completed`
- `checkout.session.expired`
- `payment_intent.succeeded`
- `payment_intent.payment_failed`

Then copy the endpoint's **Signing secret** into `STRIPE_WEBHOOK_SECRET`.

**Why this matters more than it looks.** `checkout.session.completed` is what
marks the order `paid`, sets the payment `completed`, sends the confirmation
email and clears the cart. Without a working webhook the customer is charged,
lands on the success page, and the order sits at `pending` forever with no
email — and you find out from the customer.

**The secret is per-endpoint.** A test-mode secret against a live endpoint
fails signature verification on every event, and Stripe records them as
delivery failures rather than surfacing them in the app.

### 3c. Confirm the currency

The Stripe account must be able to charge **EGP** — `STORE_CURRENCY` defaults
to `EGP` and a Stripe account is bound to the currency it settles in. See the
note in `src/lib/currency.ts`.

### 3d. Verify

Stripe's webhook page has **Send test webhook**. Send a
`checkout.session.completed` and confirm a `200`. A `400` means the signing
secret is wrong.

---

## 4. Resend — sending from your own domain

**Currently `EMAIL_FROM=Valkyrie <onboarding@resend.dev>`.** That is Resend's
shared sandbox sender, and it **only delivers to the address that owns the
Resend account**. Every order confirmation, password reset and verification
email to a real customer is silently dropped. This is a launch blocker, not a
polish item.

**Where:** [resend.com/domains](https://resend.com/domains) → **Add Domain** →
`valkyrie-eg.com`.

Resend gives you DNS records to add at your registrar:

| Type  | Purpose | Notes                                             |
| ----- | ------- | ------------------------------------------------- |
| `TXT` | SPF     | Authorises Resend to send as your domain          |
| `TXT` | DKIM    | Signs the mail; the selector is Resend-specific   |
| `MX`  | Bounces | On a subdomain such as `send.valkyrie-eg.com`     |
| `TXT` | DMARC   | Not issued by Resend — add it yourself, see below |

Wait for **Verified** (usually minutes, up to 48h), then set:

```
EMAIL_FROM=Valkyrie <orders@valkyrie-eg.com>
```

**Add a DMARC record too.** Without one, Gmail and Outlook increasingly route
bulk senders to spam regardless of SPF/DKIM. Start permissive:

```
Type: TXT   Host: _dmarc   Value: v=DMARC1; p=none; rua=mailto:you@valkyrie-eg.com
```

Tighten to `p=quarantine` once the reports come back clean.

### Also set `NEXT_PUBLIC_APP_NAME`

Read by `resend-email.service.ts`, and in **neither** `.env` nor any tracked
example file — there is no `.env.example`, because `.gitignore` matches
`.env*`. It falls back to `"Valkyrie"`, which is correct, so this is tidiness
rather than a fix. Set it explicitly so it is not a mystery later:

```
NEXT_PUBLIC_APP_NAME=Valkyrie
```

---

## 5. UploadThing

**Where:** [uploadthing.com](https://uploadthing.com) dashboard → your app →
**Settings**.

Add `https://www.valkyrie-eg.com` to the allowed origins / app URL if your plan
enforces them. `UPLOADTHING_TOKEN` itself is not domain-bound, so this may be a
no-op — check rather than assume.

**Verify:** upload a product image from the live admin. A failure here is
admin-only and will not be visible on the storefront until a product is missing
its photo.

---

## 6. DNS and the canonical host

At your registrar / DNS provider:

1. Both `valkyrie-eg.com` and `www.valkyrie-eg.com` should resolve.
2. **One redirects to the other, permanently (301).** Serving identical content
   on both is duplicate content, and it splits whatever ranking signal the site
   accumulates across two hosts. Vercel does this automatically once you mark
   one domain as primary in **Project → Settings → Domains**.
3. HTTPS everywhere, `http://` 301s to `https://`.

Confirm which one won, and make sure it is the same one in
`NEXT_PUBLIC_APP_URL`. If DNS makes `www` canonical and the env var says bare,
every canonical tag you emit points at a URL that immediately redirects.

---

## 7. Google Search Console

**Where:** [search.google.com/search-console](https://search.google.com/search-console)

1. **Add property.** Prefer the **Domain** property (`valkyrie-eg.com`) over
   the URL-prefix one — it covers both hosts and both schemes at once. It
   requires a `TXT` record at your DNS provider.
2. **Submit the sitemap:** `sitemap.xml` — the full URL is
   `https://www.valkyrie-eg.com/sitemap.xml`.
3. **Request indexing** for the homepage via URL Inspection to start the crawl
   rather than waiting.

Expect the sitemap to report **30 URLs** at current catalogue size: 17 static
routes, 5 categories, 8 products. It grows on its own as products are added —
`sitemap.ts` reads the same cached slug fetchers that prerender the product
pages, so it cannot list a URL that does not build.

**Do not expect results quickly.** A new domain takes days to weeks to index.

### Analytics

There is **no analytics of any kind installed** — no GA4, no Meta Pixel, no
Vercel Analytics. If you want to know where launch traffic comes from, that is
a code change and it needs to happen _before_ the traffic, not after; there is
no backfill.

---

## 8. What is already done in code

For completeness, so nobody re-does it. All of this shipped on 2026-09-11 and
needs no console work:

- `favicon.ico` (16/32/48), `icon.png` (512), `apple-icon.png` (180) — all
  generated from `public/logo/Val-full-logo.png`, replacing a placeholder black
  circle with a white triangle that was never the brand.
- `public/icons/icon-{192,512}.png` and `maskable-512.png` for the manifest.
- `opengraph-image.png` / `twitter-image.png` (1200×630) — the card shown when
  a link is pasted into WhatsApp, Instagram, Messenger or X.
- `manifest.webmanifest` — "Add to Home Screen" gives a branded launcher icon.
- `robots.txt` — allows the storefront, disallows admin, API, account, cart,
  checkout, `/search` and the auth routes.
- `sitemap.xml` — static routes plus every active product and category.
- `metadataBase`, Open Graph and Twitter card defaults, and
  `max-image-preview: large` on the root layout.

Regenerate the images with `pnpm icons` if the logo ever changes — they are
derived artefacts and there are eight of them, which is too many to keep in
sync by hand.

---

## Verification checklist

Run these against the live domain once the changes are deployed. Each one
fails silently if skipped, which is the whole reason for the list.

| #   | Check                                                   | Pass                                                      |
| --- | ------------------------------------------------------- | --------------------------------------------------------- |
| 1   | `https://www.valkyrie-eg.com/robots.txt`                | `Host:` and `Sitemap:` both say `www.valkyrie-eg.com`     |
| 2   | `https://www.valkyrie-eg.com/sitemap.xml`               | 30 URLs, all on the new domain                            |
| 3   | `https://www.valkyrie-eg.com/manifest.webmanifest`      | JSON loads, three icons resolve                           |
| 4   | Paste the homepage URL into a WhatsApp chat to yourself | Winged-V card with "VALKYRIE" renders                     |
| 5   | Browser tab                                             | Silver winged mark, not a triangle                        |
| 6   | Sign in with Google                                     | Returns to the site signed in, no `redirect_uri_mismatch` |
| 7   | Sign in with email **and** with phone                   | Both work — see `docs/POST-LAUNCH.md` §4                  |
| 8   | A real order, card and COD                              | Order reaches `paid`, confirmation email arrives          |
| 9   | That email's links                                      | Point at `valkyrie-eg.com`, not localhost or Vercel       |
| 10  | Stripe → Webhooks → your endpoint                       | Recent deliveries all `200`                               |
| 11  | `UPSTASH_*` set in production                           | Rate limits active — `docs/POST-LAUNCH.md` §1             |

Items 8 and 9 are the ones worth doing with a real card for a real amount you
then refund. Everything upstream of payment can look perfectly healthy while
the webhook is misconfigured.
