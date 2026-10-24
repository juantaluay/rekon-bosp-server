# Rekon BOSP — Server Node.js

Backend **Node.js (Express)** + penyimpanan **file JSON** untuk Dashboard Rekonsiliasi Dana BOSP Kabupaten Minahasa Tenggara.

Tidak memakai database eksternal. Cocok dijalankan di laptop atau VPS sederhana.

## Instalasi

```bash
cd rekon-bosp-server
npm install
npm run init-db
npm start
```

Buka: http://localhost:3000

### Akun default

| Username  | Password      | Peran            |
|-----------|---------------|------------------|
| admin     | admin2024     | Admin Dinas      |
| operator  | operator2024  | Operator Sekolah |

## Struktur

```
rekon-bosp-server/
├── package.json
├── server.js
├── scripts/init-db.js
├── scripts/patch-frontend.js
├── data/                  # JSON: schools, users, monthly_YYYY, sp2b_kab_YYYY
├── uploads/               # PDF
└── public/index.html      # Frontend (sudah diarahkan ke API Node)
```

## API ringkas

- GET  /api/health
- GET  /api/data?year=2024
- POST /api/save          { year, schools?, users?, monthlyData?, partial? }
- POST /api/login         { username, password }
- POST /api/upload        multipart atau JSON base64
- GET/POST /api/schools , /api/users , /api/sp2b-kab

## Multi-tahun

Setiap tahun disimpan di `data/monthly_YYYY.json`. Master sekolah & user bersifat global.

## Production

```bash
npm install -g pm2
pm2 start server.js --name rekon-bosp
pm2 save && pm2 startup
```

Ganti password default sebelum dipakai operasional.
