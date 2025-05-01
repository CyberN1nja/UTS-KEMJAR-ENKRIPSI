/**
 * Enhanced Server.js - Implementasi Rekomendasi Keamanan
 * 
 * File ini mengimplementasikan semua rekomendasi keamanan yang diuraikan dalam dokumen,
 * termasuk integrasi dengan KMS eksternal, enkripsi riwayat pembelian, kepatuhan GDPR,
 * kepatuhan PCI-DSS, audit logging, pengamanan akses database, dan penghapusan data yang aman.
 */
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const mysql = require('mysql2/promise'); // Menggunakan versi promise untuk async/await
const dotenv = require('dotenv');
const EnhancedCryptoService = require('./lib/EnhancedCryptoService');
const winston = require('winston');
const app = express();
const PORT = process.env.PORT || 3000;

// Load environment variables
dotenv.config();

// Konfigurasi logger untuk audit keamanan
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

// Initialize encryption service
const cryptoService = new EnhancedCryptoService();

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(require('cors')());

// Middleware untuk logging akses data sensitif
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

// Koneksi ke MySQL dengan user yang memiliki hak akses terbatas
let db;
async function initializeDatabase() {
  try {
    // Menggunakan kredensial dari environment variables
    db = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'app_user', // User dengan hak akses terbatas
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'uts2keamananjaringanaa',
    });
    
    console.log('Terhubung ke database MySQL');
    
    // Ubah struktur tabel untuk menangani data terenkripsi yang lebih besar
    await db.query(`
      ALTER TABLE pengguna 
      MODIFY alamat TEXT NOT NULL,
      MODIFY kartu TEXT NOT NULL, 
      MODIFY cvv TEXT NOT NULL, 
      MODIFY pemilik TEXT NOT NULL;
    `);
    
    console.log('Struktur tabel berhasil diperbarui untuk menangani data terenkripsi');
    
    // Buat tabel untuk riwayat pembelian jika belum ada
    await db.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        items TEXT NOT NULL,
        total_price TEXT NOT NULL,
        shipping_address TEXT NOT NULL,
        timestamp DATETIME NOT NULL,
        FOREIGN KEY (user_id) REFERENCES pengguna(id)
      );
    `);
    
    console.log('Tabel orders berhasil dibuat atau sudah ada');
    
    // Buat tabel untuk log penghapusan data (GDPR)
    await db.query(`
      CREATE TABLE IF NOT EXISTS deletion_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        deletion_date DATETIME NOT NULL,
        reason VARCHAR(255) NOT NULL
      );
    `);
    
    console.log('Tabel deletion_logs berhasil dibuat atau sudah ada');
    
    // Buat tabel untuk log audit keamanan
    await db.query(`
      CREATE TABLE IF NOT EXISTS security_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        action VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        data_type VARCHAR(255),
        timestamp DATETIME NOT NULL
      );
    `);
    
    console.log('Tabel security_logs berhasil dibuat atau sudah ada');
  } catch (err) {
    console.error('Gagal terhubung ke database:', err);
  }
}

// Inisialisasi database
initializeDatabase();

// Endpoint menerima data dari frontend dengan tokenisasi kartu kredit (PCI-DSS)
app.post('/submit', async (req, res) => {
  const { nama, telepon, alamat, kartu, cvv, pemilik } = req.body;

  console.log('Data yang diterima (sebelum enkripsi):', { nama, telepon }); // Log data non-sensitif saja

  // Validasi data
  if (!nama || !telepon || !alamat || !kartu || !cvv || !pemilik) {
    return res.status(400).json({ message: 'Data tidak lengkap.' });
  }

  try {
    // Tokenisasi kartu kredit (PCI-DSS)
    const cardData = {
      number: kartu,
      exp_month: 12, // Ambil dari form
      exp_year: 2025, // Ambil dari form
      cvc: cvv, // CVV hanya digunakan untuk membuat token, tidak disimpan
      name: pemilik
    };
    
    const tokenizedCard = await cryptoService.tokenizeCard(cardData);
    
    // Enkripsi alamat
    const encryptedAlamat = await cryptoService.encryptWithKMS(alamat, 'address');
    const alamatJSON = JSON.stringify(encryptedAlamat);

    // Query untuk menyimpan data ke database (tanpa menyimpan CVV)
    const query = 'INSERT INTO pengguna (nama, telepon, alamat, payment_token, last_four, pemilik, timestamp) VALUES (?, ?, ?, ?, ?, ?, NOW())';
    const values = [
      nama, 
      telepon, 
      alamatJSON, 
      tokenizedCard.token_id, // Token dari Stripe
      tokenizedCard.last_four, // Hanya simpan 4 digit terakhir
      JSON.stringify(await cryptoService.encryptWithKMS(pemilik, 'cardholder'))
    ];

    const [result] = await db.query(query, values);
    console.log('Data berhasil disimpan dengan enkripsi'); // Log hasil penyimpanan
    
    // Log aktivitas penyimpanan data
    securityLogger.info({
      action: 'save_user_data',
      user_id: result.insertId,
      timestamp: new Date().toISOString()
    });
    
    res.json({ message: 'Data berhasil disimpan dengan aman!' });
  } catch (error) {
    console.error('Error saat memproses data:', error);
    return res.status(500).json({ message: 'Gagal memproses data.' });
  }
});

// Endpoint untuk menyimpan riwayat pembelian terenkripsi
app.post('/saveOrder', async (req, res) => {
  const { userId, items, totalPrice, shippingAddress } = req.body;

  try {
    // Enkripsi data sensitif dari riwayat pembelian
    const encryptedItems = await cryptoService.encryptWithKMS(JSON.stringify(items), 'order_items');
    const encryptedPrice = await cryptoService.encryptWithKMS(totalPrice.toString(), 'price');
    const encryptedAddress = await cryptoService.encryptWithKMS(shippingAddress, 'shipping_address');

    // Simpan dalam format JSON
    const itemsJSON = JSON.stringify(encryptedItems);
    const priceJSON = JSON.stringify(encryptedPrice);
    const addressJSON = JSON.stringify(encryptedAddress);

    // Query untuk menyimpan data ke database
    const query = 'INSERT INTO orders (user_id, items, total_price, shipping_address, timestamp) VALUES (?, ?, ?, ?, NOW())';
    const values = [userId, itemsJSON, priceJSON, addressJSON];

    const [result] = await db.query(query, values);
    
    // Log aktivitas penyimpanan pesanan
    securityLogger.info({
      action: 'save_order',
      user_id: userId,
      order_id: result.insertId,
      timestamp: new Date().toISOString()
    });
    
    res.json({ message: 'Pesanan berhasil disimpan dengan aman!', orderId: result.insertId });
  } catch (error) {
    console.error('Error saat enkripsi data pesanan:', error);
    return res.status(500).json({ message: 'Gagal mengenkripsi data pesanan.' });
  }
});

// Endpoint untuk menghapus data pengguna (Right to be Forgotten - GDPR)
app.delete('/user/:userId', async (req, res) => {
  const userId = req.params.userId;
  
  // Verifikasi otorisasi pengguna (tidak ditampilkan di sini)
  
  try {
    // 1. Ambil data pengguna untuk dioverwrite
    const [userData] = await db.query('SELECT * FROM pengguna WHERE id = ?', [userId]);
    
    if (!userData.length) {
      return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan' });
    }
    
    // 2. Overwrite data sensitif dengan data acak sebelum menghapus
    const randomData = cryptoService.secureOverwrite();
    
    // 3. Update data dengan nilai acak
    await db.query(
      'UPDATE pengguna SET alamat = ?, payment_token = ?, pemilik = ? WHERE id = ?',
      [JSON.stringify(randomData), JSON.stringify(randomData), JSON.stringify(randomData), userId]
    );
    
    // 4. Hapus data terkait dari tabel lain
    await db.query('DELETE FROM orders WHERE user_id = ?', [userId]);
    
    // 5. Hapus data pengguna dari tabel utama
    await db.query('DELETE FROM pengguna WHERE id = ?', [userId]);
    
    // 6. Catat penghapusan dalam log audit
    await db.query(
      'INSERT INTO deletion_logs (user_id, deletion_date, reason) VALUES (?, NOW(), ?)',
      [userId, 'GDPR Right to be Forgotten request']
    );
    
    // Log aktivitas penghapusan data
    securityLogger.info({
      action: 'delete_user_data',
      user_id: userId,
      reason: 'GDPR Right to be Forgotten request',
      timestamp: new Date().toISOString()
    });
    
    res.json({ success: true, message: 'Data pengguna berhasil dihapus sesuai permintaan' });
  } catch (error) {
    console.error('Gagal menghapus data pengguna:', error);
    res.status(500).json({ success: false, message: 'Gagal menghapus data pengguna' });
  }
});

// Endpoint untuk mengekspor data pengguna (Data Portability - GDPR)
app.get('/user/:userId/export', async (req, res) => {
  const userId = req.params.userId;
  
  // Verifikasi otorisasi pengguna (tidak ditampilkan di sini)
  
  try {
    // 1. Ambil data pengguna
    const [userData] = await db.query('SELECT * FROM pengguna WHERE id = ?', [userId]);
    
    if (!userData.length) {
      return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan' });
    }
    
    // 2. Dekripsi data sensitif
    const user = userData[0];
    const decryptedUser = {
      id: user.id,
      nama: user.nama,
      telepon: user.telepon,
      alamat: await cryptoService.decryptWithKMS(JSON.parse(user.alamat)),
      // Jangan sertakan data kartu kredit lengkap untuk keamanan
      // Hanya sertakan 4 digit terakhir
      kartu_terakhir_4_digit: user.last_four,
      timestamp: user.timestamp
    };
    
    // 3. Ambil riwayat pesanan
    const [orderData] = await db.query('SELECT * FROM orders WHERE user_id = ?', [userId]);
    
    const decryptedOrders = await Promise.all(orderData.map(async (order) => ({
      order_id: order.id,
      items: JSON.parse(await cryptoService.decryptWithKMS(JSON.parse(order.items))),
      total_price: await cryptoService.decryptWithKMS(JSON.parse(order.total_price)),
      shipping_address: await cryptoService.decryptWithKMS(JSON.parse(order.shipping_address)),
      timestamp: order.timestamp
    })));
    
    // 4. Buat objek data lengkap
    const exportData = {
      user: decryptedUser,
      orders: decryptedOrders
    };
    
    // Log aktivitas ekspor data
    securityLogger.info({
      action: 'export_user_data',
      user_id: userId,
      timestamp: new Date().toISOString()
    });
    
    // 5. Kirim sebagai file JSON
    res.setHeader('Content-Disposition', `attachment; filename="user-${userId}-data-export.json"`);
    res.setHeader('Content-Type', 'application/json');
    res.json(exportData);
    
  } catch (error) {
    console.error('Gagal mengekspor data pengguna:', error);
    res.status(500).json({ success: false, message: 'Gagal mengekspor data pengguna' });
  }
});

// Endpoint untuk mengambil riwayat data dari database
app.get('/getData', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id, nama, telepon, timestamp FROM pengguna');
    res.json(rows);
  } catch (error) {
    console.error('Error saat mengambil data:', error);
    res.status(500).json({ message: 'Gagal mengambil data.' });
  }
});

// Endpoint untuk mengambil detail data pengguna (dengan dekripsi)
app.get('/getDetail/:id', async (req, res) => {
  const id = req.params.id;
  
  try {
    const [rows] = await db.query('SELECT * FROM pengguna WHERE id = ?', [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Data tidak ditemukan.' });
    }
    
    const user = rows[0];
    
    // Dekripsi data sensitif
    const decryptedData = {
      id: user.id,
      nama: user.nama,
      telepon: user.telepon,
      alamat: await cryptoService.decryptWithKMS(JSON.parse(user.alamat)),
      // Jangan tampilkan kartu kredit lengkap, hanya 4 digit terakhir
      kartu_terakhir_4_digit: user.last_four,
      timestamp: user.timestamp
    };
    
    // Log aktivitas akses detail pengguna
    securityLogger.info({
      action: 'access_user_detail',
      user_id: id,
      timestamp: new Date().toISOString()
    });
    
    res.json(decryptedData);
  } catch (error) {
    console.error('Error saat mengambil detail data:', error);
    res.status(500).json({ message: 'Gagal mengambil detail data.' });
  }
});

// Mulai server
app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});