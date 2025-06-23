// Firebase setup
const firebaseConfig = {
  databaseURL: "https://pembayaran-8587d-default-rtdb.asia-southeast1.firebasedatabase.app",
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

function getUserID() {
  let userId = localStorage.getItem("user_id");
  if (!userId) {
    userId = 'USER-' + Math.random().toString(36).substr(2, 9).toUpperCase();
    localStorage.setItem("user_id", userId);
  }
  document.getElementById("userIdDisplay").textContent = userId;
  return userId;
}

function tampilkanPembayaran() {
  const metode = document.getElementById("metode").value;
  document.getElementById("qr-section").style.display = (metode === "QRIS") ? "block" : "none";
  document.getElementById("nomor-section").style.display = (metode === "DANA" || metode === "GoPay") ? "block" : "none";
}

function pilihProduk() {
  const produk = document.getElementById("produk").value;
  const harga = document.getElementById("harga");
  const emailWrap = document.getElementById("email-wrap");
  if (produk === "canva") {
    harga.value = "4000";
    emailWrap.style.display = "block";
    document.querySelector(".warning-email").style.display = "block";
  } else {
    harga.value = "5000";
    emailWrap.style.display = "none";
    document.querySelector(".warning-email").style.display = "none";
  }
}

function copyNomor() {
  const nomor = document.getElementById("nomor-tujuan").innerText;
  navigator.clipboard.writeText(nomor).then(() => {
    alert("📋 Nomor berhasil disalin!");
  });
}

function generateID() {
  return 'ORDER-' + Math.random().toString(36).substr(2, 9).toUpperCase();
}

// ✅ Update: Fungsi validasi voucher untuk umum & khusus
function validasiVoucher(kode, userId) {
  return db.ref("voucher/" + kode).once("value").then((snap) => {
    if (!snap.exists()) return { valid: false, pesan: "Kode tidak ditemukan." };
    const data = snap.val();
    if (!data.aktif) return { valid: false, pesan: "Kode tidak aktif." };

    // Cek jika voucher KHUSUS
    if (data.userId || data.digunakan !== undefined) {
      if (data.digunakan) return { valid: false, pesan: "Kode sudah digunakan." };
      if (data.userId && data.userId !== userId) return { valid: false, pesan: "Kode ini bukan untuk perangkat Anda." };
    }

    return { valid: true, potongan: data.potongan || 0 };
  });
}

function kirimPesan() {
  const nama = document.getElementById('nama').value.trim();
  const wa = document.getElementById('wa').value.trim();
  const produk = document.getElementById('produk').value;
  const metode = document.getElementById('metode').value;
  const kode = document.getElementById('kode').value.trim();
  const hargaAwal = document.getElementById('harga').value;
  const email = document.getElementById('email').value.trim();
  const bukti = document.getElementById('bukti').files[0];

  if (!/^08[0-9]{8,11}$/.test(wa)) return alert("❌ Nomor WA tidak valid.");
  if (!nama) return alert("❗ Nama wajib diisi.");
  if (!metode) return alert("❗ Pilih metode pembayaran.");
  if (!bukti) return alert("❗ Upload bukti transfer wajib.");
  if (produk === 'canva' && !email) return alert("❗ Email untuk Canva wajib diisi.");

  const idTransaksi = generateID();
  const waktu = new Date().toLocaleString('id-ID');
  const userId = getUserID();

  const prosesSubmit = (hargaFinal, potonganInfo) => {
    const data = { id: idTransaksi, userId, nama, wa, produk, metode, kode, harga: hargaFinal, email, waktu, status: "menunggu" };
    db.ref("pesanan/" + idTransaksi).set(data).then(() => {
      // Tandai digunakan hanya jika voucher khusus
      if (kode !== "" && kode !== "Tidak digunakan") {
        db.ref("voucher/" + kode).once("value").then((snap) => {
          const data = snap.val();
          if (data.digunakan !== undefined) {
            db.ref("voucher/" + kode + "/digunakan").set(true);
          }
        });
      }

      const msg = `🛒 Pesanan Masuk\nID Transaksi: ${idTransaksi}\n👤 ${nama}\n📱 ${wa}\n📦 ${produk === 'canva' ? 'Canva Pro' : 'Alight Motion'}\n💳 ${metode}\n💰 Rp ${hargaFinal}${potonganInfo}\n🎟 ${kode}\n📧 ${email || '-'}\n🕒 ${waktu}`;
      const bot = '7834741276:AAE4aBvJWrAQt1iUNirsayeuyA3zCBWu0oA';
      const chat = '7133478033';

      fetch(`https://api.telegram.org/bot${bot}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chat, text: msg, parse_mode: 'Markdown' })
      }).then(() => {
        const fd = new FormData();
        fd.append('chat_id', chat);
        fd.append('photo', bukti);
        fd.append('caption', `🧾 Bukti Transfer dari ${nama}`);

        fetch(`https://api.telegram.org/bot${bot}/sendPhoto`, {
          method: 'POST',
          body: fd
        }).then(() => {
          alert('✅ Pesanan berhasil dikirim.');
        }).catch(() => alert('❌ Gagal kirim bukti transfer.'));
      }).catch(() => alert('❌ Gagal kirim ke Telegram.'));
    });
  };

  if (kode !== "") {
    validasiVoucher(kode, userId).then(result => {
      if (!result.valid) return alert("❌ " + result.pesan);
      const potongan = result.potongan;
      const hargaFinal = parseInt(hargaAwal) - potongan;
      alert(`✅ Kode berhasil digunakan. Diskon Rp${potongan}`);
      prosesSubmit(hargaFinal, ` (Diskon: Rp${potongan})`);
    });
  } else {
    prosesSubmit(parseInt(hargaAwal), "");
  }
}

// Jalankan user ID saat halaman dibuka
getUserID();
