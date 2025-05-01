<?php
namespace Lib;

/**
 * Key Management Service (KMS) Simulasi
 * Kelas ini bertanggung jawab untuk mengambil kunci enkripsi dari environment variable
 * Ini adalah praktik keamanan terbaik untuk tidak menyimpan kunci di dalam source code
 */
class KMS {
    /**
     * Mengambil kunci enkripsi dari environment variable
     * @return string Kunci enkripsi yang digunakan untuk AES-256-CBC
     */
    public static function getEncryptionKey() {
        // Mengambil kunci dari environment variable
        $key = getenv('ENCRYPTION_KEY');
        
        // Validasi kunci
        if (!$key) {
            throw new \Exception('Encryption key tidak ditemukan di environment variable');
        }
        
        // Memastikan kunci memiliki panjang yang tepat untuk AES-256 (32 bytes)
        if (strlen($key) !== 32) {
            throw new \Exception('Encryption key harus memiliki panjang 32 karakter untuk AES-256');
        }
        
        return $key;
    }
    
    /**
     * Mengambil IV (Initialization Vector) dari environment variable
     * @return string IV yang digunakan untuk AES-256-CBC
     */
    public static function getIV() {
        // Mengambil IV dari environment variable atau generate secara acak
        $iv = getenv('ENCRYPTION_IV');
        
        // Jika tidak ada, generate IV baru secara acak
        if (!$iv) {
            // Generate IV acak 16 bytes (128 bits) sesuai kebutuhan AES
            $iv = openssl_random_pseudo_bytes(16);
        }
        
        return $iv;
    }
}