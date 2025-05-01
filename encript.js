// const crypto = require('crypto');
// const algorithm = 'aes-256-cbc';
// const key = crypto.createHash('sha256').update(String(process.env.SECRET_KEY)).digest('base64').substr(0, 32);

// function encrypt(text) {
//   const iv = crypto.randomBytes(16);
//   const cipher = crypto.createCipheriv(algorithm, key, iv);
//   const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
//   return {
//     encryptedData: encrypted.toString('hex'),
//     iv: iv.toString('hex'),
//   };
// }

// function decrypt(encryptedData, ivHex) {
//   const iv = Buffer.from(ivHex, 'hex');
//   const decipher = crypto.createDecipheriv(algorithm, key, iv);
//   const decrypted = Buffer.concat([decipher.update(Buffer.from(encryptedData, 'hex')), decipher.final()]);
//   return decrypted.toString('utf8');
// }

// module.exports = { encrypt, decrypt };
