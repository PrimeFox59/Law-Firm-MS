# Law Firm Management System

Sistem manajemen terintegrasi untuk law firm yang menggabungkan pengelolaan aktivitas, relasi, dokumen, dan keuangan dalam satu platform yang konsisten dan aman.

## Fitur Utama

### 1. Work Management Core
- **Matter Management**: Pengelolaan perkara/proyek
- **Task Management**: Manajemen tugas personal dan matter
- **Calendar**: Penjadwalan dengan integrasi Google Calendar
- **Documents**: Sistem manajemen dokumen berbasis folder

### 2. Relationship & Data Management
- **Contacts**: Pengelolaan kontak client dan non-client
- **Personal Dashboard**: Ringkasan aktivitas dan status pekerjaan

### 3. Financial & Accountability
- **Cost Journal**: Pencatatan time entry dan expense
- **Invoice**: Sistem pembuatan dan pengelolaan tagihan
- **Transactions**: Manajemen pembayaran dan deposit

### 4. Authentication & Authorization
- Email/Password login
- Google OAuth integration
- Role-based access control (Admin, Attorney, Staff, Client)

## Teknologi

- **Backend**: Node.js + Express.js
- **Database**: SQLite + Sequelize ORM
- **Frontend**: EJS + Bootstrap 5 + Tailwind CSS
- **Authentication**: Passport.js (Local & Google OAuth)
- **Integration**: Google Calendar API

## Instalasi

1. **Clone/Extract project**
2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Setup environment variables**:
   - Copy `.env.example` ke `.env`
   - Sesuaikan konfigurasi (terutama Google OAuth jika diperlukan)

4. **Seed database** (membuat tabel dan default users):
   ```bash
   npm run seed
   ```

5. **Start server**:
   ```bash
   npm start
   ```
   atau untuk development dengan auto-reload:
   ```bash
   npm run dev
   ```

6. **Akses aplikasi**: http://localhost:3000

## Default Accounts

Setelah seeding, gunakan akun berikut untuk login:

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@lawfirm.com | admin123 |
| Attorney | attorney@lawfirm.com | attorney123 |
| Staff | staff@lawfirm.com | staff123 |
| Client | client@example.com | client123 |

## Struktur Project

```
pm-law-firm/
├── app.js                 # Main application file
├── package.json           # Dependencies
├── .env                   # Environment variables
├── config/
│   ├── database.js        # Database configuration
│   └── passport.js        # Authentication strategies
├── models/                # Sequelize models
│   ├── User.js
│   ├── Contact.js
│   ├── Matter.js
│   ├── Task.js
│   ├── Event.js
│   ├── Document.js
│   ├── Invoice.js
│   └── index.js
├── routes/                # Express routes
│   ├── auth.js
│   ├── dashboard.js
│   ├── contacts.js
│   └── index.js
├── middleware/            # Custom middleware
│   └── auth.js
├── views/                 # EJS templates
│   ├── auth/
│   ├── dashboard/
│   └── layout.ejs
├── seeders/               # Database seeders
│   └── seed.js
└── database/              # SQLite database files
```

## Google OAuth Setup (Opsional)

Untuk mengaktifkan login Google:

1. Buat project di [Google Cloud Console](https://console.cloud.google.com)
2. Enable Google+ API dan Google Calendar API
3. Create OAuth 2.0 credentials
4. Tambahkan `http://localhost:3000/auth/google/callback` ke Authorized redirect URIs
5. Copy Client ID dan Client Secret ke `.env`:
   ```
   GOOGLE_CLIENT_ID=your-client-id
   GOOGLE_CLIENT_SECRET=your-client-secret
   ```

## Development

- **Models**: Tambahkan model baru di folder `models/`
- **Routes**: Tambahkan routes di folder `routes/`
- **Views**: Tambahkan views di folder `views/`
- **Middleware**: Tambahkan custom middleware di folder `middleware/`

## Production Deployment

1. Set `NODE_ENV=production` di environment
2. Gunakan database production (PostgreSQL/MySQL recommended)
3. Set strong `SESSION_SECRET`
4. Enable HTTPS
5. Setup proper logging
6. Use process manager seperti PM2

## Security Notes

- Ganti `SESSION_SECRET` di production
- Jangan commit file `.env`
- Gunakan HTTPS di production
- Implement rate limiting untuk login
- Regular security updates untuk dependencies

## License

MIT License

## Support

Untuk pertanyaan atau issue, silakan hubungi developer.
