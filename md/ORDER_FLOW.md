# 🔄 Printava Order Workflow

This document explains the standard workflow of an order in the **Printava Order Flow** system and the responsibilities of each user role.

---

## 🎭 Roles & Responsibilities

### 🔑 Admin (Project Manager / Owner)
- **Full Visibility**: Can see and edit every order, client, and quotation.
- **System Configuration**: Manages team members, system statuses, and pricing rules.
- **Financial Oversight**: Has access to all revenue data and cost settings.

### 💼 Sales 
- **The Entry Point**: Creates Quotations and manages the CRM (Clients).
- **Conversion**: Responsible for converting approved Quotations into active Orders.
- **Communication**: Primary contact for clients during the initial phases.

### 🎨 Designer
- **Visual Assets**: Responsible for creating design mockups and print-ready files.
- **Workflow**: Manages orders in design-related statuses (`Ready for Design`, `In Design`, `Design Revision`).
- **File Preparation**: Ensures the final file is uploaded and ready for the production team.

### ⚙️ Production
- **Manufacturing**: Manages the physical printing and production of items.
- **Queue Management**: Follows the production queue sorted by delivery urgency.
- **Status Updates**: Transitions orders from `Ready for Production` to `In Production` and finally `Ready for Pickup`.

### 💰 Accountant
- **Financial Review**: Accesses pricing settings and client financial history.
- **Billing**: Monitors payments and order totals.

---

## 📈 The Life of an Order

### 1. Quotation Phase (Sales)
- Sales create a **New Quotation** for a client.
- The quotation includes products, quantities, and estimated pricing based on the shop's pricing tiers.
- **Status**: `Quotation`.

### 2. Order Conversion (Sales)
- Once the client approves the quotation, Sales converts it into a **New Order**.
- At this stage, files (design references) are usually attached.
- **Status**: `New`.

### 3. Design Phase (Designer)
- If the order requires design work, it moves to the Designer.
- The Designer uploads mockups for client approval.
- Once approved, the Designer prepares the "Print-Ready File".
- **Status Progression**: `Ready for Design` → `In Design` → `Waiting for Print File`.

### 4. Production Phase (Production)
- The production team sees the order in their **Production Queue**.
- They download the print-ready files and start the job.
- **Status Progression**: `Ready for Production` → `In Production`.

### 5. Fulfillment Phase (Production/Logistics)
- Once printing is complete, the item is packaged.
- **Status Progression**: `Ready for Pickup` → `Shipping` → `Delivered`.

---

## 🖥️ Role-Specific Views

| Role | Primary View | Can See Financials? | Can Manage Team? |
| :--- | :--- | :---: | :---: |
| **Admin** | Dashboard (Global Stats) | ✅ Yes | ✅ Yes |
| **Sales** | Quotations & Clients | ✅ Yes | ❌ No |
| **Designer** | Orders (Design-only) | ❌ No | ❌ No |
| **Production** | Production Queue | ❌ No | ❌ No |
| **Accountant** | Orders & Pricing | ✅ Yes | ❌ No |

---

## 🔗 Status Legend

- **New**: Order just created, waiting for review.
- **Ready for Design**: Waiting for the designer to start.
- **In Design**: Designer is working on the assets.
- **Design Revision**: Client requested changes to the design.
- **Ready for Production**: Design is finalized, waiting for a machine.
- **In Production**: Machine is currently printing/manufacturing.
- **Ready for Pickup**: Job finished, waiting for the client or courier.
- **Delivered**: Final stage, order completed.
