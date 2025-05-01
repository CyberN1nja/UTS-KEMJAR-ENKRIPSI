/**
 * ExternalKMS.js - Integrasi dengan Key Management Service (KMS) Eksternal
 * 
 * Modul ini menyediakan integrasi dengan layanan KMS eksternal seperti AWS KMS
 * untuk menyimpan dan mengelola kunci enkripsi secara lebih aman sesuai dengan
 * rekomendasi keamanan.
 */
const AWS = require('aws-sdk');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

class ExternalKMS {
    constructor() {
        // Inisialisasi KMS client
        this.kms = new AWS.KMS({
            region: process.env.AWS_REGION || 'us-east-1',
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        });
        this.keyId = process.env.KMS_KEY_ID; // ID kunci di AWS KMS
    }

    /**
     * Mendapatkan kunci dari KMS untuk enkripsi
     * @return {Promise<Buffer>} Kunci enkripsi dalam bentuk Buffer
     */
    async getEncryptionKey() {
        const params = {
            KeyId: this.keyId,
            NumberOfBytes: 32 // 256 bit untuk AES-256
        };
        
        try {
            const data = await this.kms.generateDataKey(params).promise();
            // Simpan kunci terenkripsi untuk dekripsi nanti
            this.encryptedKey = data.CiphertextBlob;
            // Gunakan kunci plaintext untuk enkripsi saat ini
            return data.Plaintext;
        } catch (error) {
            console.error('Error saat mengambil kunci dari KMS:', error);
            throw new Error('Gagal mendapatkan kunci enkripsi dari KMS');
        }
    }

    /**
     * Mendekripsi kunci untuk operasi dekripsi
     * @return {Promise<Buffer>} Kunci dekripsi dalam bentuk Buffer
     */
    async decryptKey() {
        const params = {
            CiphertextBlob: this.encryptedKey
        };
        
        try {
            const data = await this.kms.decrypt(params).promise();
            return data.Plaintext;
        } catch (error) {
            console.error('Error saat mendekripsi kunci dari KMS:', error);
            throw new Error('Gagal mendekripsi kunci dari KMS');
        }
    }
}

module.exports = ExternalKMS;