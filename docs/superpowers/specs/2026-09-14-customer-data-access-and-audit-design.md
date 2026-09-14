# Customer-data access and audit foundation

## Status and authority

This design records the brand-owner decisions approved after
`docs/PRELAUNCH-HANDOFF.md`. Where it conflicts with older documentation, this
document is newer and controls this phase.

## Goal

Give launch staff only the customer information needed for their current job,
make sensitive access deliberate, and leave a useful audit trail without an
OTP prompt or a general-purpose permissions framework.

## Launch roles

### Worker

- A worker is a fulfilment operator at launch. Every worker may handle every
  active order; assignment and specialist worker roles come later.
- The ordinary orders list shows customer name but not email, phone, or
  address.
- Opening an individual order is audited.
- Shipping address and delivery phone remain hidden until the worker presses
  **Show delivery details**. The reveal is audited with the automatic reason
  `order_fulfillment`; it requires no OTP and no typed reason.
- Delivered, cancelled, and refunded orders are historical. A worker cannot
  browse them directly. Historical support begins with the customer providing
  their complete email address.
- The worker must enter the exact email, affirm an unchecked statement that
  the customer requested support and supplied the email, and select one of
  `order_status`, `delivery_problem`, `return_exchange`, or `other`. `other`
  requires a short note. The confirmation resets after every lookup attempt.
- There is no partial search, suggestion list, or general customer directory
  for workers. Every lookup attempt is audited without storing the typed email;
  a successful match issues a 30-minute audit-id grant tied to that worker and
  customer. Every historical order opened is audited, and delivery details
  remain behind the reveal action.

### Admin

- An admin may search the customer directory by name or email and see the
  existing non-sensitive account/order summary.
- Phone and saved shipping addresses are unavailable in the default response.
  An admin may reveal them after choosing `customer_support`,
  `delivery_issue`, `account_correction`, or `other`; `other` requires a short
  note. The reveal is audited before data is returned.
- Birthday and billing address are not exposed in the staff UI.
- Admins may use the order export control. The export is recorded before the
  browser creates the file.

### Super admin

- A super admin has the admin data permissions plus existing role-management
  authority.
- Super-admin access is audited too; ownership does not bypass the trail.

### Future media buyer

`media_buyer` is a future role, not a launch schema value. Its eventual routes
must be attribution-scoped and separate from the customer directory. This
phase must not add a dormant role or a generic policy engine for it.

## Audit visibility

- Super admins may review every worker/admin/super-admin access event.
- Admins may review their own events and worker events, but not peer admins or
  super admins.
- Workers may review only their own events.
- Staff events appear on the selected staff account in the admin customer
  detail UI. Workers also receive a small self-history view.

## Audit records and retention

Audit rows are append-only and contain:

- actor user id, name/email snapshot, and role snapshot;
- customer subject id and/or order id where applicable;
- action and field group;
- reason code, optional reason note, and customer-request confirmation;
- creation time.

The record never stores the revealed phone, address, birthday, or exported CSV.
Protected data is returned only after the audit insert succeeds. Audit rows are
retained for 12 months; expired rows are removed as part of recording a new
event so launch does not need a scheduler.

## Exports

Workers do not receive the order-export control. Admin and super-admin exports
must record an audit event successfully before the existing browser-side CSV
is produced. Worker order-list responses do not contain email, so the browser
cannot export that hidden field from the normal API response.

## Data minimisation

- Customer queries use explicit projections. They must not return Better Auth
  phone/birthday columns, order address snapshots, notes, or unused joined
  product rows by accident.
- Default order detail returns no shipping or billing address. Shipping data
  has its own audited reveal operation. Billing address is not returned by any
  launch staff route.
- Card number, CVV, and other payment credentials are never stored by
  Valkyrie; the later OPay integration owns payment credentials.

## Later loyalty decision

Birthday remains available to server-side loyalty logic but out of staff UI.
The later birthday offer is one 20% redemption per normalized, verified phone
per rolling 365 days, regardless of birthday edits. It is not part of this
implementation phase.

## Explicit non-goals

- No routine OTP prompts.
- No order-assignment workflow.
- No role/capability DSL or generic ABAC engine.
- No `media_buyer` enum value or lead-attribution tables.
- No OPay, Resend, birthday-offer, inventory-approval, or refund-authorization
  implementation.
- Do not run `pnpm db:migrate` against the current development database.
