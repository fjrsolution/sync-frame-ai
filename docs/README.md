# Dokumentasi FrameSync AI

Panduan pembeli:

1. [Menjalankan di Windows](RUN-WINDOWS.md)
2. [Menjalankan di macOS](RUN-MACOS.md)
3. [Cara memakai aplikasi](CARA-MENGGUNAKAN-APLIKASI.md)
4. [Lisensi penggunaan](../LICENSE.txt)

Extract ZIP, sambungkan internet, lalu buka `MULAI-APLIKASI.bat` (Windows) atau `MULAI_APLIKASI-MAC.command` (Mac). Launcher memasang Python 3.11 dan seluruh dependensi pada folder project, memeriksa FFmpeg, lalu membuka browser ketika server siap. Instalasi manual Python tidak diperlukan.

## Perangkat yang ditargetkan

- Windows 10/11 x64, prosesor Intel/AMD.
- Mac Apple Silicon M1 atau lebih baru, macOS 14+.
- Browser modern; ruang kosong beberapa GB untuk paket/model, ditambah ruang media dan render. RAM 16 GB disarankan; kebutuhan aktual bergantung ukuran media/model.
- Windows ARM, 32-bit, Mac Intel, Android, dan iOS tidak didukung oleh launcher AI lengkap ini.

Internet dibutuhkan untuk instalasi, download model pertama, dan pustaka frontend dari CDN. Aplikasi belum merupakan paket offline penuh. Model diunduh oleh setup AI aplikasi saat diperlukan, bukan seluruhnya sebelum browser dibuka.

## Sebelum dijual atau dikirim

Buat salinan distribusi bersih yang berisi `backend/`, `frontend/`, `scripts/`, `docs/`, kedua requirements, launcher mulai/berhenti, README, dan folder data kosong. Jangan hanya mengirim launcher atau frontend.

**Jangan sertakan** `.venv/`, `.venv-backup-*/`, `.runtime/`, `logs/`, `__pycache__/`, cache model, kredensial, serta project/upload/output pribadi. Jangan menghapus data kerja asli saat menyiapkan salinan distribusi. Environment Python tidak portabel antar komputer; pembeli harus membangunnya lewat launcher.

Untuk ZIP Mac, pertahankan line ending LF dan izin executable `.command`. Buat arsip dari Mac setelah `chmod +x` atau jelaskan langkah `bash` pada panduan Mac. ZIP yang dibuat di Windows dapat kehilangan izin ini.

Sebelum rilis, uji salinan ZIP pada Windows dan Mac target yang belum memiliki Python: instal pertama, buka ulang, upload audio/gambar, setup model, analisis, preview, render, dan stop. Uji juga path berspasi serta unduhan terputus. Pengujian di satu laptop tidak membuktikan kompatibilitas seluruh perangkat. Rentang versi requirements masih memungkinkan pembaruan paket; uji ulang setiap rilis distribusi.

## Data pengguna

- `projects/`: project tersimpan.
- `uploads/`: foto/audio/video input.
- `outputs/`: hasil render.
- `cache/`: cache analisis dan model, dapat berisi turunan media pribadi.

Backup data tersebut sebelum memindahkan project. Paket AI dan Python dapat diunduh ulang. Baca `logs/` jika instalasi atau startup gagal.

## Referensi teknis

Python mandiri memakai [uv dari Astral](https://docs.astral.sh/uv/guides/install-python/), dipasang pada `.runtime/`. Windows dapat memerlukan [Microsoft Visual C++ Runtime](https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist). [PyTorch mengakhiri dukungan Mac Intel setelah seri 2.2](https://pytorch.org/blog/pytorch2-2/), sehingga paket AI modern project ini ditargetkan ke Apple Silicon.
