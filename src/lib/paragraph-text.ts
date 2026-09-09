/**
 * Converting between a textarea's text and a list of paragraphs.
 *
 * The admin edits body copy as one textarea; the CMS stores an array of
 * paragraphs. These two functions are the boundary, and they must round-trip:
 * opening a section and saving it again without typing anything must not
 * change what is stored.
 *
 * Pure and separately tested because the blank-line rules are the sort of
 * thing that looks obviously right and quietly is not — splitting on `\n`
 * rather than on a blank line turns every soft wrap into its own paragraph,
 * and forgetting `\r` breaks the moment someone pastes from a Windows editor.
 */

/** A blank line — possibly containing spaces, possibly CRLF — separates paragraphs. */
const PARAGRAPH_BREAK = /\r?\n[ \t]*(?:\r?\n[ \t]*)+/;

export function splitParagraphs(text: string): string[] {
  return text
    .split(PARAGRAPH_BREAK)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
}

export function joinParagraphs(paragraphs: string[]): string {
  return paragraphs.join("\n\n");
}
