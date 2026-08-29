import {
  LegalBody,
  LegalContact,
  LegalList,
  LegalNote,
  LegalTable,
  type LegalSection,
} from "@/components/legal/LegalDocument";

const PRIVACY_EMAIL = "privacy@valstore.com";

const sections: LegalSection[] = [
  {
    id: "overview",
    title: "Overview",
    content: (
      <>
        <p>
          Valkyrie is a premium streetwear store operating in Egypt. This policy
          explains what personal information we collect when you browse, create
          an account, or place an order, why we collect it, who we share it
          with, and the choices you have.
        </p>
        <p>
          It applies to this website and to the emails we send you. It does not
          apply to third-party sites we link to, which have their own policies.
        </p>
      </>
    ),
  },
  {
    id: "information-we-collect",
    title: "Information we collect",
    content: (
      <>
        <p>
          <span className="text-white">Information you give us.</span> Most of
          what we hold is information you enter yourself:
        </p>
        <LegalList
          items={[
            "Account details — name, email address, mobile number, and optionally your date of birth. Your mobile number can also be used to sign in.",
            "Delivery details — recipient name, street address, city, governorate, and contact number for each address you save.",
            "Order details — the items, sizes, colours, and quantities you buy, plus any coupon you apply.",
            "Content you submit — product reviews, ratings, wishlist items, newsletter sign-ups, and messages you send our support team.",
          ]}
        />
        <p>
          <span className="text-white">
            Information collected automatically.
          </span>{" "}
          When you use the site we record technical information such as your IP
          address, browser and device type, pages viewed, and the contents of
          your cart. This is what keeps you signed in, keeps your cart in sync
          across devices, and lets us detect abuse.
        </p>
        <p>
          <span className="text-white">Information from third parties.</span> If
          you sign in with Google or Facebook, we receive your name, email
          address, and profile picture from that provider — never your password.
        </p>
      </>
    ),
  },
  {
    id: "how-we-use-it",
    title: "How we use your information",
    content: (
      <>
        <LegalList
          items={[
            "Process, fulfil, and deliver your orders, and handle returns or exchanges.",
            "Send transactional messages — order confirmations, payment receipts, shipping and delivery updates.",
            "Operate your account: authentication, saved addresses, wishlist, and order history.",
            "Provide customer support and respond to your questions.",
            "Send marketing emails about new drops and offers, only if you opted in. Every one has an unsubscribe link.",
            "Detect and prevent fraud, abuse, and automated attacks — including rate limiting sign-in attempts.",
            "Understand which products and pages perform well so we can improve the store.",
          ]}
        />
        <LegalNote>
          We do not sell your personal information, and we do not share it with
          advertisers for their own marketing.
        </LegalNote>
      </>
    ),
  },
  {
    id: "payments",
    title: "Payment information",
    content: (
      <>
        <p>
          Card payments are handled by{" "}
          <span className="text-white">Stripe</span>. You enter your card
          details on Stripe&apos;s hosted checkout page — they never reach our
          servers, and we never store your full card number, expiry date, or
          security code. We keep only the payment reference, the amount, the
          currency, and whether the payment succeeded.
        </p>
        <p>
          If you choose <span className="text-white">Cash on Delivery</span>, no
          card details are collected at all. Your name, address, and phone
          number are shared with the courier so they can complete the delivery
          and collect payment.
        </p>
      </>
    ),
  },
  {
    id: "cookies",
    title: "Cookies and local storage",
    content: (
      <>
        <p>
          We use cookies and browser storage for a small number of purposes:
        </p>
        <LegalList
          items={[
            "Essential — keeping you signed in, protecting forms against cross-site request forgery, and remembering your cart between visits.",
            "Preferences — remembering choices such as your selected size or theme.",
            "Analytics — aggregate, non-identifying measurement of how the store is used.",
          ]}
        />
        <p>
          Essential cookies are required for the site to work. You can clear or
          block cookies in your browser settings, but signing in and checking
          out will stop working if you block the essential ones.
        </p>
      </>
    ),
  },
  {
    id: "sharing",
    title: "Who we share information with",
    content: (
      <>
        <p>
          We share the minimum necessary with service providers who work on our
          behalf and are bound to use the data only for the services they
          provide to us:
        </p>
        <LegalTable
          caption="Service providers"
          rows={[
            {
              label: "Payment processing",
              value: "Stripe — card authorisation, capture, and refunds.",
            },
            {
              label: "Delivery",
              value:
                "Courier partners — recipient name, address, and phone number.",
            },
            {
              label: "Email delivery",
              value: "Resend — sending order confirmations and account emails.",
            },
            {
              label: "Media hosting",
              value: "UploadThing — storing product and review images.",
            },
            {
              label: "Abuse prevention",
              value: "Upstash — rate limiting requests by IP address.",
            },
          ]}
        />
        <p>
          We may also disclose information where we are legally required to do
          so, to enforce our Terms of Service, or to protect the rights and
          safety of our customers and staff. If Valkyrie is ever involved in a
          merger or acquisition, your information may transfer as part of that
          business, subject to this policy.
        </p>
      </>
    ),
  },
  {
    id: "retention",
    title: "How long we keep it",
    content: (
      <>
        <p>
          We keep personal information only as long as it serves the purpose it
          was collected for, or as long as the law requires.
        </p>
        <LegalTable
          rows={[
            {
              label: "Account information",
              value: "Until you ask us to delete your account.",
            },
            {
              label: "Order and payment records",
              value:
                "Retained for accounting, tax, and warranty purposes after the order completes.",
            },
            {
              label: "Marketing preferences",
              value:
                "Until you unsubscribe, plus a record of the opt-out itself.",
            },
            {
              label: "Support conversations",
              value:
                "Kept while the issue is open and for a reasonable period after.",
            },
          ]}
        />
      </>
    ),
  },
  {
    id: "your-rights",
    title: "Your rights and choices",
    content: (
      <>
        <p>You can ask us at any time to:</p>
        <LegalList
          items={[
            "Access the personal information we hold about you.",
            "Correct anything that is inaccurate or out of date — most of this you can edit yourself under Account settings.",
            "Delete your account and the personal data attached to it, except records we must keep for legal or accounting reasons.",
            "Stop sending you marketing email, either via the unsubscribe link or by contacting us.",
            "Object to or restrict a particular use of your information.",
          ]}
        />
        <p>
          Email <span className="text-white">{PRIVACY_EMAIL}</span> and we will
          respond within a reasonable time. We may ask you to verify your
          identity before acting on a request.
        </p>
      </>
    ),
  },
  {
    id: "security",
    title: "How we protect your information",
    content: (
      <>
        <p>
          All traffic to and from this site is encrypted in transit with TLS.
          Passwords are stored hashed, never in plain text, and card data never
          touches our infrastructure. Access to customer records is restricted
          to staff who need it to do their job, and sensitive actions in the
          admin area are logged.
        </p>
        <p>
          No system is perfectly secure. If a breach ever affects your personal
          information, we will notify you and the relevant authorities as
          required.
        </p>
      </>
    ),
  },
  {
    id: "children",
    title: "Children",
    content: (
      <p>
        This store is intended for adults. We do not knowingly collect personal
        information from anyone under 18. If you believe a child has given us
        their information, contact us and we will delete it.
      </p>
    ),
  },
  {
    id: "transfers",
    title: "International transfers",
    content: (
      <p>
        Some of the service providers listed above process data on servers
        outside Egypt. Where that happens, we rely on providers that offer
        recognised safeguards and contractual commitments to protect your
        information to a comparable standard.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes to this policy",
    content: (
      <p>
        We may update this policy as the store changes or the law requires. The
        &ldquo;last updated&rdquo; date at the top always reflects the current
        version. If a change materially affects how we use your information, we
        will let you know before it takes effect.
      </p>
    ),
  },
];

export function PrivacyContent() {
  return (
    <>
      <LegalBody sections={sections} />
      <LegalContact
        title="Questions about your data?"
        description="Ask us anything about this policy, or make a request about your personal information."
        email={PRIVACY_EMAIL}
      />
    </>
  );
}
