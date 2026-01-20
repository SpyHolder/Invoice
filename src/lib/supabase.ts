import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables. Please check your .env.local file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// TypeScript interfaces for database tables
export interface UserProfile {
    id: string;
    full_name: string;
    company_name: string;
    email: string;
    created_at: string;
}

export interface Item {
    id: string;
    name: string;
    sku: string;
    category: string;
    price: number;
    description: string;
    stock: number;
    min_stock: number;
    created_at: string;
}

export interface Customer {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    created_at: string;
}

export interface Invoice {
    id: string;
    invoice_number: string;
    customer_id: string;
    date: string;
    due_date: string;
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
    notes: string | null;
    status: string;
    created_at: string;
    customer?: Customer;
}

export interface InvoiceItem {
    id: string;
    invoice_id: string;
    item_name: string;
    description: string | null;
    quantity: number;
    unit_price: number;
    discount: number;
    tax_rate: number;
    total: number;
}

export interface Quotation {
    id: string;
    quotation_number: string;
    customer_id: string;
    date: string;
    valid_until: string;
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
    notes: string | null;
    payment_terms: string | null;
    status: string;
    created_at: string;
    customer?: Customer;
}

export interface QuotationItem {
    id: string;
    quotation_id: string;
    item_name: string;
    description: string | null;
    quantity: number;
    unit_price: number;
    discount: number;
    tax_rate: number;
    total: number;
}

export interface PurchaseOrder {
    id: string;
    vendor_name: string;
    date: string;
    status: 'pending' | 'received' | 'cancelled';
    total_amount: number;
    notes: string | null;
    created_at: string;
}

export interface PurchaseOrderItem {
    id: string;
    purchase_order_id: string;
    item_id: string;
    item_name: string;
    quantity: number;
    unit_price: number;
    amount: number;
    item?: Item;
}
