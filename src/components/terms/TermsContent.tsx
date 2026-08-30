import Link from "next/link";
import {
  LegalBody,
  LegalContact,
  LegalList,
  LegalNote,
  type LegalSection,
} from "@/components/legal/LegalDocument";

const LEGAL_EMAIL = "legal@valstore.com";

const sections: LegalSection[] = [
  {
    id: "agreement",
    title: "Agreement to these terms",
    content: (
      <>
        <p>
          These Terms of Service govern your use of the Valkyrie website and any
          order you place through it. By browsing the store, creating an
          account, or checking out, you agree to be bound by them. If you do not
          agree, please stop using the site.
        </p>
        <p>
          Our{" "}
          <Link
            href="/privacy"
            className="text-white underline decoration-white/30 underline-offset-4 transition-colors hover:decoration-white"
          >
            Privacy Policy
          </Link>{" "}
          forms part of this agreement and explains how we handle your personal
          information.
        </p>
      </>
    ),
  },
  {
    id: "eligibility",
    title: "Eligibility and your account",
    content: (
      <>
        <p>
          You must be at least 18 years old, or have the consent of a parent or
          guardian, to place an order. When you create an account you agree to:
        </p>
        <LegalList
          items={[
            "Provide accurate and complete information, including a working mobile number and delivery address.",
            "Keep your password confidential and not share your account with anyone else.",
            "Tell us promptly if you believe someone else has accessed your account.",
          ]}
        />
        <p>
          You are responsible for everything that happens under your account. We
          may suspend or close an account that is used fraudulently or in breach
          of these terms.
        </p>
      </>
    ),
  },
  {
    id: "acceptable-use",
    title: "Acceptable use",
    content: (
      <>
        <p>You agree not to:</p>
        <LegalList
          items={[
            "Use the site for any unlawful purpose or in breach of anyone else's rights.",
            "Attempt to gain unauthorised access to our systems, accounts, or data.",
            "Upload or transmit malicious code, or interfere with the operation of the site.",
            "Scrape, harvest, or bulk-download our content, product data, or images without permission.",
            "Resell products bought from us as new or authorised stock without our written agreement.",
            "Post reviews or content that is false, abusive, defamatory, or infringes someone else's rights.",
          ]}
        />
      </>
    ),
  },
  {
    id: "products-pricing",
    title: "Products, pricing, and availability",
    content: (
      <>
        <p>
          We work to describe our products accurately, but colours can vary
          between screens and measurements are approximate. Product images are
          illustrative.
        </p>
        <p>
          All prices are shown in Egyptian Pounds (EGP) and include applicable
          taxes unless stated otherwise at checkout. Stock is limited, and an
          item shown as available may sell out before your order is confirmed.
        </p>
        <LegalNote>
          If a product is listed at an obviously incorrect price, or is
          unavailable after you order, we may cancel the order and refund you in
          full. We will always contact you before doing so.
        </LegalNote>
      </>
    ),
  },
  {
    id: "orders",
    title: "Orders and acceptance",
    content: (
      <>
        <p>
          Placing an order is an offer to buy. Your order is confirmed only when
          we send you an order confirmation email with your order number. Until
          then, no contract exists between us.
        </p>
        <p>We may refuse or cancel an order where:</p>
        <LegalList
          items={[
            "The item is out of stock or has been mispriced.",
            "We cannot verify the delivery address or contact number.",
            "We suspect fraud, abuse, or a breach of these terms.",
            "Previous cash-on-delivery orders to the same address were repeatedly refused.",
          ]}
        />
      </>
    ),
  },
  {
    id: "payment",
    title: "Payment",
    content: (
      <>
        <p>We accept two payment methods:</p>
        <LegalList
          items={[
            "Card payment — processed securely by Stripe. Your card details are entered on Stripe's checkout page and are never stored by us. Payment is taken when the order is placed.",
            "Cash on delivery — you pay the courier in cash when your order arrives. Please have the exact amount ready.",
          ]}
        />
        <p>
          By paying, you confirm that you are authorised to use the payment
          method provided. If a cash-on-delivery order is refused at the door
          without a valid reason, we may decline future cash-on-delivery orders
          from that address.
        </p>
      </>
    ),
  },
  {
    id: "discounts",
    title: "Discount codes and promotions",
    content: (
      <>
        <p>
          Discount codes are subject to their own conditions — a minimum order
          value, an expiry date, a usage limit, or a restriction to particular
          products.
        </p>
        <LegalList
          items={[
            "Only one code can be applied per order unless stated otherwise.",
            "Codes have no cash value and cannot be exchanged or refunded.",
            "We may withdraw or void a code that is being misused or was issued in error.",
            "If you return part of an order, the refund reflects the discounted price you actually paid.",
          ]}
        />
      </>
    ),
  },
  {
    id: "shipping",
    title: "Shipping and delivery",
    content: (
      <>
        <p>
          Delivery times shown at checkout and on our{" "}
          <Link
            href="/shipping"
            className="text-white underline decoration-white/30 underline-offset-4 transition-colors hover:decoration-white"
          >
            Shipping page
          </Link>{" "}
          are estimates, not guarantees. Risk in the goods passes to you on
          delivery.
        </p>
        <p>
          Please make sure your address and phone number are correct. Couriers
          typically attempt delivery more than once; if they cannot reach you,
          the order may be returned to us and re-delivery charges may apply. We
          are not responsible for delays caused by couriers, weather, customs,
          or other events outside our control.
        </p>
      </>
    ),
  },
  {
    id: "returns",
    title: "Returns, exchanges, and refunds",
    content: (
      <>
        <p>
          Most items can be returned within 30 days of delivery, unworn,
          unwashed, and with their original tags attached. Full conditions and
          the step-by-step process are on our{" "}
          <Link
            href="/returns"
            className="text-white underline decoration-white/30 underline-offset-4 transition-colors hover:decoration-white"
          >
            Returns &amp; Exchanges page
          </Link>
          .
        </p>
        <p>
          Refunds are issued to the original payment method. Card refunds are
          returned through Stripe and may take several business days to appear
          on your statement; cash-on-delivery orders are refunded by an agreed
          method. Nothing here limits your statutory rights as a consumer under
          Egyptian law, including for goods that are faulty or not as described.
        </p>
      </>
    ),
  },
  {
    id: "reviews",
    title: "Reviews and user content",
    content: (
      <>
        <p>
          When you post a review, photo, or other content, you keep ownership of
          it but grant Valkyrie a non-exclusive, royalty-free licence to
          display, reproduce, and adapt it in connection with the store and our
          marketing.
        </p>
        <p>
          You confirm that the content is your own, is honest, and does not
          infringe anyone&apos;s rights. We may edit or remove content that
          breaches these terms, and we do not have to publish everything
          submitted.
        </p>
      </>
    ),
  },
  {
    id: "intellectual-property",
    title: "Intellectual property",
    content: (
      <p>
        The Valkyrie name, logo, designs, product photography, copy, and the
        design and code of this website are owned by Valkyrie or licensed to us,
        and are protected by copyright and trade mark law. You may view and
        share our pages for personal, non-commercial use. Any other use —
        copying, reproduction, or commercial exploitation — requires our written
        permission.
      </p>
    ),
  },
  {
    id: "availability",
    title: "Site availability",
    content: (
      <p>
        We aim to keep the store available and accurate, but we do not guarantee
        uninterrupted access. We may suspend, withdraw, or change any part of
        the site for maintenance or business reasons, usually without notice.
      </p>
    ),
  },
  {
    id: "liability",
    title: "Limitation of liability",
    content: (
      <>
        <p>
          To the fullest extent permitted by law, Valkyrie is not liable for any
          indirect, incidental, special, or consequential loss arising from your
          use of the site or our products — including lost profits, lost data,
          or loss of opportunity.
        </p>
        <p>
          Where we are found liable, our total liability for any order is
          limited to the amount you paid for that order.
        </p>
        <LegalNote>
          Nothing in these terms excludes or limits our liability for death or
          personal injury caused by negligence, for fraud, or for anything else
          that cannot lawfully be excluded.
        </LegalNote>
      </>
    ),
  },
  {
    id: "governing-law",
    title: "Governing law",
    content: (
      <p>
        These terms are governed by the laws of the Arab Republic of Egypt, and
        the courts of Egypt have exclusive jurisdiction over any dispute arising
        from them. If any provision is found unenforceable, the rest remains in
        force.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes to these terms",
    content: (
      <p>
        We may update these terms as our business or the law changes. The
        version published here at the time you place an order is the one that
        applies to that order. Continued use of the site after an update means
        you accept the revised terms.
      </p>
    ),
  },
];

export function TermsContent() {
  return (
    <>
      <LegalBody sections={sections} />
      <LegalContact
        title="Need clarification?"
        description="Get in touch if anything in these terms is unclear or you have a dispute to raise."
        email={LEGAL_EMAIL}
      />
    </>
  );
}
