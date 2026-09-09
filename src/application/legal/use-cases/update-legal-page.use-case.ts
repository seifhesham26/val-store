/**
 * Update Legal Page Use Case
 *
 * Updates a legal page's content. The repository records the previous
 * state as a history row in the same transaction.
 */

import { LegalPageRepositoryInterface } from "@/domain/legal/interfaces/repositories/legal-page.repository.interface";
import { UpdateLegalPageInput } from "@/domain/legal/interfaces/repositories/legal-page.repository.interface";
import { LegalPageEntity } from "@/domain/legal/entities/legal-page.entity";

export class UpdateLegalPageUseCase {
  constructor(
    private readonly legalPageRepository: LegalPageRepositoryInterface
  ) {}

  async execute(input: UpdateLegalPageInput): Promise<LegalPageEntity> {
    return this.legalPageRepository.update(input);
  }
}
