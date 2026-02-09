import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables. Please check your .env.local file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// TypeScript interfaces for database tables

export interface Company {
    id: string;
    name: string; // Nama Perusahaan Kamu
    address: string | null;
    phone: string | null;
    uen_number: string | null; // Co. UEN (Singapura)
    logo_url: string | null;
    created_at: string;
}

export interface BankAccount {
    id: string;
    company_id: string;
    bank_name: string | null; // e.g. UOB Serangoon Central
    bank_address: string | null;
    account_number: string | null;
    swift_code: string | null;
    branch_code: string | null;
    paynow_uen: string | null; // Field khusus sesuai Image 2
    is_primary: boolean;
}

export interface Partner {
    id: string;
    type: 'customer' | 'vendor'; // Required
    company_name: string; // Required: PT Jaya Subakti Perkasa / Samsung
    attn_name?: string | null; // Optional: Ms. Kelly Teo / Maria
    address?: string | null; // Billing Address
    shipping_address?: string | null; // For Site Delivery (Image 3,4,5)
    phone?: string | null;
    email?: string | null;
    created_at: string;
}

export interface Item {
    id: string;
    item_code: string | null; // e.g. QNO-6012R (Penting buat Image 5)
    sku: string | null;
    name: string;
    description: string | null;
    category: string | null;
    uom: string | null; // EA, Lot, Nos (Sesuai Image 1)
    price: number;
    stock: number;
    min_stock: number;
    created_at?: string;
}

export interface Quotation {
    id: string;
    quote_number: string; // CNK-Q25-30180-R1
    quotation_number?: string; // Legacy/DB compat
    customer_id: string;
    date: string;
    validity_date: string | null;
    subject: string | null; // "To Supply Labor and Material..." (Image 1)
    subtotal: number;
    discount_amount: number; // "Good Will Discount" (Image 1)
    total_amount: number;
    total?: number; // Legacy/DB compat
    gst_rate: number; // "NO GST" note
    status: string;
    customer?: Partner; // Helper for joins
    created_at?: string;
}

export interface QuotationItem {
    id: string;
    quotation_id: string;
    item_description: string | null; // Bisa panjang
    quantity: number;
    uom: string | null;
    unit_price: number;
    disc_percent: number;
    disc_amount: number;
    total_price: number;
}

export interface SalesOrder {
    id: string;
    so_number: string | null;
    quotation_id: string | null;
    customer_po_number: string | null; // "4504642120" (Dari Image 2/3/4)
    project_schedule_date: string | null;
    status: string;
}

export interface SalesOrderItem {
    id: string;
    so_id: string;
    description: string | null;
    quantity: number;
    uom: string | null;
    phase_name: string | null; // e.g. "01 Phase", "02 Phase"
}

export interface DeliveryOrder {
    id?: string;
    do_number: string | null;
    so_id: string | null;
    date: string | null;
    subject?: string | null;  // Subject/description for DO
    status?: string | null;   // pending, delivered, cancelled
    terms: string | null;
    requestor_name: string | null;
    shipping_address_snapshot: string | null;
    customer_id?: string | null;
    created_at?: string;
}

export interface DeliveryOrderItem {
    id?: string;
    do_id: string;
    item_code: string | null; // "00010", "00020"
    description: string | null;
    quantity: number;
    uom: string | null;
    group_name?: string | null;
    created_at?: string;
}

export interface Invoice {
    id: string;
    invoice_number: string; // CNK-INV-35258030
    so_id: string | null;
    do_number_ref: string | null; // Referensi DO (Image 2) - LEGACY
    date: string;
    due_date: string | null;
    terms: string | null; // "60 Days"
    subject: string | null; // "01- 50% Upon Project..."
    subtotal: number;
    discount: number;
    tax: number; // Database column is 'tax', not 'tax_rate' or 'tax_amount'
    grand_total: number;
    payment_status: string; // unpaid, partial, paid
    billing_type?: string; // itemized, milestone, final
    invoice_type?: string; // legacy, do_based
    total_sections?: number; // Number of DO sections
    customer?: Partner; // Helper for joins
}

export interface InvoiceDeliverySection {
    id: string;
    invoice_id: string;
    do_id: string;
    section_number: number;
    section_label: string | null;
    created_at?: string;
    delivery_order?: DeliveryOrder; // Helper for joins
}

export interface InvoiceItem {
    id: string;
    invoice_id: string;
    do_section_id?: string | null; // Reference to which DO section
    item_code: string | null; // "00010"
    description: string | null; // "01 - 50% Upon..."
    quantity: number;
    uom: string | null;
    unit_price: number;
    total_price: number;
}

export interface InvoicePayment {
    id: string;
    invoice_id: string;
    date: string;
    amount: number;
    method: string | null;
    notes: string | null;
}

export interface PurchaseOrder {
    id: string;
    po_number: string; // CNK-P25-30040
    vendor_id: string | null; // Link ke Vendor
    date: string | null;
    quote_ref: string | null; // Ref Quote Vendor
    shipping_info: string | null; // "Ship Via: FCA..."
    delivery_address: string | null; // "Working Site Address"
    notes?: string | null;
    status: string;
    total: number;
    vendor_name?: string; // Helper for display
    vendor?: Partner;
    created_at?: string;
}

export interface PurchaseOrderItem {
    id: string;
    purchase_order_id: string;
    item_id?: string | null;
    item_code: string | null; // HW-QNO...
    description: string | null;
    quantity: number;
    unit_price: number;
    total: number;
}

// Quotation Terms & Conditions
export interface QuotationTerm {
    id: string;
    category: string; // Remarks, Warranty, Cancellation, Payment Plan, General Terms
    title: string | null;
    content: string;
    sort_order: number;
    is_active: boolean;
    created_at?: string;
}

export interface QuotationSelectedTerm {
    id: string;
    quotation_id: string;
    term_id: string;
    term?: QuotationTerm; // Helper for joins
    created_at?: string;
}

// Term Categories constant for UI
export const TERM_CATEGORIES = [
    'Remarks',
    'Warranty',
    'Cancellation',
    'Payment Plan',
    'General Terms'
] as const;

export type TermCategory = typeof TERM_CATEGORIES[number];
