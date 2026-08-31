"use client";

/**
 * Category Form Dialog
 *
 * Create and edit share one form. The slug follows the name as you type, for
 * as long as it is still the slug that name would generate — so renaming
 * "Men's Tee" to "Mens Tees" moves the URL with it. The moment the slug is
 * typed into by hand, or was already something the name would not produce, it
 * stops following: a hand-picked URL is a deliberate choice and renaming the
 * category should not silently overwrite it.
 */

import { useState } from "react";
import { slugify } from "@/domain/shared/slug";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CategoryRow } from "./CategoriesTable";

/** Sentinel for the Select, which cannot hold an empty string value. */
export const NO_PARENT = "none";

interface CategoryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The category being edited, or null when creating a new one. */
  category: CategoryRow | null;
  /** Every category, used to populate the parent picker. */
  categories: CategoryRow[];
  isPending: boolean;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}

export function CategoryFormDialog({
  open,
  onOpenChange,
  category,
  categories,
  isPending,
  onSubmit,
}: CategoryFormDialogProps) {
  const isEditing = category !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            {isEditing ? "Edit Category" : "New Category"}
          </DialogTitle>
          <DialogDescription>
            Categories group products in the storefront and fill the category
            dropdown on the product form.
          </DialogDescription>
        </DialogHeader>

        {/* The form's own state lives one level down on purpose. Radix unmounts
            DialogContent when the dialog closes, so a nested component gets
            fresh state every time it opens — no effect syncing props into
            state, and no stale name left over from the last category edited.
            The key covers the case of switching category with it still open. */}
        <CategoryForm
          key={category?.id ?? "new"}
          category={category}
          categories={categories}
          isPending={isPending}
          onCancel={() => onOpenChange(false)}
          onSubmit={onSubmit}
        />
      </DialogContent>
    </Dialog>
  );
}

function CategoryForm({
  category,
  categories,
  isPending,
  onCancel,
  onSubmit,
}: {
  category: CategoryRow | null;
  categories: CategoryRow[];
  isPending: boolean;
  onCancel: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
  const isEditing = category !== null;

  const [name, setName] = useState(category?.name ?? "");
  const [slug, setSlug] = useState(category?.slug ?? "");
  // Once true the slug is the admin's, not ours, and the name stops driving it.
  // An existing slug the name would not have generated was chosen by hand, so
  // it starts pinned.
  const [slugPinned, setSlugPinned] = useState(
    category !== null && category.slug !== slugify(category.name)
  );

  const handleNameChange = (value: string) => {
    setName(value);
    if (!slugPinned) setSlug(slugify(value));
  };

  const slugChanged = isEditing && slug !== category.slug;

  // A category cannot be its own parent, and picking one of its own children
  // would make a cycle the tree could not be rendered from.
  const parentOptions = categories.filter(
    (option) => option.id !== category?.id && option.parentId !== category?.id
  );

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          required
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="Outerwear"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="slug">
          Slug{" "}
          <span className="text-xs font-normal text-muted-foreground">
            {slugPinned
              ? "(set by hand — the name no longer changes it)"
              : "(follows the name)"}
          </span>
        </Label>
        <Input
          id="slug"
          name="slug"
          value={slug}
          onChange={(e) => {
            setSlugPinned(true);
            setSlug(e.target.value);
          }}
          placeholder="outerwear"
        />
        {slugChanged && (
          <p className="text-xs text-amber-600 dark:text-amber-500">
            The category&rsquo;s URL changes from /{category.slug} to /
            {slugify(slug) || slug}. Links to the old one will break.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={category?.description ?? ""}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="parentId">Parent category</Label>
          <Select name="parentId" defaultValue={category?.parentId ?? NO_PARENT}>
            <SelectTrigger id="parentId">
              <SelectValue placeholder="Top level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_PARENT}>Top level</SelectItem>
              {parentOptions.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="displayOrder">Display order</Label>
          <Input
            id="displayOrder"
            name="displayOrder"
            type="number"
            min={0}
            defaultValue={category?.displayOrder ?? 0}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="imageUrl">Image URL</Label>
        <Input
          id="imageUrl"
          name="imageUrl"
          defaultValue={category?.imageUrl ?? ""}
          placeholder="/images/outerwear.jpg"
        />
      </div>

      <div className="flex items-center justify-between rounded-md border p-3">
        <div>
          <Label htmlFor="isActive">Visible in the storefront</Label>
          <p className="text-xs text-muted-foreground">
            Hidden categories keep their products but disappear from navigation.
          </p>
        </div>
        <Switch
          id="isActive"
          name="isActive"
          defaultChecked={category?.isActive ?? true}
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isEditing ? "Save changes" : "Create category"}
        </Button>
      </div>
    </form>
  );
}
