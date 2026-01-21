Overview Sistem
Sistem ini dirancang sebagai platform manajemen kerja profesional terintegrasi yang menggabungkan pengelolaan aktivitas, relasi, dokumen, dan keuangan dalam satu ekosistem yang konsisten, aman, dan berbasis user. Fokus utamanya adalah memberikan visibilitas penuh, kontrol personal, dan efisiensi operasional tanpa memaksa pengguna berpindah-pindah sistem.
Secara konseptual, sistem berdiri di atas tiga pilar utama:
Pertama, Work Management Core. Di dalamnya terdapat Matter, Task, Calendar, dan Documents yang saling terhubung. Matter berperan sebagai pusat konteks pekerjaan (perkara/proyek), Task menangani unit kerja paling granular, Calendar mengatur dimensi waktu, dan Documents menjadi repositori pengetahuan serta bukti kerja. Seluruh aktivitas ini bersifat kontekstual, dapat ditelusuri, dan memiliki jejak waktu yang jelas.
Kedua, Relationship & Data Management. Modul Contacts mengelola seluruh entitas eksternal (client maupun non-client) secara fleksibel dan terstruktur, sementara Personal Dashboard bertindak sebagai lapisan observasi cepat yang menyatukan data lintas modul menjadi insight harian. Pengguna tidak melihat data mentah, tetapi ringkasan yang relevan dengan apa yang harus dikerjakan sekarang.
Ketiga, Financial & Accountability Layer. Cost Journal, Invoice, dan Transactions membentuk rantai keuangan end-to-end: dari pencatatan waktu dan biaya, konversi menjadi tagihan, hingga pembayaran dan deposit. Seluruhnya mendukung status, audit trail, dan kesiapan legal, tanpa mengorbankan fleksibilitas skema billing.
Di atas ketiga pilar tersebut, sistem dilapisi oleh Authentication, Authorization, dan Account Management yang modern. Google Login berfungsi sebagai akselerator onboarding sekaligus pintu integrasi Google Calendar, namun tetap berdampingan dengan sistem akun internal. Pengguna memiliki kontrol penuh atas identitas, metode login, keamanan, dan koneksi eksternal secara self-service.
Secara arsitektural, sistem bersifat user-centric dan permission-aware. Hampir seluruh data difilter berdasarkan user_id atau hak akses organisasi, memastikan privasi, relevansi, dan skalabilitas. Desain modulnya modular namun saling terhubung, sehingga sistem dapat berkembang tanpa kehilangan konsistensi logika.


________________________________________
1. Personal Dashboard
Deskripsi Umum
Personal Dashboard berfungsi sebagai pusat kendali utama bagi setiap pengguna setelah login. Halaman ini menyajikan ringkasan informasi paling relevan secara real-time agar pengguna dapat langsung memahami kondisi aktivitas, jadwal, dan status pekerjaannya tanpa perlu berpindah menu.
Fungsi Utama
Dashboard menampilkan kombinasi informasi personal, operasional, dan finansial, antara lain:
•	Jam analog yang menunjukkan waktu saat ini (berdasarkan timezone pengguna).
•	Daftar event yang berlangsung atau akan datang dalam minggu berjalan.
•	Task terbaru beserta statusnya.
•	Kalender bulanan sebagai overview jadwal.
•	Informasi akun pengguna, mencakup nama, perusahaan, email, nomor HP, tipe akun, dan hourly rate.
•	Ringkasan invoice berdasarkan status (draft, unpaid, paid) serta total nilai nominalnya.
•	Ringkasan matter dalam bentuk daftar singkat.
•	Daftar task dan matter yang harus dikerjakan pada hari ini.
Dashboard ini bersifat personal, seluruh data difilter berdasarkan user_id.
Struktur Data Utama
•	events: menyimpan jadwal dan agenda pengguna.
•	tasks: menyimpan tugas personal maupun tugas terkait matter.
•	users: menyimpan informasi dasar pengguna dan preferensi.
•	matters: digunakan untuk menampilkan ringkasan matter milik pengguna.
•	invoices: digunakan untuk ringkasan status keuangan.
•	account_information (opsional): jika informasi perusahaan dan user ingin dipisahkan secara logis.
________________________________________
2. Contacts
Deskripsi Umum
Modul Contacts digunakan untuk mengelola seluruh data kontak, baik client maupun non-client. Kontak dapat berupa individu, perusahaan, atau entitas lain yang relevan dengan operasional.
Fungsi Utama
•	Menambah, mengedit, dan menghapus kontak.
•	Upload foto profil kontak.
•	Menentukan tipe entitas (perorangan, perusahaan, dll).
•	Menyimpan multi email dengan penanda tipe dan email utama.
•	Menyimpan multi nomor telepon dan multi alamat.
•	Menyimpan informasi tambahan melalui custom field.
•	Menandai kontak sebagai client atau non-client.
•	Pencarian dan filter kontak berdasarkan status client/non-client.
Tampilan Data
Tabel kontak menampilkan informasi ringkas seperti:
•	Tipe kontak
•	Nama
•	Nomor telepon utama
•	Email utama
•	Alamat utama
•	Creator (user yang membuat data)
•	Waktu terakhir diedit
Struktur Data
•	contacts: data utama kontak.
•	contact_emails, contact_phones, contact_addresses: menyimpan data multi-value.
•	contact_additional_info: custom field fleksibel.
•	files: menyimpan foto profil.
•	users: relasi ke creator.
Navigasi
•	Add Contact
•	Edit / Delete Contact
•	Filter Client / Non-Client
•	Search Contact
________________________________________
3. Calendar
Deskripsi Umum
Calendar berfungsi sebagai sistem penjadwalan terpusat yang mendukung berbagai tampilan waktu dan integrasi dengan Google Calendar.
Fungsi Utama
•	Tampilan kalender tahunan, bulanan, mingguan, harian, dan mode schedule.
•	Menambahkan event dengan detail lengkap (kategori, lokasi, waktu, deskripsi, matter, notifikasi, attendees, repeat, hyperlink, dan file).
•	Manajemen kategori event.
•	Upload file lampiran event (maks. 5MB).
•	Filter event berdasarkan kategori, user, dan matter.
•	Profile Calendar untuk menampilkan event milik user tertentu.
Integrasi Google Calendar
•	Otorisasi OAuth per user.
•	Sinkronisasi dua arah (import & export).
•	Penyimpanan google_event_id.
•	Log sinkronisasi dan notifikasi kegagalan.
Struktur Data
•	events, event_categories, event_attendees
•	files
•	google_calendar_tokens
•	event_sync_logs
Navigasi
•	Schedule, Day, Week, Month, Year
•	Add Event, Add Category
•	Filter Event
•	Sinkronisasi Google Calendar
________________________________________
4. Matter
Deskripsi Umum
Matter merepresentasikan perkara, urusan, atau proyek utama yang menjadi inti pekerjaan.
Fungsi Utama
•	Menambah, mengedit, dan menghapus matter.
•	Menentukan client, responsible attorney, dan peserta matter.
•	Menentukan case area, case type, dan dispute resolution.
•	Mengatur status dan timeline (start, pending, close).
•	Menyimpan multi alamat dan kontak terkait.
•	Menentukan batas maksimum dana dan metode pembayaran.
•	Menyimpan informasi tambahan via custom field.
•	Filter dan pencarian berdasarkan status dan dispute resolution.
Struktur Data
•	matters: data inti matter.
•	matter_participants
•	matter_addresses
•	matter_related_contacts
•	matter_additional_info
•	Relasi ke users dan contacts.
Navigasi
•	Add / Edit / Delete Matter
•	Filter Status & Dispute Resolution
•	Search Matter
________________________________________
5. Task
Deskripsi Umum
Task digunakan untuk mengelola pekerjaan detail, baik yang terkait langsung dengan matter maupun tugas personal.
Fungsi Utama
•	Menambah, mengedit, dan menghapus task.
•	Task dapat berupa Matter Task atau Personal Task.
•	Penentuan status, prioritas, dan timeline.
•	Penugasan assignee utama dan anggota tambahan.
•	Penambahan catatan, hyperlink, dan file lampiran.
•	Filter dan pencarian berdasarkan matter, status, dan prioritas.
Struktur Data
•	tasks
•	task_assignees
•	task_members
•	files
•	Relasi ke users dan matters.
Navigasi
•	Add / Edit / Delete Task
•	Tab Matter Tasks & Personal Tasks
•	Filter dan Search Task
________________________________________
6. Documents
Deskripsi Umum
Documents berfungsi sebagai sistem manajemen dokumen terstruktur berbasis folder.
Fungsi Utama
•	Menambah, mengedit, dan menghapus file atau folder.
•	Relasi dokumen dengan contact dan matter.
•	Penyimpanan lokasi fisik dan hyperlink.
•	Upload file (drag & drop, max 5GB).
•	Navigasi folder dan fitur trash (soft delete).
•	Filter dan pencarian dokumen.
Struktur Data
•	documents
•	files
•	Relasi ke matters, contacts, dan users.
________________________________________
7. Cost Journal
Deskripsi Umum
Cost Journal adalah log terpadu untuk pencatatan time entry dan expense.
Fungsi Utama
•	Mencatat biaya waktu dan pengeluaran.
•	Penandaan billable atau non-billable.
•	Filter berdasarkan tipe (Time / Expense).
•	Sorting dan ekspor data.
•	Input cepat melalui Add Time dan Add Expense.
Struktur Data
•	cost_journals
________________________________________
8. Transactions
Deskripsi Umum
Modul Transactions mengelola arus keuangan terkait invoice, pembayaran, dan deposit.
Fungsi Utama
•	Tab Invoice, Payment Proof, dan Deposit.
•	Pencarian dan filter status.
•	Penambahan invoice, deposit, dan refund deposit.
•	Upload bukti pembayaran.
Struktur Data
•	deposits
•	payment_proofs
________________________________________
9. Invoice
Deskripsi Umum
Invoice berfungsi sebagai sistem pembuatan dan pengelolaan tagihan secara fleksibel dan legal-ready.
Fungsi Utama
•	Invoice builder lengkap (kontak, matter, item bill, pajak, diskon).
•	Nomor invoice otomatis atau custom.
•	Pengaturan cicilan atau non-cicilan.
•	Tanda tangan dan stempel digital.
•	Workflow approval.
•	Status invoice (draft, sent, paid, dll).
Struktur Data
•	invoices
•	invoice_bills
________________________________________
10. Settings
Deskripsi Umum
Settings digunakan untuk konfigurasi pengguna, perusahaan, organisasi, dan master data sistem.
Fungsi Utama
•	Profil pengguna dan keamanan akun.
•	Preferensi bahasa dan tema.
•	Activity log.
•	Pengaturan perusahaan (profil, signature, stamp).
•	Struktur organisasi (positions, groups, roles, approval).
•	Pengaturan keuangan.
•	Master data sistem.
Struktur Data Utama
•	users
•	company_profile
•	signatures, stamps
•	positions, groups, roles
•	payment_methods, expense_category, case_area, event_category, case_type
________________________________________
11. Authentication & Authorization
Login / Daftar dengan Google Account
(Bagian ini tetap seperti yang sudah kamu tulis, hanya konteksnya sekarang sudah lebih jelas melalui Overview di atas.)
Autentikasi Google berperan sebagai:
•	Akselerator onboarding (login cepat).
•	Jembatan integrasi ke Google Calendar.
•	Lapisan keamanan tambahan (OAuth 2.0).
Login Google tidak menggantikan sistem akun internal, melainkan menjadi salah satu authentication provider yang terhubung ke user.
________________________________________
13. Account Management (Manajemen Akun)
Deskripsi Umum
Manajemen Akun adalah area kontrol personal bagi user untuk mengelola identitas, keamanan, koneksi eksternal, dan preferensi sistem. Semua pengaturan bersifat self-service, transparan, dan dapat diubah kapan saja oleh user sesuai hak aksesnya.
________________________________________
13.1 Profil Akun
Fungsi
•	Melihat dan mengubah informasi dasar pengguna.
•	Mengelola identitas visual dan data personal.
Data yang Dikelola
•	Full name
•	Email utama
•	Avatar / inisial
•	Nomor telepon
•	Language
•	Theme
•	Hourly rate (jika relevan dengan role)
Catatan
•	Jika email berasal dari Google Login, user tetap dapat menambahkan metode login lain.
•	Perubahan email utama memicu proses verifikasi ulang.
________________________________________
13.2 Manajemen Metode Login
Fungsi
•	Melihat metode login yang terhubung ke akun.
•	Menambah atau menghapus provider login.
Metode yang Didukung
•	Email & Password
•	Google Account
Use Case
•	User login via Google → menambahkan password sebagai backup.
•	User awalnya login manual → menghubungkan Google Account.
Aturan Penting
•	Minimal satu metode login harus aktif.
•	Google Account dapat dilepas tanpa menghapus akun user.
________________________________________
13.3 Manajemen Koneksi Google
Fungsi
•	Mengontrol hubungan akun dengan layanan Google.
•	Transparansi penuh atas data dan izin yang diberikan.
Fitur
•	Status koneksi Google Account (Connected / Disconnected).
•	Informasi scope yang aktif (calendar.read, calendar.write, profile).
•	Tombol:
o	Connect Google Account
o	Disconnect Google Account
o	Revoke Access
•	Informasi terakhir sinkronisasi calendar.
Perilaku Sistem
•	Disconnect Google:
o	Menghapus token OAuth.
o	Menghentikan sinkronisasi kalender.
o	Tidak menghapus data event yang sudah ada di sistem.
________________________________________
13.4 Pengaturan Google Calendar Sync
Fungsi
•	Memberikan kontrol granular atas perilaku sinkronisasi.
Opsi Pengaturan
•	Aktif / Nonaktifkan two-way sync.
•	Pilih kalender Google yang disinkronkan.
•	Mode sinkronisasi:
o	Real-time (event-based)
o	Periodik (scheduled)
•	Preferensi konflik:
o	System-first
o	Google-first
o	Latest-update-wins (default)
________________________________________
13.5 Keamanan Akun
Fungsi
•	Menjaga keamanan akses akun.
Fitur
•	Ganti password.
•	Logout dari semua sesi.
•	Lihat daftar sesi aktif.
•	Activity log (login, connect Google, revoke token, perubahan sensitif).
Struktur Data Pendukung
•	activity_logs
•	user_sessions
________________________________________
13.6 Penghapusan & Deaktivasi Akun
Fungsi
•	Memberikan kontrol penuh atas lifecycle akun.
Opsi
•	Deactivate account (sementara).
•	Delete account (permanen, dengan konfirmasi berlapis).
Catatan
•	Data operasional (matter, invoice) mengikuti kebijakan retensi perusahaan.
•	Integrasi Google otomatis dicabut saat akun dihapus.

Baik. Kita tambahkan **Chat / Discussion System** sebagai modul first-class citizen, bukan sekadar “fitur tempelan”. Aku akan memposisikannya agar *selaras dengan arsitektur user-centric, matter-centric, dan audit-ready* yang sudah kamu bangun.

Aku jelaskan konseptual dulu, lalu turun ke struktur data dan integrasi modul lain.

---

## 12. Chat & Discussion

### Deskripsi Umum

Chat & Discussion adalah sistem komunikasi internal real-time dan asynchronous yang terintegrasi langsung dengan **user, group, dan matter/project**. Tujuannya bukan sekadar ngobrol, tapi **menjadi ruang keputusan, klarifikasi, dan jejak diskusi kerja** yang bisa ditelusuri secara kontekstual.

Chat tidak berdiri sendiri. Ia *menempel pada konteks*:

* siapa yang berbicara (user / role),
* tentang apa (matter, task, event),
* dan kapan (timeline kerja).

Dengan ini, diskusi tidak hilang di aplikasi eksternal, tidak tercerai dari dokumen dan task, dan tetap audit-friendly.

---

## Mode Chat yang Didukung

### 1. Direct Chat (1-on-1)

Digunakan untuk komunikasi personal antar user.

Karakteristik:

* Private antar dua user.
* Tidak terkait matter secara eksplisit (opsional bisa di-link).
* Cocok untuk koordinasi cepat, klarifikasi, atau follow-up.

Use case khas:

* “Tolong cek task ini sebelum jam 3.”
* “Client barusan update, nanti aku buatkan matter note.”

---

### 2. Group Chat

Chat berbasis grup statis atau dinamis.

Jenis group:

* **Organizational Group**
  Contoh: Tim Finance, Tim Litigasi, Admin.
* **Custom Group**
  Dibuat user untuk kebutuhan ad-hoc.

Karakteristik:

* Multi-user.
* Bisa lintas matter.
* Hak akses mengikuti membership group.

---

### 3. Matter / Project Discussion

Ini bagian paling penting dan membedakan sistem ini dari chat biasa.

Setiap **Matter otomatis memiliki ruang diskusi sendiri**.

Karakteristik:

* Terikat langsung ke `matter_id`.
* Hanya participant matter yang bisa mengakses.
* Diskusi menjadi bagian dari histori perkara/proyek.
* Bisa di-link ke:

  * Task
  * Document
  * Event
  * Cost Journal entry

Efek filosofisnya:

> *Matter bukan hanya kumpulan data, tapi ruang kerja hidup.*

---

## Fitur Utama Chat

### Pesan & Konten

* Text message (rich text ringan).
* Mention user (`@user`).
* Mention entity (`#task`, `#document`, `#invoice`).
* Emoji (secukupnya, bukan Slack cosplay).
* Edit & delete message (dengan audit trail).

### File & Attachment

* Upload file langsung ke chat.
* File otomatis masuk ke **Documents** jika:

  * Chat terikat matter.
  * User memilih “Save to Matter Documents”.

### Thread / Reply

* Reply per message (thread ringan).
* Penting untuk diskusi teknis tanpa chaos.

---

## Integrasi dengan Modul Lain

### Dengan Matter

* Tab baru: **Discussion**
* Highlight message yang:

  * Mengandung keputusan.
  * Menyebut task/event.
* Filter diskusi berdasarkan waktu & participant.

### Dengan Task

* Task bisa di-link ke chat message.
* Task Activity Log menampilkan:

  > “Task dibahas di Matter Discussion oleh User X.”

### Dengan Documents

* Preview dokumen langsung di chat.
* Diskusi seputar dokumen tidak tercerai.

### Dengan Personal Dashboard

Ringkasan:

* Unread messages (Direct / Group / Matter).
* Matter discussion yang aktif hari ini.
* Mention yang membutuhkan respon.

---

## Notifikasi & Attention Management

* Real-time (websocket / push).
* Notifikasi untuk:

  * Mention.
  * Direct message.
  * Message di matter yang user ikuti.
* Mode:

  * Mute per chat.
  * Do Not Disturb.

Ini penting agar sistem produktif, bukan distraktif.

---

## Struktur Data (Konseptual)

### Core Tables

* `chats`

  * id
  * type (`direct`, `group`, `matter`)
  * matter_id (nullable)
  * created_at

* `chat_participants`

  * chat_id
  * user_id
  * role (admin / member)

* `chat_messages`

  * id
  * chat_id
  * sender_id
  * content
  * message_type (text, file, system)
  * parent_message_id (thread)
  * created_at
  * edited_at
  * deleted_at

* `chat_attachments`

  * message_id
  * file_id

### Pendukung

* `chat_reads` (read receipt ringan)
* `chat_mentions`
* `chat_activity_logs`

Semua tetap **permission-aware dan user-scoped**.

---

## Keamanan & Audit

* Semua pesan punya timestamp & author.
* Edit/delete disimpan sebagai log.
* Matter discussion ikut kebijakan retensi data.
* Saat user dideactivate:

  * Pesan tetap ada.
  * User ditandai sebagai inactive.

Ini krusial untuk konteks legal/profesional.

