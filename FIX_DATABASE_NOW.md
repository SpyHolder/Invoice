# 🔧 URGENT: Database RLS Policy Fix

## Masalah
Aplikasi mengalami **403 Forbidden** error dari Supabase karena RLS (Row Level Security) policies masih mencari kolom `user_id` yang sudah tidak ada di schema.

## Solusi
Jalankan migration file yang sudah saya buat untuk update RLS policies.

## Cara Menjalankan

### Opsi 1: Manual via Supabase Dashboard (RECOMMENDED)

1. Buka [Supabase Dashboard](https://app.supabase.com)
2. Pilih project Anda
3. Klik **SQL Editor** di sidebar kiri
4. Copy seluruh isi file `supabase/migrations/20260201150000_fix_quotation_items_schema.sql`
5. Paste ke SQL Editor
6. Klik **Run** atau tekan Ctrl+Enter
7. Refresh aplikasi Anda di browser

### Opsi 2: Menggunakan Supabase CLI

```bash
# Pastikan Supabase CLI sudah ter-install
# npm install -g supabase

# Link ke project Anda (jika belum)
supabase link --project-ref YOUR_PROJECT_REF

# Reset database dengan semua migrations
supabase db reset
```

## Verifikasi

Setelah menjalankan migration:

1. Buka aplikasi di http://localhost:5173
2. Login dengan akun: `sapigamimg@gmail.com` / `okeoke`
3. Coba tambah customer atau item
4. **Tidak boleh ada error 403** di console
5. Data harus berhasil tersimpan

## File yang Sudah Diperbaiki

✅ 7 files updated untuk match database schema:
- `src/lib/supabase.ts` - TypeScript interfaces
- `src/pages/Dashboard.tsx` - Removed user_id filters
- `src/pages/Invoices.tsx` - Updated to use `total` instead of `total_amount`
- `src/pages/Quotations.tsx` - Updated schema fields
- `src/pages/Items.tsx` - Removed stock management (not in schema)
- `src/pages/Customers.tsx` - Removed user_id
- `src/pages/PurchaseOrders.tsx` - Removed user_id & stock logic

## Catatan

> ⚠️ **WARNING**: Migration ini menggunakan public access policy (`USING (true)`). 
> Untuk production app, sebaiknya tambahkan kembali kolom `user_id` dan gunakan `auth.uid()` untuk proper data isolation per user.

## Need Help?

Jika masih ada error setelah menjalankan migration, cek:
1. Apakah SQL berhasil dijalankan tanpa error di Supabase?
2. Apakah sudah refresh browser setelah update policies?
3. Clear browser cache dan coba lagi
