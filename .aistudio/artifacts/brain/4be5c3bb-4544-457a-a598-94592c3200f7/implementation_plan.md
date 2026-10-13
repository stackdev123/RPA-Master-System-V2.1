# Penyederhanaan Halaman Login (Tampilan Kartu Terpusat)

Menghapus panel showcase promosi di sisi kiri halaman login ("Sistem Manajemen Produksi, Inventaris & Distribusi Terpadu") sehingga pengguna langsung disajikan tampilan form login yang bersih, fokus, dan terpusat di tengah layar.

## User Review & Critical Decisions

> [!IMPORTANT]
> Pilihan desain yang telah dikonfirmasi dari sesi tanya jawab sebelumnya:

- **Identitas Perusahaan**: Tetap menampilkan logo dan nama **PT Mitra Karya Foodindo · RPA Master System** di bagian atas form login sebagai penanda identitas sistem.
- **Tata Letak Form Login**: Menampilkan form di dalam kotak kartu bersih yang berada tepat di tengah layar dengan latar belakang lembut (`slate-50`), menggantikan tata letak dua kolom sebelumnya.

## 1. Overview & Core Concept

- **What It Does**: Menyederhanakan layar masuk (login) menjadi satu kartu autentikasi terpusat tanpa panel teks deskriptif atau informasi fitur di sisi kiri layar.
- **Target Audience / Persona**: Staf operasional, admin, dan manajemen PT Mitra Karya Foodindo yang mengakses sistem setiap hari dan membutuhkan akses masuk yang cepat serta bebas distraksi.
- **Key Value**: Tampilan lebih ringkas, profesional, dan langsung berfokus pada input kredensial (`Username` dan `Password`).

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. Pengguna membuka aplikasi dan langsung melihat kartu login tepat di tengah layar.
  2. Kolom `Username` otomatis aktif (auto-focus), mendukung navigasi tombol panah atas/bawah (`ArrowUp` / `ArrowDown`) dan `Enter` untuk berpindah ke kolom `Password` hingga tombol `Masuk ke Sistem`.
  3. Jika input kosong atau salah, pesan peringatan ditampilkan dengan jelas di dalam kartu.
- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Minimalis, bersih, dan fungsional (Utilitarian Enterprise Clean).
  - *Color Palette & Mood*: Latar belakang halaman abu-abu lembut (`bg-slate-50`), permukaan kartu putih bersih (`bg-white`) dengan garis tepi halus (`border-slate-200/80`), teks utama gelap (`text-slate-900`), serta aksen merah/hitam khas identitas PT Mitra Karya Foodindo pada fokus input dan tombol aksi utama.
  - *Typography & Hierarchy*: Judul form yang proporsional dengan subjudul singkat dan label input yang tegas serta mudah dibaca.
  - *Component Styling & Layout*: Satu level kartu di tengah layar (`max-w-[420px]`) dengan ruang kosong (whitespace) yang seimbang dan responsif di perangkat desktop maupun mobile.
- **Interactive Feedback & Motion**: Indikator fokus garis tepi pada kolom aktif, tombol tampilkan/sembunyikan password, serta transisi halus saat tombol ditekan.

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Menghapus Panel Sisi Kiri Sepenuhnya**
  - *Chosen Approach*: Menghapus seluruh blok kolom kiri yang berisi judul *"Sistem Manajemen Produksi, Inventaris & Distribusi Terpadu"*, deskripsi, dan tiga poin fitur di bawahnya.
  - *Why*: Untuk aplikasi internal yang digunakan secara rutin, panel deskripsi memakan separuh layar tanpa menambah fungsi operasional. Kartu login terpusat membuat tampilan lebih fokus dan rapi.
  - *Alternatives Considered*: Menyembunyikan teks deskripsi tetapi mempertahankan kolom gelap di kiri — tidak dipilih karena membuat layar tampak timpang dan menyisakan ruang kosong yang tidak perlu.
- **Decision 2: Mempertahankan Navigasi Keyboard Cepat**
  - *Chosen Approach*: Mempertahankan seluruh fungsi auto-focus, berpindah kolom dengan tombol panah/Enter, dan toggle visibilitas password.
  - *Why*: Memastikan kebiasaan input cepat pengguna lama tetap berjalan lancar tanpa perubahan perilaku form.

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram**:

```
┌──────────────────────────────────────────────────────────┐
│              Latar Halaman Terpusat (Full Screen)        │
│                                                          │
│        ┌────────────────────────────────────────┐        │
│        │          Kartu Login Terpusat          │        │
│        │  ┌──────────────────────────────────┐  │        │
│        │  │ Logo & Nama Perusahaan (Header)  │  │        │
│        │  └──────────────────────────────────┘  │        │
│        │  ┌──────────────────────────────────┐  │        │
│        │  │ Judul "Masuk ke Akun"            │  │        │
│        │  └──────────────────────────────────┘  │        │
│        │  ┌──────────────────────────────────┐  │        │
│        │  │ Input Username & Password        │  │        │
│        │  │ + Toggle Lihat Password          │  │        │
│        │  └──────────────────────────────────┘  │        │
│        │  ┌──────────────────────────────────┐  │        │
│        │  │ Pesan Validasi & Tombol Masuk    │  │        │
│        │  └──────────────────────────────────┘  │        │
│        └────────────────────────────────────────┘        │
│                    Footer Hak Cipta                      │
└──────────────────────────────────────────────────────────┘
```

- **Data Model & State**:
  - State lokal komponen tetap mengelola `username`, `password`, `showPassword`, `error`, dan `focusedField`.
  - Callback `onLogin(username, password)` tetap terhubung langsung ke fungsi autentikasi utama aplikasi.
- **Interactive Component & State Mapping**:
  - Saat halaman dimuat, referensi input `username` langsung menerima fokus.
  - Penekanan `Enter` atau `ArrowDown` pada `Username` memindahkan fokus ke `Password`.
  - Penekanan `Enter` pada `Password` atau klik pada tombol `Masuk ke Sistem` memvalidasi kelengkapan input dan memanggil handler `onLogin`.
