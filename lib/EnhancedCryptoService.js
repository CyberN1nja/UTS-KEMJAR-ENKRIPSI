/**
 * EnhancedCryptoService.js - Layanan Enkripsi dan Dekripsi Data yang Ditingkatkan
 * 
 * Modul ini mengimplementasikan semua rekomendasi keamanan yang diuraikan dalam dokumen,
 * termasuk integrasi dengan KMS eksternal, enkripsi riwayat pembelian, kepatuhan GDPR,
 * kepatuhan PCI-DSS, audit logging, dan penghapusan data yang aman.
 */
const crypto = require('crypto');
const dotenv = require('dotenv');
const ExternalKMS = require('./ExternalKMS');
const winston = require('winston');
const stripe = require('stripe');

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

class EnhancedCryptoService {
    constructor() {
        // Inisialisasi KMS eksternal
        this.externalKMS = new ExternalKMS();
        
        // Fallback ke kunci lokal jika KMS eksternal tidak tersedia
        this.localKey = process.env.ENCRYPTION_KEY;
        if (!this.localKey || this.localKey.length !== 32) {
            throw new Error('ENCRYPTION_KEY harus memiliki panjang 32 karakter untuk AES-256');
        }
        
        this.algorithm = 'aes-256-cbc';
        this.hmacAlgo = 'sha256';
        
        // Inisialisasi Stripe untuk tokenisasi kartu kredit (PCI-DSS)
        if (process.env.STRIPE_SECRET_KEY) {
            this.stripe = stripe(process.env.STRIPE_SECRET_KEY);
        }
    }

    /**
     * Mengenkripsi data sensitif dengan KMS eksternal
     * @param {string} text Data yang akan dienkripsi
     * @param {string} dataType Jenis data untuk logging
     * @return {Object} Object berisi data terenkripsi, IV, dan HMAC
     */
    async encryptWithKMS(text, dataType = 'unknown') {
        try {
            // Log aktivitas enkripsi (tanpa data yang dienkripsi)
            securityLogger.info({
                action: 'encrypt',
                user_id: global.currentUser ? global.currentUser.id : 'system',
                data_type: dataType || this.identifyDataType(text),
                timestamp: new Date().toISOString()
            });
            
            // Dapatkan kunci dari KMS eksternal
            const key = await this.externalKMS.getEncryptionKey();
            
            // Generate IV acak untuk setiap proses enkripsi
            const iv = crypto.randomBytes(16);
            
            // Enkripsi data menggunakan AES-256-CBC
            const cipher = crypto.createCipheriv(this.algorithm, Buffer.from(key), iv);
            let encrypted = cipher.update(text, 'utf8', 'hex');
            encrypted += cipher.final('hex');
            
            // Generate HMAC untuk verifikasi integritas
            const hmac = crypto.createHmac(this.hmacAlgo, key)
                .update(encrypted + iv.toString('hex'))
                .digest('hex');
            
            // Mengembalikan hasil dalam format yang aman untuk disimpan di database
            return {
                data: encrypted,
                iv: iv.toString('hex'),
                hmac: hmac
            };
        } catch (error) {
            console.error('Error saat enkripsi dengan KMS:', error);
            // Fallback ke enkripsi lokal jika KMS gagal
            return this.encrypt(text, dataType);
        }
    }

    /**
     * Mendekripsi data terenkripsi dengan KMS eksternal
     * @param {Object} encryptedData Object berisi data terenkripsi, IV, dan HMAC
     * @return {string} Data asli yang telah didekripsi
     */
    async decryptWithKMS(encryptedData) {
        try {
            // Log aktivitas dekripsi
            securityLogger.info({
                action: 'decrypt',
                user_id: global.currentUser ? global.currentUser.id : 'system',
                timestamp: new Date().toISOString()
            });
            
            // Validasi parameter input
            if (!encryptedData.data || !encryptedData.iv || !encryptedData.hmac) {
                throw new Error('Format data terenkripsi tidak valid');
            }
            
            // Dapatkan kunci dari KMS eksternal
            const key = await this.externalKMS.decryptKey();
            
            const encrypted = encryptedData.data;
            const iv = Buffer.from(encryptedData.iv, 'hex');
            
            // Verifikasi HMAC untuk memastikan integritas data
            const calculatedHmac = crypto.createHmac(this.hmacAlgo, key)
                .update(encrypted + encryptedData.iv)
                .digest('hex');
            
            if (calculatedHmac !== encryptedData.hmac) {
                throw new Error('Verifikasi integritas data gagal: Data mungkin telah dimanipulasi');
            }
            
            // Dekripsi data
            const decipher = crypto.createDecipheriv(this.algorithm, Buffer.from(key), iv);
            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            
            return decrypted;
        } catch (error) {
            console.error('Error saat dekripsi dengan KMS:', error);
            // Fallback ke dekripsi lokal jika KMS gagal
            return this.decrypt(encryptedData);
        }
    }

    /**
     * Mengenkripsi data sensitif dengan kunci lokal (fallback)
     * @param {string} text Data yang akan dienkripsi
     * @param {string} dataType Jenis data untuk logging
     * @return {Object} Object berisi data terenkripsi, IV, dan HMAC
     */
    encrypt(text, dataType = 'unknown') {
        // Log aktivitas enkripsi (tanpa data yang dienkripsi)
        securityLogger.info({
            action: 'encrypt_local',
            user_id: global.currentUser ? global.currentUser.id : 'system',
            data_type: dataType || this.identifyDataType(text),
            timestamp: new Date().toISOString()
        });
        
        // Generate IV acak untuk setiap proses enkripsi
        const iv = crypto.randomBytes(16);
        
        // Enkripsi data menggunakan AES-256-CBC
        const cipher = crypto.createCipheriv(this.algorithm, Buffer.from(this.localKey), iv);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        // Generate HMAC untuk verifikasi integritas
        const hmac = crypto.createHmac(this.hmacAlgo, this.localKey)
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
     * Mendekripsi data terenkripsi dengan kunci lokal (fallback)
     * @param {Object} encryptedData Object berisi data terenkripsi, IV, dan HMAC
     * @return {string} Data asli yang telah didekripsi
     */
    decrypt(encryptedData) {
        // Log aktivitas dekripsi
        securityLogger.info({
            action: 'decrypt_local',
            user_id: global.currentUser ? global.currentUser.id : 'system',
            timestamp: new Date().toISOString()
        });
        
        // Validasi parameter input
        if (!encryptedData.data || !encryptedData.iv || !encryptedData.hmac) {
            throw new Error('Format data terenkripsi tidak valid');
        }
        
        const encrypted = encryptedData.data;
        const iv = Buffer.from(encryptedData.iv, 'hex');
        
        // Verifikasi HMAC untuk memastikan integritas data
        const calculatedHmac = crypto.createHmac(this.hmacAlgo, this.localKey)
            .update(encrypted + encryptedData.iv)
            .digest('hex');
        
        if (calculatedHmac !== encryptedData.hmac) {
            throw new Error('Verifikasi integritas data gagal: Data mungkin telah dimanipulasi');
        }
        
        // Dekripsi data
        const decipher = crypto.createDecipheriv(this.algorithm, Buffer.from(this.localKey), iv);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    }

    /**
     * Tokenisasi kartu kredit menggunakan Stripe (PCI-DSS)
     * @param {Object} cardData Data kartu kredit
     * @return {Promise<Object>} Token kartu dan 4 digit terakhir
     */
    async tokenizeCard(cardData) {
        try {
            if (!this.stripe) {
                throw new Error('Stripe tidak dikonfigurasi');
            }
            
            // Log aktivitas tokenisasi (tanpa data kartu)
            securityLogger.info({
                action: 'tokenize_card',
                user_id: global.currentUser ? global.currentUser.id : 'system',
                timestamp: new Date().toISOString()
            });
            
            // Buat token kartu di Stripe
            const token = await this.stripe.tokens.create({
                card: {
                    number: cardData.number,
                    exp_month: cardData.exp_month,
                    exp_year: cardData.exp_year,
                    cvc: cardData.cvc, // CVV hanya digunakan untuk membuat token, tidak disimpan
                    name: cardData.name
                }
            });
            
            // Kembalikan token dan 4 digit terakhir
            return {
                token_id: token.id,
                last_four: cardData.number.slice(-4)
            };
        } catch (error) {
            console.error('Error saat tokenisasi kartu:', error);
            throw new Error('Gagal melakukan tokenisasi kartu');
        }
    }

    /**
     * Penghapusan data yang aman (secure delete)
     * @param {Object} data Data yang akan dihapus
     * @return {Object} Data yang telah dioverwrite dengan nilai acak
     */
    secureOverwrite(data) {
        // Log aktivitas secure overwrite
        securityLogger.info({
            action: 'secure_overwrite',
            user_id: global.currentUser ? global.currentUser.id : 'system',
            timestamp: new Date().toISOString()
        });
        
        // Generate data acak untuk overwrite
        const randomData = crypto.randomBytes(32).toString('hex');
        
        // Enkripsi data acak
        const encryptedRandom = this.encrypt(randomData);
        
        // Kembalikan data acak terenkripsi untuk overwrite
        return encryptedRandom;
    }

    /**
     * Helper untuk mengidentifikasi jenis data (untuk logging)
     * @param {string} text Data yang akan diidentifikasi
     * @return {string} Jenis data
     */
    identifyDataType(text) {
        if (text.match(/^\d{13,19}$/)) return 'payment_card'; // Pola kartu pembayaran
        if (text.match(/^\d{3,4}$/)) return 'cvv';
        if (text.includes('@')) return 'email';
        if (text.match(/^\d{10,15}$/)) return 'phone';
        return 'other';
    }
}

module.exports = EnhancedCryptoService;