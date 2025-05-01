/**
 * encript.js - Modul Enkripsi dan Dekripsi Data
 * 
 * File ini menyediakan fungsi untuk mengenkripsi dan mendekripsi data sensitif
 * menggunakan algoritma AES-256-CBC dengan IV acak dan HMAC untuk verifikasi integritas
 * sesuai dengan standar GDPR dan PCI-DSS.
 */
const crypto = require('crypto');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Mengambil kunci dari environment variable
const key = process.env.ENCRYPTION_KEY;
if (!key || key.length !== 32) {
  throw new Error('ENCRYPTION_KEY harus memiliki panjang 32 karakter untuk AES-256');
}

const algorithm = 'aes-256-cbc';
const hmacAlgo = 'sha256';

/**
 * Mengenkripsi data sensitif
 * @param {string} text Data yang akan dienkripsi
 * @return {Object} Object berisi data terenkripsi, IV, dan HMAC
 */
function encrypt(text) {
  // Generate IV acak untuk setiap proses enkripsi
  const iv = crypto.randomBytes(16);
  
  // Enkripsi data menggunakan AES-256-CBC
  const cipher = crypto.createCipheriv(algorithm, Buffer.from(key), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  // Generate HMAC untuk verifikasi integritas
  const hmac = crypto.createHmac(hmacAlgo, key)
      .update(encrypted + iv.toString('hex'))
      .digest('hex');
  
  // Mengembalikan hasil dalam format yang aman untuk disimpan di database
  return {
    data: encrypted,
    iv: iv.toString('hex'),
    hmac: hmac
  };
}

/**
 * Mendekripsi data terenkripsi
 * @param {Object} encryptedData Object berisi data terenkripsi, IV, dan HMAC
 * @return {string} Data asli yang telah didekripsi
 */
function decrypt(encryptedData) {
  // Validasi parameter input
  if (!encryptedData.data || !encryptedData.iv || !encryptedData.hmac) {
    throw new Error('Format data terenkripsi tidak valid');
  }
  
  const encrypted = encryptedData.data;
  const iv = Buffer.from(encryptedData.iv, 'hex');
  
  // Verifikasi HMAC untuk memastikan integritas data
  const calculatedHmac = crypto.createHmac(hmacAlgo, key)
      .update(encrypted + encryptedData.iv)
      .digest('hex');
  
  if (calculatedHmac !== encryptedData.hmac) {
    throw new Error('Verifikasi integritas data gagal: Data mungkin telah dimanipulasi');
  }
  
  // Dekripsi data
  const decipher = crypto.createDecipheriv(algorithm, Buffer.from(key), iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

module.exports = { encrypt, decrypt };
