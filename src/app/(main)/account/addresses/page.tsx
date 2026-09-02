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

export default function AddressesPage() {
  const utils = trpc.useUtils();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<AddressItem | null>(
    null
  );

  const { data: addresses = [], isLoading } =
    trpc.public.address.list.useQuery();

  const createMutation = trpc.public.address.create.useMutation({
    onSuccess: () => {
      utils.public.address.list.invalidate();
      toast("Address added");
      setIsDialogOpen(false);
    },
    onError: (err) => {
      toast.error("Failed to add address", { description: err.message });
    },
  });

  const updateMutation = trpc.public.address.update.useMutation({
    onSuccess: () => {
      utils.public.address.list.invalidate();
      toast("Address updated");
      setIsDialogOpen(false);
      setEditingAddress(null);
    },
  });

  const deleteMutation = trpc.public.address.delete.useMutation({
    onSuccess: () => {
      utils.public.address.list.invalidate();
      toast("Address deleted");
    },
  });

  const setDefaultMutation = trpc.public.address.setDefault.useMutation({
    onSuccess: () => {
      utils.public.address.list.invalidate();
      toast("Default address updated");
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
