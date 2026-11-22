# BUCC Event Registration — Backend API

NestJS REST API for the BUCC Event Registration System. Handles events, registrations, ticketing, auth, image uploads, gallery, and email notifications.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | NestJS (Express) |
| Language | TypeScript |
| Database | PostgreSQL via Neon (serverless) |
| ORM | Prisma |
| Auth | JWT in HTTP-only cookie |
| Image storage | Cloudinary |
| Email | Nodemailer + Gmail SMTP |
| QR codes | `qrcode` npm package |
| Rate limiting | `@nestjs/throttler` |

---

## Prerequisites

- Node.js 20+
- A [Neon](https://neon.tech) PostgreSQL database
- A [Cloudinary](https://cloudinary.com) account
- A Gmail account with an [App Password](https://myaccount.google.com/apppasswords) generated

---

## Setup

```bash
npm install
```

Copy `.env.example` to `.env` and fill in all values:

```bash
cp .env.example .env
```

Run migrations and seed the database:

```bash
npx prisma migrate deploy
npx prisma db seed
```

Start the development server:

```bash
npm run start:dev
```

The API runs on `http://localhost:4000` with the `/api` prefix.

---

## Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `JWT_SECRET` | Secret for signing JWTs |
| `TICKET_SECRET` | Secret for HMAC-signed ticket codes |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |
| `MAIL_FROM` | Sender email address |
| `MAIL_USER` | Gmail address for SMTP auth |
| `MAIL_APP_PASSWORD` | Gmail App Password |
| `FRONTEND_URL` | Frontend origin (used in email links and QR codes) |
| `CORS_ORIGIN` | Comma-separated allowed CORS origins |
| `API_BASE_URL` | Base URL for terminal scripts (default: `http://localhost:4000/api`) |
| `CONTACT_EMAIL` | Email address that receives contact form submissions |
| `ADMIN_EMAIL` | Admin account email (created by seed) |
| `ADMIN_PASSWORD` | Admin account password (created by seed) |

---

## API Overview

### Public

| Method | URL | Description |
|---|---|---|
| `GET` | `/api/events` | List published events (`?category=`, `?upcoming=true`, `?limit=`) |
| `GET` | `/api/events/:slug` | Single published event |
| `POST` | `/api/events/:slug/register` | Register for an event (no account needed) |
| `GET` | `/api/tickets/:code` | Look up a ticket by code |
| `GET` | `/api/gallery` | All gallery images (`?eventId=`) |
| `GET` | `/api/stats` | Site stats (events, registrations, check-ins, active members) |
| `POST` | `/api/contact` | Contact form (3/min rate limit) |

### Auth

| Method | URL | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Organizer signup — sends 6-digit verification code |
| `POST` | `/api/user/auth/register` | Attendee signup — same flow, sets role ATTENDEE |
| `POST` | `/api/auth/verify` | Verify code, create account, set session cookie |
| `POST` | `/api/auth/resend` | Resend verification code (1 per 30s) |
| `POST` | `/api/auth/login` | Login (all roles) |
| `POST` | `/api/auth/logout` | Clear session cookie |
| `GET` | `/api/auth/me` | Current user (requires auth) |
| `POST` | `/api/auth/forgot-password` | Send password reset code |
| `POST` | `/api/auth/reset-password` | Verify code and set new password |

### Organizer (requires ORGANIZER or ADMIN role)

| Method | URL | Description |
|---|---|---|
| `GET` | `/api/organizer/events` | Organizer's own events |
| `GET` | `/api/organizer/events/:id` | Single event by ID |
| `POST` | `/api/organizer/events` | Create event |
| `PATCH` | `/api/organizer/events/:id` | Update event |
| `PATCH` | `/api/organizer/events/:id/publish` | Publish event |
| `PATCH` | `/api/organizer/events/:id/unpublish` | Revert to draft |
| `PATCH` | `/api/organizer/events/:id/cancel` | Cancel event (emails all registrants) |
| `GET` | `/api/organizer/events/:id/registrations` | List registrations (`?q=` search) |
| `POST` | `/api/organizer/events/:id/check-in` | Check in a ticket `{ ticketCode }` |
| `POST` | `/api/uploads/image` | Upload image to Cloudinary |
| `POST` | `/api/gallery` | Add gallery image |
| `PATCH` | `/api/gallery/:id` | Update gallery image |
| `DELETE` | `/api/gallery/:id` | Delete gallery image |

### Admin (requires ADMIN role)

| Method | URL | Description |
|---|---|---|
| `GET` | `/api/admin/users` | All users |
| `DELETE` | `/api/admin/users/:id` | Delete a user (cannot delete self or admins) |
| `GET` | `/api/admin/events` | All events with organizer info |
| `PATCH` | `/api/admin/events/:id/cancel` | Cancel any event |

---

## Roles

| Role | Access |
|---|---|
| `ORGANIZER` | Manage own events, upload images, manage gallery, check-in |
| `ADMIN` | Everything an organizer can do + user/event admin |
| `ATTENDEE` | Register for events, view events and gallery |

---

## Email Notifications

| Trigger | Recipient | Content |
|---|---|---|
| Successful registration | Registrant | Ticket code + QR code + event details |
| Organizer signup | New organizer | 6-digit verification code |
| Attendee signup | New attendee | 6-digit verification code |
| Forgot password | User | 6-digit reset code |
| Event cancelled | All confirmed/checked-in registrants | Cancellation notice |

---

## Terminal Scripts

All scripts require the API to be running (`npm run start:dev`).

```bash
# Create and publish a new event
npx tsx scripts/create-event.ts --title "..." --description "..." --category WORKSHOP --venue "..." --capacity 50 --starts "2026-12-25T10:00" --ends "2026-12-25T13:00" --coverImage "https://..."

# Set event cover image from a Cloudinary URL
npx tsx scripts/set-event-cover-url.ts "<cloudinaryUrl>" <eventSlug>

# Add a gallery image from a Cloudinary URL
npx tsx scripts/add-gallery-url.ts "<cloudinaryUrl>" "<title>" <eventSlug> "<caption>"

# Cancel an event
npx tsx scripts/delete-event.ts <eventSlug>

# Delete a gallery image
npx tsx scripts/delete-gallery-image.ts <imageId>
```

Event categories: `WORKSHOP` | `TALK` | `HACKATHON` | `SOCIAL`

---

## Seed Accounts

After running `npx prisma db seed`:

| Account | Email | Password | Role |
|---|---|---|---|
| Admin | `admin@bucc.club` | set via `ADMIN_PASSWORD` in `.env` | `ADMIN` |
| Demo Organizer | `organizer@bucc.test` | `bucc-demo-1234` | `ORGANIZER` |

---

## Rate Limits

| Endpoint | Limit |
|---|---|
| All routes (default) | 60 req/min per IP |
| `POST /api/auth/register` | 5 req/min |
| `POST /api/auth/login` | 10 req/min |
| `POST /api/auth/verify` | 10 req/min |
| `POST /api/auth/forgot-password` | 5 req/min |
| `POST /api/auth/reset-password` | 5 req/min |
| `POST /api/contact` | 3 req/min |

---

## Tests

```bash
npm run test
```

---

## Production Checklist

- [ ] Set `CORS_ORIGIN` to your frontend domain
- [ ] Set `FRONTEND_URL` to your frontend domain (used in QR codes and email links)
- [ ] Set a strong `ADMIN_PASSWORD` before seeding
- [ ] Set `ADMIN_LOGIN_PATH` to something secret before deploying
- [ ] Use `npx prisma migrate deploy` (not `migrate dev`) in production
- [ ] Run `npx prisma generate` before starting the server
- [ ] Run `npx prisma db seed` once to create the admin user and seed data
- [ ] Rotate `JWT_SECRET` and `TICKET_SECRET` from any dev values
- [ ] Ensure `.env` is never committed — it is in `.gitignore`
- [ ] Set `NODE_ENV=production` so Cloudinary uploads go to the `production` folder
