/**
 * Inisialisasi data JSON default.
 * Jalankan: npm run init-db
 */
const path = require("path");
const fs = require("fs");

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");
fs.mkdirSync(DATA_DIR, { recursive: true });

function writeIfMissing(file, data) {
  const full = path.join(DATA_DIR, file);
  if (!fs.existsSync(full)) {
    fs.writeFileSync(full, JSON.stringify(data, null, 2), "utf8");
    console.log("Created", full);
    return true;
  }
  console.log("Exists ", full);
  return false;
}

const defaultUsers = [
  {
    name: "Administrator Dinas",
    username: "admin",
    password: "admin2024",
    role: "Admin Dinas",
    schoolNo: null,
    npsn: "",
    status: "Aktif",
  },
  {
    name: "Operator SDN 1 Ratahan",
    username: "operator",
    password: "operator2024",
    role: "Operator Sekolah",
    schoolNo: 1,
    npsn: "69762652",
    status: "Aktif",
  },
];

const defaultSchools = [
  { no: 1, npsn: "69762652", name: "SD NEGERI 1 RATAHAN", alamat: "Ratahan", status: "NEGERI", kecamatan: "RATAHAN", jenjang: "SD" },
  { no: 2, npsn: "40102120", name: "SD NEGERI 2 RATAHAN", alamat: "Ratahan", status: "NEGERI", kecamatan: "RATAHAN", jenjang: "SD" },
  { no: 3, npsn: "40102130", name: "SD INPRES RATAHAN", alamat: "Ratahan", status: "NEGERI", kecamatan: "RATAHAN", jenjang: "SD" },
  { no: 15, npsn: "40102210", name: "SMPN 1 RATAHAN", alamat: "Ratahan", status: "NEGERI", kecamatan: "RATAHAN", jenjang: "SMP" },
];

writeIfMissing("users.json", defaultUsers);
writeIfMissing("schools.json", defaultSchools);
writeIfMissing("meta.json", { version: 1, createdAt: new Date().toISOString() });

console.log("Data dir:", DATA_DIR);
console.log("Selesai. Akun default: admin/admin2024 , operator/operator2024");
