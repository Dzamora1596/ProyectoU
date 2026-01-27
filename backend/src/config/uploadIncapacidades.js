// backend/src/config/uploadIncapacidades.js
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const crypto = require("crypto");

const UPLOAD_DIR = path.resolve(process.cwd(), "uploads", "incapacidades");

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function sanitizeFilename(name = "") {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 180);
}

const storage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function (_req, file, cb) {
    const original = sanitizeFilename(file.originalname || "archivo");
    const ext = path.extname(original).toLowerCase();
    const base = path.basename(original, ext);

    const unique = crypto.randomBytes(16).toString("hex");
    const saved = `${base}_${Date.now()}_${unique}${ext}`;

    cb(null, saved);
  },
});

function fileFilter(_req, file, cb) {
  const allowed = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
  ];

  if (!allowed.includes(file.mimetype)) {
    return cb(
      new Error(
        "Tipo de archivo no permitido. Solo PDF o imágenes (JPG/PNG/WEBP)."
      ),
      false
    );
  }

  cb(null, true);
}

const uploadIncapacidad = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, 
  },
});

module.exports = { uploadIncapacidad };
