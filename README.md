# Val Store

Premium streetwear e-commerce platform built with Next.js 16, TypeScript, and modern best practices.

## Tech Stack

- **Framework:** Next.js 16 with App Router
- **Language:** TypeScript
- **Database:** PostgreSQL with Drizzle ORM
- **Authentication:** Better Auth
- **Payments:** Stripe + Cash on Delivery
- **Styling:** Tailwind CSS 4 + shadcn/ui
- **State:** Zustand
- **API:** tRPC
- **File Uploads:** UploadThing
- **Testing:** Vitest

## Getting Started

### Prerequisites

- Node.js 22+
- pnpm 10+
- PostgreSQL database

### Installation

1. Clone the repository:

```bash
git clone https://github.com/seifXXII/val-store.git
cd val-store
```

2. Install dependencies:

```bash
pnpm install
```

3. Copy environment variables:

```bash
cp .env.example .env.local
```

4. Update `.env.local` with your values

5. Run database migrations:

```bash
pnpm db:push
```

6. Seed the database (optional):

```bash
pnpm seed
```

7. Start the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## Scripts

| Script            | Description                  |
| ----------------- | ---------------------------- |
| `pnpm dev`        | Start development server     |
| `pnpm build`      | Build for production         |
| `pnpm start`      | Start production server      |
| `pnpm lint`       | Run ESLint                   |
| `pnpm type-check` | Run TypeScript type checking |
| `pnpm test`       | Run tests once               |
| `pnpm test:watch` | Run tests in watch mode      |
| `pnpm test:ui`    | Run tests with UI            |
| `pnpm db:push`    | Push schema to database      |
| `pnpm db:studio`  | Open Drizzle Studio          |
| `pnpm seed`       | Seed the database            |

## Project Structure

```
src/
├── app/                 # Next.js App Router pages
│   ├── (auth)/          # Auth pages (login, register, etc.)
│   ├── (main)/          # Storefront pages
│   ├── admin/           # Admin dashboard
│   └── api/             # API routes
├── components/          # React components
├── domain/              # Domain entities and interfaces
├── application/         # Use cases and business logic
├── infrastructure/      # Database repositories
├── lib/                 # Utilities and configs
└── server/              # tRPC routers
```

## Environment Variables

See `.env.example` for required environment variables.

## License

Private project - All rights reserved.
