/**
 * Address Router
 *
 * tRPC router for address operations.
 */

import { z } from "zod";
import { router, protectedProcedure } from "../../trpc";
import { container } from "@/application/container";

const addressSchema = z.object({
  name: z.string().min(1, "Name is required"),
  street: z.string().min(1, "Street address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  country: z.string().optional(),
  phone: z.string().min(1, "Phone is required"),
  // Defaults to "shipping" so existing callers that never sent this field
  // (the checkout flow's implicit shipping-address creation, older clients)
  // keep working unchanged.
  addressType: z.enum(["shipping", "billing"]).default("shipping"),
});

export const addressRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const useCase = container.getGetUserAddressesUseCase();
    const addresses = await useCase.execute(ctx.user.id);
    // Map DB fields to UI fields if necessary, currently they match roughly
    // DB: addressLine1, addressLine2, postalCode, fullName
    // UI expects: street, zipCode, name
    return addresses.map((addr) => ({
      id: addr.id,
      name: addr.fullName,
      street: addr.addressLine1,
      city: addr.city,
      state: addr.state,
      zipCode: addr.postalCode,
      country: addr.country,
      phone: addr.phone,
      isDefault: addr.isDefault,
      addressType: addr.addressType,
    }));
  }),

  create: protectedProcedure
    .input(addressSchema)
    .mutation(async ({ ctx, input }) => {
      const useCase = container.getCreateAddressUseCase();
      await useCase.execute({
        userId: ctx.user.id,
        fullName: input.name,
        addressLine1: input.street,
        city: input.city,
        state: input.state ?? "",
        postalCode: input.zipCode ?? "",
        country: input.country ?? "",
        phone: input.phone,
        addressType: input.addressType,
      });
      return { success: true };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        data: addressSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const useCase = container.getUpdateAddressUseCase();
      await useCase.execute(input.id, ctx.user.id, {
        fullName: input.data.name,
        addressLine1: input.data.street,
        city: input.data.city,
        state: input.data.state ?? "",
        postalCode: input.data.zipCode ?? "",
        country: input.data.country ?? "",
        phone: input.data.phone,
        addressType: input.data.addressType,
      });
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const useCase = container.getDeleteAddressUseCase();
      await useCase.execute(input.id, ctx.user.id);
      return { success: true };
    }),

  setDefault: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const useCase = container.getSetDefaultAddressUseCase();
      await useCase.execute(ctx.user.id, input.id);
      return { success: true };
    }),
});
