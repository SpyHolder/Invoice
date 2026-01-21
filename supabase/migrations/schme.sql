/*
  # FIX: Make item_name Optional
  
  Masalah: Error "violates not-null constraint" pada item_name.
  Solusi: Mengubah kolom item_name menjadi BOLEH KOSONG (Nullable).
  
  Alasan: Karena sekarang sudah ada kolom 'item_id' yang me-refer ke tabel items,
  nama item dalam bentuk teks manual tidak lagi krusial/wajib.
*/

-- 1. Ubah kolom item_name agar boleh NULL
ALTER TABLE purchase_order_items 
ALTER COLUMN item_name DROP NOT NULL;

-- 2. (Opsional tapi Disarankan) Set default value jika kosong
ALTER TABLE purchase_order_items 
ALTER COLUMN item_name SET DEFAULT '';

-- 3. Reload Schema Cache agar API sadar perubahan ini
NOTIFY pgrst, 'reload schema';