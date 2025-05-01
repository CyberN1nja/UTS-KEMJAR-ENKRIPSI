# Pengamanan Data Pengguna pada Website E-Commerce

mengimplementasikan sistem pengamanan data sensitif pengguna pada website e-commerce menggunakan algoritma AES-256-CBC dengan praktik terbaik keamanan seperti KMS, IV, dan HMAC, agar sesuai dengan standar GDPR dan PCI-DSS.

## Fitur Keamanan yang Diterapkan

### AES-256-CBC
- Digunakan untuk mengenkripsi data sensitif dengan IV acak
- Implementasi di `lib/CryptoService.js`, `lib/CryptoService.php`, dan `encript.js`

### IV (Initialization Vector)
- Dibuat unik untuk setiap proses enkripsi agar hasil tidak bisa ditebak
- Disimpan bersama data terenkripsi untuk proses dekripsi

### HMAC (SHA-256)
- Digunakan untuk memverifikasi integritas data agar tidak dimanipulasi
- Implementasi di semua layanan enkripsi

### Key Management Service (KMS) Simulasi
- Kunci tidak disimpan di dalam source code, melainkan diambil dari environment variable (ENCRYPTION_KEY di file .env)
- Implementasi di `lib/KMS.php` dan `lib/CryptoService.js`

### Dekripsi saat dibutuhkan saja
- Data hanya didekripsi saat proses transaksi atau menampilkan riwayat pembelian
- Implementasi di `server.js` pada endpoint `/getData`

### External KMS Integration
- Integrasi dengan layanan KMS eksternal (AWS KMS) untuk pengelolaan kunci yang lebih aman
- Implementasi di `lib/ExternalKMS.js` dengan fallback ke kunci lokal

### Enhanced Crypto Service
- Layanan enkripsi yang ditingkatkan dengan fitur audit logging dan kepatuhan PCI-DSS
- Implementasi di `lib/EnhancedCryptoService.js` dengan dukungan tokenisasi kartu kredit

### Toggle Visibility untuk Data Sensitif
- Fitur untuk menyembunyikan/menampilkan data sensitif pada antarmuka pengguna
- Implementasi di `public/data_view.html` dengan masking data otomatis

## Struktur File

- `lib/CryptoService.php`: Logika enkripsi/dekripsi untuk PHP
- `lib/CryptoService.js`: Logika enkripsi/dekripsi untuk JavaScript
- `lib/KMS.php`: Pengambil kunci enkripsi dari .env
- `lib/ExternalKMS.js`: Integrasi dengan AWS KMS untuk pengelolaan kunci eksternal
- `lib/EnhancedCryptoService.js`: Layanan enkripsi yang ditingkatkan dengan fitur keamanan tambahan
- `encript.js`: Modul enkripsi/dekripsi untuk Node.js
- `.env`: Tempat aman menyimpan kunci enkripsi
- `server.js`: Server backend dengan implementasi enkripsi/dekripsi dasar
- `server_enhanced.js`: Server backend dengan fitur keamanan yang ditingkatkan
- `public/`: Menyimpan file frontend (seperti form atau index)
- `public/data_view.html`: Tampilan data dengan fitur toggle untuk data sensitif

## Contoh Pemakaian

### PHP
```php
use Lib\CryptoService;
use Lib\KMS;

$key = KMS::getEncryptionKey();
$crypto = new CryptoService($key);

$encrypted = $crypto->encrypt("Data sensitif");
$decrypted = $crypto->decrypt($encrypted);
```

### JavaScript (Node.js) - Basic
```javascript
const CryptoService = require('./lib/CryptoService');

const cryptoService = new CryptoService();

const encrypted = cryptoService.encrypt("Data sensitif");
const decrypted = cryptoService.decrypt(encrypted);
```

### JavaScript (Node.js) - Enhanced
```javascript
const EnhancedCryptoService = require('./lib/EnhancedCryptoService');

const cryptoService = new EnhancedCryptoService();

// Enkripsi dengan KMS eksternal
async function secureData() {
  const encrypted = await cryptoService.encryptWithKMS("Data sensitif", "personal_data");
  const decrypted = await cryptoService.decryptWithKMS(encrypted);
  return decrypted;
}
```

## Catatan untuk Deployment

- Pastikan file `.env` tidak dapat diakses publik
- Gunakan HTTPS untuk semua komunikasi
- Jalankan validasi input & perlindungan CSRF
- Implementasi harus patuh pada GDPR dan PCI-DSS jika menyimpan data Eropa atau data kartu
- Gunakan kunci enkripsi yang kuat dan unik untuk setiap lingkungan (development, staging, production)
- Untuk menggunakan KMS eksternal, konfigurasikan kredensial AWS di file `.env`
- Jalankan server dengan fitur keamanan yang ditingkatkan menggunakan `node server_enhanced.js`