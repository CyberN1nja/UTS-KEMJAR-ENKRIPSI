const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const mysql = require('mysql2'); // Import mysql2
const dotenv = require('dotenv');
const CryptoService = require('./lib/CryptoService');
const app = express();
const PORT = 3000;

// Load environment variables
dotenv.config();

// Initialize encryption service
const cryptoService = new CryptoService();

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(require('cors')());

// Koneksi ke MySQL
const db = mysql.createConnection({
  host: 'localhost', // Menghubungkan ke MySQL di localhost
  user: 'root', // Default user di XAMPP adalah 'root'
  password: '', // Biasanya kosong pada XAMPP
  database: 'uts2keamananjaringanaa', // Nama database yang kamu buat di phpMyAdmin
});

// Periksa dan ubah struktur tabel jika diperlukan
db.connect((err) => {
  if (err) {
    console.error('Gagal terhubung ke database:', err);
    return;
  }
  console.log('Terhubung ke database MySQL');
  
  // Ubah struktur tabel untuk menangani data terenkripsi yang lebih besar
  const alterTableQuery = `
    ALTER TABLE pengguna 
    MODIFY alamat TEXT NOT NULL,
    MODIFY kartu TEXT NOT NULL, 
    MODIFY cvv TEXT NOT NULL, 
    MODIFY pemilik TEXT NOT NULL;
  `;
  
  db.query(alterTableQuery, (alterErr) => {
    if (alterErr) {
      console.error('Gagal mengubah struktur tabel:', alterErr);
      console.log('Aplikasi tetap berjalan, tapi mungkin akan ada masalah saat menyimpan data terenkripsi.');
    } else {
      console.log('Struktur tabel berhasil diperbarui untuk menangani data terenkripsi');
    }
  });
});

// Endpoint menerima data dari frontend
app.post('/submit', (req, res) => {
  const { nama, telepon, alamat, kartu, cvv, pemilik } = req.body;

  console.log('Data yang diterima (sebelum enkripsi):', { nama, telepon }); // Log data non-sensitif saja

  // Validasi data
  if (!nama || !telepon || !alamat || !kartu || !cvv || !pemilik) {
    return res.status(400).json({ message: 'Data tidak lengkap.' });
  }

  try {
    // Enkripsi data sensitif
    const encryptedAlamat = cryptoService.encrypt(alamat);
    const encryptedKartu = cryptoService.encrypt(kartu);
    const encryptedCVV = cryptoService.encrypt(cvv);
    const encryptedPemilik = cryptoService.encrypt(pemilik);

    // Simpan data terenkripsi dalam format JSON
    const alamatJSON = JSON.stringify(encryptedAlamat);
    const kartuJSON = JSON.stringify(encryptedKartu);
    const cvvJSON = JSON.stringify(encryptedCVV);
    const pemilikJSON = JSON.stringify(encryptedPemilik);

    // Query untuk menyimpan data ke database
    const query = 'INSERT INTO pengguna (nama, telepon, alamat, kartu, cvv, pemilik, timestamp) VALUES (?, ?, ?, ?, ?, ?, NOW())';
    const values = [nama, telepon, alamatJSON, kartuJSON, cvvJSON, pemilikJSON];

    db.query(query, values, (err, result) => {
      if (err) {
        console.error('Gagal menyimpan data:', err);
        return res.status(500).json({ message: 'Gagal menyimpan data.' });
      }
      console.log('Data berhasil disimpan dengan enkripsi'); // Log hasil penyimpanan
      res.json({ message: 'Data berhasil disimpan dengan aman!' });
    });
  } catch (error) {
    console.error('Error saat enkripsi data:', error);
    return res.status(500).json({ message: 'Gagal mengenkripsi data.' });
  }
});

// Endpoint untuk mengambil riwayat data dari database
app.get('/getData', (req, res) => {
  console.log('Request untuk mengambil data diterima'); // Log sederhana

  const query = 'SELECT * FROM pengguna ORDER BY timestamp DESC';
  db.query(query, (err, results) => {
    if (err) {
      console.error('Gagal mengambil data:', err);
      return res.status(500).json({ message: 'Gagal mengambil data.', error: err });
    }
    
    try {
      // Dekripsi data sensitif untuk setiap hasil
      const decryptedResults = results.map(item => {
        try {
          // Parse data JSON terenkripsi
          const alamatEncrypted = JSON.parse(item.alamat);
          const kartuEncrypted = JSON.parse(item.kartu);
          const cvvEncrypted = JSON.parse(item.cvv);
          const pemilikEncrypted = JSON.parse(item.pemilik);
          
          // Dekripsi data
          return {
            ...item,
            alamat: cryptoService.decrypt(alamatEncrypted),
            kartu: cryptoService.decrypt(kartuEncrypted),
            cvv: cryptoService.decrypt(cvvEncrypted),
            pemilik: cryptoService.decrypt(pemilikEncrypted)
          };
        } catch (decryptError) {
          console.error('Gagal mendekripsi item:', decryptError);
          // Kembalikan data asli jika dekripsi gagal
          return item;
        }
      });
      
      console.log('Data berhasil diambil dan didekripsi'); // Log hasil
      res.json({ data: decryptedResults });
    } catch (error) {
      console.error('Error saat dekripsi data:', error);
      return res.status(500).json({ message: 'Gagal mendekripsi data.', error: error.message });
    }
  });
});

// Endpoint baru untuk mengambil data pengguna dengan toggle masked/cleartext
app.get('/getUserData', (req, res) => {
  console.log('Request untuk mengambil data pengguna diterima');

  const query = 'SELECT * FROM pengguna ORDER BY timestamp DESC';
  db.query(query, (err, results) => {
    if (err) {
      console.error('Gagal mengambil data pengguna:', err);
      return res.status(500).json({ message: 'Gagal mengambil data pengguna.', error: err.message });
    }
    
    try {
      // Dekripsi data sensitif untuk setiap hasil
      const decryptedResults = results.map(item => {
        try {
          // Cek apakah data sudah dalam format JSON atau belum
          let alamatDecrypted, kartuDecrypted, cvvDecrypted, pemilikDecrypted;
          
          try {
            // Coba parse sebagai JSON
            const alamatEncrypted = JSON.parse(item.alamat);
            const kartuEncrypted = JSON.parse(item.kartu);
            const cvvEncrypted = JSON.parse(item.cvv);
            const pemilikEncrypted = JSON.parse(item.pemilik);
            
            // Dekripsi data jika berhasil di-parse
            alamatDecrypted = cryptoService.decrypt(alamatEncrypted);
            kartuDecrypted = cryptoService.decrypt(kartuEncrypted);
            cvvDecrypted = cryptoService.decrypt(cvvEncrypted);
            pemilikDecrypted = cryptoService.decrypt(pemilikEncrypted);
          } catch (parseError) {
            // Jika gagal parse, gunakan data asli (mungkin belum terenkripsi)
            console.log('Data mungkin belum terenkripsi, menggunakan data asli');
            alamatDecrypted = item.alamat;
            kartuDecrypted = item.kartu;
            cvvDecrypted = item.cvv;
            pemilikDecrypted = item.pemilik;
          }
          
          return {
            ...item,
            alamat: alamatDecrypted,
            kartu: kartuDecrypted,
            cvv: cvvDecrypted,
            pemilik: pemilikDecrypted
          };
        } catch (decryptError) {
          console.error('Gagal memproses item:', decryptError);
          // Kembalikan data asli jika dekripsi gagal
          return item;
        }
      });
      
      console.log('Data pengguna berhasil diambil dan diproses');
      res.json({ data: decryptedResults });
    } catch (error) {
      console.error('Error saat memproses data pengguna:', error);
      return res.status(500).json({ message: 'Gagal memproses data pengguna.', error: error.message });
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server ShopX berjalan di http://localhost:${PORT}`);
  console.log(`Akses tampilan data dengan toggle di http://localhost:${PORT}/data_view.html`);
});