# Daftar Fitur FrameSync AI

Dokumen ini merangkum fitur aplikasi yang tersedia pada rilis saat ini. Fitur
yang masih dalam pengembangan ditandai terpisah agar tidak disalahartikan sebagai
fitur yang sudah siap dipakai.

## Auto Sync dan AI lokal

### Tiga mode pemilihan visual

- **Cakupan AI**: semua gambar aktif wajib terpakai, AI boleh mengubah urutan.
  Video B-roll opsional kecuali diberi tanda wajib. Pemilihan global memakai
  OR-Tools CP-SAT dengan batas 30 detik, seed tetap, satu worker, minimum shot
  1,2 detik, dan larangan sumber gambar muncul kembali setelah ditinggalkan.
  Hasil feasible adalah draft, bukan jaminan optimum atau kecocokan sempurna.
  Review LOW wajib sebelum draft diterapkan; kegagalan tidak menyimpan timeline
  parsial. Clip manual/terkunci dan rentang waktunya dipertahankan.
- Kelompok visual untuk Cakupan AI dipilih eksplisit: **Semua voice** atau voice
  tertentu. Pengelompokan berdasar waktu upload tidak membatasi kandidat.
- Proyek baru memakai Cakupan AI sebagai awal. Proyek lama mempertahankan mode
  tersimpan tanpa migrasi otomatis.

- **Semantic AI**: image dan B-roll bersaing berdasarkan relevansi. Urutan bukan
  kewajiban dan aset yang tidak relevan boleh tidak digunakan.
- **Storyboard · urutan**: khusus image yang sudah disusun. Semua image dalam
  kelompok voice wajib muncul dalam urutan library. Jumlah beat dan image sama
  menghasilkan pasangan 1:1 tanpa pemilihan ulang oleh AI. Skor AI hanya validasi.
- Bila beat lebih banyak, beat berdekatan dikelompokkan secara berurutan. Bila
  image lebih banyak, scene dibagi pada word onset yang tersedia dengan minimum
  1,2 detik untuk potongan baru. Jika tidak memungkinkan, proses gagal dengan
  pesan jelas sebelum timeline disimpan; tidak ada image yang dibuang diam-diam.
- Pacing Storyboard mengutamakan 1,8–4 detik, penalti hold mulai 4,5 detik dan
  peringatan di atas 5,5 detik. Coverage dan batas audio tetap diutamakan; durasi
  tidak dipaksakan dengan memotong kata, mengulang sumber, atau mengubah suara.
- **Naskah asli** opsional tersedia di modal Storyboard, terpisah per voice.
  Satu baris menentukan satu beat; bila hanya satu paragraf, gunakan tanda akhir
  kalimat. Teks berasal dari naskah, waktunya dicocokkan ke word timestamps Whisper.
  Ini alignment leksikal lokal, bukan forced alignment fonetik. Kecocokan parsial
  ditandai LOW; naskah yang terlalu berbeda ditolak, bukan diberi waktu tebakan.
- Clip manual/locked tetap dilindungi. Jika perlindungan membuat urutan atau
  coverage mustahil, pengguna menerima pesan konflik. Override semua tetap pilihan
  eksplisit, tidak dijalankan otomatis. Intro tidak dihitung sebagai image storyboard.

### Review per kalimat

- Mode semantik per kalimat dari proyek lama tetap dapat dibaca tanpa migrasi
  otomatis. Pilih **Cakupan AI** untuk gambar wajib dengan urutan bebas atau
  **Storyboard · urutan** untuk urutan tetap; mode lama tidak berubah diam-diam.
- **Storyboard** menampilkan narasi, visual terpilih, alasan, confidence per
  kalimat, dan hingga tiga alternatif dari kelompok voice yang sama. Filter LOW
  membantu meninjau pasangan meragukan, termasuk caption yang hanya menjelaskan
  tampilan kartun tanpa bukti aksi.
- Ganti pasangan melalui storyboard menyimpan rentang kalimat sebagai edit manual.
  Clip terkunci harus dibuka kuncinya terlebih dahulu. Auto Sync biasa menjaga
  koreksi manual; override semua tetap dapat menggantinya.
- Koreksi teks transkrip tidak mengubah timestamp audio asli. Jalankan Auto Sync
  setelah menyimpan koreksi untuk memperbarui pencocokan. Penyisipan kata tidak
  membuat timestamp kata baru; interval yang dikoreksi tetap dipertahankan.
- Laporan aset belum terpakai menjelaskan keterbatasan relevansi, kelompok voice,
  dan pemilihan kandidat lain. Skor AI merupakan indikasi, bukan jaminan akurasi.
- Transkrip lama tanpa word timestamps tetap memakai interval segmen; mode ini
  tidak mengarang onset kata. Untuk mendapatkan onset kata baru diperlukan
  transkripsi ulang secara eksplisit.

- Voice Sequence untuk satu atau banyak voice, lengkap dengan drag urutan dan
  preview suara per file.
- Transcript lokal menggunakan Faster Whisper, word timestamp, jeda, kalimat,
  dan klausa untuk membentuk batas scene.
- Pilihan bahasa narasi: Indonesia, English, Mandarin/China, dan Korea.
- Pencocokan image/shot video dengan narasi memakai SigLIP2, Florence-2, dan multilingual E5 saat
  model tersedia secara lokal.
- Global optimizer memilih image atau shot B-roll sebagai satu kumpulan kandidat,
  lengkap dengan confidence, Review LOW, alasan pemilihan, dan alternatif visual.
- Urutan image dan video dinilai terpisah agar video tidak otomatis terdorong ke
  akhir cerita. Kata/frasa wajib pengguna tetap menjadi anchor. Optimizer
  mempertimbangkan adegan berikutnya dan durasi footage sebelum memilih shot.
- Caption AI disimpan per image/shot. Kegagalan satu aset tidak menghapus hasil
  aset lain; modal menampilkan penyebab gagal dan tombol analisis ulang.
- Model yang sudah terpasang tetap dapat membuat caption tanpa internet.
  Proses AI lokal berjalan bergantian untuk menghindari benturan pemuatan model.
- Identifikasi subjek membandingkan manusia, makhluk gaib, campuran, dan objek
  lain melalui SigLIP2 serta deskripsi. Bukti ambigu ditandai **Belum pasti**;
  suasana gelap tidak otomatis dianggap makhluk gaib. Konflik subjek dengan
  narasi mengurangi skor dan ditandai LOW; koreksi/cue pengguna diprioritaskan.
- Jika rentang video terlalu pendek, optimizer memilih visual lain. Jika tidak
  ada visual yang cukup, Auto Sync meminta footage tambahan/perpanjangan rentang
  sebelum membuat timeline yang melampaui Source Out.
- Cache transcript, caption, embedding, serta skor agar Analyze berikutnya lebih
  cepat dan hasil tidak berubah tanpa perubahan input.
- Pilihan **Override Semua** atau **Hanya Voice Baru** ketika Auto Sync diulang.
- Scene atau edit manual yang dikunci dilindungi dari Auto Sync ulang.

## Asset visual dan audio

- Upload, hapus, urutkan, cari, kelompokkan, beri tag, dan preview image besar.
- Deskripsi foto dan kata/frasa wajib menjadi prioritas di atas caption AI.
- Analisis ulang image tanpa menghapus koreksi pengguna.
- Satu video **Intro** di awal timeline dengan audio sumber aktif.
- Video **B-roll** maksimal 10 menit per file. FFmpeg/OpenCV memecahnya menjadi
  shot non-destruktif dan membuat thumbnail/frame representatif untuk AI lokal.
- Modal B-roll berisi player besar, daftar shot, Source In/Out, status aktif,
  caption AI read-only, deskripsi pengguna, kata/frasa wajib, tambah/hapus shot,
  serta analisis ulang satu video.
- Setiap shot aktif menjadi kandidat Auto Sync. Rentang yang sama tidak dipakai
  dua kali otomatis; shot berbeda dari video sumber yang sama tetap boleh dipakai.
- Audio sumber B-roll default bisu. Audio dapat diaktifkan per clip, lalu diatur
  volume serta fade-nya dari Inspector.
- Background music, narration, dan pengaturan volume/fade.

## Timeline dan edit manual

- Drag, resize, split, duplicate, replace, delete, copy/paste, lock, dan ripple
  edit.
- Ganti visual scene dengan image atau video B-roll dari Asset Library.
- Crop, fit mode, scale, posisi, motion Ken Burns, dan transition.
- Preview timeline, fullscreen, zoom, marker, serta multi-track visual/audio.
- B-roll dapat dipotong di timeline; bagian hasil split memakai offset footage
  yang tepat.
- B-roll hasil Auto Sync memakai kecepatan asli dan mengambil durasi yang
  diperlukan. Klausa berurutan melanjutkan posisi sumber. Preview menyesuaikan
  playback rate dengan rentang sumber saat clip diubah manual, sehingga tidak
  melakukan seek terus-menerus untuk mengejar suara.
- Inspector B-roll menyediakan Source In/Out. Preview dan render membaca rentang
  footage yang sama; render tidak melewati Source Out atau membekukan frame akhir.

## Caption dan output

- Auto Caption terpisah dari Analyze & Auto Sync.
- Lima style caption: Classic, Impact, Minimal, Karaoke, dan News.
- Caption dapat diaktifkan/nonaktifkan tanpa menghapusnya, diedit manual,
  diimpor dari SRT, atau diekspor ke SRT.
- Canvas 16:9, 9:16, 1:1, 4:5, dan 4:3; preview serta render memakai ukuran yang
  sama.
- Render H.264/H.265, 24/25/30/60 FPS, pilihan kualitas, cancel render, cache
  render, dan riwayat hasil per project.
- Nama output memakai nama project dan kode unik.

## Project dan distribusi

- Buat, simpan, hapus, dan pindahkan project.
- Data project berada pada `projects/`, media input pada `uploads/`, hasil render
  pada `outputs/`, dan cache pada `cache/`.
- Launcher Windows dan macOS serta panduan instalasi untuk pengguna awam.

## Aturan Auto Sync video

- Cue/deskripsi pengguna lebih kuat daripada caption AI.
- Tokoh atau aksi spesifik dengan cue kuat tetap mengutamakan visual yang cocok;
  footage umum cocok untuk tempat, suasana, laut, gunung, dan perjalanan.
- Jika video tidak relevan, engine tidak memaksakannya. Visual terbaik yang ada
  dipakai dan scene diberi LOW atau `Butuh footage tambahan`.
- Clip manual atau terkunci tidak disentuh ketika Auto Sync diulang.
- Hasil analisis shot, thumbnail, caption, dan embedding disimpan berdasarkan
  hash file, rentang shot, dan versi model agar proses berikutnya lebih cepat.
