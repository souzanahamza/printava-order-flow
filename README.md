# Printava Order Flow

A high-performance, modern order management dashboard for print shops. Built with **React 18, TypeScript, Vite, Tailwind CSS**, and **Supabase** for auth and data.

[![Live Demo](https://img.shields.io/badge/Live-Demo-brightgreen?style=for-the-badge)](https://print-flow-ten.vercel.app)
[![Mobile](https://img.shields.io/badge/Mobile-Android-blue?style=for-the-badge&logo=android)](https://capacitorjs.com/)

---

## Overview

**Printava Order Flow** supports the full print-shop lifecycle: quotations, orders, production, design approvals, shipping, and reporting. Teams work from one place with role-based routes so sales, design, production, and accounting each see what they need.

---

## Key Features

### Dashboard and analytics

- At-a-glance metrics: revenue, pipeline, and workload signals.
- Charts for trends (Recharts).
- Role-aware home dashboards (admin, sales, designer, production, accountant).

### Orders and quotations

- Quotation-to-order flow with dedicated list and detail views.
- Configurable pricing and product catalog.
- Status-driven pipeline (custom statuses in settings).

### Authentication

- **Login** and **sign-up** at `/login` and `/signup` with a split marketing + form layout (`features/auth`).
- Session handling via Supabase Auth and protected routes.

### Clients and team (CRM)

- Client records and history.
- Team management, roles, and **RBAC** (admin, sales, designer, accountant, production).

### Production and design

- Production task queue (`/production-tasks`).
- Design approvals and admin design tasks (`/design-tasks`, legacy paths redirect where applicable).

### Settings and operations

- Status configuration, pricing, shipping, exchange rates, and app settings (admin).
- Print-friendly summaries (react-to-print), exports where applicable (XLSX).

---

## Tech stack

| Area | Choice |
|------|--------|
| UI | [React 18](https://reactjs.org/), [TypeScript](https://www.typescriptlang.org/) |
| Build | [Vite](https://vitejs.dev/) |
| Styling | [Tailwind CSS](https://tailwindcss.com/) |
| Components | [shadcn/ui](https://ui.shadcn.com/) (Radix UI) |
| Routing | [React Router v6](https://reactrouter.com/) |
| Data | [TanStack Query v5](https://tanstack.com/query/latest) |
| Backend | [Supabase](https://supabase.com/) (Postgres, Auth, RLS) |
| Forms | [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/) |
| Mobile shell | [Capacitor](https://capacitorjs.com/) (Android) |
| Other | Lucide, date-fns, Recharts, Sonner, react-error-boundary |

---

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Bun](https://bun.sh/) (optional)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (for migrations and local DB work)

### Clone and install

```bash
git clone <repository-url>
cd printava-order-flow
npm install
# or: bun install
```

### Environment variables

Create a `.env` in the project root with your Supabase project values (from the Supabase dashboard):

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<your-anon-or-publishable-key>
VITE_SUPABASE_PROJECT_ID=<project-ref>
```

The publishable (anon) key is the public client key; keep service role keys out of the frontend.

> **Note:** The bundled Supabase client lives in `src/integrations/supabase/client.ts`. Point it at your env-driven values for deployments so secrets are not committed.

### Database (Supabase)

Link your project and apply migrations when setting up a new instance:

```bash
supabase link --project-ref <your_project_ref>
supabase db push
```

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server (default: http://localhost:5173) |
| `npm run build` | Production build |
| `npm run build:dev` | Build in development mode |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |

```bash
npm run dev
```

---

## Mobile (Capacitor)

Android is the primary mobile target. After a web build:

```bash
npm run build
npx cap sync
npx cap open android
```

---

## Project structure

```text
src/
├── components/       # Shared UI, layout, and shadcn primitives
├── features/         # Domain modules
│   ├── auth/         # Login, sign-up, not-found, auth layout components
│   ├── clients/
│   ├── dashboard/
│   ├── designer/
│   ├── orders/       # Orders, quotations, new/edit flows, order details
│   ├── production/
│   ├── products/
│   ├── quotations/   # Shared quotation UI where split from orders
│   └── settings/     # Team, statuses, shipping, pricing entry, settings shell
├── hooks/            # Auth, RBAC, domain hooks
├── integrations/     # Supabase client and generated types
├── lib/              # Utilities, constants, shared types
├── pages/            # Legacy or thin re-exports (prefer features/ for new work)
├── App.tsx           # Routes, providers, guards
└── main.tsx          # Entry
supabase/
├── migrations/
└── functions/        # Edge functions (if used)
```

---

## License

Proprietary. For licensing questions, contact the repository owner.

---

Built for modern print shops.
