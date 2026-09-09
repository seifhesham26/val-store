/**
 * FAQ view of a markdown document.
 *
 * `content/legal/faq.md` uses one `## ` heading per question with the answer as
 * the prose beneath it, so the accordion is the same split the legal pages use
 * — see `./markdown-sections`. This is the adapter that renames the fields to
 * the vocabulary the accordion speaks.
 */

import { splitMarkdownSections } from "./markdown-sections";

export interface FaqSection {
  question: string;
  answer: string;
}

export function splitFaqSections(markdown: string): FaqSection[] {
  return splitMarkdownSections(markdown).map(({ title, body }) => ({
    question: title,
    answer: body,
  }));
}
