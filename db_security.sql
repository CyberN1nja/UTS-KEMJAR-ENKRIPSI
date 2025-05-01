-- Script SQL untuk Pengamanan Akses Database
-- Implementasi rekomendasi keamanan untuk membatasi hak akses database

-- 1. Buat user database dengan hak akses terbatas
CREATE USER IF NOT EXISTS 'app_user'@'localhost' IDENTIFIED BY 'strong_password';

-- 2. Berikan hak akses terbatas untuk tabel pengguna
GRANT SELECT, INSERT, UPDATE ON uts2keamananjaringanaa.pengguna TO 'app_user'@'localhost';

-- 3. Berikan hak akses terbatas untuk tabel orders
GRANT SELECT, INSERT, UPDATE ON uts2keamananjaringanaa.orders TO 'app_user'@'localhost';

-- 4. Batasi akses ke tabel log audit hanya untuk insert
GRANT INSERT ON uts2keamananjaringanaa.security_logs TO 'app_user'@'localhost';
GRANT INSERT ON uts2keamananjaringanaa.deletion_logs TO 'app_user'@'localhost';

-- 5. Batasi akses ke tabel yang berisi data sensitif
-- Hanya berikan akses ke kolom yang tidak sensitif untuk operasi SELECT
GRANT SELECT (id, nama, telepon, timestamp, last_four) ON uts2keamananjaringanaa.pengguna TO 'app_user'@'localhost';

-- 6. Buat user terpisah untuk operasi administratif
CREATE USER IF NOT EXISTS 'admin_user'@'localhost' IDENTIFIED BY 'different_strong_password';
GRANT ALL PRIVILEGES ON uts2keamananjaringanaa.* TO 'admin_user'@'localhost';

-- 7. Pastikan perubahan hak akses diterapkan
FLUSH PRIVILEGES;

-- Catatan: Ganti 'strong_password' dan 'different_strong_password' dengan password yang kuat
-- dan simpan di tempat yang aman, seperti dalam environment variables atau vault.