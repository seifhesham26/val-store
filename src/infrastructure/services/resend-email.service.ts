/**
 * Resend Email Service
 *
 * Implementation of EmailServiceInterface using Resend.
 * Resend is a modern email API for developers.
 *
 * @see https://resend.com/docs
 */

import { Resend } from "resend";
import {
  EmailServiceInterface,
  SendEmailInput,
  SendEmailResult,
} from "@/application/interfaces/email.interface";

export class ResendEmailService implements EmailServiceInterface {
  private readonly resend: Resend;
  private readonly fromEmail: string;
  private readonly appName: string;
  private readonly baseUrl: string;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("RESEND_API_KEY is not set — email service unavailable");
    }
    this.resend = new Resend(apiKey);
    this.fromEmail =
      process.env.EMAIL_FROM || "Valkyrie <noreply@valstore.com>";
    this.appName = process.env.NEXT_PUBLIC_APP_NAME || "Valkyrie";
    this.baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  }

  async sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
    try {
      const { data, error } = await this.resend.emails.send({
        from: input.from || this.fromEmail,
        to: Array.isArray(input.to) ? input.to : [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
      });

      if (error) {
        return { id: "", success: false };
      }

      return { id: data?.id || "", success: true };
    } catch {
      return { id: "", success: false };
    }
  }

  async sendVerificationEmail(
    email: string,
    verificationUrl: string,
    userName?: string
  ): Promise<void> {
    const name = userName || "there";
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Verify your email</title>
        </head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #333;">Verify your email address</h1>
          <p>Hi ${name},</p>
          <p>Thanks for signing up for ${this.appName}! Please verify your email address by clicking the button below:</p>
          <p style="margin: 30px 0;">
            <a href="${verificationUrl}" 
               style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Verify Email
            </a>
          </p>
          <p style="color: #666; font-size: 14px;">
            If you didn't create an account, you can safely ignore this email.
          </p>
          <p style="color: #666; font-size: 14px;">
            This link will expire in 24 hours.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px;">
            ${this.appName} · <a href="${this.baseUrl}">${this.baseUrl}</a>
          </p>
        </body>
      </html>
    `;

    await this.sendEmail({
      to: email,
      subject: `Verify your ${this.appName} account`,
      html,
      text: `Hi ${name}, verify your email by visiting: ${verificationUrl}`,
    });
  }

  async sendPasswordResetEmail(
    email: string,
    resetUrl: string,
    userName?: string
  ): Promise<void> {
    const name = userName || "there";
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Reset your password</title>
        </head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #333;">Reset your password</h1>
          <p>Hi ${name},</p>
          <p>We received a request to reset your password. Click the button below to choose a new one:</p>
          <p style="margin: 30px 0;">
            <a href="${resetUrl}" 
               style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Reset Password
            </a>
          </p>
          <p style="color: #666; font-size: 14px;">
            If you didn't request a password reset, you can safely ignore this email.
          </p>
          <p style="color: #666; font-size: 14px;">
            This link will expire in 1 hour.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px;">
            ${this.appName} · <a href="${this.baseUrl}">${this.baseUrl}</a>
          </p>
        </body>
      </html>
    `;

    await this.sendEmail({
      to: email,
      subject: `Reset your ${this.appName} password`,
      html,
      text: `Hi ${name}, reset your password by visiting: ${resetUrl}`,
    });
  }

  async sendOrderConfirmation(
    email: string,
    orderNumber: string,
    orderDetails: {
      items: { name: string; quantity: number; price: number }[];
      total: number;
      shippingAddress: string;
    }
  ): Promise<void> {
    const itemsHtml = orderDetails.items
      .map(
        (item) => `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.name}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">$${item.price.toFixed(2)}</td>
        </tr>
      `
      )
      .join("");

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Order Confirmation</title>
        </head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #333;">Order Confirmed! 🎉</h1>
          <p>Thank you for your order. We're getting it ready for you.</p>
          <p style="background: #f5f5f5; padding: 15px; border-radius: 6px;">
            <strong>Order Number:</strong> ${orderNumber}
          </p>
          <h2 style="color: #333; margin-top: 30px;">Order Details</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background: #f5f5f5;">
                <th style="padding: 10px; text-align: left;">Item</th>
                <th style="padding: 10px; text-align: center;">Qty</th>
                <th style="padding: 10px; text-align: right;">Price</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
              <tr>
                <td colspan="2" style="padding: 10px; text-align: right;"><strong>Total:</strong></td>
                <td style="padding: 10px; text-align: right;"><strong>$${orderDetails.total.toFixed(2)}</strong></td>
              </tr>
            </tbody>
          </table>
          <h2 style="color: #333; margin-top: 30px;">Shipping Address</h2>
          <p style="background: #f5f5f5; padding: 15px; border-radius: 6px; white-space: pre-line;">
            ${orderDetails.shippingAddress}
          </p>
          <p style="margin-top: 30px;">
            <a href="${this.baseUrl}/orders/${orderNumber}" 
               style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              View Order
            </a>
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px;">
            ${this.appName} · <a href="${this.baseUrl}">${this.baseUrl}</a>
          </p>
        </body>
      </html>
    `;

    await this.sendEmail({
      to: email,
      subject: `Order Confirmed - ${orderNumber}`,
      html,
      text: `Order ${orderNumber} confirmed. Total: $${orderDetails.total.toFixed(2)}`,
    });
  }

  async sendWelcomeEmail(email: string, userName?: string): Promise<void> {
    const name = userName || "there";
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Welcome to ${this.appName}</title>
        </head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #333;">Welcome to ${this.appName}! 🎉</h1>
          <p>Hi ${name},</p>
          <p>Thanks for verifying your email! Your account is now fully activated.</p>
          <p>Here's what you can do next:</p>
          <ul>
            <li>Browse our latest collection</li>
            <li>Create your wishlist</li>
            <li>Enjoy exclusive member discounts</li>
          </ul>
          <p style="margin: 30px 0;">
            <a href="${this.baseUrl}/shop" 
               style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Start Shopping
            </a>
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px;">
            ${this.appName} · <a href="${this.baseUrl}">${this.baseUrl}</a>
          </p>
        </body>
      </html>
    `;

    await this.sendEmail({
      to: email,
      subject: `Welcome to ${this.appName}!`,
      html,
      text: `Welcome to ${this.appName}, ${name}! Start shopping at ${this.baseUrl}/shop`,
    });
  }
}
