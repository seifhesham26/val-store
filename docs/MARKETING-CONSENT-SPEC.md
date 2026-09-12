# 📧 Marketing Consent & Unsubscribe — Implementation Spec

> **Status**: Not yet implemented. This spec defines what needs to be built.

---

## 1. Database Schema Changes

### `user` table additions

```sql
ALTER TABLE "user"
  ADD COLUMN "marketing_consent" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN "marketing_consent_date" TIMESTAMP,
  ADD COLUMN "marketing_consent_ip" TEXT;
```

### `newsletter_subscriber` table additions

```sql
ALTER TABLE "newsletter_subscriber"
  ADD COLUMN "consented_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  ADD COLUMN "unsubscribed_at" TIMESTAMP,
  ADD COLUMN "unsubscribe_token" TEXT UNIQUE;
```

**Why timestamps & IP?**
Egypt's PDPL (Law 151/2020) requires the data controller to prove consent was given.
Storing when and from where consent was granted provides an audit trail.

---

## 2. Consent Capture Points

### Signup Form (already has checkbox — needs backend wiring)

- The `SignupForm.tsx` now has a `marketingConsent` boolean in form state
- Wire it through the signup mutation → save to `user.marketing_consent`
- Record `marketing_consent_date` and `marketing_consent_ip` at the same time

### Newsletter Section (already captures email)

- The newsletter subscribe mutation should auto-set `consented_at` = now
- Generate a unique `unsubscribe_token` per subscriber for one-click unsub

---

## 3. Unsubscribe Mechanisms (3 required methods)

### Method 1: One-Click Email Unsubscribe Link

Every marketing email MUST include:

```
List-Unsubscribe: <https://www.valkyrie-eg.com/api/unsubscribe?token=XXXXX>
List-Unsubscribe-Post: List-Unsubscribe=One-Click
```

**API endpoint**: `POST /api/unsubscribe?token=XXXXX`

- Validates token against `newsletter_subscriber.unsubscribe_token`
- Sets `unsubscribed_at` = now
- Returns a simple "You've been unsubscribed" confirmation page
- Also supports `GET` for users who click the link directly

**Also in the email body**:

- A visible "Unsubscribe" link in the email footer
- Links to the same endpoint

### Method 2: Account Settings Toggle

Add to `/account` settings page:

- "Marketing emails" toggle (on/off)
- When toggled off: sets `user.marketing_consent = false`, clears `marketing_consent_date`
- When toggled on: sets `user.marketing_consent = true`, records new date/IP

### Method 3: Footer Link

Add to the site footer:

- "Email Preferences" link → routes to `/account/preferences` (if logged in)
  or `/unsubscribe` (public page where they can enter their email to unsub)

---

## 4. Marketing Email Requirements

Every marketing/promotional email sent MUST:

1. Include the sender's identity: "Valkyrie — www.valkyrie-eg.com"
2. Include a physical address (Egyptian registered address)
3. Include an unsubscribe link (one-click, works without login)
4. Include `List-Unsubscribe` and `List-Unsubscribe-Post` headers
5. Only be sent to users who have `marketing_consent = true` OR active newsletter subscribers without `unsubscribed_at`
6. NEVER send to users who have withdrawn consent

### Transactional vs Marketing

**Transactional emails** (order confirmation, password reset, email verification) do NOT require marketing consent — they are necessary to fulfill the contract.

**Marketing emails** (promotions, new arrivals, sales, birthday offers) DO require explicit opt-in consent.

---

## 5. Multi-Channel Marketing (Future)

If expanding beyond email:

| Channel  | Consent Field           | Opt-in Point      | Opt-out Method          |
| -------- | ----------------------- | ----------------- | ----------------------- |
| Email    | `marketing_consent`     | Signup checkbox   | Email link / settings   |
| SMS      | `sms_marketing_consent` | Separate checkbox | Reply STOP / settings   |
| WhatsApp | `whatsapp_consent`      | Separate checkbox | Message STOP / settings |

Each channel MUST have its own independent consent — opting in to email does NOT imply consent for SMS/WhatsApp.

---

## 6. Double Opt-in (Recommended)

For newsletter subscriptions, consider double opt-in:

1. User enters email → we save with `confirmed = false`
2. Send confirmation email: "Click to confirm your subscription"
3. User clicks → we set `confirmed = true`, `consented_at` = now
4. Only send marketing to `confirmed = true` subscribers

Double opt-in is not legally required in Egypt but:

- Reduces spam complaints
- Improves deliverability
- Provides stronger proof of consent

---

## 7. Data to Query Before Sending Marketing

```sql
-- Newsletter subscribers who can receive marketing
SELECT email FROM newsletter_subscriber
WHERE unsubscribed_at IS NULL;

-- Registered users who opted in to marketing
SELECT email FROM "user"
WHERE marketing_consent = TRUE;

-- UNION both, deduplicate by email
```

---

## 8. Compliance Checklist

- [ ] `marketing_consent` field on user table with timestamp
- [ ] Newsletter table tracks `consented_at` and `unsubscribed_at`
- [ ] One-click unsubscribe API endpoint (`/api/unsubscribe`)
- [ ] `List-Unsubscribe` headers on all marketing emails
- [ ] Account settings page with marketing toggle
- [ ] Footer link to email preferences / unsubscribe
- [ ] Visible unsubscribe link in every marketing email body
- [ ] Marketing emails only sent to consented users
- [ ] Signup form marketing checkbox wired to backend
- [ ] Audit trail: consent date + IP stored
