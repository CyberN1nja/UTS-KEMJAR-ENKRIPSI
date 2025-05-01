# Rekomendasi Keamanan yang Belum Diterapkan

Dokumen ini berisi saran-saran keamanan yang belum diterapkan pada sistem e-commerce saat ini untuk meningkatkan keamanan data pengguna sesuai dengan standar industri dan regulasi.

## 1. Integrasi dengan Key Management Service (KMS) Eksternal

### Saran
Gunakan Key Management Service (KMS) yang terpisah (seperti AWS KMS, GCP KMS, atau Azure Key Vault) untuk menyimpan dan mengelola kunci enkripsi AES-256.

### Alasan
Menjaga kunci enkripsi lebih aman dan terkelola secara terpusat serta mengurangi risiko kebocoran kunci dari aplikasi.

### Implementasi
```javascript
// Contoh integrasi dengan AWS KMS di CryptoService.js
const AWS = require('aws-sdk');

class CryptoService {
    constructor() {
        // Inisialisasi KMS client
        this.kms = new AWS.KMS({
            region: process.env.AWS_REGION,
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        });
        this.keyId = process.env.KMS_KEY_ID; // ID kunci di AWS KMS
        this.algorithm = 'aes-256-cbc';
        this.hmacAlgo = 'sha256';
    }

    // Mendapatkan kunci dari KMS untuk enkripsi
    async getEncryptionKey() {
        const params = {
            KeyId: this.keyId,
            NumberOfBytes: 32 // 256 bit untuk AES-256
        };
        
        const data = await this.kms.generateDataKey(params).promise();
        // Simpan kunci terenkripsi untuk dekripsi nanti
        this.encryptedKey = data.CiphertextBlob;
        // Gunakan kunci plaintext untuk enkripsi saat ini
        return data.Plaintext;
    }

    // Mendekripsi kunci untuk operasi dekripsi
    async decryptKey() {
        const params = {
            CiphertextBlob: this.encryptedKey
        };
        
        const data = await this.kms.decrypt(params).promise();
        return data.Plaintext;
    }
}
```

## 2. Enkripsi Riwayat Pembelian

### Saran
Data riwayat pembelian (seperti item, harga, tanggal) juga harus dienkripsi dan hanya didekripsi saat dibutuhkan untuk pemrosesan atau tampilan.

### Alasan
Menjaga konsistensi dalam pengamanan semua data sensitif, bukan hanya data pengguna dan kartu pembayaran.

### Implementasi
```javascript
// Tambahkan endpoint untuk menyimpan riwayat pembelian terenkripsi
app.post('/saveOrder', (req, res) => {
  const { userId, items, totalPrice, shippingAddress } = req.body;

  try {
    // Enkripsi data sensitif dari riwayat pembelian
    const encryptedItems = cryptoService.encrypt(JSON.stringify(items));
    const encryptedPrice = cryptoService.encrypt(totalPrice.toString());
    const encryptedAddress = cryptoService.encrypt(shippingAddress);

    // Simpan dalam format JSON
    const itemsJSON = JSON.stringify(encryptedItems);
    const priceJSON = JSON.stringify(encryptedPrice);
    const addressJSON = JSON.stringify(encryptedAddress);

    // Query untuk menyimpan data ke database
    const query = 'INSERT INTO orders (user_id, items, total_price, shipping_address, timestamp) VALUES (?, ?, ?, ?, NOW())';
    const values = [userId, itemsJSON, priceJSON, addressJSON];

    db.query(query, values, (err, result) => {
      if (err) {
        console.error('Gagal menyimpan data pesanan:', err);
        return res.status(500).json({ message: 'Gagal menyimpan data pesanan.' });
      }
      res.json({ message: 'Pesanan berhasil disimpan dengan aman!', orderId: result.insertId });
    });
  } catch (error) {
    console.error('Error saat enkripsi data pesanan:', error);
    return res.status(500).json({ message: 'Gagal mengenkripsi data pesanan.' });
  }
});
```

## 3. Kepatuhan GDPR

### Saran: Hak untuk Dilupakan
Implementasikan mekanisme "right to be forgotten" untuk memungkinkan pengguna menghapus data mereka secara permanen.

### Alasan
Sesuai dengan peraturan GDPR yang memberi hak pada pengguna untuk meminta penghapusan data pribadi mereka.

### Implementasi
```javascript
// Endpoint untuk menghapus data pengguna (Right to be Forgotten)
app.delete('/user/:userId', async (req, res) => {
  const userId = req.params.userId;
  
  // Verifikasi otorisasi pengguna (tidak ditampilkan di sini)
  
  try {
    // 1. Hapus data pengguna dari tabel utama
    await db.promise().query('DELETE FROM pengguna WHERE id = ?', [userId]);
    
    // 2. Hapus data terkait dari tabel lain
    await db.promise().query('DELETE FROM orders WHERE user_id = ?', [userId]);
    
    // 3. Catat penghapusan dalam log audit
    await db.promise().query(
      'INSERT INTO deletion_logs (user_id, deletion_date, reason) VALUES (?, NOW(), ?)',
      [userId, 'GDPR Right to be Forgotten request']
    );
    
    res.json({ success: true, message: 'Data pengguna berhasil dihapus sesuai permintaan' });
  } catch (error) {
    console.error('Gagal menghapus data pengguna:', error);
    res.status(500).json({ success: false, message: 'Gagal menghapus data pengguna' });
  }
});
```

### Saran: Portabilitas Data
Implementasikan mekanisme portabilitas data untuk memungkinkan pengguna mengekspor data mereka dalam format standar seperti JSON atau CSV.

### Implementasi
```javascript
// Endpoint untuk mengekspor data pengguna (Data Portability)
app.get('/user/:userId/export', async (req, res) => {
  const userId = req.params.userId;
  
  // Verifikasi otorisasi pengguna (tidak ditampilkan di sini)
  
  try {
    // 1. Ambil data pengguna
    const [userData] = await db.promise().query('SELECT * FROM pengguna WHERE id = ?', [userId]);
    
    if (!userData.length) {
      return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan' });
    }
    
    // 2. Dekripsi data sensitif
    const user = userData[0];
    const decryptedUser = {
      id: user.id,
      nama: user.nama,
      telepon: user.telepon,
      alamat: cryptoService.decrypt(JSON.parse(user.alamat)),
      // Jangan sertakan data kartu kredit lengkap untuk keamanan
      // Hanya sertakan 4 digit terakhir
      kartu_terakhir_4_digit: cryptoService.decrypt(JSON.parse(user.kartu)).slice(-4),
      timestamp: user.timestamp
    };
    
    // 3. Ambil riwayat pesanan
    const [orderData] = await db.promise().query('SELECT * FROM orders WHERE user_id = ?', [userId]);
    
    const decryptedOrders = orderData.map(order => ({
      order_id: order.id,
      items: JSON.parse(cryptoService.decrypt(JSON.parse(order.items))),
      total_price: cryptoService.decrypt(JSON.parse(order.total_price)),
      shipping_address: cryptoService.decrypt(JSON.parse(order.shipping_address)),
      timestamp: order.timestamp
    }));
    
    // 4. Buat objek data lengkap
    const exportData = {
      user: decryptedUser,
      orders: decryptedOrders
    };
    
    // 5. Kirim sebagai file JSON
    res.setHeader('Content-Disposition', `attachment; filename="user-${userId}-data-export.json"`);
    res.setHeader('Content-Type', 'application/json');
    res.json(exportData);
    
  } catch (error) {
    console.error('Gagal mengekspor data pengguna:', error);
    res.status(500).json({ success: false, message: 'Gagal mengekspor data pengguna' });
  }
});
```

## 4. Kepatuhan PCI-DSS

### Saran
Jangan pernah menyimpan CVV dalam database, bahkan dalam bentuk terenkripsi. Gunakan metode tokenisasi untuk menggantikan data sensitif tersebut.

### Alasan
Sesuai dengan standar PCI-DSS yang mengharuskan untuk tidak menyimpan CVV atau data kartu kredit dalam bentuk yang dapat dipulihkan.

### Implementasi
```javascript
// Gunakan layanan tokenisasi untuk kartu kredit
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Endpoint untuk menyimpan informasi pembayaran
app.post('/payment-info', async (req, res) => {
  const { nama, telepon, alamat, kartu, cvv, pemilik } = req.body;

  try {
    // 1. Buat token kartu di Stripe (tidak menyimpan CVV)
    const token = await stripe.tokens.create({
      card: {
        number: kartu,
        exp_month: 12, // Ambil dari form
        exp_year: 2025, // Ambil dari form
        cvc: cvv, // CVV hanya digunakan untuk membuat token, tidak disimpan
        name: pemilik
      }
    });

    // 2. Enkripsi alamat
    const encryptedAlamat = cryptoService.encrypt(alamat);
    const alamatJSON = JSON.stringify(encryptedAlamat);

    // 3. Simpan token kartu dan data lain (bukan kartu asli atau CVV)
    const query = 'INSERT INTO pengguna (nama, telepon, alamat, payment_token, last_four, timestamp) VALUES (?, ?, ?, ?, ?, NOW())';
    const values = [
      nama, 
      telepon, 
      alamatJSON, 
      token.id, // Token dari Stripe
      kartu.slice(-4) // Hanya simpan 4 digit terakhir
    ];

    db.query(query, values, (err, result) => {
      if (err) {
        console.error('Gagal menyimpan data:', err);
        return res.status(500).json({ message: 'Gagal menyimpan data.' });
      }
      res.json({ message: 'Data pembayaran berhasil disimpan dengan aman!' });
    });
  } catch (error) {
    console.error('Error saat memproses data pembayaran:', error);
    return res.status(500).json({ message: 'Gagal memproses data pembayaran.' });
  }
});
```

## 5. Audit dan Logging Keamanan

### Saran
Implementasikan logging untuk semua tindakan terkait data sensitif seperti enkripsi, dekripsi, permintaan data sensitif, dan kegagalan otorisasi.

### Alasan
Memberikan jejak audit yang dapat digunakan untuk mendeteksi dan mencegah pelanggaran keamanan.

### Implementasi
```javascript
const winston = require('winston');

// Konfigurasi logger
const securityLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'security-service' },
  transports: [
    new winston.transports.File({ filename: 'security-audit.log' }),
    // Tambahkan transport untuk mengirim log ke sistem SIEM jika diperlukan
  ],
});

// Tambahkan middleware untuk logging akses data sensitif
app.use('/getData', (req, res, next) => {
  // Catat siapa yang mengakses data
  securityLogger.info({
    action: 'data_access',
    user_id: req.user ? req.user.id : 'unauthenticated',
    ip_address: req.ip,
    endpoint: req.originalUrl,
    timestamp: new Date().toISOString()
  });
  next();
});

// Modifikasi CryptoService untuk mencatat aktivitas enkripsi/dekripsi
class CryptoService {
  // ... kode yang sudah ada ...
  
  encrypt(text) {
    // Log aktivitas enkripsi (tanpa data yang dienkripsi)
    securityLogger.info({
      action: 'encrypt',
      user_id: global.currentUser ? global.currentUser.id : 'system',
      data_type: this.identifyDataType(text),
      timestamp: new Date().toISOString()
    });
    
    // Lanjutkan dengan enkripsi seperti biasa
    // ... kode enkripsi yang sudah ada ...
  }
  
  decrypt(encryptedData) {
    // Log aktivitas dekripsi
    securityLogger.info({
      action: 'decrypt',
      user_id: global.currentUser ? global.currentUser.id : 'system',
      timestamp: new Date().toISOString()
    });
    
    // Lanjutkan dengan dekripsi seperti biasa
    // ... kode dekripsi yang sudah ada ...
  }
  
  // Helper untuk mengidentifikasi jenis data (untuk logging)
  identifyDataType(text) {
    if (text.match(/^\d{13,19}$/)) return 'payment_card'; // Pola kartu pembayaran
    if (text.match(/^\d{3,4}$/)) return 'cvv';
    if (text.includes('@')) return 'email';
    return 'other';
  }
}
```

## 6. Pengamanan Akses Database

### Saran
Gunakan akun dengan privilege terbatas pada database untuk mencegah akses tidak sah ke data sensitif.

### Alasan
Mengurangi risiko kebocoran data dengan membatasi hak akses hanya pada operasi yang diperlukan.

### Implementasi
```sql
-- Buat user database dengan hak akses terbatas
CREATE USER 'app_user'@'localhost' IDENTIFIED BY 'strong_password';

-- Berikan hak akses terbatas
GRANT SELECT, INSERT, UPDATE ON uts2keamananjaringanaa.pengguna TO 'app_user'@'localhost';
GRANT SELECT, INSERT, UPDATE ON uts2keamananjaringanaa.orders TO 'app_user'@'localhost';

-- Batasi akses ke tabel log audit hanya untuk insert
GRANT INSERT ON uts2keamananjaringanaa.security_logs TO 'app_user'@'localhost';

-- Batasi akses ke tabel yang berisi data sensitif
GRANT SELECT (id, nama, telepon, timestamp) ON uts2keamananjaringanaa.pengguna TO 'app_user'@'localhost';

-- Buat user terpisah untuk operasi administratif
CREATE USER 'admin_user'@'localhost' IDENTIFIED BY 'different_strong_password';
GRANT ALL PRIVILEGES ON uts2keamananjaringanaa.* TO 'admin_user'@'localhost';
```

```javascript
// Modifikasi koneksi database di server.js
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER, // Gunakan user dengan hak akses terbatas dari .env
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});
```

## 7. Penghapusan Data yang Aman

### Saran
Implementasikan mekanisme secure delete saat pengguna meminta penghapusan data mereka atau ketika data sudah tidak lagi diperlukan.

### Alasan
Untuk memastikan data yang disimpan, terutama data terenkripsi, benar-benar hilang dan tidak bisa dipulihkan.

### Implementasi
```javascript
// Fungsi untuk penghapusan data yang aman
async function secureDeleteUser(userId) {
  try {
    // 1. Ambil data pengguna untuk dioverwrite
    const [userData] = await db.promise().query('SELECT * FROM pengguna WHERE id = ?', [userId]);
    
    if (!userData.length) {
      throw new Error('Pengguna tidak ditemukan');
    }
    
    // 2. Overwrite data sensitif dengan data acak sebelum menghapus
    const randomData = crypto.randomBytes(32).toString('hex');
    const encryptedRandom = cryptoService.encrypt(randomData);
    
    // 3. Update data dengan nilai acak
    await db.promise().query(
      'UPDATE pengguna SET alamat = ?, kartu = ?, pemilik = ? WHERE id = ?',
      [JSON.stringify(encryptedRandom), JSON.stringify(encryptedRandom), JSON.stringify(encryptedRandom), userId]
    );
    
    // 4. Hapus data setelah overwrite
    await db.promise().query('DELETE FROM pengguna WHERE id = ?', [userId]);
    
    // 5. Catat penghapusan dalam log audit
    securityLogger.info({
      action: 'secure_delete',
      user_id: userId,
      timestamp: new Date().toISOString()
    });
    
    return { success: true, message: 'Data berhasil dihapus secara aman' };
  } catch (error) {
    console.error('Gagal melakukan secure delete:', error);
    return { success: false, message: 'Gagal menghapus data' };
  }
}

// Endpoint untuk secure delete
app.delete('/secure-delete/:userId', async (req, res) => {
  const userId = req.params.userId;
  
  // Verifikasi otorisasi (tidak ditampilkan di sini)
  
  const result = await secureDeleteUser(userId);
  if (result.success) {
    res.json(result);
  } else {
    res.status(500).json(result);
  }
});
```

## Kesimpulan

Implementasi rekomendasi keamanan di atas akan secara signifikan meningkatkan keamanan data pengguna pada sistem e-commerce, memastikan kepatuhan terhadap standar industri seperti PCI-DSS dan regulasi seperti GDPR. Pendekatan berlapis ini tidak hanya melindungi data sensitif pengguna tetapi juga membangun kepercayaan pelanggan terhadap platform e-commerce.