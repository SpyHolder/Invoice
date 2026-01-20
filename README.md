# Business Suite - ERP Management System

A comprehensive web-based ERP application for small to medium-sized businesses, built with React, TypeScript, Tailwind CSS, and Supabase.

## Features

- **Dashboard**: Business overview with revenue, pending invoices, low stock alerts, and quick actions
- **Invoicing**: Create and manage sales invoices with automatic stock deduction
- **Quotations**: Create quotations and convert them to invoices
- **Purchase Orders**: Manage procurement with automatic stock increments
- **Inventory Management**: Track items, stock levels, and minimum stock alerts
- **Customer Management**: Maintain customer database
- **Multi-tenancy**: Row Level Security ensures data isolation per user

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS
- **Backend**: Supabase (PostgreSQL with Auth and RLS)
- **Routing**: React Router DOM
- **Icons**: Lucide React

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- A Supabase project (create one at [supabase.com](https://supabase.com))

### Installation

1. **Install dependencies**:
   ```bash
   npm install
   npm install react-to-print
   ```

2. **Configure environment variables**:
   - Open `.env.local`
   - Replace the placeholder values with your Supabase credentials:
     ```
     VITE_SUPABASE_URL=https://your-project.supabase.co
     VITE_SUPABASE_ANON_KEY=your-anon-key
     ```

3. **Set up the database**:
   - Go to your Supabase project dashboard
   - Navigate to the SQL Editor
   - Copy and paste the contents of `supabase/schema.sql`
   - Run the SQL script to create all tables and RLS policies

4. **Start the development server**:
   ```bash
   npm run dev
   ```

5. **Open your browser**:
   - Navigate to `http://localhost:5173`
   - Sign up for a new account to get started!

## Project Structure

```
business-suite/
├── src/
│   ├── components/
│   │   ├── layout/          # Sidebar, TopBar, MobileMenu, MainLayout
│   │   ├── ui/              # Reusable UI components (Button, Input, Card, Modal)
│   │   └── ProtectedRoute.tsx
│   ├── contexts/
│   │   └── AuthContext.tsx  # Authentication state management
│   ├── lib/
│   │   └── supabase.ts      # Supabase client and TypeScript interfaces
│   ├── pages/
│   │   ├── Login.tsx
│   │   ├── Signup.tsx
│   │   ├── Dashboard.tsx
│   │   ├── Items.tsx
│   │   ├── Customers.tsx
│   │   ├── Invoices.tsx
│   │   ├── Quotations.tsx
│   │   └── PurchaseOrders.tsx
│   ├── App.tsx              # Main app with routing
│   ├── main.tsx             # Entry point
│   └── index.css            # Global styles
├── supabase/
│   └── schema.sql           # Database schema
├── .env.local               # Environment variables (add your credentials)
└── package.json
```

## Usage

### First Steps

1. **Sign up** for a new account
2. **Add Items** to your inventory
3. **Add Customers** to your database
4. Create **Quotations** and convert them to **Invoices**
5. Create **Purchase Orders** to restock inventory

### Key Features

- **Low Stock Alerts**: Dashboard shows items running low on stock
- **Stock Management**: Invoices automatically deduct stock; POs increment stock when received
- **Status Tracking**: Toggle invoice payment status, mark POs as received
- **Responsive Design**: Works on mobile, tablet, and desktop

## Database Schema

The application uses the following tables:
- `user_profiles` - Extended user information
- `items` - Inventory/products
- `customers` - Customer database
- `invoices` & `invoice_items` - Sales invoices
- `quotations` & `quotation_items` - Sales quotations
- `purchase_orders` & `purchase_order_items` - Procurement

All tables are secured with Row Level Security (RLS) policies.

## Build for Production

```bash
npm run build
```

The production-ready files will be in the `dist/` directory.

## Support

For issues or questions, please check:
- Supabase documentation: https://supabase.com/docs
- React documentation: https://react.dev

## License

MIT
