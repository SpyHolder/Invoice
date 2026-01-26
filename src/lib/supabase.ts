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
    attn: string | null;
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
    // New Fields
    terms: string;
    customer_po: string | null;
    // New Fields for Project Based
    sales_order_id?: string;
    invoice_type?: 'ITEM' | 'PROGRESS';
    po_group_id?: string;
}

export interface InvoiceItem {
    id: string;
    invoice_id: string;
    item_id?: string;
    item_name: string;
    description: string | null;
    quantity: number;
    unit_price: number;
    discount: number;
    tax_rate: number;
    total: number;
    // New Fields
    uom: string;
    discount_percent: number;
}

export interface CompanySettings {
    id: string;
    name: string;
    address_line1: string;
    address_line2: string;
    address_line3: string;
    phone: string;
    email: string;
    logo_url: string;
    gst_note: string;
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
    // New fields
    contact: string | null;
    rfq_ref_no: string | null;
    subject: string | null;
    goodwill_discount: number;
    currency: string;
    linked_sales_order_id?: string;
}

export interface QuotationItem {
    id: string;
    quotation_id: string;
    item_id?: string;
    item_name: string;
    description: string | null;
    quantity: number;
    unit_price: number;
    discount: number;
    tax_rate: number;
    total: number;
    // New fields
    uom: string;
    bef_disc: number;
    disc_percent: number;
    disc_amt: number;
}

export interface PurchaseOrder {
    id: string;
    vendor_name: string;
    date: string;
    status: 'pending' | 'received' | 'cancelled';
    total: number;
    notes: string | null;
    created_at: string;
    // New Fields
    customer_id?: string;
    total_project_value?: number;
    customer?: { name: string };
}

export interface POGroup {
    id: string;
    purchase_order_id: string;
    group_name: string;
    description: string | null;
    created_at: string;
}

export interface SalesOrder {
    id: string;
    quotation_id?: string;
    purchase_order_id?: string;
    customer_id?: string;
    status: string;
    total_amount: number;
    notes: string | null;
    created_at: string;
    updated_at: string;
    customer?: Customer;
    quotation?: Quotation;
    purchase_order?: PurchaseOrder;
}

export interface SalesOrderItem {
    id: string;
    sales_order_id: string;
    item_name: string;
    description: string | null;
    quantity: number;
    uom: string;
    unit_price: number;
    discount: number;
    total: number;
    po_group_id?: string;
    item_id?: string;
    created_at: string;
    po_group?: POGroup;
}

export interface PaymentProgress {
    id: string;
    sales_order_id: string;
    invoice_id?: string;
    percentage: number;
    amount: number;
    created_at: string;
}

export interface PurchaseOrderItem {
    id: string;
    purchase_order_id: string;
    item_id: string;
    item_name: string;
    quantity: number;
    unit_price: number;
    total: number;
    item?: Item;
}

export interface DeliveryOrder {
    id: string;
    do_number: string;
    customer_id: string;
    quotation_id: string;
    date: string;
    delivery_date: string | null;
    status: 'pending' | 'delivered' | 'cancelled';
    notes: string | null;
    delivery_address: string | null;
    total: number;
    created_at: string;
    customer?: Customer;
    quotation?: Quotation;
    // New Fields
    terms: string;
    customer_po: string | null;
    requestor: string | null;
    billing_address: string | null;
    sales_order_id?: string;
    po_group_id?: string;
}

export interface DeliveryOrderItem {
    id: string;
    delivery_order_id: string;
    quotation_item_id: string | null;
    item_id: string | null;
    item_name: string;
    description: string | null;
    quantity: number;
    unit_price: number;
    total: number;
    // New Fields
    group_name: string | null;
    uom: string;
}
