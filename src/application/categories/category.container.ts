/**
 * Category Domain Container
 *
 * Provides singleton instances of category repository and use cases.
 */

import { DrizzleCategoryRepository } from "@/infrastructure/database/repositories/category.repository";
import { ListCategoriesUseCase } from "./use-cases/list-categories.use-case";
import { CreateCategoryUseCase } from "./use-cases/create-category.use-case";
import { DeleteCategoryUseCase } from "./use-cases/delete-category.use-case";
import { UpdateCategoryUseCase } from "./use-cases/update-category.use-case";

export function createCategoryModule() {
  let repo: DrizzleCategoryRepository | undefined;
  const getCategoryRepository = () =>
    (repo ??= new DrizzleCategoryRepository());

  let list: ListCategoriesUseCase | undefined;
  let create: CreateCategoryUseCase | undefined;
  let del: DeleteCategoryUseCase | undefined;
  let update: UpdateCategoryUseCase | undefined;

  return {
    getCategoryRepository,
    getListCategoriesUseCase: () =>
      (list ??= new ListCategoriesUseCase(getCategoryRepository())),
    getCreateCategoryUseCase: () =>
      (create ??= new CreateCategoryUseCase(getCategoryRepository())),
    getDeleteCategoryUseCase: () =>
      (del ??= new DeleteCategoryUseCase(getCategoryRepository())),
    getUpdateCategoryUseCase: () =>
      (update ??= new UpdateCategoryUseCase(getCategoryRepository())),
  };
}

export type CategoryModule = ReturnType<typeof createCategoryModule>;
