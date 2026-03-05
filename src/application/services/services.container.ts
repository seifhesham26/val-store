/**
 * Services Container
 *
 * Email service and site config repository.
 */

import { ResendEmailService } from "@/infrastructure/services/resend-email.service";
import { DrizzleSiteConfigRepository } from "@/infrastructure/database/repositories/site-config.repository";

export function createServicesModule() {
  let emailService: ResendEmailService | undefined;
  let siteConfigRepo: DrizzleSiteConfigRepository | undefined;

  return {
    getEmailService: () => (emailService ??= new ResendEmailService()),
    getSiteConfigRepository: () =>
      (siteConfigRepo ??= new DrizzleSiteConfigRepository()),
  };
}

export type ServicesModule = ReturnType<typeof createServicesModule>;
