"use client";

/**
 * Shipping Settings
 *
 * Delivery fee per governorate, plus the store-wide free-shipping threshold.
 *
 * Rates lived in environment variables until this screen existed, which put the
 * numbers somewhere the person who knows the courier prices could not reach and
 * made every price change a deploy.
 *
 * Editing is local until Save, and only changed rows are sent. Twenty-seven
 * inputs that each fired a mutation on blur would be twenty-seven writes and
 * twenty-seven chances to half-apply a price change.
 */

import { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Save, Truck } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useAdminWriteAccess } from "@/hooks/use-admin-write-access";
import {
  EGYPT_GOVERNORATES,
  type ShippingZone,
} from "@/domain/shipping/egypt-governorates";
import { STORE_CURRENCY } from "@/lib/currency";

const ZONE_LABELS: Record<ShippingZone, string> = {
  cairo_giza: "Cairo & Giza",
  delta: "Delta governorates",
  other: "Other governorates",
};

const ZONE_ORDER: ShippingZone[] = ["cairo_giza", "delta", "other"];

interface RateDraft {
  fee: string;
  isDeliverable: boolean;
}

export function ShippingSettings() {
  const { canWrite } = useAdminWriteAccess();
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.admin.shipping.getConfig.useQuery();

  const [drafts, setDrafts] = useState<Record<string, RateDraft> | null>(null);
  const [threshold, setThreshold] = useState<string | null>(null);

  // Derived from the loaded config on first render that has it, without an
  // effect: setting state inside useEffect renders once with stale values and
  // React 19 flags it.
  const saved = useMemo(() => {
    const map: Record<string, RateDraft> = {};
    for (const g of EGYPT_GOVERNORATES) {
      const row = data?.rates.find((r) => r.governorate === g.code);
      map[g.code] = {
        fee: String(row?.fee ?? 0),
        isDeliverable: row?.isDeliverable ?? true,
      };
    }
    return map;
  }, [data]);

  const current = drafts ?? saved;
  const currentThreshold =
    threshold ?? String(data?.freeShippingThreshold ?? 0);

  const updateRates = trpc.admin.shipping.updateRates.useMutation();
  const setThresholdMutation =
    trpc.admin.shipping.setFreeShippingThreshold.useMutation();

  const isDirty =
    EGYPT_GOVERNORATES.some(
      (g) =>
        current[g.code].fee !== saved[g.code].fee ||
        current[g.code].isDeliverable !== saved[g.code].isDeliverable
    ) || currentThreshold !== String(data?.freeShippingThreshold ?? 0);

  const setRate = (code: string, patch: Partial<RateDraft>) =>
    setDrafts({ ...current, [code]: { ...current[code], ...patch } });

  const setZone = (zone: ShippingZone, fee: string) => {
    const next = { ...current };
    for (const g of EGYPT_GOVERNORATES.filter((x) => x.zone === zone)) {
      next[g.code] = { ...next[g.code], fee };
    }
    setDrafts(next);
  };

  const save = async () => {
    // Only what changed. Sending all 27 every time would rewrite rows nobody
    // touched and lose the audit value of `updated_by`.
    const changed = EGYPT_GOVERNORATES.filter(
      (g) =>
        current[g.code].fee !== saved[g.code].fee ||
        current[g.code].isDeliverable !== saved[g.code].isDeliverable
    ).map((g) => ({
      governorate: g.code,
      fee: Number(current[g.code].fee) || 0,
      isDeliverable: current[g.code].isDeliverable,
    }));

    try {
      if (changed.length > 0) await updateRates.mutateAsync({ rates: changed });
      if (currentThreshold !== String(data?.freeShippingThreshold ?? 0)) {
        await setThresholdMutation.mutateAsync({
          value: Number(currentThreshold) || 0,
        });
      }
      await utils.admin.shipping.getConfig.invalidate();
      setDrafts(null);
      setThreshold(null);
      toast.success("Shipping rates saved");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save shipping rates"
      );
    }
  };

  const isSaving = updateRates.isPending || setThresholdMutation.isPending;

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="size-5" />
            Free shipping threshold
          </CardTitle>
          <CardDescription>
            Orders at or above this value ship free, whatever the destination.
            Set it to 0 for no threshold — that means no order ships free, not
            that every order does.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              step="0.01"
              value={currentThreshold}
              readOnly={!canWrite}
              onChange={(e) => setThreshold(e.target.value)}
              className="w-40 rounded-lg border bg-background px-3 py-2 text-sm text-foreground"
            />
            <span className="text-sm text-muted-foreground">
              {STORE_CURRENCY}
            </span>
          </div>
        </CardContent>
      </Card>

      {ZONE_ORDER.map((zone) => (
        <Card key={zone}>
          <CardHeader>
            <CardTitle className="text-base">{ZONE_LABELS[zone]}</CardTitle>
            <CardDescription className="flex flex-wrap items-center gap-2">
              <span>Delivery fee per governorate, in {STORE_CURRENCY}.</span>
              {canWrite && (
                <span className="flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="set all"
                    aria-label={`Set every fee in ${ZONE_LABELS[zone]}`}
                    className="w-24 rounded border bg-background px-2 py-1 text-xs text-foreground"
                    onChange={(e) => setZone(zone, e.target.value)}
                  />
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {EGYPT_GOVERNORATES.filter((g) => g.zone === zone).map((g) => (
              <div
                key={g.code}
                className="flex items-center justify-between gap-2 rounded-lg border p-2"
              >
                <label
                  htmlFor={`fee-${g.code}`}
                  className="min-w-0 truncate text-sm"
                  title={g.ar}
                >
                  {g.en}
                </label>
                <div className="flex shrink-0 items-center gap-2">
                  <input
                    id={`fee-${g.code}`}
                    type="number"
                    min={0}
                    step="0.01"
                    value={current[g.code].fee}
                    readOnly={!canWrite}
                    disabled={!current[g.code].isDeliverable}
                    onChange={(e) => setRate(g.code, { fee: e.target.value })}
                    className="w-20 rounded border bg-background px-2 py-1 text-sm text-foreground disabled:opacity-40"
                  />
                  <label className="flex items-center gap-1 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={current[g.code].isDeliverable}
                      disabled={!canWrite}
                      onChange={(e) =>
                        setRate(g.code, { isDeliverable: e.target.checked })
                      }
                    />
                    Ships
                  </label>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      {canWrite && (
        <div className="flex justify-end">
          <Button onClick={save} disabled={!isDirty || isSaving}>
            {isSaving ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Save className="mr-2 size-4" />
            )}
            Save shipping rates
          </Button>
        </div>
      )}
    </div>
  );
}
