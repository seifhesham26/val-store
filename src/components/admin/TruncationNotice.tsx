import { AlertTriangle } from "lucide-react";

interface TruncationNoticeProps {
  /** Rows actually rendered. */
  shown: number;
  /** Rows that match, ignoring the cap. */
  total: number;
  /** What is being counted, plural — "variants", "reviews". */
  noun: string;
}

/**
 * Says out loud that a capped list is not showing everything.
 *
 * Several admin tables render every row they are given with no pagination or
 * virtualisation, so their queries carry a ceiling. A ceiling with no signal
 * is the worse of the two failures: the table looks complete and simply stops
 * containing rows — on the inventory screen, stock an admin can neither see
 * nor edit, with nothing on the page to suggest it exists.
 *
 * Renders nothing while everything fits, so it costs nothing at the data
 * volumes where the cap is unreachable.
 */
export function TruncationNotice({
  shown,
  total,
  noun,
}: TruncationNoticeProps) {
  if (total <= shown) return null;

  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
      <p className="text-foreground">
        Showing the first <strong>{shown.toLocaleString()}</strong> of{" "}
        <strong>{total.toLocaleString()}</strong> {noun}. This table does not
        paginate yet — narrow the list or raise the limit to see the rest.
      </p>
    </div>
  );
}
