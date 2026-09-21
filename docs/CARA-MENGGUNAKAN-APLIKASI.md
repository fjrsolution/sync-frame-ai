# Cara Menggunakan FrameSync AI

## 1. Buat atau pilih project

Saat aplikasi terbuka, buat project baru dan beri nama. Semua perubahan disimpan otomatis pada project tersebut.

## 2. Upload bahan

Klik **Upload Assets**.

- Upload foto untuk visual video.
- Semua audio memakai **Voice Sequence**, baik hanya satu voice maupun banyak voice.
- Urutkan kartu voice dengan drag-and-drop. Urutan ini menjadi urutan suara dalam video.
- Klik ikon play pada kartu voice untuk mendengarkan audio sebelum disinkronkan.
- Tab **Intro** menerima tepat satu file MP4, MOV, M4V, atau WebM. Video ini
  selalu ditempatkan di awal dan tidak pernah menjadi kandidat Auto Sync.

Saat intro ditambahkan, scene, voice, musik, subtitle, dan transcript yang sudah
ada digeser setelah durasi intro. Upload intro baru akan mengganti intro lama.
Audio bawaan video intro ikut diputar pada preview dan hasil render. Voice narration
baru dimulai setelah intro selesai agar kedua suara tidak bertabrakan.

Saran: upload foto yang memang menceritakan bagian narasi yang sama. Semakin jelas subjek foto, semakin baik hasil Auto Sync.

Klik ikon preview pada kartu image untuk membuka gambar besar. Di modal itu Anda
dapat mengisi:

- **Deskripsi foto**: jelaskan tokoh, objek, aksi, tempat, dan waktu. Deskripsi ini diprioritaskan di atas caption AI.
- **Kata/frasa wajib**: isi frasa yang harus memakai image tersebut, dipisahkan koma. Contoh: `Dayang Sumbi memasak, memasak ramuan`.
- **Analisis ulang image**: membuat ulang caption AI hanya untuk image tersebut tanpa mengubah deskripsi pengguna.

Klik **Simpan pemahaman image** sesudah mengedit. Caption AI tetap ditampilkan
terpisah dan tidak dapat mengganti koreksi Anda.

## 3. Jalankan Analyze & Auto Sync

Sebelum menganalisis, pilih **Bahasa** sesuai bahasa yang benar-benar dipakai
oleh voice/naskah:

- **Indonesia** untuk narasi bahasa Indonesia;
- **English** untuk narasi bahasa Inggris;
- **中文** untuk narasi bahasa Mandarin/China;
- **한국어** untuk narasi bahasa Korea.

Pilihan ini dipakai oleh Whisper saat membaca ucapan, oleh pemisah kalimat,
dan oleh pencocokan frasa visual dengan image. Pilihan disimpan per project dan
juga dipakai oleh **Auto Caption**. Jika bahasa diganti, aplikasi membuat ulang
transcript agar transcript bahasa lama tidak dipakai kembali.

Klik **Analyze & Auto Sync** setelah foto dan voice sudah masuk.

Analyze pertama dapat lebih lama karena model AI lokal diunduh dan membuat
pemahaman setiap image. Jendela progress menampilkan empat tahap:

1. Faster Whisper `small` untuk transcript dan waktu setiap kata;
2. SigLIP2 untuk mencocokkan narasi langsung dengan isi gambar;
3. Florence-2 Base untuk mendeskripsikan isi gambar;
4. `multilingual-e5-small` untuk membandingkan narasi dengan deskripsi gambar.

Model diproses satu per satu dan dilepas dari RAM sebelum tahap berikutnya.
Florence memproses satu image setiap kali agar tetap nyaman pada RAM 8 GB.
Jika download terputus, proses berhenti dan menampilkan **Coba Lagi**. Pilihan
**Lanjut Mode Terbatas** tetap dapat membuat timeline memakai cache/fallback,
tetapi akurasi visualnya lebih rendah dan aplikasi menampilkannya dengan jelas.

Analyze berikutnya memakai cache sehingga lebih cepat.
Jika voice, urutan voice, bahasa, dan mode segmentasi tidak berubah, Auto Sync
juga memakai transcript beserta word timestamp sebelumnya. Karena itu menekan
Auto Sync ulang tidak mengubah batas scene hanya akibat hasil transkripsi baru.

FrameSync memuat model secara bergantian agar tetap nyaman pada komputer RAM
8 GB: SigLIP dilepas sebelum Florence-2, lalu Florence-2 dilepas sebelum encoder
caption multilingual dimuat. Caption image, embedding, dan transcript disimpan
berdasarkan hash isi file, bahasa, serta versi model. File lama tidak dianalisis
ulang. Jika isi file atau versi model berubah, hanya cache terkait yang dibuat ulang.

FrameSync juga menyimpan matriks kecocokan SigLIP2, pencocokan caption
multilingual, dan hasil Global Optimizer. Saat Auto Sync diulang tanpa perubahan
naskah, image, atau deskripsi, model besar tidak dimuat kembali dan hasil
pemilihan image tetap identik. Mengubah input otomatis membatalkan cache terkait.

Aplikasi akan:

1. membaca narasi dan memisahkannya berdasarkan kalimat serta jeda;
2. memilih foto yang paling relevan untuk setiap bagian;
3. membuat timeline gambar dan audio;
4. menampilkan nilai confidence pada scene yang hasilnya belum cukup yakin.

Jika menjalankan Auto Sync lagi ketika timeline sudah ada, pilih salah satu:

- **Override Semua**: membuat ulang seluruh scene otomatis.
- **Hanya Voice Baru**: hanya membuat scene dari voice dan batch gambar yang baru ditambahkan; scene lama dipertahankan.

Edit manual dan clip yang dikunci dilindungi saat sinkronisasi ulang dengan voice yang sama.

## 4. Periksa dan edit timeline

Pada timeline bawah:

- klik scene untuk memilihnya;
- drag scene untuk memindahkan waktu;
- tarik sisi kiri/kanan scene untuk mengubah durasi;
- pilih **Sumber visual** langsung dari Inspector bila foto tidak sesuai;
- gunakan **Start = playhead** atau **End = playhead** untuk memotong scene pada
  posisi pemutar saat ini;
- klik **Simpan edit manual** untuk langsung menyimpan perubahan;
- gunakan tombol lock bila scene tidak boleh diubah oleh Auto Sync berikutnya;
- gunakan tombol play untuk memeriksa hasil sebelum render.

Editor mencegah scene visual saling overlap saat timing diketik, digeser, atau
di-resize. Setiap perubahan sumber, timing, crop, motion, dan transition otomatis
ditandai sebagai edit manual sehingga tetap dipertahankan saat Auto Sync diulang.
Intro dikunci pada detik nol; hapus dari tab **Intro** atau upload video baru untuk
menggantinya.

Nilai **LOW CONFIDENCE** bukan error. Artinya beberapa foto memiliki skor yang mirip sehingga bagian tersebut perlu diperiksa manual.

Klik **Review LOW** untuk berpindah langsung ke scene LOW berikutnya. Inspector
menampilkan caption yang cocok, aksi/frasa yang cocok, alternatif terdekat,
pengaruh urutan, serta kesepakatan direct visual dengan caption.

Peringatan **Butuh foto tambahan** berarti engine mempertahankan image paling
relevan lebih lama karena alternatif tersedia tidak cukup cocok. Tambahkan image
yang sesuai, lalu jalankan Auto Sync lagi.

## 5. Tambahkan caption bila diperlukan

Caption tidak dibuat otomatis saat Analyze. Klik **Auto Caption** jika ingin membuat subtitle.

Pilih salah satu dari lima style caption. Matikan toggle **Caption aktif** bila video tidak ingin menampilkan subtitle. Saat nonaktif, caption tidak ikut preview maupun hasil render.

## 6. Pilih ukuran video

Di kontrol **Canvas**, pilih ukuran yang sesuai:

- `16:9` untuk YouTube atau layar lebar;
- `9:16` untuk TikTok, Reels, dan Shorts;
- `1:1` untuk post Instagram;
- `4:5` untuk feed portrait;
- `4:3` untuk format klasik.

Preview dan hasil render menggunakan ukuran yang sama.

## 7. Render video

Klik tombol **Render**. Jangan menutup aplikasi sampai render selesai.

Setelah selesai, video MP4 dapat dibuka atau diunduh dari aplikasi. File aslinya berada di folder `outputs/` dalam folder project.

## Tips hasil yang lebih baik

- Gunakan foto berbeda untuk lokasi, tokoh, dan peristiwa berbeda.
- Beri urutan foto sesuai alur cerita sebelum Analyze.
- Untuk tokoh fiksi atau detail yang tidak terlihat jelas pada foto, lakukan koreksi manual melalui **Replace image** lalu lock scene tersebut.
- Jangan memakai satu foto untuk terlalu banyak kejadian yang berbeda.
- Periksa scene LOW CONFIDENCE lebih dulu sebelum render.

## Backup project

Untuk memindahkan atau mengamankan project, salin folder berikut bersama-sama:

```text
projects/
uploads/
outputs/
```

Simpan salinan di lokasi lain sebelum menghapus project atau menginstal ulang aplikasi.
