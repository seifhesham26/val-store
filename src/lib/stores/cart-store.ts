/**
 * Cart Store
 *
 * Zustand store for client-side cart state management.
 * - Guest users: persists to localStorage
 * - Logged-in users: syncs with server via CartProvider
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/**
 * Id prefix for a line added while signed out.
 *
 * A server-synced line carries the real `cart_items.id` uuid; a guest line
 * has no server row yet, so it needs an id from somewhere else to stay
 * addressable by `updateQuantity`/`removeItem` before it does. The prefix
 * doubles as a marker: `CartProvider` uses it to tell "still needs merging
 * into the server cart" apart from "already synced," without any separate
 * flag or ref-based tracking of the sign-in transition — which matters
 * because a full-page reload during login remounts the provider and loses
 * any in-memory transition state, but not this prefix.
 */
export const GUEST_CART_ITEM_ID_PREFIX = "guest-";

export interface CartItem {
  id: string;
  productId: string;
  variantId: string | null;
  variantLabel: string | null;
  productName: string;
  productPrice: number;
  productImage: string | null;
  quantity: number;
  maxStock: number;
}

interface CartState {
  items: CartItem[];
  isOpen: boolean;
  isLoading: boolean;
  isSyncing: boolean;
}

interface CartActions {
  setItems: (items: CartItem[]) => void;
  addItem: (item: CartItem) => void;
  updateQuantity: (cartItemId: string, quantity: number) => void;
  removeItem: (cartItemId: string) => void;
  clearCart: () => void;
  clearSignedOutItems: () => void;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  setLoading: (loading: boolean) => void;
  setSyncing: (syncing: boolean) => void;
  getItemCount: () => number;
  getSubtotal: () => number;
  isEmpty: () => boolean;
}

type CartStore = CartState & CartActions;

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      // State
      items: [],
      isOpen: false,
      isLoading: false,
      isSyncing: false,

      // Actions
      setItems: (items: CartItem[]) => set({ items }),

      addItem: (item: CartItem) =>
        set((state: CartState) => {
          // Identity is product + variant: the same shirt in M and L are two
          // separate lines.
          const existingIndex = state.items.findIndex(
            (i: CartItem) =>
              i.productId === item.productId && i.variantId === item.variantId
          );

          if (existingIndex >= 0) {
            const newItems = [...state.items];
            const existing = newItems[existingIndex];
            newItems[existingIndex] = {
              ...existing,
              quantity: existing.quantity + item.quantity,
            };
            return { items: newItems };
          }

          return { items: [...state.items, item] };
        }),

      updateQuantity: (cartItemId: string, quantity: number) =>
        set((state: CartState) => ({
          items: state.items.map((item: CartItem) =>
            item.id === cartItemId ? { ...item, quantity } : item
          ),
        })),

      removeItem: (cartItemId: string) =>
        set((state: CartState) => ({
          items: state.items.filter((item: CartItem) => item.id !== cartItemId),
        })),

      clearCart: () => set({ items: [] }),

      // The sign-out backstop in `CartProvider` used to call `clearCart`
      // outright, which was correct when a logged-out visitor's cart was
      // always empty. Now a guest cart is real data that must survive
      // whatever unauthenticated moment the backstop reacts to, so this
      // drops only the lines a previous account actually synced — the ones
      // that could leak to the next person on a shared browser — and keeps
      // any line still waiting for its first sign-in to merge.
      clearSignedOutItems: () =>
        set((state: CartState) => ({
          items: state.items.filter((item: CartItem) =>
            item.id.startsWith(GUEST_CART_ITEM_ID_PREFIX)
          ),
        })),

      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),
      toggleCart: () => set((state: CartState) => ({ isOpen: !state.isOpen })),

      setLoading: (loading: boolean) => set({ isLoading: loading }),
      setSyncing: (syncing: boolean) => set({ isSyncing: syncing }),

      getItemCount: () => {
        const { items } = get();
        return items.reduce(
          (sum: number, item: CartItem) => sum + item.quantity,
          0
        );
      },

      getSubtotal: () => {
        const { items } = get();
        return items.reduce(
          (sum: number, item: CartItem) =>
            sum + item.productPrice * item.quantity,
          0
        );
      },

      isEmpty: () => get().items.length === 0,
    }),
    {
      // Bumped when CartItem gained variantId/variantLabel. Rehydrating a
      // pre-variant cart would produce lines that can't be matched or ordered
      // correctly, so old persisted carts are dropped rather than migrated.
      name: "valkyrie-cart-v2",
      storage: createJSONStorage(() => localStorage),
      partialize: (state: CartStore) => ({ items: state.items }),
    }
  )
);
