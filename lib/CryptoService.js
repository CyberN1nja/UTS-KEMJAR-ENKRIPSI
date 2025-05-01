/**
 * CryptoService.js - Layanan Enkripsi dan Dekripsi Data untuk JavaScript
 * 
 * Modul ini menyediakan fungsi untuk mengenkripsi dan mendekripsi data sensitif
 * menggunakan algoritma AES-256-CBC dengan IV acak dan HMAC untuk verifikasi integritas
 * sesuai dengan standar GDPR dan PCI-DSS.
 */
const crypto = require('crypto');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

class CryptoService {
    constructor() {
        // Mengambil kunci dari environment variable
        this.key = process.env.ENCRYPTION_KEY;
        if (!this.key || this.key.length !== 32) {
            throw new Error('ENCRYPTION_KEY harus memiliki panjang 32 karakter untuk AES-256');
        }
        
        this.algorithm = 'aes-256-cbc';
        this.hmacAlgo = 'sha256';
    }

    /**
     * Mengenkripsi data sensitif
     * @param {string} text Data yang akan dienkripsi
     * @return {Object} Object berisi data terenkripsi, IV, dan HMAC
     */
    encrypt(text) {
        // Generate IV acak untuk setiap proses enkripsi
        const iv = crypto.randomBytes(16);
        
        // Enkripsi data menggunakan AES-256-CBC
        const cipher = crypto.createCipheriv(this.algorithm, Buffer.from(this.key), iv);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        // Generate HMAC untuk verifikasi integritas
        const hmac = crypto.createHmac(this.hmacAlgo, this.key)
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
    decrypt(encryptedData) {
        // Validasi parameter input
        if (!encryptedData.data || !encryptedData.iv || !encryptedData.hmac) {
            throw new Error('Format data terenkripsi tidak valid');
        }
        
        const encrypted = encryptedData.data;
        const iv = Buffer.from(encryptedData.iv, 'hex');
        
        // Verifikasi HMAC untuk memastikan integritas data
        const calculatedHmac = crypto.createHmac(this.hmacAlgo, this.key)
            .update(encrypted + encryptedData.iv)
            .digest('hex');
        
        if (calculatedHmac !== encryptedData.hmac) {
            throw new Error('Verifikasi integritas data gagal: Data mungkin telah dimanipulasi');
        }
        
        // Dekripsi data
        const decipher = crypto.createDecipheriv(this.algorithm, Buffer.from(this.key), iv);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    }
}

module.exports = CryptoService;