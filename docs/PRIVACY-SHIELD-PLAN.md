# 🛡️ Operation Privacy Shield — The Valkyrie Data Armor Plan ⚔️

## Summary

The store collects personal data (email, phone, name, birthday, addresses) across several forms but never tells users **how** it will be used or asks for **explicit consent** before collection. The privacy policy ([privacy.md](file:///c:/dev/val-store/content/legal/privacy.md)) is actually well-written and covers most data usage, but it has unfilled placeholders and doesn't connect to the forms themselves. Additionally, there's no marketing opt-in flow and no unsubscribe mechanism.

This plan covers:

1. **Form consent disclosures** — tell users how data is used before they submit
2. **Marketing opt-in** — explicit checkbox for advertising/promotional emails
3. **Unsubscribe mechanism** — ability to opt out of marketing
4. **Privacy policy updates** — fill placeholders, add marketing and cross-border detail
5. **Cross-border transfer disclosures** — NeonDB (EU), Stripe/Vercel/etc (US/EU)

---

## Current State of the Privacy Policy

The [privacy.md](file:///c:/dev/val-store/content/legal/privacy.md) **already covers**:

- ✅ What data is collected (name, email, phone, birthday, addresses, orders, reviews)
- ✅ Why it's held (contract, legal obligation, consent for marketing, legitimate interest)
- ✅ Cookies (essential only, no trackers)
- ✅ Third-party providers (Stripe, Resend, Neon, Vercel, UploadThing, Upstash)
- ✅ Data retention periods
- ✅ User rights (access, correction, deletion, objection)
- ✅ Cross-border transfers section (mentions EU/US processing)

**Gaps found**:

- ❌ Placeholder `[REGISTERED BUSINESS NAME]`, `[REGISTERED ADDRESS]`, etc. — **you need to fill these**
- ❌ Placeholder `[PRIVACY CONTACT EMAIL]` — should be a real email
- ❌ Placeholder `[CROSS-BORDER TRANSFER STATUS]` — needs actual status
- ❌ No mention of **marketing channels** (email, SMS, WhatsApp) or how ads are sent
- ❌ No specifics on NeonDB hosting region or data processing agreements
- ❌ Terms of Sale also has placeholders: `[REGISTERED BUSINESS NAME]`, `[VAT STATEMENT]`, etc.

> [!IMPORTANT]
> The privacy policy placeholders (`[REGISTERED BUSINESS NAME]`, `[COMMERCIAL REGISTER NUMBER]`, `[TAX REGISTRATION NUMBER]`, `[PRIVACY CONTACT EMAIL]`, `[CROSS-BORDER TRANSFER STATUS]`) and the terms placeholders (`[SUPPORT EMAIL]`, `[SUPPORT PHONE]`, `[VAT STATEMENT]`) must be filled with your real business details. I cannot fill these — you need to provide the values.

---

## Proposed Changes

### Phase 1: Form Consent Disclosures (Code Changes)

Add a short consent line with links to Privacy Policy and Terms above/below the submit button on every form that collects personal data.

#### [MODIFY] [SignupForm.tsx](file:///c:/dev/val-store/src/components/auth/signup/SignupForm.tsx)

Add before the "Create account" button (line ~263):

- A **marketing opt-in checkbox** (unchecked by default): _"Send me exclusive offers, new arrivals and updates via email"_
- A consent disclosure: _"By creating an account, you agree to our [Terms of Sale](/terms) and [Privacy Policy](/privacy). We use your data to manage your account, process orders, and — if you opt in — send marketing."_
- Add `marketingConsent: boolean` to form state and pass it to the signup mutation

#### [MODIFY] [NewsletterSection.tsx](file:///c:/dev/val-store/src/components/home/NewsletterSection.tsx)

Add below the email input (line ~73):

- Disclosure text: _"By subscribing, you agree to receive marketing emails from Valkyrie. You can unsubscribe at any time. See our [Privacy Policy](/privacy)."_

#### [MODIFY] [CheckoutForm.tsx](file:///c:/dev/val-store/src/components/checkout/CheckoutForm.tsx)

Add before the "Complete Order" button (line ~204):

- Disclosure: _"By placing this order, you agree to our [Terms of Sale](/terms). Your data is used to process and deliver your order. See our [Privacy Policy](/privacy)."_

#### [MODIFY] [AddressFormDialog.tsx](file:///c:/dev/val-store/src/components/account/addresses/AddressFormDialog.tsx)

Add before the action buttons (line ~103):

- Small disclosure: _"Your address and phone number are used for order delivery. See our [Privacy Policy](/privacy)."_

---

### Phase 2: Marketing Opt-in & Unsubscribe (Needs Design — Not Implemented Yet)

> [!WARNING]
> This is the part that **does not exist yet**. Creating an MD spec for future implementation.

What needs to be built:

1. **Marketing consent field on user/customer record**
   - Add `marketingConsent: boolean` and `marketingConsentDate: timestamp` to the customer/user schema
   - Capture consent at signup (from the new checkbox)
   - Store consent timestamp for audit trail

2. **Unsubscribe mechanism** — three methods:
   - **Email link**: Every marketing email must have an unsubscribe link that one-click opts out
   - **Account settings**: A toggle in `/account` settings to manage marketing preferences
   - **Footer link**: An "Unsubscribe" or "Email Preferences" link in the site footer

3. **Newsletter subscriber consent**
   - The newsletter table should track `consentedAt` timestamp
   - Every newsletter email needs an unsubscribe link
   - Consider double opt-in (send confirmation email before adding to list)

4. **Marketing channels to support** (for future):
   - Email (via Resend)
   - SMS (if you plan to use phone numbers for marketing)
   - WhatsApp (common in Egypt)
   - Each channel needs its own consent toggle

---

### Phase 3: Privacy Policy & Cross-Border Transfer Updates

#### [MODIFY] [privacy.md](file:///c:/dev/val-store/content/legal/privacy.md)

Updates needed:

1. **Fill placeholders** (you provide the values):
   - `[REGISTERED BUSINESS NAME]`
   - `[REGISTERED ADDRESS]`
   - `[COMMERCIAL REGISTER NUMBER]`
   - `[TAX REGISTRATION NUMBER]`
   - `[PRIVACY CONTACT EMAIL]` → e.g. `privacy@valkyrie-eg.com`

2. **Expand marketing section** (line 61-63) to specify:
   - Marketing channels: email, and potentially SMS/WhatsApp
   - That consent is opt-in, not opt-out
   - How to unsubscribe (link in email, account settings, or contacting support)

3. **Expand cross-border transfer section** (lines 88-96) with specifics:
   - **Neon (database)**: Data hosted in EU (AWS `eu-central-1` Frankfurt, or whichever region you chose). All customer data, orders, addresses, etc. are stored here.
   - **Stripe (payments)**: US/EU. Only payment references, not card numbers.
   - **Resend (email)**: US. Receives email addresses and message content for transactional and marketing emails.
   - **Vercel (hosting)**: US/EU edge network. Serves the site, processes requests.
   - **UploadThing (images)**: US. Product images and profile pictures.
   - **Upstash (rate limiting)**: EU. IP addresses for rate limiting.
   - Replace `[CROSS-BORDER TRANSFER STATUS]` with actual status — under Egypt's PDPL, cross-border transfers require either adequate protection or approval from the Personal Data Protection Centre
   - Note: Egypt's PDPL recognizes EU as having adequate data protection; US transfers typically need additional safeguards (DPAs, SCCs)

4. **Update effectiveDate** after changes

#### [MODIFY] [terms.md](file:///c:/dev/val-store/content/legal/terms.md)

Fill placeholders (you provide values):

- `[REGISTERED BUSINESS NAME]`, `[REGISTERED ADDRESS]`
- `[COMMERCIAL REGISTER NUMBER]`
- `[SUPPORT EMAIL]` → `support@valkyrie-eg.com`
- `[SUPPORT PHONE]` → your Egyptian phone number
- `[VAT STATEMENT]` → e.g. "Prices include VAT" or "Prices exclude VAT at 14%"

---

## Open Questions

## 📝 Fill These In Later

Come back and replace each placeholder when you have the details. Copy-paste the value in place of the bracketed text.

### In [privacy.md](file:///c:/dev/val-store/content/legal/privacy.md)

| Placeholder                      | What to put                                                                  | Status |
| -------------------------------- | ---------------------------------------------------------------------------- | ------ |
| `[REGISTERED BUSINESS NAME]`     | Your official company name from the Commercial Register                      | ⬜     |
| `[REGISTERED ADDRESS]`           | Registered office address                                                    | ⬜     |
| `[COMMERCIAL REGISTER NUMBER]`   | السجل التجاري number                                                         | ⬜     |
| `[TAX REGISTRATION NUMBER]`      | البطاقة الضريبية number                                                      | ⬜     |
| `[PRIVACY CONTACT EMAIL]`        | e.g. `privacy@valkyrie-eg.com`                                               | ⬜     |
| `[CROSS-BORDER TRANSFER STATUS]` | Status of PDPC approval for cross-border transfers, or "Application pending" | ⬜     |

### In [terms.md](file:///c:/dev/val-store/content/legal/terms.md)

| Placeholder                    | What to put                                              | Status |
| ------------------------------ | -------------------------------------------------------- | ------ |
| `[REGISTERED BUSINESS NAME]`   | Same as above                                            | ⬜     |
| `[REGISTERED ADDRESS]`         | Same as above                                            | ⬜     |
| `[COMMERCIAL REGISTER NUMBER]` | Same as above                                            | ⬜     |
| `[TAX REGISTRATION NUMBER]`    | Same as above                                            | ⬜     |
| `[SUPPORT PHONE]`              | Your Egyptian phone number for customers                 | ⬜     |
| `[VAT STATEMENT]`              | e.g. "Prices include VAT at 14%" or "Prices exclude VAT" | ⬜     |

> [!TIP]
> Once you fill these in, run the DB seed script to push the updated legal pages to the database (or edit them directly from the admin panel).

---

## Verification Plan

### Automated Tests

- Verify forms render consent text via existing component tests

### Manual Verification

- Visual check: all forms show consent disclosure before submit
- Signup form: marketing checkbox defaults to unchecked
- Newsletter: disclosure text visible
- Checkout: terms agreement visible
- Privacy policy: no remaining `[PLACEHOLDER]` text after you provide values
