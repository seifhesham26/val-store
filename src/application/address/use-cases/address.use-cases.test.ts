import { describe, it, expect, vi } from "vitest";
import {
  DeleteAddressUseCase,
  UpdateAddressUseCase,
  CreateAddressUseCase,
} from "./address.use-cases";
import type { AddressRepositoryInterface } from "@/domain/address/interfaces/repositories/address.repository.interface";
import type { Address, NewAddress } from "@/db/schema";

function address(over: Partial<Address> = {}): Address {
  return {
    id: "addr-1",
    userId: "user-1",
    addressType: "shipping",
    isDefault: false,
    fullName: "A Customer",
    addressLine1: "1 Street",
    addressLine2: null,
    city: "Cairo",
    state: "Cairo",
    postalCode: "11511",
    country: "EG",
    phone: "+201000000000",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  } as Address;
}

function repo(rows: Address[]): AddressRepositoryInterface {
  return {
    findById: vi.fn(async (id: string) => rows.find((r) => r.id === id)),
    findByUserId: vi.fn(async (userId: string) =>
      rows.filter((r) => r.userId === userId)
    ),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(async () => undefined),
    setDefault: vi.fn(),
  } as unknown as AddressRepositoryInterface;
}

describe("DeleteAddressUseCase", () => {
  it("deletes an address the caller owns", async () => {
    const rows = [address(), address({ id: "addr-2" })];
    const repository = repo(rows);

    await new DeleteAddressUseCase(repository).execute("addr-1", "user-1");

    expect(repository.delete).toHaveBeenCalledWith("addr-1");
  });

  it("refuses an address belonging to someone else", async () => {
    const repository = repo([address({ userId: "someone-else" })]);

    await expect(
      new DeleteAddressUseCase(repository).execute("addr-1", "user-1")
    ).rejects.toThrow(/not found or access denied/i);
    expect(repository.delete).not.toHaveBeenCalled();
  });

  it("says the same thing for an id that does not exist", async () => {
    // One message for missing and for not-yours: distinguishing them confirms
    // an id exists.
    const repository = repo([]);

    await expect(
      new DeleteAddressUseCase(repository).execute("nope", "user-1")
    ).rejects.toThrow(/not found or access denied/i);
  });

  it("keeps the last shipping address — checkout needs one", async () => {
    const repository = repo([address()]);

    await expect(
      new DeleteAddressUseCase(repository).execute("addr-1", "user-1")
    ).rejects.toThrow(/only shipping address/i);
    expect(repository.delete).not.toHaveBeenCalled();
  });

  it("counts only shipping addresses towards that floor", async () => {
    // A billing address is not a substitute: checkout cannot ship to it.
    const repository = repo([
      address(),
      address({ id: "addr-2", addressType: "billing" }),
    ]);

    await expect(
      new DeleteAddressUseCase(repository).execute("addr-1", "user-1")
    ).rejects.toThrow(/only shipping address/i);
  });

  it("deletes the last billing address freely", async () => {
    // Checkout defaults billing to shipping, so nothing breaks.
    const repository = repo([
      address(),
      address({ id: "addr-2", addressType: "billing" }),
    ]);

    await new DeleteAddressUseCase(repository).execute("addr-2", "user-1");

    expect(repository.delete).toHaveBeenCalledWith("addr-2");
  });

  it("does not count another customer's addresses towards the floor", async () => {
    const repository = repo([
      address(),
      address({ id: "addr-2", userId: "user-2" }),
    ]);

    await expect(
      new DeleteAddressUseCase(repository).execute("addr-1", "user-1")
    ).rejects.toThrow(/only shipping address/i);
  });
});

describe("UpdateAddressUseCase", () => {
  it("refuses to flip the only shipping address to billing", async () => {
    const repository = repo([address()]);

    await expect(
      new UpdateAddressUseCase(repository).execute("addr-1", "user-1", {
        addressType: "billing",
      })
    ).rejects.toThrow(/only shipping address/i);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("allows the change when another shipping address remains", async () => {
    const repository = repo([address(), address({ id: "addr-2" })]);

    await new UpdateAddressUseCase(repository).execute("addr-1", "user-1", {
      addressType: "billing",
    });

    expect(repository.update).toHaveBeenCalledWith("addr-1", {
      addressType: "billing",
    });
  });

  it("does not count another customer's shipping address as a substitute", async () => {
    const repository = repo([
      address(),
      address({ id: "addr-2", userId: "user-2" }),
    ]);

    await expect(
      new UpdateAddressUseCase(repository).execute("addr-1", "user-1", {
        addressType: "billing",
      })
    ).rejects.toThrow(/only shipping address/i);
  });

  it("allows editing fields other than addressType on the only shipping address", async () => {
    const repository = repo([address()]);

    await new UpdateAddressUseCase(repository).execute("addr-1", "user-1", {
      city: "Alexandria",
    });

    expect(repository.update).toHaveBeenCalledWith("addr-1", {
      city: "Alexandria",
    });
  });

  it("does not guard a billing address changing type", async () => {
    const repository = repo([
      address({ addressType: "shipping" }),
      address({ id: "addr-2", addressType: "billing" }),
    ]);

    await new UpdateAddressUseCase(repository).execute("addr-2", "user-1", {
      addressType: "shipping",
    });

    expect(repository.update).toHaveBeenCalledWith("addr-2", {
      addressType: "shipping",
    });
  });

  it("refuses an address belonging to someone else", async () => {
    const repository = repo([address({ userId: "someone-else" })]);

    await expect(
      new UpdateAddressUseCase(repository).execute("addr-1", "user-1", {
        city: "Giza",
      })
    ).rejects.toThrow(/not found or access denied/i);
    expect(repository.update).not.toHaveBeenCalled();
  });
});

describe("CreateAddressUseCase", () => {
  function newAddress(over: Partial<NewAddress> = {}): NewAddress {
    return {
      userId: "user-1",
      addressType: "shipping",
      isDefault: false,
      fullName: "A Customer",
      addressLine1: "1 Street",
      city: "Cairo",
      state: "Cairo",
      postalCode: "11511",
      country: "EG",
      phone: "+201000000000",
      ...over,
    } as NewAddress;
  }

  it("defaults the first address without mutating the caller's argument", async () => {
    const repository = repo([]);
    const input = newAddress();
    const frozen = { ...input };

    await new CreateAddressUseCase(repository).execute(input);

    // The argument itself must be untouched — the use case derives a new
    // object rather than writing through the parameter.
    expect(input).toEqual(frozen);
    expect(repository.create).toHaveBeenCalledWith({
      ...input,
      isDefault: true,
    });
  });

  it("leaves isDefault alone when the customer already has an address", async () => {
    const repository = repo([address()]);
    const input = newAddress({ isDefault: false });

    await new CreateAddressUseCase(repository).execute(input);

    expect(repository.create).toHaveBeenCalledWith(input);
  });
});
