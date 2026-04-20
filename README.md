# 🖨️ Printava Order Flow

A high-performance, modern order management dashboard specifically designed for print shops. Built with **React 18, TypeScript, Vite, Tailwind CSS**, and powered by **Supabase**.

[![Live Demo](https://img.shields.io/badge/Live-Demo-brightgreen?style=for-the-badge)](https://print-flow-ten.vercel.app)
[![Mobile Support](https://img.shields.io/badge/Mobile-Android-blue?style=for-the-badge&logo=android)](https://capacitorjs.com/)

---

## 🌟 Overview

**Printava Order Flow** streamlines the complex workflow of print shops, from initial quotation to final delivery. It provides a centralized hub for managing clients, tracking production stages, handling shipping, and monitoring business performance through real-time analytics.

---

## 🚀 Key Features

### 📊 Dashboard & Analytics
- **At-a-glance Metrics**: Monitor total revenue, pending orders, and active production tasks.
- **Interactive Charts**: Visual business performance tracking using Recharts.
- **Recent Activity**: Stay updated with the latest order status changes.

### 📝 Order & Quotation Management
- **Smart Flow**: Seamless transition from quotation to confirmed order.
- **Dynamic Pricing**: Configurable pricing rules for different print products and services.
- **Order Tracking**: Granular tracking through various stages (New, In Design, In Production, Shipping, Delivered).

### 👥 Client & Team Management (CRM)
- **Centralized Database**: Store client contact info, preferences, and full order history.
- **Team Collaboration**: Manage staff across different departments (Sales, Production, Design, Accounting).
- **Role-Based Access Control (RBAC)**: Secure access restricted by user roles (Admin, Sales, Designer, Accountant, Production).

### 🛠️ Production & Operations
- **Production Pipeline**: Dedicated view for production teams to manage their queue.
- **Design Approvals**: Integrated workflow for client design verification and sign-off.
- **Shipping Integration**: Track packages and update shipping statuses.

### ⚙️ Extensibility & Configuration
- **Custom Statuses**: Define your own production and order workflows via the settings dashboard.
- **Pricing Settings**: Fine-tune your margins, service costs, and product tax rates.
- **Print-Ready Documents**: Generate and print order summaries, receipts, and invoices directly from the browser.

---

## 🛠️ Tech Stack

- **Framework**: [React 18](https://reactjs.org/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Type Safety**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **UI Components**: [shadcn/ui](https://ui.shadcn.com/) (Radix UI)
- **State Management & Data Fetching**: [TanStack Query (React Query) v5](https://tanstack.com/query/latest)
- **Backend & Auth**: [Supabase](https://supabase.com/)
- **Form Handling**: [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/)
- **Mobile Foundation**: [Capacitor](https://capacitorjs.com/) (Android support)
- **Utilities**: Lucide Icons, Date-fns, Recharts, XLSX, React-to-Print.

---

## 📥 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Bun](https://bun.sh/) (Optional but recommended)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (For database management)

### 1️⃣ Clone the Repository

```bash
git clone <repository-url>
cd printava-order-flow
```

### 2️⃣ Install Dependencies

Using Bun (recommended):
```bash
bun install
```
Or npm:
```bash
npm install
```

### 3️⃣ Environment Configuration

Create a `.env` file in the root directory and add your Supabase credentials. You can use the values from your Supabase dashboard:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_SUPABASE_PROJECT_ID=your_project_id
```

### 4️⃣ Database Setup (Supabase)

If you are setting up a new Supabase instance, apply the existing migrations:

```bash
supabase link --project-ref your_project_id
supabase db push
```

### 5️⃣ Start Development Server

```bash
bun dev
# or
npm run dev
```

The application will be available at `http://localhost:5173`.

---

## 📱 Mobile Development (Capacitor)

The project includes Capacitor for mobile deployment. Currently, Android is the primary mobile target.

To sync the web build with the Android project:
```bash
npm run build
npx cap sync
npx cap open android
```

---

## 📁 Project Structure

```text
src/
├── components/     # Reusable UI components and shadcn primitives
├── features/       # Domain modules (each may include components/, pages/, etc.)
├── hooks/          # Custom React hooks (Auth, RBAC, Supabase)
├── integrations/   # Supabase client and external configurations
├── lib/            # Shared utilities, constants, and database types
├── utils/          # Helper functions (Formatting, Validation)
├── App.tsx         # Main router and provider configuration
└── main.tsx        # Application entry point
supabase/
├── migrations/     # PostgreSQL schema, RLS policies, and triggers
└── functions/      # Supabase Edge Functions
```

---

## 📄 License

This project is proprietary. For licensing inquiries, please contact the repository owner.

---

Built with ❤️ for Modern Print Shops.
