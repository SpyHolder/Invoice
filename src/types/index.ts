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
    contact: string | null; // Contact information for quotation
    rfq_ref_no: string | null; // RFQ Reference Number
    subtotal: number;
    discount_amount: number; // "Good Will Discount" (Image 1)
    total_amount: number;
    total?: number; // Legacy/DB compat
    gst_rate: number; // "NO GST" note
    status: string; // draft, confirmed
    customer_po_number: string | null; // PO Number from customer
    project_schedule_date: string | null; // Project schedule date
    customer?: Partner; // Helper for joins
    terms_content?: string; // HTML T&C content
    created_at?: string;
    // Delivery progress helpers (from list query)
    do_count?: number;
    delivery_status?: string;
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
    item_name: string | null; // Item name from items table
}

// SalesOrder and SalesOrderItem are deprecated - SO module has been removed
// Keeping interfaces for backward compat only
export interface SalesOrder {
    id: string;
    so_number: string | null;
    quotation_id: string | null;
    customer_po_number: string | null;
    project_schedule_date: string | null;
    status: string;
}

export interface SalesOrderItem {
    id: string;
    so_id: string;
    description: string | null;
    quantity: number;
    uom: string | null;
    phase_name: string | null;
    qty_backordered: number;
    qty_reserved: number;
}

export interface DeliveryOrder {
    id?: string;
    do_number: string | null;
    quotation_id: string | null; // Links directly to Quotation (SO removed)
    so_id?: string | null; // Deprecated, kept for backward compat
    date: string | null;
    subject?: string | null;
    status?: string | null;
    terms: string | null;
    requestor_name: string | null;
    shipping_address_snapshot: string | null;
    customer_id?: string | null;
    customer_po_number?: string | null;
    quote_ref?: string | null;
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
    quotation_id: string | null; // Links to Quotation (SO removed)
    so_id?: string | null; // Deprecated
    do_number_ref: string | null;
    date: string;
    due_date: string | null;
    terms: string | null;
    subject: string | null;
    subtotal: number;
    discount: number;
    tax: number;
    grand_total: number;
    payment_status: string;
    billing_type?: string;
    invoice_type?: string;
    total_sections?: number;
    notes?: string | null;
    customer?: Partner;
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
    group_name?: string | null; // Group name from DO items (e.g. "Equipment", "Materials")
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
    vendor_id: string | null;
    quotation_id: string | null; // Links PO to source Quotation
    date: string | null;
    quote_ref: string | null;
    shipping_info: string | null;
    delivery_address: string | null;
    notes?: string | null;
    status: string;
    subtotal: number;
    tax: number;
    total: number;
    vendor_name?: string;
    vendor?: Partner;
    terms_content?: string;
    created_at?: string;
}

export interface PurchaseOrderItem {
    id: string;
    po_id: string;
    item_id?: string | null;
    item_code: string | null; // HW-QNO...
    description: string | null;
    quantity: number;
    unit_price: number;
    total: number;
}

