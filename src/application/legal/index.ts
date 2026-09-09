/**
 * Legal Domain Container
 *
 * Provides singleton instances of the legal page repository and use cases.
 */

import { DrizzleLegalPageRepository } from "@/infrastructure/database/repositories/legal/legal-page.repository";
import { UpdateLegalPageUseCase } from "./use-cases/update-legal-page.use-case";

export function createLegalModule() {
  let legalPageRepo: DrizzleLegalPageRepository | undefined;

  const getLegalPageRepository = () =>
    (legalPageRepo ??= new DrizzleLegalPageRepository());

  let updateLegalPage: UpdateLegalPageUseCase | undefined;

  return {
    getLegalPageRepository,

    getUpdateLegalPageUseCase: () =>
      (updateLegalPage ??= new UpdateLegalPageUseCase(
        getLegalPageRepository()
      )),
  };
}

export type LegalModule = ReturnType<typeof createLegalModule>;
