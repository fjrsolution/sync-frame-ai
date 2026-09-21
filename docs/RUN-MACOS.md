# Menjalankan FrameSync AI di macOS

## Instalasi pertama

1. Gunakan Mac **Apple Silicon (M1 atau lebih baru)** dengan macOS 14 atau lebih baru. Paket AI lengkap saat ini tidak mendukung Mac Intel.
2. Extract seluruh ZIP ke folder lokal yang bisa ditulis, misalnya `~/Documents/FrameSync-AI`.
3. Sambungkan internet, lalu double-click **MULAI_APLIKASI-MAC.command**.
4. Tunggu pemasangan Python 3.11, dependensi aplikasi, AI lokal, dan FFmpeg. Tidak perlu memasang Python, Homebrew, Node.js, atau Xcode secara manual.
5. Browser terbuka di **http://127.0.0.1:8000** setelah server siap. Biarkan Terminal terbuka selama aplikasi digunakan.

Jika ZIP tidak mempertahankan izin executable, buka Terminal, ketik `bash` diikuti spasi, seret file `MULAI_APLIKASI-MAC.command` ke Terminal, lalu tekan Enter. Alternatif untuk mengaktifkan double-click:

```bash
cd ~/Documents/FrameSync-AI
chmod +x MULAI_APLIKASI-MAC.command HENTIKAN_APLIKASI-MAC.command
./MULAI_APLIKASI-MAC.command
```

Jika macOS memblokir file, ikuti menu Open/Privacy & Security sesuai versi macOS setelah memastikan sumber file dipercaya. Launcher tidak dapat menghilangkan Gatekeeper atau kebijakan perangkat. Penjual perlu menjaga izin executable saat membuat arsip di Mac.

## Pemakaian berikutnya

Double-click launcher yang sama. Python dan dependensi dipakai kembali; perubahan pada kedua file requirements diperiksa. Tekan **Control+C** pada Terminal launcher untuk menghentikan aplikasi. Menutup browser saja tidak menghentikan server.

## Model AI dan koneksi

Launcher memasang paket AI. Bobot model diunduh oleh setup AI aplikasi saat diperlukan; tunggu indikator selesai sebelum menganalisis. Siapkan beberapa GB untuk unduhan dan cache, ditambah ruang video. Cache Hugging Face berada di `cache/huggingface/`. Frontend masih memakai CDN sehingga internet juga dibutuhkan untuk memuat pustaka antarmuka yang belum tersimpan di browser.

## Mengatasi kendala

- Unduhan gagal: periksa internet, ruang disk, dan akses GitHub/PyPI/Hugging Face, lalu jalankan ulang.
- Port 8000 digunakan: tutup aplikasi pemilik port dan jalankan ulang.
- Import atau server gagal: baca `logs/setup.log`, `logs/server.log`, dan `logs/bootstrap-macos.log`.
- Browser tidak terbuka: buka `http://127.0.0.1:8000` sendiri.
- Folder dipindahkan: environment lama disimpan sebagai `.venv-backup-*` dan dibuat ulang. Jangan ikut mengirim `.venv` atau `.runtime` ke perangkat lain.

Python dan dependensi dipasang lokal pada folder project tanpa mengubah Python sistem. Mac Intel membutuhkan penyesuaian paket/model tersendiri; jangan menjual versi AI lengkap ini sebagai kompatibel dengan Mac Intel.
