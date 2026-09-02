"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { User, LogOut, Settings, ShoppingBag, Shield } from "lucide-react";
import { signOut } from "@/lib/auth-client";
import { useCartStore } from "@/lib/stores/cart-store";
import Link from "next/link";
import Image from "next/image";

interface UserDialogProps {
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    image?: string | null;
  } | null;
}

export function UserDialog({ user }: UserDialogProps) {
  const [open, setOpen] = useState(false);

  const handleLogout = async () => {
    await signOut({
      fetchOptions: {
        onSuccess: () => {
          // Was `localStorage.removeItem("user")`, a key nothing in the
          // codebase writes. This is the cleanup that line looked like it
          // was meant to be.
          useCartStore.getState().clearCart();
          window.location.href = "/login";
        },
      },
    });
  };

  if (!user) {
    return (
      <div className="flex gap-2">
        <Button variant="outline" asChild>
          <Link href="/login">Sign in</Link>
        </Button>
        <Button asChild>
          <Link href="/signup">Sign up</Link>
        </Button>
      </div>
    );
  }

  const initials =
    (user.firstName?.[0] || "") + (user.lastName?.[0] || "") || "U";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative h-9 w-9 rounded-full overflow-hidden hover:ring-2 hover:ring-ring/20 transition-all"
        >
          {user.image ? (
            <Image
              src={user.image}
              alt={`${user.firstName} ${user.lastName}`}
              fill
              className="object-cover"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center bg-muted text-foreground text-sm font-medium">
              {initials}
            </span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader className="sr-only">
          <DialogTitle>Account</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* User Profile Card */}
          <div className="flex flex-col items-center text-center pt-2">
            <div className="relative h-20 w-20 rounded-full overflow-hidden border-2 border-border mb-3">
              {user.image ? (
                <Image
                  src={user.image}
                  alt={`${user.firstName} ${user.lastName}`}
                  fill
                  className="object-cover"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center bg-muted text-foreground text-2xl font-semibold">
                  {initials}
                </span>
              )}
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              {user.firstName} {user.lastName}
            </h3>
            <p className="text-sm text-muted-foreground">{user.email}</p>
            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground capitalize">
              <Shield className="h-3 w-3" />
              {user.role.replace("_", " ")}
            </span>
          </div>

          {/* Divider */}
          <div className="border-t" />

          {/* Quick Actions */}
          <div className="space-y-1">
            <Button
              variant="outline"
              className="w-full justify-start h-10 px-3"
              asChild
              onClick={() => setOpen(false)}
            >
              <Link href="/account/orders">
                <ShoppingBag className="mr-3 h-4 w-4" />
                My Orders
              </Link>
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start h-10 px-3"
              asChild
              onClick={() => setOpen(false)}
            >
              <Link href="/account/profile">
                <User className="mr-3 h-4 w-4" />
                My Profile
              </Link>
            </Button>

            {(user.role === "admin" || user.role === "super_admin") && (
              <Button
                variant="outline"
                className="w-full justify-start h-10 px-3"
                asChild
                onClick={() => setOpen(false)}
              >
                <Link href="/admin">
                  <Settings className="mr-3 h-4 w-4" />
                  Admin Dashboard
                </Link>
              </Button>
            )}
          </div>

          {/* Divider */}
          <div className="border-t" />

          {/* Logout */}
          <Button
            variant="outline"
            className="w-full justify-start h-10 px-3 text-destructive border-destructive/30 hover:bg-destructive/10"
            onClick={handleLogout}
          >
            <LogOut className="mr-3 h-4 w-4" />
            Sign out
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
