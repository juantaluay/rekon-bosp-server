/**
 * Server Node.js — Dashboard Rekonsiliasi Dana BOSP
 * Kabupaten Minahasa Tenggara
 *
 * Penyimpanan: file JSON di folder data/ (tanpa native module)
 *   data/schools.json
 *   data/users.json
 *   data/monthly_YYYY.json
 *   data/sp2b_kab_YYYY.json
 *   uploads/
 */
require("dotenv").config();

const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const multer = require("multer");

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, "uploads");
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB) || 25;

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Seed jika belum ada
require("./scripts/init-db.js");

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || true }));
app.use(express.json({ limit: "30mb" }));
app.use(express.text({ type: "text/plain", limit: "30mb" }));
app.use("/uploads", express.static(UPLOAD_DIR));
app.use(express.static(path.join(__dirname, "public")));

// ---------- JSON helpers ----------
function readJson(file, fallback) {
  const full = path.join(DATA_DIR, file);
  try {
    if (!fs.existsSync(full)) return fallback;
    return JSON.parse(fs.readFileSync(full, "utf8"));
  } catch (e) {
    console.warn("readJson fail", file, e.message);
    return fallback;
  }
}

function writeJson(file, data) {
  const full = path.join(DATA_DIR, file);
  const tmp = full + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tmp, full);
}

function parseBody(req) {
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body || {};
}

function getSchools() { return readJson("schools.json", []); }
function setSchools(list) { writeJson("schools.json", list); }
function getUsers() { return readJson("users.json", []); }
function setUsers(list) { writeJson("users.json", list); }
function monthlyFile(year) { return `monthly_${year}.json`; }
function getMonthly(year) { return readJson(monthlyFile(year), {}); }
function setMonthly(year, data) { writeJson(monthlyFile(year), data); }

function mergeMonthly(year, incoming) {
  const current = getMonthly(year);
  for (const [schoolNo, months] of Object.entries(incoming || {})) {
    if (!current[schoolNo]) current[schoolNo] = {};
    for (const [month, payload] of Object.entries(months || {})) {
      current[schoolNo][month] = payload;
    }
  }
  setMonthly(year, current);
  return current;
}

function upsertSchools(list) {
  if (!Array.isArray(list)) return getSchools();
  const map = new Map(getSchools().map((s) => [Number(s.no), s]));
  for (const s of list) {
    map.set(Number(s.no), {
      no: Number(s.no),
      npsn: s.npsn || "",
      name: s.name || "",
      alamat: s.alamat || "",
      status: (s.status || "NEGERI").toUpperCase(),
      kecamatan: s.kecamatan || "",
      jenjang: s.jenjang || "SD",
    });
  }
  const out = Array.from(map.values()).sort((a, b) => a.no - b.no);
  setSchools(out);
  return out;
}

function upsertUsers(list) {
  if (!Array.isArray(list)) return getUsers();
  const map = new Map(getUsers().map((u) => [String(u.username).toLowerCase(), u]));
  for (const u of list) {
    if (!u || !u.username) continue;
    const prev = map.get(String(u.username).toLowerCase()) || {};
    map.set(String(u.username).toLowerCase(), {
      name: u.name || prev.name || u.username,
      username: u.username,
      password: u.password != null ? u.password : prev.password || "",
      role: u.role || prev.role || "Operator Sekolah",
      schoolNo: u.schoolNo ?? u.school_no ?? prev.schoolNo ?? null,
      npsn: u.npsn || prev.npsn || "",
      status: u.status || prev.status || "Pending",
    });
  }
  const out = Array.from(map.values());
  setUsers(out);
  return out;
}

// ---------- Routes ----------
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", version: "1.0.0-node-json", time: new Date().toISOString() });
});

app.get("/api/data", (req, res) => {
  try {
    const year = Number(req.query.year) || 2024;
    res.json({
      status: "success",
      year,
      schools: getSchools(),
      users: getUsers(),
      monthlyData: getMonthly(year),
    });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

app.post("/api/save", (req, res) => {
  try {
    const body = parseBody(req);
    const year = Number(body.year) || 2024;
    if (Array.isArray(body.schools) && body.schools.length) upsertSchools(body.schools);
    if (Array.isArray(body.users) && body.users.length) upsertUsers(body.users);
    if (body.monthlyData && typeof body.monthlyData === "object") {
      mergeMonthly(year, body.monthlyData);
    }
    res.json({ status: "success", year, partial: !!body.partial });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

app.post("/api/login", (req, res) => {
  try {
    const body = parseBody(req);
    const username = (body.username || "").trim();
    const password = (body.password || "").trim();
    const user = getUsers().find((u) => u.username === username && u.password === password);
    if (!user) return res.status(401).json({ status: "error", message: "Username atau password salah" });
    if (user.status !== "Aktif") return res.status(403).json({ status: "error", message: "Akun masih Pending" });
    res.json({ status: "success", user });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

app.get("/api/schools", (_req, res) => {
  res.json({ status: "success", schools: getSchools() });
});

app.post("/api/schools", (req, res) => {
  try {
    const body = parseBody(req);
    const list = Array.isArray(body.schools) ? body.schools : body.school ? [body.school] : null;
    if (!list) return res.status(400).json({ status: "error", message: "schools required" });
    res.json({ status: "success", schools: upsertSchools(list) });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

app.delete("/api/schools/:no", (req, res) => {
  try {
    const no = Number(req.params.no);
    setSchools(getSchools().filter((s) => Number(s.no) !== no));
    // hapus dari semua file monthly_*
    for (const f of fs.readdirSync(DATA_DIR)) {
      if (!/^monthly_\d+\.json$/.test(f)) continue;
      const year = Number(f.replace(/\D/g, ""));
      const data = getMonthly(year);
      if (data[no] || data[String(no)]) {
        delete data[no];
        delete data[String(no)];
        setMonthly(year, data);
      }
    }
    res.json({ status: "success" });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

app.get("/api/users", (_req, res) => {
  res.json({ status: "success", users: getUsers() });
});

app.post("/api/users", (req, res) => {
  try {
    const body = parseBody(req);
    const list = Array.isArray(body.users) ? body.users : body.user ? [body.user] : null;
    if (!list) return res.status(400).json({ status: "error", message: "users required" });
    res.json({ status: "success", users: upsertUsers(list) });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

app.get("/api/sp2b-kab", (req, res) => {
  const year = Number(req.query.year) || 2024;
  const store = readJson(`sp2b_kab_${year}.json`, { records: {}, last: {} });
  res.json({ status: "success", year, records: store.records || {}, last: store.last || {} });
});

app.post("/api/sp2b-kab", (req, res) => {
  try {
    const body = parseBody(req);
    const year = Number(body.year) || 2024;
    const file = `sp2b_kab_${year}.json`;
    const store = readJson(file, { records: {}, last: {} });
    if (body.records && typeof body.records === "object") {
      store.records = { ...(store.records || {}), ...body.records };
    }
    if (body.last && typeof body.last === "object") store.last = body.last;
    if (body.deleteKey && store.records) delete store.records[body.deleteKey];
    writeJson(file, store);
    res.json({ status: "success" });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// ---------- Upload ----------
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const safe = (file.originalname || "file.pdf").replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}-${safe}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf" || /\.pdf$/i.test(file.originalname || "")) cb(null, true);
    else cb(new Error("Hanya file PDF yang diizinkan"));
  },
});

app.post("/api/upload", (req, res, next) => {
  const ct = req.headers["content-type"] || "";
  if (ct.includes("multipart/form-data")) return upload.single("file")(req, res, next);
  return next();
}, (req, res) => {
  try {
    if (req.file) {
      const url = `/uploads/${req.file.filename}`;
      return res.json({ status: "success", fileUrl: url, fileName: req.file.originalname });
    }
    const body = parseBody(req);
    if (body.action === "uploadFile" || body.fileData) {
      let base64 = body.fileData || "";
      const comma = base64.indexOf(",");
      if (comma >= 0) base64 = base64.slice(comma + 1);
      const buffer = Buffer.from(base64, "base64");
      if (!buffer.length) return res.status(400).json({ status: "error", message: "fileData kosong" });
      const fileName = (body.fileName || "dokumen.pdf").replace(/[^a-zA-Z0-9._-]/g, "_");
      const stored = `${Date.now()}-${body.schoolNo || 0}-${body.docType || "doc"}-${fileName}`;
      fs.writeFileSync(path.join(UPLOAD_DIR, stored), buffer);
      const url = `/uploads/${stored}`;
      return res.json({ status: "success", fileUrl: url, fileName: body.fileName || fileName });
    }
    return res.status(400).json({ status: "error", message: "Tidak ada file" });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

app.post("/", (req, res) => {
  const body = parseBody(req);
  if (body.action === "uploadFile") {
    req.url = "/api/upload";
    return app._router.handle(req, res, () => {});
  }
  if (body.action === "saveAll") {
    req.url = "/api/save";
    return app._router.handle(req, res, () => {});
  }
  res.json({ status: "error", message: "Unknown action" });
});

app.get("/", (_req, res) => {
  const index = path.join(__dirname, "public", "index.html");
  if (fs.existsSync(index)) return res.sendFile(index);
  res.type("text").send("Server Rekon BOSP berjalan.\nLetakkan HTML di public/index.html\nAPI: GET /api/health");
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(400).json({ status: "error", message: err.message || "Bad request" });
});

app.listen(PORT, HOST, () => {
  console.log(`Rekon BOSP server  http://localhost:${PORT}`);
  console.log(`Data directory     ${DATA_DIR}`);
  console.log(`Uploads directory  ${UPLOAD_DIR}`);
  console.log(`Health             http://localhost:${PORT}/api/health`);
});
