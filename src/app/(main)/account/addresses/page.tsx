"use client";

/**
 * Addresses Page
 *
 * Manage shipping addresses using tRPC.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { AddressesHeader } from "@/components/account/addresses/AddressesHeader";
import {
  AddressList,
  type AddressItem,
} from "@/components/account/addresses/AddressList";
import { AddressFormDialog } from "@/components/account/addresses/AddressFormDialog";
import { cachePatch, runOptimistic } from "@/lib/optimistic-patches";
import { showRetryToast } from "@/lib/optimistic-toast";
import type { AppRouter } from "@/server";
import type { inferRouterInputs } from "@trpc/server";

type RouterInputs = inferRouterInputs<AppRouter>;
type AddressInput = RouterInputs["public"]["address"]["create"];

export default function AddressesPage() {
  const utils = trpc.useUtils();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<AddressItem | null>(
    null
  );

  const { data: addresses = [], isLoading } =
    trpc.public.address.list.useQuery();

  const listPatch = (
    patch: (rows: AddressItem[] | undefined) => AddressItem[] | undefined
  ) =>
    cachePatch({
      cancel: () => utils.public.address.list.cancel(),
      read: () => utils.public.address.list.getData(),
      write: (data) => utils.public.address.list.setData(undefined, data),
      invalidate: () => utils.public.address.list.invalidate(),
      patch,
    });

  function retryCreate(data: AddressInput) {
    createMutation.mutate(data);
  }

  const createMutation = trpc.public.address.create.useMutation({
    // The server returns `{ success: true }`, not the row, so the optimistic
    // entry carries a temporary id and is replaced outright by the refetch.
    // The prefix marks it as never safe to send back.
    onMutate: (input) =>
      runOptimistic([
        listPatch((rows) => [
          ...(rows ?? []),
          {
            id: `optimistic-${crypto.randomUUID()}`,
            name: input.name,
            street: input.street,
            city: input.city,
            state: input.state ?? "",
            zipCode: input.zipCode ?? "",
            country: input.country ?? "",
            phone: input.phone,
            // Zod defaults this server-side, so the *input* type has it
            // optional — the list row does not.
            addressType: input.addressType ?? "shipping",
            // The first address a customer saves becomes their default.
            isDefault: (rows ?? []).length === 0,
          },
        ]),
      ]),
    onSuccess: () => {
      toast("Address added");
      setIsDialogOpen(false);
    },
    onError: (err, variables, handle) => {
      handle?.rollback();
      showRetryToast(err.message || "Couldn't add that address.", () =>
        retryCreate(variables)
      );
    },
    onSettled: (_data, _err, _variables, handle) => {
      handle?.settle();
    },
  });

  function retryUpdate(input: { id: string; data: AddressInput }) {
    updateMutation.mutate(input);
  }

  const updateMutation = trpc.public.address.update.useMutation({
    onMutate: ({ id, data }) =>
      runOptimistic([
        listPatch((rows) =>
          rows?.map((row) =>
            row.id === id
              ? {
                  ...row,
                  name: data.name,
                  street: data.street,
                  city: data.city,
                  state: data.state ?? "",
                  zipCode: data.zipCode ?? "",
                  country: data.country ?? "",
                  phone: data.phone,
                  addressType: data.addressType ?? "shipping",
                }
              : row
          )
        ),
      ]),
    onSuccess: () => {
      toast("Address updated");
      setIsDialogOpen(false);
      setEditingAddress(null);
    },
    onError: (err, variables, handle) => {
      handle?.rollback();
      showRetryToast(err.message || "Couldn't update that address.", () =>
        retryUpdate(variables)
      );
    },
    onSettled: (_data, _err, _variables, handle) => {
      handle?.settle();
    },
  });

  function retryDelete(id: string) {
    deleteMutation.mutate({ id });
  }

  const deleteMutation = trpc.public.address.delete.useMutation({
    onMutate: ({ id }) =>
      runOptimistic([
        listPatch((rows) => rows?.filter((row) => row.id !== id)),
      ]),
    onSuccess: () => {
      toast("Address deleted");
    },
    // Without an error handler at all, this once failed in total silence — no
    // toast, no error, the row still on screen. Rolling back is not enough on
    // its own; the customer has to be told the row came back on purpose.
    onError: (err, variables, handle) => {
      handle?.rollback();
      showRetryToast(err.message || "Couldn't delete that address.", () =>
        retryDelete(variables.id)
      );
    },
    onSettled: (_data, _err, _variables, handle) => {
      handle?.settle();
    },
  });

  function retrySetDefault(id: string) {
    setDefaultMutation.mutate({ id });
  }

  const setDefaultMutation = trpc.public.address.setDefault.useMutation({
    // Exactly one row is default, so this needs nothing from the server.
    onMutate: ({ id }) =>
      runOptimistic([
        listPatch((rows) =>
          rows?.map((row) => ({ ...row, isDefault: row.id === id }))
        ),
      ]),
    onSuccess: () => {
      toast("Default address updated");
    },
    onError: (err, variables, handle) => {
      handle?.rollback();
      showRetryToast(
        err.message || "Couldn't update your default address.",
        () => retrySetDefault(variables.id)
      );
    },
    onSettled: (_data, _err, _variables, handle) => {
      handle?.settle();
    },
  });

  const handleSaveAddress = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const data = {
      name: formData.get("name") as string,
      street: formData.get("street") as string,
      city: formData.get("city") as string,
      state: formData.get("state") as string,
      zipCode: formData.get("zipCode") as string,
      country: formData.get("country") as string,
      phone: formData.get("phone") as string,
      addressType: formData.get("addressType") as "shipping" | "billing",
    };

    if (editingAddress) {
      updateMutation.mutate({ id: editingAddress.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between">
          <div className="h-8 bg-white/[0.06] rounded w-32 animate-pulse" />
          <div className="h-10 bg-white/[0.06] rounded w-32 animate-pulse" />
        </div>
        <div className="h-48 bg-white/[0.06] rounded-lg animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AddressesHeader
        onAddClick={() => {
          setEditingAddress(null);
          setIsDialogOpen(true);
        }}
      />
      <AddressList
        addresses={addresses}
        onAddFirstClick={() => setIsDialogOpen(true)}
        onEditClick={(address) => {
          setEditingAddress(address);
          setIsDialogOpen(true);
        }}
        onSetDefault={(id) => setDefaultMutation.mutate({ id })}
        onDelete={(id) => deleteMutation.mutate({ id })}
        isSettingDefault={setDefaultMutation.isPending}
        isDeleting={deleteMutation.isPending}
      />
      <AddressFormDialog
        isOpen={isDialogOpen}
        onClose={() => {
          setIsDialogOpen(false);
          setEditingAddress(null);
        }}
        editingAddress={editingAddress}
        onSave={handleSaveAddress}
        isSaving={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  );
}
