# 🎨 Frontend Design & UX Guide

This document outlines the design philosophy, user experience patterns, and frontend architecture used in **Printava Order Flow**.

---

## 🏛️ Design Philosophy

The application follows a **Modern Professional Dashboard** aesthetic, designed to be clean, functional, and enterprise-grade. It prioritizes data clarity and efficient workflows for shop operators.

### Core Principles
- **Data-First**: Essential metrics and order details are front and center.
- **Micro-Interactions**: Subtle animations and hover effects (via `tailwindcss-animate`) provide tactile feedback.
- **Visual Hierarchy**: Consistent use of weight, size, and color to guide the user's eye to the most important actions.
- **Glassmorphism & Soft UI**: Use of subtle shadows, rounded corners (`radius: 0.75rem`), and light backgrounds to create a premium feel.

---

## 🎨 Design System

The system is built on **Tailwind CSS** using a curated color palette and typography system.

### 🔡 Typography
- **Sans-Serif**: `Montserrat` — Used for main headings, dashboard metrics, and navigation.
- **Arabi Support**: `Cairo` & `Tajawal` — Optimized for Arabic text rendering in multi-lingual contexts.
- **Monospace**: `IBM Plex Mono` — Used for Order Numbers (e.g., `#ORD-1234`) and SKUs.

### 🎨 Color Palette
The app uses a dynamic HSL-based theme that supports both **Light** and **Dark** modes.
- **Primary**: A professional blue/indigo that represents trust and technology.
- **Statuses**:
  - `New`: Soft Blue
  - `Design`: Purple (Creativity)
  - `Production`: Amber (Work in progress)
  - `Shipping`: Teal/Cyan (Movement)
  - `Delivered`: Emerald (Completion)

### 🧩 Component Library: shadcn/ui
We use `shadcn/ui` built on top of **Radix UI** primitives. This ensures:
- **Accessibility**: All components are WAI-ARIA compliant.
- **Customizability**: Tailwind-driven styling for every component.
- **Consistency**: Unified design across buttons, inputs, dialogs, and cards.

---

## 📱 User Experience (UX) Patterns

### 1. Responsive & Adaptive Layout
- **Desktop**: A robust sidebar navigation with collapsible sections.
- **Mobile**: The layout adapts into a "Mobile-First" view for workers on the shop floor who use phones/tablets to track orders in real-time.

### 2. Feedback Systems
- **Toasts**: `Sonner` is used for high-priority notifications (Success, Errors).
- **Loading States**: `Skeleton` screens are implemented to reduce "layout shift" and perceived wait times.
- **Empty States**: Custom illustrations and text when no data is available (Quotations, Production Queue).

### 3. Smart Form Handling
- Powered by `React Hook Form` and `Zod`.
- **Inline Validation**: Immediate feedback on field errors.
- **Dynamic Fields**: Adding/Removing order items in the `NewOrder` page is handled with a smooth UI.

### 4. Role-Based Navigation
The sidebar and available actions change dynamically based on the **User Role**. An admin sees settings and team management, while a production worker sees a simplified queue optimized for speed.

---

## 🛠️ Frontend Architecture

### ⚡ Vite & TypeScript
- **Vite**: Provides an ultra-fast development environment and optimized production builds.
- **TypeScript**: Ensures type safety across the application, especially for complex order structures and database schemas.

### 📡 Data Synchronization: TanStack Query (v5)
The app uses a "Stale-While-Revalidate" strategy:
- **Automatic Caching**: Once an order is loaded, navigating back to it is instant.
- **Background Updates**: The production queue stays updated without manual refreshes.
- **Optimistic Updates**: (Where applicable) UI updates immediately while the database syncs in the background.

---

## 📂 Design Folder Structure

```text
src/
├── components/
│   ├── ui/         # Base shadcn primitives
│   ├── shared/     # Domain-specific reusable components (OrderCard, etc.)
│   └── Layout.tsx  # Global wrapper (Sidebar, Navbar)
├── assets/         # Images, Logos, and CSS globals
└── index.css       # Tailwind variables and global styles
```

---

Built with a focus on **Efficiency** and **Elegance**.
