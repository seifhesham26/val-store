import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "How long does shipping take?",
    answer:
      "Standard shipping takes 5-7 business days. Express shipping takes 2-3 business days. International orders take 7-14 business days.",
  },
  {
    question: "What is your return policy?",
    answer:
      "We offer a 30-day return policy for unworn items with tags attached. Simply log into your account and start a return from your order history.",
  },
  {
    question: "Do you ship internationally?",
    answer:
      "Yes! We ship to most countries worldwide. International shipping rates vary by destination and are calculated at checkout.",
  },
  {
    question: "How can I track my order?",
    answer:
      "Once your order ships, you'll receive an email with your tracking number. You can also track your order from your account dashboard.",
  },
  {
    question: "What payment methods do you accept?",
    answer:
      "We accept all major credit cards (Visa, Mastercard, American Express), PayPal, and Cash on Delivery for select regions.",
  },
  {
    question: "Can I change or cancel my order?",
    answer:
      "Orders can be modified or cancelled within 1 hour of placing them. After that, the order enters processing and cannot be changed.",
  },
  {
    question: "Do you offer gift wrapping?",
    answer:
      "Not yet. We are working on it — for now, orders arrive in our standard packaging.",
  },
  {
    question: "How do I contact customer support?",
    answer:
      "You can reach us at support@valstore.com or call +1 (555) 123-4567 during business hours (Mon-Fri, 9am-6pm EST).",
  },
];

export function FAQAccordion() {
  return (
    <Accordion type="single" collapsible className="max-w-3xl">
      {faqs.map((faq, index) => (
        <AccordionItem key={index} value={`item-${index}`}>
          <AccordionTrigger className="text-left">
            {faq.question}
          </AccordionTrigger>
          <AccordionContent className="text-muted-foreground">
            {faq.answer}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
