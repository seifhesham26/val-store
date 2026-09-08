/**
 * Cart Provider
 *
 * Provider component that syncs cart state with server for authenticated users.
 * Handles initial cart load and provides cart context throughout the app.
 */

"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { useSession } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc";
import {
  useCartStore,
  GUEST_CART_ITEM_ID_PREFIX,
  PENDING_CART_ITEM_ID_PREFIX,
  isLocalOnlyCartItemId,
  type CartItem,
} from "@/lib/stores/cart-store";
import {
  createCartSyncRegistry,
  reconcileServerCart,
} from "@/lib/cart-sync-registry";
import { cartAddKey, createCartAddRegistry } from "@/lib/cart-add-registry";
import { showRetryToast } from "@/lib/optimistic-toast";
import { toast } from "sonner";

// Module scope, not inside `useCart()` — every component that calls the
// hook (CartDrawer, CartPopulated, ProductDetail, QuickAddSliderBar, ...)
// must share one debounce timer and one "is this line mid-write" flag per
// cart item id, the same way every caller already shares one
// `useCartStore()`. A registry scoped to the hook instead produced a
// separate timer per mounted component per line, so two surfaces editing
// the same line within a second could each win.
const cartSyncRegistry = createCartSyncRegistry();

// The same reasoning, for adds. Keyed on product+variant rather than cart item
// id, because a line being added may not have a server row yet. Note the two
// registries behave differently on purpose: quantity edits replace, adds
// accumulate — see the header of `cart-add-registry.ts`.
const cartAddRegistry = createCartAddRegistry();

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

  // Sync server cart to local store.
  //
  // This effect fires on *any* `cart.get` refetch, not just one triggered by
  // editing the line it's about to overwrite — every cart mutation's
  // `onSuccess` calls `invalidateCart()`. Without `reconcileServerCart`, an
  // unrelated mutation (adding an item from the drawer, say) could refetch
  // while a different line's debounced quantity edit is still pending and
  // stamp that line back to its pre-edit value, which then flips back again
  // a moment later when the debounced write actually lands. Reading the
  // local snapshot via `getState()` rather than depending on `store.items`
  // keeps this effect from re-running on every local edit.
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
      const localItems = useCartStore.getState().items;
      setItems(
        reconcileServerCart(items, localItems, {
          isPendingItem: cartSyncRegistry.isPending,
          isPendingAdd: cartAddRegistry.isPending,
        })
      );
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

/**
 * How many units of one product+variant the server has not confirmed yet.
 *
 * Drives the "Added N" counter on the add buttons. The registry is a plain
 * module singleton with no React in it, so this subscribes the way the navbar
 * badge does, and reports 0 during SSR — a pending write cannot exist on the
 * server, and forcing the value keeps the button out of hydration mismatches.
 */
export function useCartAddDelta(
  productId: string,
  variantId: string | null
): number {
  const key = cartAddKey(productId, variantId);

  return useSyncExternalStore(
    cartAddRegistry.subscribe,
    () => cartAddRegistry.pendingDelta(key),
    () => 0
  );
}

/** Product data the store needs to render a cart line before the server does. */
export interface CartLineDetails {
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

  // Add item — a local write, always. For a signed-in customer the server call
  // is debounced and additive: press thirty times and the cart reads thirty
  // immediately while the server hears one `+30`. `details` is the display
  // data (name, price, image, stock) the caller already has for the product;
  // none of it is trusted again once it matters, because the server re-resolves
  // price and stock on both the add and the guest merge.
  const addItem = useCallback(
    (
      productId: string,
      quantity: number = 1,
      variantId: string | null = null,
      details?: CartLineDetails
    ) => {
      if (!details) {
        // No display data to show locally with — this means a call site hasn't
        // been updated to pass it, not that the customer did anything wrong,
        // but silently dropping the click would look identical to a real
        // failure from where they are standing.
        toast.error("Could not add this item to your cart");
        return;
      }

      const display = details;
      const prefix = isAuthenticated
        ? PENDING_CART_ITEM_ID_PREFIX
        : GUEST_CART_ITEM_ID_PREFIX;

      /** Show `delta` more units right now. */
      function addLocally(delta: number) {
        // `store.addItem` merges on product + variant, so the generated id is
        // only ever used when this is a brand-new line.
        store.addItem({
          id: `${prefix}${crypto.randomUUID()}`,
          productId,
          variantId,
          variantLabel: display.variantLabel,
          productName: display.productName,
          productPrice: display.productPrice,
          productImage: display.productImage,
          quantity: delta,
          maxStock: display.maxStock,
        });
      }

      /** Take `delta` units back out after a write the server refused. */
      function takeBackLocally(delta: number) {
        const line = useCartStore
          .getState()
          .items.find(
            (item) =>
              item.productId === productId && item.variantId === variantId
          );
        if (!line) return;

        const next = line.quantity - delta;
        if (next > 0) store.updateQuantity(line.id, next);
        else store.removeItem(line.id);
      }

      addLocally(quantity);

      // A guest line stays local until `mergeGuestItems` folds it into the
      // server cart at sign-in.
      if (!isAuthenticated) return;

      const key = cartAddKey(productId, variantId);

      function queue(delta: number) {
        cartAddRegistry.queueAdd(key, delta, async (totalDelta) => {
          try {
            await addMutation.mutateAsync({
              productId,
              quantity: totalDelta,
              variantId,
            });
          } catch (error) {
            // Take back exactly what this call was carrying. Presses that
            // arrived while it was on the wire are a separate call and are
            // still perfectly good.
            takeBackLocally(totalDelta);
            // The client caps at the cached ceiling, so reaching here means
            // stock moved underneath us — refresh the figure the ceiling is
            // computed from so the page corrects itself.
            utils.public.products.getStock.invalidate();
            invalidateCart();
            showRetryToast(
              error instanceof Error && error.message
                ? error.message
                : "Couldn't add that to your cart.",
              () => {
                addLocally(totalDelta);
                queue(totalDelta);
              }
            );
          }
        });
      }

      queue(quantity);
    },
    [isAuthenticated, addMutation, store, utils, invalidateCart]
  );

  // Update quantity — local first, server on a shared 1s debounce.
  const updateQuantity = useCallback(
    (cartItemId: string, quantity: number) => {
      store.updateQuantity(cartItemId, quantity);

      // A `guest-` or `pending-` id has no server row to update yet. Sending
      // one as a cartItemId would fail uuid validation outright, so it stays
      // local until the merge — or the add — replaces it with a real one.
      if (!isAuthenticated || isLocalOnlyCartItemId(cartItemId)) return;

      function schedule() {
        // `scheduleUpdate` shares its timer across every `useCart()` instance
        // and marks this id "pending" for the sync effect, replacing any write
        // already scheduled for the same id — last call wins.
        cartSyncRegistry.scheduleUpdate(cartItemId, async () => {
          try {
            await updateMutation.mutateAsync({ cartItemId, quantity });
          } catch {
            // As far as the server is concerned the optimistic write never
            // happened. Pull the real value back in rather than leaving the
            // customer looking at a quantity nobody agrees with, and give them
            // a way to try again that does not mean re-finding the item.
            invalidateCart();
            showRetryToast("Couldn't save that quantity change.", () => {
              store.updateQuantity(cartItemId, quantity);
              schedule();
            });
          }
        });
      }

      schedule();
    },
    [isAuthenticated, updateMutation, store, invalidateCart]
  );

  // Remove item
  const removeItem = useCallback(
    (cartItemId: string) => {
      // A debounced quantity write may still be armed for this id — let it
      // fire after the row is gone and `UpdateCartItemUseCase` rejects with
      // "Cart item not found" for no one to see.
      cartSyncRegistry.cancel(cartItemId);

      // Queued units for this product have nowhere to go now either.
      const line = useCartStore
        .getState()
        .items.find((item) => item.id === cartItemId);
      if (line) {
        cartAddRegistry.cancel(cartAddKey(line.productId, line.variantId));
      }

      store.removeItem(cartItemId);

      // See updateQuantity: a local-only id has no server row to delete.
      if (!isAuthenticated || isLocalOnlyCartItemId(cartItemId)) return;

      function attempt() {
        removeMutation.mutate(
          { cartItemId },
          {
            onError: () => {
              // The row survived, so the refetch restores it under the same
              // id — which is what makes retrying the identical call valid.
              invalidateCart();
              showRetryToast("Couldn't remove that item.", () => {
                store.removeItem(cartItemId);
                attempt();
              });
            },
          }
        );
      }

      attempt();
    },
    [isAuthenticated, removeMutation, store, invalidateCart]
  );

  // Clear cart
  const clearCart = useCallback(() => {
    // Same reasoning as removeItem, for every line at once.
    cartSyncRegistry.cancelAll();
    cartAddRegistry.cancelAll();

    const snapshot = useCartStore.getState().items;
    store.clearCart();

    if (!isAuthenticated) return;

    function attempt() {
      clearMutation.mutate(undefined, {
        onError: () => {
          // Nothing was deleted, so put the whole cart back rather than
          // waiting for a refetch to notice.
          store.setItems(snapshot);
          showRetryToast("Couldn't empty your cart.", () => {
            store.clearCart();
            attempt();
          });
        },
      });
    }

    attempt();
  }, [isAuthenticated, clearMutation, store]);

  /**
   * Send everything that is still sitting on a debounce, and wait for it.
   *
   * Checkout is the one place where being behind the server actually costs
   * something, and disabling a button while `isSyncing` was only ever an
   * accidental approximation of this.
   */
  const flushPendingWrites = useCallback(async () => {
    await Promise.all([
      cartAddRegistry.flushAll(),
      cartSyncRegistry.flushAll(),
    ]);
  }, []);

  return {
    items: store.items,
    isOpen: store.isOpen,
    isLoading: store.isLoading,
    itemCount: store.getItemCount(),
    subtotal: store.getSubtotal(),
    isEmpty: store.isEmpty(),
    isAuthenticated,

    // Actions
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
    flushPendingWrites,
    openCart: store.openCart,
    closeCart: store.closeCart,
    toggleCart: store.toggleCart,
  };
}
