import { router } from "../../trpc";
import { siteSettingsProcedures } from "./settings/site-settings";
import { contentSectionsProcedures } from "./settings/content-sections";
import { featuredItemsProcedures } from "./settings/featured-items";

export const settingsRouter = router({
  ...siteSettingsProcedures,
  ...contentSectionsProcedures,
  ...featuredItemsProcedures,
});
