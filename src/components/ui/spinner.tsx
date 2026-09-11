import { cn } from "@/lib/utils";
import { ValkyrieLoader } from "@/components/ui/valkyrie-loader";

/**
 * The shared inline spinner.
 *
 * Renders the branded mark rather than lucide's `Loader2`. The props signature
 * is unchanged so existing call sites keep working, including the ones that
 * pass `className` to resize it.
 */
function Spinner({ className }: { className?: string }) {
  return (
    <ValkyrieLoader inline size="xs" className={cn("size-4", className)} />
  );
}

export { Spinner };
