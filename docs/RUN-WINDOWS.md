# Menjalankan FrameSync AI di Windows

## Instalasi pertama

1. Gunakan Windows 10/11 **64-bit Intel/AMD**. Windows ARM dan 32-bit belum didukung paket AI ini.
2. Extract seluruh ZIP ke folder yang bisa ditulis, misalnya `C:\FrameSync-AI`. Jangan menjalankan dari dalam ZIP atau `Program Files`. Folder lokal dengan nama pendek disarankan agar path paket AI tidak terlalu panjang.
3. Sambungkan internet dan double-click **MULAI-APLIKASI.bat**.
4. Tunggu unduhan Python 3.11, paket aplikasi, AI lokal, dan FFmpeg selesai. Tidak perlu memasang Python, pip, Git, Node.js, atau FFmpeg secara manual.
5. Bila Microsoft Visual C++ Runtime belum tersedia, launcher mengunduh installer Microsoft. Izinkan permintaan Windows; jika diminta restart, restart lalu buka launcher lagi.
6. Browser terbuka setelah server siap di **http://127.0.0.1:8000**. Biarkan jendela launcher terbuka selama aplikasi digunakan.

Instalasi pertama dapat memerlukan beberapa GB unduhan. Sediakan ruang kosong yang cukup untuk paket, cache model, serta video. Jangan membuka beberapa launcher saat pemasangan sedang berjalan.

## Pemakaian berikutnya

Double-click file yang sama. Python dan paket yang sudah terpasang dipakai kembali. Launcher memeriksa kedua file requirements, import paket AI, dan executable FFmpeg. Paket dipasang ulang bila daftar berubah atau pemeriksaan import gagal. Jika server sudah berjalan, browser dibuka tanpa membuat server kedua.

Tekan **Ctrl+C** di jendela launcher untuk menghentikan aplikasi. Menutup tab browser saja tidak menghentikan server.

## Model AI

Paket AI terpasang melalui launcher. Bobot Whisper, SigLIP2, Florence-2, dan multilingual E5 diunduh oleh alur setup AI aplikasi saat diperlukan. Tunggu indikator setup AI selesai sebelum analisis. Ini berbeda dari pemasangan paket Python dan memerlukan unduhan tambahan. Cache Hugging Face disimpan di `cache/huggingface/`.

## Mengatasi kendala

- **Download gagal:** periksa internet, ruang disk, proxy/firewall, dan akses ke GitHub, PyPI, serta Hugging Face. Jalankan launcher lagi.
- **Akses ditolak:** extract ke folder milik pengguna. Kebijakan antivirus/perusahaan dapat membatasi eksekusi; launcher tidak menonaktifkan proteksi tersebut.
- **Port 8000 dipakai:** tutup aplikasi pemilik port. Jangan menghentikan proses lain secara sembarang.
- **Server gagal:** baca `logs/server.log`; detail pemasangan ada di `logs/setup.log` dan `logs/bootstrap-windows.log`.
- **Browser tidak terbuka:** buka `http://127.0.0.1:8000` secara manual.
- **Environment dari laptop lama:** launcher menyimpan environment lama sebagai `.venv-backup-*`, lalu membuat yang baru. Setelah berhasil, backup environment boleh dihapus; jangan hapus folder data project.
- **SmartScreen:** pastikan sumber paket dipercaya dan ikuti kebijakan keamanan Windows. Peringatan OS tidak dapat dijamin hilang oleh launcher.

Python khusus aplikasi berada di `.runtime/python/`, dependensi berada di `.venv/`. Python sistem dan PATH pengguna tidak perlu diubah.
