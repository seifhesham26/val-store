import { ValkyrieLoader } from "@/components/ui/valkyrie-loader";

/** Fallback for storefront routes without a more specific skeleton. */
export default function MainLoading() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <ValkyrieLoader size="lg" label="Loading" />
    </div>
  );
}
