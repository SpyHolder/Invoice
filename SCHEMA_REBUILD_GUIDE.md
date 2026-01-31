# 🚀 Full Schema Rebuild - Panduan Eksekusi

## ⚠️ PERINGATAN PENTING

Migration ini akan **MENGHAPUS SEMUA DATA** yang ada di database dan membuat ulang schema dari awal.

**Pastikan:**
- ✅ Anda sudah backup data jika diperlukan
- ✅ Ini adalah environment development/testing
- ✅ Anda siap kehilangan data existing

---

## 📋 Langkah-Langkah Eksekusi

### 1. Buka Supabase Dashboard

1. Login ke [Supabase Dashboard](https://app.supabase.com)
2. Pilih project Anda
3. Klik **SQL Editor** di sidebar kiri

### 2. Jalankan Migration

1. Buka file: `supabase/migrations/20260201000000_full_schema_rebuild.sql`
2. Copy **SELURUH ISI** file tersebut
3. Paste ke SQL Editor di Supabase
4. Klik **Run** atau tekan `Ctrl+Enter`
5. Tunggu hingga selesai (sekitar 5-10 detik)

### 3. Verifikasi Schema

Setelah migration berhasil, check apakah semua table sudah terbuat:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

**Expected Tables (16 tables):**
- ✅ bank_accounts
- ✅ companies
- ✅ delivery_order_items
- ✅ delivery_orders
- ✅ invoice_items
- ✅ invoice_payments
- ✅ invoices
- ✅ items
- ✅ partners
- ✅ purchase_order_items
- ✅ purchase_orders
- ✅ quotation_items
- ✅ quotations
- ✅ sales_order_items
- ✅ sales_orders
- ✅ user_profiles

### 4. Seed Initial Data (Optional)

Anda bisa populate dengan data testing. Contoh:

#### A. Create Company Profile

```sql
INSERT INTO public.companies (name, address, phone, email, uen_number)
VALUES (
  'PT Cahaya Naga Kencana',
  'Jl. Contoh No. 123, Jakarta',
  '+62 21 1234567',
  'info@cnk.co.id',
  '201234567D'
);
```

#### B. Create Bank Account

```sql
INSERT INTO public.bank_accounts (
  company_id, 
  bank_name, 
  account_number, 
  swift_code,
  paynow_uen,
  is_primary
)
SELECT 
  id,
  'UOB Serangoon Central',
  '123-456-789-0',
  'UOVBSGSG',
  '201234567D',
  true
FROM public.companies
WHERE name = 'PT Cahaya Naga Kencana';
```

#### C. Create Sample Customer

```sql
INSERT INTO public.partners (type, company_name, attn_name, address, shipping_address, phone, email)
VALUES (
  'customer',
  'PT Jaya Subakti Perkasa',
  'Ms. Kelly Teo',
  'Jl. Sudirman No. 45, Jakarta',
  'Jl. Industri Blok B No. 10, Bekasi',
  '+62 21 9876543',
  'kelly@jsp.co.id'
);
```

#### D. Create Sample Vendor

```sql
INSERT INTO public.partners (type, company_name, attn_name, address, phone, email)
VALUES (
  'vendor',
  'Samsung Electronics Indonesia',
  'Maria',
  'Jl. Technology Park, Jakarta',
  '+62 21 5555555',
  'maria@samsung.id'
);
```

#### E. Create Sample Items

```sql
INSERT INTO public.items (item_code, name, description, uom, price, stock)
VALUES 
  ('SRV-001', 'Labor Service', 'Professional labor service', 'hours', 500, 999),
  ('MAT-001', 'Building Material', 'Quality construction material', 'pcs', 1500, 100),
  ('HW-QNO-6012R', 'Samsung CCTV QNO-6012R', '2MP Network IR Bullet Camera', 'unit', 850, 50),
  ('INST-001', 'Installation Service', 'Professional installation service', 'set', 300, 999);
```

### 5. Refresh Frontend

1. Buka aplikasi di browser: `http://localhost:5173`
2. Tekan `Ctrl+Shift+R` atau `Cmd+Shift+R` (hard refresh)
3. Atau clear browser cache dan refresh

---

## ✅ Testing Checklist

Setelah migration dan seeding, test workflow:

- [ ] **Login** berhasil
- [ ] **Dashboard** muncul tanpa error
- [ ] **Partners**:
  - [ ] List partners muncul
  - [ ] Bisa create customer baru
  - [ ] Bisa create vendor baru
- [ ] **Quotations**:
  - [ ] Bisa create quotation
  - [ ] Bisa pilih customer dari dropdown
  - [ ] Bisa add line items
  - [ ] Budget summary calculate correctly
  - [ ] Bisa save quotation
- [ ] **Items** list muncul dengan benar
- [ ] **Companies** & **Bank Accounts** bisa diakses

---

## 🔧 Troubleshooting

### Error: "relation does not exist"
**Solusi:** Re-run migration script, pastikan semua table terbuat.

### Error: "permission denied"
**Solusi:** Check RLS policies, pastikan user authenticated.

### Frontend error: "Could not find table..."
**Solusi:** 
1. Hard refresh browser
2. Check Network tab di DevTools
3. Pastikan Supabase URL dan Anon Key benar di `.env.local`

### Data tidak muncul di dropdown
**Solusi:**
1. Check apakah seed data sudah diinsert
2. Periksa filter di query (e.g., `type='customer'`)
3. Check browser console untuk error logs

---

## 📞 Support

Jika ada masalah, check:
1. Browser Console (F12) - cari error messages
2. Supabase Dashboard → Logs
3. Network tab - check API responses

---

**Status:** ✅ Ready to Execute  
**Estimated Time:** 5-10 minutes (migration + seeding)  
**Risk Level:** 🔴 HIGH (Data will be lost)
