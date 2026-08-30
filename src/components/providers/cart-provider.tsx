/**
 * Cart Provider
 *
 * Provider component that syncs cart state with server for authenticated users.
 * Handles initial cart load and provides cart context throughout the app.
 */

"use client";

import { useEffect, useCallback, useRef } from "react";
import { useSession } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc";
import { useCartStore, type CartItem } from "@/lib/stores/cart-store";
import { toast } from "sonner";

interface CartProviderProps {
  children: React.ReactNode;
}

export function CartProvider({ children }: CartProviderProps) {
  const { data: session } = useSession();
  const isAuthenticated = !!session?.user;

  const { setItems, setLoading } = useCartStore();

  // Fetch cart from server for authenticated users
  const { data: serverCart, isLoading } = trpc.public.cart.get.useQuery(
    undefined,
    {
      enabled: isAuthenticated,
      staleTime: 1000 * 60, // 1 minute
      refetchOnWindowFocus: false,
    }
  );

  // Sync server cart to local store
  useEffect(() => {
    if (isAuthenticated && serverCart) {
      const items: CartItem[] = serverCart.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        variantId: item.variantId,
        variantLabel: item.variantLabel,
        productName: item.productName,
        productPrice: item.productPrice,
        productImage: item.productImage,
        quantity: item.quantity,
        maxStock: item.maxStock,
      }));
      setItems(items);
    }
  }, [isAuthenticated, serverCart, setItems]);

  // Update loading state
  useEffect(() => {
    setLoading(isLoading);
  }, [isLoading, setLoading]);

  return <>{children}</>;
}

/**
 * Hook for cart operations that syncs with server
 */
export function useCart() {
  const { data: session } = useSession();
  const isAuthenticated = !!session?.user;
  const utils = trpc.useUtils();

  const store = useCartStore();
  const updateTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>(
    {}
  );

  // Server mutations.
  //
  // Every cart write also refreshes the stock check: what is available depends
  // on what the cart is holding, so a stale check would keep reporting a
  // problem the customer has already fixed.
  const invalidateCart = useCallback(() => {
    utils.public.cart.get.invalidate();
    utils.public.cart.stockStatus.invalidate();
  }, [utils]);

  const addMutation = trpc.public.cart.add.useMutation({
    onSuccess: invalidateCart,
  });

  const updateMutation = trpc.public.cart.updateQuantity.useMutation({
    onSuccess: invalidateCart,
  });

  const removeMutation = trpc.public.cart.remove.useMutation({
    onSuccess: invalidateCart,
  });

  const clearMutation = trpc.public.cart.clear.useMutation({
    onSuccess: invalidateCart,
  });

  // Add item - sync with server if authenticated
  const addItem = useCallback(
    async (
      productId: string,
      quantity: number = 1,
      variantId: string | null = null
    ) => {
      if (isAuthenticated) {
        store.setSyncing(true);
        try {
          await addMutation.mutateAsync({ productId, quantity, variantId });
        } finally {
          store.setSyncing(false);
        }
      } else {
        // For guests, show a toast with a redirect to login
        toast.info("Please sign in to add items to your cart", {
          action: {
            label: "Sign In",
            onClick: () => {
              window.location.href = `/login?redirect=${encodeURIComponent(
                window?.location?.pathname || "/"
              )}`;
            },
          },
        });
      }
    },
    [isAuthenticated, addMutation, store]
  );

  // Update quantity
  const updateQuantity = useCallback(
    (cartItemId: string, quantity: number) => {
      // 1. Instantly update the local Zustand store for snappy UI
      store.updateQuantity(cartItemId, quantity);

      if (isAuthenticated) {
        // Clear previous timer for this cart item
        if (updateTimersRef.current[cartItemId]) {
          clearTimeout(updateTimersRef.current[cartItemId]);
        }

        // 2. Schedule the actual server mutation
        updateTimersRef.current[cartItemId] = setTimeout(async () => {
          store.setSyncing(true);
          try {
            await updateMutation.mutateAsync({ cartItemId, quantity });
          } finally {
            store.setSyncing(false);
          }
        }, 1000); // 1000ms debounce
      }
    },
    [isAuthenticated, updateMutation, store]
  );

  // Remove item
  const removeItem = useCallback(
    async (cartItemId: string) => {
      if (isAuthenticated) {
        store.setSyncing(true);
        try {
          // Optimistically update local state
          store.removeItem(cartItemId);
          await removeMutation.mutateAsync({ cartItemId });
        } finally {
          store.setSyncing(false);
        }
      } else {
        store.removeItem(cartItemId);
      }
    },
    [isAuthenticated, removeMutation, store]
  );

  // Clear cart
  const clearCart = useCallback(async () => {
    if (isAuthenticated) {
      store.setSyncing(true);
      try {
        store.clearCart();
        await clearMutation.mutateAsync();
      } finally {
        store.setSyncing(false);
      }
    } else {
      store.clearCart();
    }
  }, [isAuthenticated, clearMutation, store]);

  return {
    items: store.items,
    isOpen: store.isOpen,
    isLoading: store.isLoading,
    isSyncing: store.isSyncing,
    itemCount: store.getItemCount(),
    subtotal: store.getSubtotal(),
    isEmpty: store.isEmpty(),
    isAuthenticated,

    // Actions
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
    openCart: store.openCart,
    closeCart: store.closeCart,
    toggleCart: store.toggleCart,
  };
}
