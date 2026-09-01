import { ValkyrieLoader } from "@/components/ui/valkyrie-loader";

export default function AccountLoading() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <ValkyrieLoader size="md" label="Loading your account" />
    </div>
  );
}
