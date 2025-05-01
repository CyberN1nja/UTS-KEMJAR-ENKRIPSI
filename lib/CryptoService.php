<?php
namespace Lib;

/**
 * CryptoService - Layanan Enkripsi dan Dekripsi Data
 * 
 * Kelas ini menyediakan fungsi untuk mengenkripsi dan mendekripsi data sensitif
 * menggunakan algoritma AES-256-CBC dengan IV acak dan HMAC untuk verifikasi integritas
 * sesuai dengan standar GDPR dan PCI-DSS.
 */
class CryptoService {
    private $key;
    private $cipher = 'aes-256-cbc';
    private $hmacAlgo = 'sha256';
    
    /**
     * Constructor
     * @param string $key Kunci enkripsi dari KMS
     */
    public function __construct($key) {
        $this->key = $key;
    }
    
    /**
     * Mengenkripsi data sensitif
     * @param string $data Data yang akan dienkripsi
     * @return array Array berisi data terenkripsi, IV, dan HMAC
     */
    public function encrypt($data) {
        // Generate IV acak untuk setiap proses enkripsi
        $iv = openssl_random_pseudo_bytes(16);
        
        // Enkripsi data menggunakan AES-256-CBC
        $encrypted = openssl_encrypt($data, $this->cipher, $this->key, 0, $iv);
        
        if ($encrypted === false) {
            throw new \Exception('Enkripsi gagal: ' . openssl_error_string());
        }
        
        // Generate HMAC untuk verifikasi integritas
        $hmac = hash_hmac($this->hmacAlgo, $encrypted . bin2hex($iv), $this->key, true);
        
        // Mengembalikan hasil dalam format yang aman untuk disimpan di database
        return [
            'data' => base64_encode($encrypted),
            'iv' => bin2hex($iv),
            'hmac' => bin2hex($hmac)
        ];
    }
    
    /**
     * Mendekripsi data terenkripsi
     * @param array $encryptedData Array berisi data terenkripsi, IV, dan HMAC
     * @return string Data asli yang telah didekripsi
     */
    public function decrypt($encryptedData) {
        // Validasi parameter input
        if (!isset($encryptedData['data']) || !isset($encryptedData['iv']) || !isset($encryptedData['hmac'])) {
            throw new \Exception('Format data terenkripsi tidak valid');
        }
        
        $encrypted = base64_decode($encryptedData['data']);
        $iv = hex2bin($encryptedData['iv']);
        $hmac = hex2bin($encryptedData['hmac']);
        
        // Verifikasi HMAC untuk memastikan integritas data
        $calculatedHmac = hash_hmac($this->hmacAlgo, $encrypted . $encryptedData['iv'], $this->key, true);
        
        if (!hash_equals($calculatedHmac, $hmac)) {
            throw new \Exception('Verifikasi integritas data gagal: Data mungkin telah dimanipulasi');
        }
        
        // Dekripsi data
        $decrypted = openssl_decrypt($encrypted, $this->cipher, $this->key, 0, $iv);
        
        if ($decrypted === false) {
            throw new \Exception('Dekripsi gagal: ' . openssl_error_string());
        }
        
        return $decrypted;
    }
}