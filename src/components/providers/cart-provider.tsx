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
import {
  useCartStore,
  GUEST_CART_ITEM_ID_PREFIX,
  type CartItem,
} from "@/lib/stores/cart-store";
import { toast } from "sonner";

interface CartProviderProps {
  children: React.ReactNode;
}

export function CartProvider({ children }: CartProviderProps) {
  const { data: session, isPending: isSessionPending } = useSession();
  const isAuthenticated = !!session?.user;

  const { setItems, setLoading, clearSignedOutItems } = useCartStore();
  const utils = trpc.useUtils();

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

  const mergeGuestItems = trpc.public.cart.mergeGuestItems.useMutation();
  const mergeInFlightRef = useRef(false);

  // Merge a guest cart into the server cart.
  //
  // Triggered by the id prefix rather than by watching for an
  // unauthenticated -> authenticated transition: a transition tracked in a
  // ref is lost if login does a full-page navigation, which remounts this
  // provider. The prefix survives that remount because it is persisted with
  // the item. So this runs whenever the settled session is authenticated
  // and the store still holds `guest-` prefixed lines — items added before
  // sign-in that have never made it into a server row. A returning
  // authenticated user whose local cart is entirely server-synced items
  // finds nothing to merge and this is a no-op.
  //
  // `mergeGuestItems.mutate` fires synchronously off the current store
  // snapshot, so it does not matter whether the sync effect above later
  // overwrites the store with a not-yet-merged server cart before this
  // mutation's response comes back — the merge already has what it needs.
  useEffect(() => {
    if (isSessionPending || !isAuthenticated || mergeInFlightRef.current) {
      return;
    }

    const guestLines = useCartStore
      .getState()
      .items.filter((item) => item.id.startsWith(GUEST_CART_ITEM_ID_PREFIX));

    if (guestLines.length === 0) {
      return;
    }

    mergeInFlightRef.current = true;
    mergeGuestItems.mutate(
      {
        items: guestLines.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
        })),
      },
      {
        onSuccess: () => {
          utils.public.cart.get.invalidate();
        },
        onError: () => {
          toast.error(
            "Some items from your cart couldn't be carried over. Please double-check your cart."
          );
        },
        onSettled: () => {
          mergeInFlightRef.current = false;
        },
      }
    );
    // `mergeGuestItems`/`utils` are new references every render; re-running
    // this on every render would refire the mutation with the same stale
    // closure state instead of reacting to the session settling.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isSessionPending]);

  // Backstop for the three sign-out handlers.
  //
  // The sync effect above only runs when a server cart *arrives*, so for a
  // logged-out visitor a stale persisted cart is never displaced. Each
  // sign-out path clears it directly — this covers session expiry and any
  // route that ends up here without going through one of them.
  //
  // Waiting for `isPending` to settle is load-bearing, not defensive: while
  // the session request is in flight `session` is undefined, so an unguarded
  // check reads as "logged out" on every single page load. That would clear
  // a cart the server is about to restore — and now that guest carts are
  // real, `clearSignedOutItems` rather than `clearCart` is what runs here:
  // it drops only server-synced lines (which could belong to whichever
  // account just signed out) and keeps any line still waiting for its first
  // sign-in to merge, so a guest cart survives session expiry and stray
  // routes the same way it survives a page reload.
  useEffect(() => {
    if (!isSessionPending && !isAuthenticated) {
      clearSignedOutItems();
    }
  }, [isSessionPending, isAuthenticated, clearSignedOutItems]);

  // Update loading state
  useEffect(() => {
    setLoading(isLoading);
  }, [isLoading, setLoading]);

  return <>{children}</>;
}

/** Product data the store needs to render a guest cart line locally. */
export interface GuestCartItemDetails {
  productName: string;
  productPrice: number;
  productImage: string | null;
  variantLabel: string | null;
  maxStock: number;
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

  // Add item - sync with server if authenticated, otherwise write straight
  // to the local store. `guestDetails` is the display data (name, price,
  // image, stock) the caller already has on hand for the product being
  // added — the guest branch has no server round trip to fetch it from, and
  // none of it is trusted again once it matters: CartProvider's merge
  // re-resolves both price and stock from the database at sign-in.
  const addItem = useCallback(
    async (
      productId: string,
      quantity: number = 1,
      variantId: string | null = null,
      guestDetails?: GuestCartItemDetails
    ) => {
      if (isAuthenticated) {
        store.setSyncing(true);
        try {
          await addMutation.mutateAsync({ productId, quantity, variantId });
        } finally {
          store.setSyncing(false);
        }
        return;
      }

      if (!guestDetails) {
        // No display data to show locally with — this means a call site
        // hasn't been updated to pass it, not that the guest did anything
        // wrong, but silently dropping the click would look identical to a
        // real failure from where the customer is standing.
        toast.error("Could not add this item to your cart");
        return;
      }

      store.addItem({
        id: `${GUEST_CART_ITEM_ID_PREFIX}${crypto.randomUUID()}`,
        productId,
        variantId,
        variantLabel: guestDetails.variantLabel,
        productName: guestDetails.productName,
        productPrice: guestDetails.productPrice,
        productImage: guestDetails.productImage,
        quantity,
        maxStock: guestDetails.maxStock,
      });
    },
    [isAuthenticated, addMutation, store]
  );

  // Update quantity
  const updateQuantity = useCallback(
    (cartItemId: string, quantity: number) => {
      // 1. Instantly update the local Zustand store for snappy UI
      store.updateQuantity(cartItemId, quantity);

      // A `guest-` id has no server row to update yet — even if sign-in has
      // already flipped `isAuthenticated`, the merge may not have landed.
      // Sending it as a cartItemId would fail uuid validation outright, so
      // it stays local until the merge replaces it with a real one.
      const isUnmergedGuestLine = cartItemId.startsWith(
        GUEST_CART_ITEM_ID_PREFIX
      );

      if (isAuthenticated && !isUnmergedGuestLine) {
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
      // See updateQuantity: a `guest-` id may not have a server row yet even
      // once `isAuthenticated` is true, if the merge hasn't landed.
      if (
        isAuthenticated &&
        !cartItemId.startsWith(GUEST_CART_ITEM_ID_PREFIX)
      ) {
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
