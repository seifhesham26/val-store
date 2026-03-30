/**
 * Product Domain Container
 *
 * Provides singleton instances of product repositories and use cases.
 * Covers: products, product variants, product images.
 */

import { DrizzleProductRepository } from "@/infrastructure/database/repositories/products/product.repository";
import { DrizzleProductVariantRepository } from "@/infrastructure/database/repositories/products/product-variant.repository";
import { DrizzleProductImageRepository } from "@/infrastructure/database/repositories/products/product-image.repository";
import { CreateProductUseCase } from "./use-cases/create-product.use-case";
import { ListProductsUseCase } from "./use-cases/list-products.use-case";
import { GetProductUseCase } from "./use-cases/get-product.use-case";
import { DeleteProductUseCase } from "./use-cases/delete-product.use-case";
import { ToggleProductStatusUseCase } from "./use-cases/toggle-product-status.use-case";
import { UpdateProductUseCase } from "./use-cases/update-product.use-case";
import { AddProductVariantUseCase } from "./use-cases/add-product-variant.use-case";
import { UpdateVariantStockUseCase } from "./use-cases/update-variant-stock.use-case";
import { AddProductImageUseCase } from "./use-cases/add-product-image.use-case";
import { RemoveProductImageUseCase } from "./use-cases/remove-product-image.use-case";

export function createProductModule() {
  let productRepo: DrizzleProductRepository | undefined;
  let variantRepo: DrizzleProductVariantRepository | undefined;
  let imageRepo: DrizzleProductImageRepository | undefined;

  const getProductRepository = () =>
    (productRepo ??= new DrizzleProductRepository());
  const getProductVariantRepository = () =>
    (variantRepo ??= new DrizzleProductVariantRepository());
  const getProductImageRepository = () =>
    (imageRepo ??= new DrizzleProductImageRepository());

  let createProduct: CreateProductUseCase | undefined;
  let listProducts: ListProductsUseCase | undefined;
  let getProduct: GetProductUseCase | undefined;
  let deleteProduct: DeleteProductUseCase | undefined;
  let toggleProductStatus: ToggleProductStatusUseCase | undefined;
  let updateProduct: UpdateProductUseCase | undefined;
  let addVariant: AddProductVariantUseCase | undefined;
  let updateVariantStock: UpdateVariantStockUseCase | undefined;
  let addImage: AddProductImageUseCase | undefined;
  let removeImage: RemoveProductImageUseCase | undefined;

  return {
    getProductRepository,
    getProductVariantRepository,
    getProductImageRepository,

    getCreateProductUseCase: () =>
      (createProduct ??= new CreateProductUseCase(getProductRepository())),
    getListProductsUseCase: () =>
      (listProducts ??= new ListProductsUseCase(getProductRepository())),
    getGetProductUseCase: () =>
      (getProduct ??= new GetProductUseCase(getProductRepository())),
    getDeleteProductUseCase: () =>
      (deleteProduct ??= new DeleteProductUseCase(getProductRepository())),
    getToggleProductStatusUseCase: () =>
      (toggleProductStatus ??= new ToggleProductStatusUseCase(
        getProductRepository()
      )),
    getUpdateProductUseCase: () =>
      (updateProduct ??= new UpdateProductUseCase(getProductRepository())),
    getAddProductVariantUseCase: () =>
      (addVariant ??= new AddProductVariantUseCase(
        getProductVariantRepository(),
        getProductRepository()
      )),
    getUpdateVariantStockUseCase: () =>
      (updateVariantStock ??= new UpdateVariantStockUseCase(
        getProductVariantRepository()
      )),
    getAddProductImageUseCase: () =>
      (addImage ??= new AddProductImageUseCase(
        getProductImageRepository(),
        getProductRepository()
      )),
    getRemoveProductImageUseCase: () =>
      (removeImage ??= new RemoveProductImageUseCase(
        getProductImageRepository()
      )),
  };
}

export type ProductModule = ReturnType<typeof createProductModule>;
