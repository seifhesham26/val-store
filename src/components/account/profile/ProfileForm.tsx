import { useState } from "react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { AppRouter } from "@/server";
import { inferRouterOutputs } from "@trpc/server";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type UserProfile = RouterOutputs["public"]["profile"]["me"];

export function ProfileForm({ user }: { user: UserProfile | undefined }) {
  const utils = trpc.useUtils();
  const [name, setName] = useState(user?.name || "");
  const [isLoading, setIsLoading] = useState(false);
  // The parent renders this form while `profile.me` is still loading, so
  // `user` is `undefined` on the first render and never remounts once the
  // query resolves. A `useState` initializer runs exactly once, so seeding
  // from the prop alone pinned `name` to "" forever: the field stayed empty
  // beside a correctly-filled Email (read straight from the prop), and
  // because the Save button is disabled on `name === user?.name`, an
  // untouched form offered an enabled Save that the server then rejected
  // with `z.string().min(2)`.
  //
  // Seeding by user id rather than on every prop change is deliberate — a
  // refetch (this form's own invalidation included) must not overwrite a
  // name the customer is part-way through typing.
  const [seededFor, setSeededFor] = useState<string | null>(null);

  if (user && user.id !== seededFor) {
    setSeededFor(user.id);
    setName(user.name || "");
  }

  const updateName = trpc.public.profile.updateName.useMutation({
    onSuccess: () => {
      utils.public.profile.me.invalidate();
      toast.success("Profile updated");
    },
    onError: (err) => {
      toast.error("Failed to update profile", { description: err.message });
    },
  });

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await updateName.mutateAsync({ name });
    } catch {
      // Error handled by the mutation onError hook
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-zinc-900 border border-white/10 rounded-lg">
      <div className="p-5 border-b border-white/10">
        <h3 className="text-lg font-semibold text-white">
          Profile Information
        </h3>
        <p className="text-sm text-gray-500">
          Update your personal information.
        </p>
      </div>
      <div className="p-5">
        <form onSubmit={handleUpdateProfile} className="space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-300"
            >
              Name
            </label>
            <input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="w-full px-3 py-2 bg-white/[0.06] border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-val-accent/50 focus:border-val-accent/50 transition-colors"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-300"
            >
              Email
            </label>
            <input
              id="email"
              value={user?.email || ""}
              disabled
              className="w-full px-3 py-2 bg-white/[0.04] border border-white/10 rounded-lg text-gray-500 cursor-not-allowed"
            />
            <p className="text-xs text-gray-600">Email cannot be changed.</p>
          </div>

          <Button
            type="submit"
            disabled={isLoading || updateName.isPending || name === user?.name}
            className="bg-val-accent hover:bg-val-accent/90 text-black font-medium"
          >
            {updateName.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </form>
      </div>
    </div>
  );
}
