# Cara Menggunakan FrameSync AI

## Pilih mode Auto Sync dan review storyboard

Untuk proyek baru, mode awal adalah **Cakupan AI**. Buka **Mode** atau dialog
**Analyze & Auto Sync** untuk memilih:

- **Cakupan AI**: semua gambar aktif wajib masuk timeline, tetapi AI boleh
  mengubah urutannya. Video B-roll bersifat opsional kecuali Anda menandainya
  **Wajib dipakai** pada modal video. Hasil pertama hanya berupa draft; periksa
  pasangan berstatus LOW lalu tekan **Terapkan Timeline**. Menutup draft tidak
  mengubah timeline lama.
- **Storyboard · urutan**: semua gambar mengikuti urutan tab Images. Cocok untuk
  gambar yang dibuat satu per satu mengikuti naskah.
- **Semantic AI**: image dan B-roll dipilih berdasarkan kecocokan; sebagian aset
  boleh tidak dipakai. Proyek lama tetap menggunakan mode tersimpan, tidak
  dipindahkan otomatis ke Cakupan AI.

Di modal gambar atau video, **Kelompok voice** dapat dipilih sebagai **Semua
voice** atau voice tertentu. Pilihan ini menentukan di bagian suara mana aset
boleh muncul. Waktu upload bukan lagi pembatas tersembunyi pada Cakupan AI.
Tandai **Wajib dipakai** untuk video yang harus memperoleh minimal satu cuplikan.
Jika durasi, kelompok, atau clip manual/terkunci membuat cakupan mustahil,
Analyze berhenti dengan pesan konflik dan timeline lama tetap utuh. Draft yang
dibuat sebelum project diedit harus dianalisis ulang sebelum diterapkan.

1. Jika memakai **Storyboard · urutan** untuk gambar yang dibuat mengikuti naskah,
   semua image wajib terpakai secara berurutan. Atur urutan pada tab Images
   sebelum menjalankan sync.
   Opsional: buka **Storyboard → Naskah asli**, pilih voice dan isi satu beat per
   baris. Teks disimpan otomatis. Jalankan **Analyze & Auto Sync** setelahnya.
   Sebelum sync berjalan, dialog **Pilih Mode Auto Sync** menampilkan ulang pilihan
   ini. Pilih **Cakupan AI** bila semua foto harus terpakai tetapi AI boleh
   mengurutkannya. **Semantic AI** tidak menjamin seluruh foto masuk timeline.
   Pilihan disimpan untuk sync berikutnya.
2. Buka **Storyboard** untuk melihat pasangan kalimat dan visual. Centang
   **Hanya LOW** untuk memeriksa bagian yang kurang meyakinkan.
3. Pilih alternatif untuk mengganti visual hanya pada rentang kalimat tersebut.
   Pilihan disimpan sebagai edit manual. Clip terkunci harus dibuka kuncinya
   sebelum diganti. Cakupan AI selalu menjaga clip manual/terkunci, termasuk
   ketika pilihan otomatis dihitung ulang. Mode lama dapat menggantinya bila
   Anda memilih **Override Semua**.
4. Gunakan **Deskripsi foto** untuk menjelaskan konteks yang diketahui pengguna.
   Jangan menganggap caption AI sebagai fakta: pada kartun, tangan terbuka dapat
   salah dibaca sebagai objek lain. Setelah mengedit deskripsi, jalankan sync lagi.
5. Bagian **Koreksi teks transkrip** memperbaiki teks tanpa memindahkan waktu audio
   asli. Simpan teks lalu jalankan sync lagi; transkrip yang masih cocok dengan
   konfigurasi audio memakai cache, bukan Whisper ulang.
6. Periksa **Gambar / footage belum terpakai** untuk mode Semantic AI. Dalam
   Storyboard dan Cakupan AI, gambar wajib tercakup; jika jumlah atau koreksi manual
   menghalanginya, proses berhenti dengan pesan konflik tanpa menyimpan timeline
   parsial. B-roll tidak termasuk kandidat Storyboard; gunakan Cakupan AI atau
   Semantic AI.

Mode ini tidak menjamin pemahaman kartun sempurna. Review visual tetap diperlukan,
terutama untuk identitas tokoh, hubungan keluarga, dan maksud adegan.

## 1. Buat atau pilih project

Saat aplikasi terbuka, buat project baru dan beri nama. Semua perubahan disimpan otomatis pada project tersebut.

## 2. Upload bahan

Klik **Upload Assets**.

- Upload foto untuk visual video.
- Semua audio memakai **Voice Sequence**, baik hanya satu voice maupun banyak voice.
- Urutkan kartu voice dengan drag-and-drop. Urutan ini menjadi urutan suara dalam video.
- Klik ikon play pada kartu voice untuk mendengarkan audio sebelum disinkronkan.
- Tab **Videos** menerima video B-roll MP4, MOV, M4V, atau WebM. B-roll dapat
  di-drag ke track visual, di-double click pada posisi playhead, atau dipakai
  untuk mengganti scene image secara manual.
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

### Menyiapkan B-roll video

Video pada tab **Videos** adalah footage B-roll maksimal 10 menit per file.
Klik tombol preview/edit pada kartu video untuk membuka modal B-roll. Pada analisis
pertama, aplikasi mendeteksi pergantian adegan dan membuat beberapa shot tanpa
memotong atau mengubah file asli.

Di modal B-roll Anda dapat:

- memutar video dan memilih shot terdeteksi;
- memakai **Set In** dan **Set Out** untuk mengubah rentang shot;
- memakai **Tambah Shot** untuk membuat kandidat sendiri;
- memakai **Gunakan Shot** untuk memasang rentang terpilih ke scene aktif atau
  posisi playhead;
- menonaktifkan shot yang tidak boleh dipilih Auto Sync;
- mengisi deskripsi dan kata/frasa wajib untuk video maupun masing-masing shot;
- menghapus shot atau menganalisis ulang satu video.

Tekan **Simpan video & shot** setelah mengedit. Deskripsi/cue pengguna selalu
diprioritaskan di atas caption AI. Analisis ulang memperbarui caption AI, tetapi
tidak menghapus koreksi pengguna.

Video juga tetap dapat diedit manual: drag ke V1, double click pada posisi
playhead, atau gunakan **Replace** pada scene terpilih. Anda dapat menggeser,
Split, crop, mengubah fit mode/transition, dan mengatur Source In/Out di Inspector.

Suara B-roll dibisukan secara default agar tidak mengganggu voice narration.
Aktifkan **Audio footage** pada Inspector bila suara asli diperlukan, lalu atur
volume dan fade. Audio asli intro tetap aktif secara default.

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
2. mendeteksi shot video dan memahami frame representatifnya;
3. memilih image atau cuplikan B-roll yang paling relevan untuk setiap bagian;
4. membuat timeline visual dan audio;
5. menampilkan nilai confidence pada scene yang hasilnya belum cukup yakin.

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

Untuk B-roll, tombol **Split** membagi clip pada posisi playhead. Bagian kedua
tetap menggunakan offset footage yang benar, sehingga Anda dapat mengambil bagian
video yang berbeda tanpa membuat salinan file baru.

Inspector B-roll menyediakan **Source In** dan **Source Out**. Preview dan render
memakai rentang itu secara tepat. Bila durasi clip timeline lebih panjang daripada
rentang footage, video disesuaikan waktunya secara halus dan tidak membekukan frame
terakhir. Clip manual atau terkunci tetap dipertahankan saat Auto Sync diulang.

Nilai **LOW CONFIDENCE** bukan error. Artinya beberapa foto memiliki skor yang mirip sehingga bagian tersebut perlu diperiksa manual.

Klik **Review LOW** untuk berpindah langsung ke scene LOW berikutnya. Inspector
menampilkan caption yang cocok, aksi/frasa yang cocok, alternatif terdekat,
pengaruh urutan, serta kesepakatan direct visual dengan caption.

Peringatan **Butuh foto/footage tambahan** berarti alternatif yang tersedia tidak
cukup cocok. Tambahkan image atau B-roll yang sesuai, lalu jalankan Auto Sync lagi.

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
- Untuk B-roll, nonaktifkan shot buram/tidak berguna dan beri cue singkat seperti
  `laut`, `gunung`, `perjalanan`, atau aksi yang benar-benar terlihat.
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
