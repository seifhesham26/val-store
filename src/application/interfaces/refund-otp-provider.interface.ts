/** Delivery boundary for return-confirmation OTPs. WhatsApp is the launch provider. */
export interface RefundOtpProvider {
  send(input: {
    phone: string;
    code: string;
    requestId: string;
  }): Promise<void>;
}
