const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const app = express();
const PORT = 3000;

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(require('cors')());

// Simulasi penyimpanan data (bisa diganti dengan DB)
let dataPengguna = [];

// Endpoint menerima data dari frontend
app.post('/submit', (req, res) => {
  const { nama, telepon, alamat, kartu, cvv, pemilik } = req.body;

  // Simulasi validasi dan penyimpanan
  if (!nama || !telepon || !alamat || !kartu || !cvv || !pemilik) {
    return res.status(400).json({ message: 'Data tidak lengkap.' });
  }

  dataPengguna.push(req.body);
  console.log('Data diterima:', req.body);
  res.json({ message: 'Data berhasil disimpan!' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server ShopX berjalan di http://localhost:${PORT}`);
});
