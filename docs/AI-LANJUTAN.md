# Analisis adegan lanjutan (opsional)

Auto Sync tetap memakai SigLIP2, Florence-2, dan E5 sebagai dasar. Analisis video sekarang mendeteksi cut adaptif, menyimpan tiga frame sampel per shot (awal, tengah, akhir), dan membandingkan ketiganya dengan narasi. Di modal video, frame beserta timestamp dapat ditinjau; rentang shot dan deskripsi pengguna tetap bisa dikoreksi.

## Pemeriksa adegan Qwen lokal

Pemeriksaan ini **tidak aktif secara bawaan**. Ia hanya memeriksa sejumlah kecil pasangan visual–narasi yang LOW atau skornya berdekatan. Pada video, tiga frame sampel diperiksa; satu frame yang bertentangan tidak cukup untuk memberi penalti seluruh shot. Bukti yang jelas bertentangan dapat menurunkan skor, tetapi tidak mengganti deskripsi/kata wajib yang diberikan pengguna. Hasilnya tampil di Inspector sebagai “Pemeriksaan adegan”. Tanpa konfigurasi, Inspector menampilkan “Tidak diperiksa” dan Auto Sync berjalan seperti biasa.

Siapkan sendiri binary `llama-mtmd-cli`, bobot `Qwen3-VL-2B-Instruct` GGUF `Q4_K_M`, serta vision encoder (`mmproj`) yang cocok. Tempatkan di lokasi yang dapat dibaca aplikasi; jangan campur dengan paket distribusi tanpa memeriksa lisensinya. Buat manifest JSON, misalnya:

```json
{
  "model_id": "Qwen/Qwen3-VL-2B-Instruct-GGUF",
  "quant": "Q4_K_M",
  "runtime": "C:/models/llama-mtmd-cli.exe",
  "runtime_sha256": "64 karakter SHA-256",
  "model": "C:/models/Qwen3-VL-2B-Instruct-Q4_K_M.gguf",
  "model_sha256": "64 karakter SHA-256",
  "mmproj": "C:/models/mmproj.gguf",
  "mmproj_sha256": "64 karakter SHA-256"
}
```

Isi checksum file aktual (PowerShell: `Get-FileHash -Algorithm SHA256 <path>`), kemudian set `FRAME_SYNC_SCENE_VERIFIER_CONFIG` ke path manifest sebelum membuka aplikasi. Aplikasi menolak file yang tidak cocok dengan checksum. Runtime hanya dipanggil sebagai proses lokal, bukan layanan cloud. Jika tidak tersedia/gagal, Auto Sync tetap memakai skor dasar dan memberi peringatan. Pemeriksa ini belum menjadi jaminan akurasi; hasil LOW tetap perlu ditinjau manusia. Untuk RAM 16 GB, ukur waktu dan penggunaan memori pada perangkat target sebelum mendistribusikannya.

## Penyelarasan naskah dengan WhisperX

Jika naskah asli tersedia atau timestamp kata ditandai meragukan, worker WhisperX dapat memperbaiki sebagian timestamp tanpa mentranskripsi seluruh audio lagi. Paketnya dipisahkan dari environment utama agar versi Torch aplikasi tidak berubah. Instal dengan `make align` (atau lihat target `align` pada `Makefile`). Setelah itu, model alignment bahasa yang dipakai perlu tersedia di cache lokal; download pertama memerlukan internet bila diizinkan aplikasi. Kata yang gagal disejajarkan tetap menggunakan timestamp Whisper lama.

Jangan menjalankan worker ini sebagai syarat wajib untuk semua project: angka, simbol, musik, dan suara bertumpuk masih dapat membuat alignment keliru. Cache alignment didasarkan pada isi audio, teks/word timestamp, bahasa, dan versi pipeline.

## Pemeriksaan hasil

Bandingkan onset visual dengan awal klausa, buka `Review LOW`, lalu perbaiki deskripsi, cue, atau pasangan manual. Semua gambar wajib terpakai hanya pada mode cakupan/storyboard dan selama constraint durasi/clip terkunci masih memungkinkan; cakupan tidak membuktikan visualnya cocok. Jangan menimpa timeline lama bila preview Auto Sync menyatakan konflik.
