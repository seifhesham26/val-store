"use client";

/**
 * Admin Categories Page
 *
 * Categories used to be seed-only: `admin.categories.list` existed to fill the
 * product form's dropdown, and nothing could create, rename or retire one.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  CategoriesTable,
  type CategoryRow,
} from "@/components/admin/categories/CategoriesTable";
import {
  CategoryFormDialog,
  NO_PARENT,
} from "@/components/admin/categories/CategoryFormDialog";

export default function AdminCategoriesPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CategoryRow | null>(null);

  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.admin.categories.list.useQuery({});

  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
  };

  const createMutation = trpc.admin.categories.create.useMutation({
    onSuccess: () => {
      utils.admin.categories.list.invalidate();
      closeDialog();
      toast.success("Category created");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.admin.categories.update.useMutation({
    onSuccess: () => {
      utils.admin.categories.list.invalidate();
      closeDialog();
      toast.success("Category updated");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.admin.categories.delete.useMutation({
    onSuccess: () => {
      utils.admin.categories.list.invalidate();
      setPendingDelete(null);
      toast.success("Category deleted");
    },
    // The use case refuses to orphan children or strand products, and says
    // which. Keeping the dialog open lets the admin read why.
    onError: (err) => toast.error(err.message),
  });

  /** Blank optional field means "clear it", not "leave it alone". */
  const text = (form: FormData, name: string) => {
    const value = (form.get(name) as string | null)?.trim();
    return value ? value : null;
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const name = (formData.get("name") as string).trim();
    const slug = text(formData, "slug");
    const parentId = formData.get("parentId") as string | null;
    const displayOrder = parseInt(
      (formData.get("displayOrder") as string) || "0",
      10
    );

    if (editing) {
      updateMutation.mutate({
        id: editing.id,
        data: {
          name,
          // Omitted rather than null: the use case reads "no slug" as "derive it
          // from the name", which is what an empty field should mean.
          ...(slug ? { slug } : {}),
          description: text(formData, "description"),
          parentId: parentId && parentId !== NO_PARENT ? parentId : null,
          imageUrl: text(formData, "imageUrl"),
          displayOrder: Number.isFinite(displayOrder) ? displayOrder : 0,
          isActive: formData.get("isActive") === "on",
        },
      });
      return;
    }

    createMutation.mutate({
      name,
      description: text(formData, "description") ?? undefined,
      parentId: parentId && parentId !== NO_PARENT ? parentId : undefined,
      imageUrl: text(formData, "imageUrl") ?? undefined,
      displayOrder: Number.isFinite(displayOrder) ? displayOrder : 0,
    });
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  const categories = (data?.categories ?? []) as CategoryRow[];

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Categories</h1>
          <p className="text-sm text-muted-foreground">
            {categories.length} categor{categories.length === 1 ? "y" : "ies"}
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Category
        </Button>
      </div>

      <CategoriesTable
        categories={categories}
        onEdit={(category) => {
          setEditing(category);
          setDialogOpen(true);
        }}
        onDelete={setPendingDelete}
      />

      <CategoryFormDialog
        open={dialogOpen}
        onOpenChange={(open) => (open ? setDialogOpen(true) : closeDialog())}
        category={editing}
        categories={categories}
        isPending={createMutation.isPending || updateMutation.isPending}
        onSubmit={handleSubmit}
      />

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete &ldquo;{pendingDelete?.name}&rdquo;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete && pendingDelete.childCount > 0
                ? "This category has subcategories. Move or delete them first."
                : pendingDelete && pendingDelete.productCount > 0
                  ? `This category still has ${pendingDelete.productCount} product(s). Reassign them first.`
                  : "Categories are deleted permanently — unlike products, there is no restoring one."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={
                deleteMutation.isPending ||
                (pendingDelete?.childCount ?? 0) > 0 ||
                (pendingDelete?.productCount ?? 0) > 0
              }
              onClick={() =>
                pendingDelete && deleteMutation.mutate({ id: pendingDelete.id })
              }
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
