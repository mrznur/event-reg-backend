import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';
import QRCode from 'qrcode';

export interface TicketEmailData {
  to: string;
  name: string;
  ticketCode: string;
  eventTitle: string;
  eventSlug: string;
  venue: string;
  startsAt: Date;
  endsAt: Date;
  timezone: string;
}

export interface VerificationEmailData {
  to: string;
  name: string;
  code: string;
}

export interface PasswordResetEmailData {
  to: string;
  name: string;
  code: string;
}

export interface EventCancellationEmailData {
  to: string;
  name: string;
  eventTitle: string;
  venue: string;
  startsAt: Date;
  timezone: string;
}

export interface ContactFormEmailData {
  to: string;
  fromName: string;
  fromEmail: string;
  message: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;
  private readonly from: string;
  private readonly frontendUrl: string;

  constructor(private readonly config: ConfigService) {
    this.from = this.config.getOrThrow<string>('MAIL_FROM');
    this.frontendUrl = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';

    this.transporter = createTransport({
      service: 'gmail',
      auth: {
        user: this.config.getOrThrow<string>('MAIL_USER'),
        pass: this.config.getOrThrow<string>('MAIL_APP_PASSWORD'),
      },
    });
  }

  async sendTicketEmail(data: TicketEmailData): Promise<void> {
    const ticketUrl = `${this.frontendUrl}/tickets/${data.ticketCode}`;
    const qrDataUrl = await QRCode.toDataURL(ticketUrl, {
      width: 200,
      margin: 2,
      color: { dark: '#18181b', light: '#ffffff' },
    });
    // Strip the data:image/png;base64, prefix — we'll embed it inline
    const qrBase64 = qrDataUrl.replace(/^data:image\/png;base64,/, '');

    const subject = `Your ticket for ${data.eventTitle}`;
    const html = this.ticketTemplate(data, ticketUrl, qrBase64);

    try {
      await this.transporter.sendMail({
        from: this.from,
        to: data.to,
        subject,
        html,
        attachments: [
          {
            filename: 'ticket-qr.png',
            content: Buffer.from(qrBase64, 'base64'),
            cid: 'ticket-qr', // referenced as cid:ticket-qr in the HTML
          },
        ],
      });
      this.logger.log(`Ticket email sent to ${data.to}`);
    } catch (error) {
      this.logger.error(
        `Failed to send ticket email to ${data.to}: ${(error as Error).message}`,
      );
    }
  }

  async sendVerificationCode(data: VerificationEmailData): Promise<void> {
    const subject = 'Your BUCC verification code';
    const html = this.verificationTemplate(data);

    try {
      await this.transporter.sendMail({
        from: this.from,
        to: data.to,
        subject,
        html,
      });
      this.logger.log(`Verification code sent to ${data.to}`);
    } catch (error) {
      this.logger.error(
        `Failed to send verification code to ${data.to}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  private formatDate(date: Date, timezone: string): string {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: timezone,
    }).format(date);
  }

  private ticketTemplate(
    data: TicketEmailData,
    ticketUrl: string,
    qrBase64: string,
  ): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#18181b;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7;">

          <!-- Header -->
          <tr>
            <td style="background:#18181b;padding:24px 32px;">
              <h1 style="margin:0;color:#fafafa;font-size:18px;font-weight:600;">BUCC Event Registration</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 4px;color:#71717a;font-size:13px;">Hi ${data.name},</p>
              <p style="margin:0 0 24px;color:#18181b;font-size:15px;line-height:1.6;">
                You're registered for <strong>${data.eventTitle}</strong>. Here's your ticket:
              </p>

              <!-- Ticket code -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
                <tr>
                  <td style="background:#f4f4f5;border-radius:8px;padding:20px;text-align:center;">
                    <p style="margin:0 0 8px;color:#71717a;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Ticket Code</p>
                    <p style="margin:0;font-size:24px;font-weight:700;color:#18181b;letter-spacing:1px;">${data.ticketCode}</p>
                  </td>
                </tr>
              </table>

              <!-- QR code -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td style="text-align:center;padding:16px 0;">
                    <img src="cid:ticket-qr" alt="Ticket QR Code" width="160" height="160"
                      style="display:block;margin:0 auto;border-radius:8px;" />
                    <p style="margin:8px 0 0;color:#71717a;font-size:12px;">Scan to open your ticket</p>
                  </td>
                </tr>
              </table>

              <!-- View ticket link -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td style="text-align:center;">
                    <a href="${ticketUrl}"
                      style="display:inline-block;background:#18181b;color:#fafafa;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:500;">
                      View My Ticket
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Event details -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td style="padding:8px 0;border-bottom:1px solid #f4f4f5;">
                    <span style="color:#71717a;font-size:13px;">When</span><br>
                    <span style="color:#18181b;font-size:14px;">${this.formatDate(data.startsAt, data.timezone)} – ${this.formatDate(data.endsAt, data.timezone)}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0;">
                    <span style="color:#71717a;font-size:13px;">Where</span><br>
                    <span style="color:#18181b;font-size:14px;">${data.venue}</span>
                  </td>
                </tr>
              </table>

              <p style="margin:0;color:#71717a;font-size:13px;line-height:1.5;">
                Show this QR code or your ticket code at the entrance to check in. See you there!
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f4f4f5;padding:16px 32px;">
              <p style="margin:0;color:#a1a1aa;font-size:12px;text-align:center;">
                This is an automated email from BUCC Event Registration.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
  }

  async sendPasswordResetCode(data: PasswordResetEmailData): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.from,
        to: data.to,
        subject: 'Reset your BUCC password',
        html: this.passwordResetTemplate(data),
      });
      this.logger.log(`Password reset code sent to ${data.to}`);
    } catch (error) {
      this.logger.error(`Failed to send reset code to ${data.to}: ${(error as Error).message}`);
      throw error;
    }
  }

  async sendEventCancellation(data: EventCancellationEmailData): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.from,
        to: data.to,
        subject: `Event cancelled: ${data.eventTitle}`,
        html: this.cancellationTemplate(data),
      });
      this.logger.log(`Cancellation email sent to ${data.to}`);
    } catch (error) {
      this.logger.error(`Failed to send cancellation email to ${data.to}: ${(error as Error).message}`);
    }
  }

  private verificationTemplate(data: VerificationEmailData): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#18181b;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7;">

          <tr>
            <td style="background:#18181b;padding:24px 32px;">
              <h1 style="margin:0;color:#fafafa;font-size:18px;font-weight:600;">BUCC Account Verification</h1>
            </td>
          </tr>

          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 4px;color:#71717a;font-size:13px;">Hi ${data.name},</p>
              <p style="margin:0 0 24px;color:#18181b;font-size:15px;line-height:1.6;">
                Use this code to verify your email and complete your signup:
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td style="background:#f4f4f5;border-radius:8px;padding:24px;text-align:center;">
                    <p style="margin:0;font-size:32px;font-weight:700;color:#18181b;letter-spacing:6px;">${data.code}</p>
                  </td>
                </tr>
              </table>

              <p style="margin:0;color:#71717a;font-size:13px;line-height:1.5;">
                This code expires in 10 minutes. If you didn't sign up, you can ignore this email.
              </p>
            </td>
          </tr>

          <tr>
            <td style="background:#f4f4f5;padding:16px 32px;">
              <p style="margin:0;color:#a1a1aa;font-size:12px;text-align:center;">
                This is an automated email from BUCC Event Registration.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
  }

  async sendContactForm(data: ContactFormEmailData): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.from,
        to: data.to,
        replyTo: data.fromEmail,
        subject: `Contact form message from ${data.fromName}`,
        html: `
<p><strong>From:</strong> ${data.fromName} (${data.fromEmail})</p>
<p><strong>Message:</strong></p>
<p style="white-space:pre-wrap">${data.message}</p>`,
      });
      this.logger.log(`Contact form email sent from ${data.fromEmail}`);
    } catch (error) {
      this.logger.error(`Failed to send contact form email: ${(error as Error).message}`);
      throw error;
    }
  }

  private passwordResetTemplate(data: PasswordResetEmailData): string {
    return `
<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#18181b;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;"><tr><td align="center">
    <table width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7;">
      <tr><td style="background:#18181b;padding:24px 32px;"><h1 style="margin:0;color:#fafafa;font-size:18px;font-weight:600;">BUCC Password Reset</h1></td></tr>
      <tr><td style="padding:32px;">
        <p style="margin:0 0 4px;color:#71717a;font-size:13px;">Hi ${data.name},</p>
        <p style="margin:0 0 24px;color:#18181b;font-size:15px;line-height:1.6;">Use this code to reset your password:</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
          <tr><td style="background:#f4f4f5;border-radius:8px;padding:24px;text-align:center;">
            <p style="margin:0;font-size:32px;font-weight:700;color:#18181b;letter-spacing:6px;">${data.code}</p>
          </td></tr>
        </table>
        <p style="margin:0;color:#71717a;font-size:13px;line-height:1.5;">This code expires in 10 minutes. If you didn't request a password reset, you can ignore this email.</p>
      </td></tr>
      <tr><td style="background:#f4f4f5;padding:16px 32px;"><p style="margin:0;color:#a1a1aa;font-size:12px;text-align:center;">This is an automated email from BUCC Event Registration.</p></td></tr>
    </table>
  </td></tr></table>
</body></html>`;
  }

  private cancellationTemplate(data: EventCancellationEmailData): string {
    return `
<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#18181b;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;"><tr><td align="center">
    <table width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7;">
      <tr><td style="background:#18181b;padding:24px 32px;"><h1 style="margin:0;color:#fafafa;font-size:18px;font-weight:600;">Event Cancelled</h1></td></tr>
      <tr><td style="padding:32px;">
        <p style="margin:0 0 4px;color:#71717a;font-size:13px;">Hi ${data.name},</p>
        <p style="margin:0 0 24px;color:#18181b;font-size:15px;line-height:1.6;">
          We're sorry to let you know that <strong>${data.eventTitle}</strong> has been cancelled.
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
          <tr><td style="padding:8px 0;border-bottom:1px solid #f4f4f5;">
            <span style="color:#71717a;font-size:13px;">Was scheduled for</span><br>
            <span style="color:#18181b;font-size:14px;">${this.formatDate(data.startsAt, data.timezone)}</span>
          </td></tr>
          <tr><td style="padding:8px 0;">
            <span style="color:#71717a;font-size:13px;">Venue</span><br>
            <span style="color:#18181b;font-size:14px;">${data.venue}</span>
          </td></tr>
        </table>
        <p style="margin:0;color:#71717a;font-size:13px;line-height:1.5;">We apologise for any inconvenience. Keep an eye out for future events from BUCC.</p>
      </td></tr>
      <tr><td style="background:#f4f4f5;padding:16px 32px;"><p style="margin:0;color:#a1a1aa;font-size:12px;text-align:center;">This is an automated email from BUCC Event Registration.</p></td></tr>
    </table>
  </td></tr></table>
</body></html>`;
  }
}
