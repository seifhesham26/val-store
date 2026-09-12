import { Button } from "@/components/ui/button";
import { EGYPT_GOVERNORATES } from "@/domain/shipping/egypt-governorates";

interface AddressFormData {
  name: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  phone?: string | null;
  addressType?: "shipping" | "billing";
}

interface AddressFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  editingAddress: AddressFormData | null;
  onSave: (e: React.FormEvent<HTMLFormElement>) => void;
  isSaving: boolean;
}

export function AddressFormDialog({
  isOpen,
  onClose,
  editingAddress,
  onSave,
  isSaving,
}: AddressFormDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-zinc-900 border border-white/10 rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">
          {editingAddress ? "Edit Address" : "Add New Address"}
        </h3>
        <form onSubmit={onSave} className="space-y-4">
          <FormField
            id="name"
            label="Full Name"
            defaultValue={editingAddress?.name}
            required
          />
          <FormField
            id="street"
            label="Street Address"
            defaultValue={editingAddress?.street}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <FormField
              id="city"
              label="City"
              defaultValue={editingAddress?.city}
              required
            />
            <GovernorateField defaultValue={editingAddress?.state} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField
              id="zipCode"
              label="Postal Code"
              defaultValue={editingAddress?.zipCode}
            />
            <FormField
              id="country"
              label="Country"
              defaultValue={editingAddress?.country || "Egypt"}
            />
          </div>
          <FormField
            id="phone"
            label="Phone"
            defaultValue={editingAddress?.phone || undefined}
            required
          />
          <div className="space-y-1.5">
            <label
              htmlFor="addressType"
              className="block text-sm font-medium text-gray-300"
            >
              Address Type
            </label>
            <select
              id="addressType"
              name="addressType"
              defaultValue={editingAddress?.addressType ?? "shipping"}
              className="w-full px-3 py-2 bg-white/[0.06] border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-val-accent/50 focus:border-val-accent/50 transition-colors"
            >
              <option value="shipping" className="bg-zinc-900">
                Shipping
              </option>
              <option value="billing" className="bg-zinc-900">
                Billing
              </option>
            </select>
          </div>
          <p className="text-[11px] leading-relaxed text-gray-500">
            Your address and phone number are used for order delivery. See our{" "}
            <a
              href="/privacy"
              className="text-gray-400 underline underline-offset-2 hover:text-white"
            >
              Privacy Policy
            </a>
            .
          </p>
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1 border-white/10 text-gray-300 hover:bg-white/[0.04] hover:text-white"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-val-accent hover:bg-val-accent/90 text-black font-medium"
              disabled={isSaving}
            >
              {editingAddress ? "Update Address" : "Add Address"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

const FIELD_CLASS =
  "w-full px-3 py-2 bg-white/[0.06] border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-val-accent/50 focus:border-val-accent/50 transition-colors";

/**
 * Governorate picker.
 *
 * Egypt is divided into governorates, not states — the field was labelled
 * "State/Province" and free-typed, which is a US shape and made the value
 * unusable for shipping zones.
 *
 * `addresses.state` is still a free-text column, so addresses saved before this
 * existed can hold anything. An unrecognised stored value is offered as its own
 * option rather than being dropped: silently blanking it would corrupt a saved
 * address just by opening the form to edit something else.
 */
function GovernorateField({ defaultValue }: { defaultValue?: string }) {
  const isKnown = EGYPT_GOVERNORATES.some((g) => g.en === defaultValue);

  return (
    <div className="space-y-1.5">
      <label
        htmlFor="state"
        className="block text-sm font-medium text-gray-300"
      >
        Governorate
      </label>
      <select
        id="state"
        name="state"
        defaultValue={defaultValue ?? ""}
        className={FIELD_CLASS}
      >
        {/*
         * Every option carries `bg-zinc-900` like the address-type select
         * above. A native option inherits the light palette otherwise and
         * renders white-on-white — the recurring two-themes-one-root trap.
         */}
        <option value="" className="bg-zinc-900">
          Select a governorate
        </option>
        {defaultValue && !isKnown && (
          <option value={defaultValue} className="bg-zinc-900">
            {defaultValue}
          </option>
        )}
        {EGYPT_GOVERNORATES.map((g) => (
          <option key={g.code} value={g.en} className="bg-zinc-900">
            {g.en}
          </option>
        ))}
      </select>
    </div>
  );
}

function FormField({
  id,
  label,
  defaultValue,
  required,
}: {
  id: string;
  label: string;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-gray-300">
        {label}
      </label>
      <input
        id={id}
        name={id}
        defaultValue={defaultValue}
        required={required}
        className="w-full px-3 py-2 bg-white/[0.06] border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-val-accent/50 focus:border-val-accent/50 transition-colors"
      />
    </div>
  );
}
