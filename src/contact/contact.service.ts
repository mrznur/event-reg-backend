import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailService } from '../mail/mail.service';
import { ContactDto } from './contact.dto';

@Injectable()
export class ContactService {
  private readonly inboxEmail: string;

  constructor(
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {
    this.inboxEmail = this.config.get<string>('CONTACT_EMAIL') ?? 'info@bucc.club';
  }

  async send(dto: ContactDto) {
    await this.mail.sendContactForm({
      to: this.inboxEmail,
      fromName: dto.name,
      fromEmail: dto.email,
      message: dto.message,
    });
    return { ok: true };
  }
}
