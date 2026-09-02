import { MapPin, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppRouter } from "@/server";
import { inferRouterOutputs } from "@trpc/server";

type RouterOutputs = inferRouterOutputs<AppRouter>;
export type AddressItem = RouterOutputs["public"]["address"]["list"][number];

interface AddressListProps {
  addresses: AddressItem[];
  onAddFirstClick: () => void;
  onEditClick: (address: AddressItem) => void;
  onSetDefault: (id: string) => void;
  onDelete: (id: string) => void;
  isSettingDefault: boolean;
  isDeleting: boolean;
}

export function AddressList({
  addresses,
  onAddFirstClick,
  onEditClick,
  onSetDefault,
  onDelete,
  isSettingDefault,
  isDeleting,
}: AddressListProps) {
  if (addresses.length === 0) {
    return (
      <div className="bg-zinc-900 border border-white/10 rounded-lg py-12 text-center">
        <MapPin className="h-12 w-12 mx-auto text-gray-600 mb-4" />
        <p className="text-gray-400">No addresses saved yet.</p>
        <button
          onClick={onAddFirstClick}
          className="mt-2 text-val-accent hover:underline text-sm"
        >
          Add your first address
        </button>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {addresses.map((address) => (
        <div
          key={address.id}
          className={`bg-zinc-900 border rounded-lg p-4 ${
            address.isDefault ? "border-val-accent/40" : "border-white/10"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-base font-semibold text-white">
              {address.name}
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-xs bg-white/[0.06] text-gray-300 px-2 py-1 rounded-full capitalize">
                {address.addressType}
              </span>
              {address.isDefault && (
                <span className="text-xs bg-val-accent/15 text-val-accent px-2 py-1 rounded-full">
                  Default
                </span>
              )}
            </div>
          </div>
          <p className="text-sm text-gray-400 mb-4 leading-relaxed">
            {address.street}
            <br />
            {address.city}, {address.state} {address.zipCode}
            <br />
            {address.country}
          </p>
          <div className="flex gap-2">
            {!address.isDefault && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onSetDefault(address.id)}
                disabled={isSettingDefault}
                className="border-white/10 text-gray-300 hover:bg-white/[0.04] hover:text-white text-xs"
              >
                Set as Default
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEditClick(address)}
              className="text-gray-400 hover:text-white hover:bg-white/[0.04]"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
              onClick={() => onDelete(address.id)}
              disabled={isDeleting}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
