/**
 * The FAQ, rendered from `content/legal/faq.md`.
 *
 * Each `## ` heading in that document is a question and the prose beneath it is
 * the answer, so the accordion is the same markdown split the legal pages use —
 * see `@/lib/markdown-sections`. One storage shape, two presentations.
 *
 * The questions used to be a hardcoded array here, which is how the page came
 * to claim worldwide shipping, list a payment method the store does not accept,
 * and give US support hours on an Egyptian store.
 */

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { LegalMarkdown } from "@/components/legal/LegalMarkdown";
import type { FaqSection } from "@/lib/faq-markdown";

export function FAQAccordion({ sections }: { sections: FaqSection[] }) {
  if (sections.length === 0) {
    return (
      <p className="max-w-3xl text-sm text-gray-400">
        Our questions and answers are temporarily unavailable. Please contact us
        and we will help directly.
      </p>
    );
  }

  return (
    <Accordion type="single" collapsible className="max-w-3xl">
      {sections.map((section, index) => (
        <AccordionItem key={section.question} value={`item-${index}`}>
          <AccordionTrigger className="text-left">
            {section.question}
          </AccordionTrigger>
          <AccordionContent className="space-y-4 text-sm leading-relaxed text-gray-400">
            <LegalMarkdown markdown={section.answer} />
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
