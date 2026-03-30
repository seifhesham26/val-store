/**
 * Customer Entity
 *
 * Represents a real human identified by phone number.
 * Multiple user accounts can belong to the same customer.
 */

export interface CustomerProps {
  id: string;
  phone: string;
  preferredName: string | null;
  isPhoneVerified: boolean;
  totalOrders: number;
  totalSpent: number;
  loyaltyPoints: number;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class Customer {
  private constructor(private readonly props: CustomerProps) {}

  // Getters
  get id(): string {
    return this.props.id;
  }

  get phone(): string {
    return this.props.phone;
  }

  get preferredName(): string | null {
    return this.props.preferredName;
  }

  get isPhoneVerified(): boolean {
    return this.props.isPhoneVerified;
  }

  get totalOrders(): number {
    return this.props.totalOrders;
  }

  get totalSpent(): number {
    return this.props.totalSpent;
  }

  get loyaltyPoints(): number {
    return this.props.loyaltyPoints;
  }

  get notes(): string | null {
    return this.props.notes;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  // Factory methods
  static create(props: CustomerProps): Customer {
    return new Customer(props);
  }

  static createNew(phone: string, preferredName?: string): Customer {
    return new Customer({
      id: crypto.randomUUID(),
      phone,
      preferredName: preferredName || null,
      isPhoneVerified: false,
      totalOrders: 0,
      totalSpent: 0,
      loyaltyPoints: 0,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // Domain methods
  verifyPhone(): Customer {
    return new Customer({
      ...this.props,
      isPhoneVerified: true,
      updatedAt: new Date(),
    });
  }

  updatePreferredName(name: string): Customer {
    return new Customer({
      ...this.props,
      preferredName: name,
      updatedAt: new Date(),
    });
  }

  addOrder(orderTotal: number): Customer {
    return new Customer({
      ...this.props,
      totalOrders: this.props.totalOrders + 1,
      totalSpent: this.props.totalSpent + orderTotal,
      updatedAt: new Date(),
    });
  }

  addLoyaltyPoints(points: number): Customer {
    return new Customer({
      ...this.props,
      loyaltyPoints: this.props.loyaltyPoints + points,
      updatedAt: new Date(),
    });
  }

  addNote(note: string): Customer {
    const existingNotes = this.props.notes || "";
    const timestamp = new Date().toISOString();
    const newNote = `[${timestamp}] ${note}`;
    return new Customer({
      ...this.props,
      notes: existingNotes ? `${existingNotes}\n${newNote}` : newNote,
      updatedAt: new Date(),
    });
  }

  // Check if customer can use COD
  canUseCashOnDelivery(): boolean {
    return this.props.isPhoneVerified;
  }

  // Convert to plain object
  toProps(): CustomerProps {
    return { ...this.props };
  }
}
