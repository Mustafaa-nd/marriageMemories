const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
require("dotenv").config();
const { uploadFileToDrive } = require("./google/drive");

const app = express();
const PORT = process.env.PORT || 3000;

const MAX_SIZE_MB = 100;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

app.use(cors());
app.use(express.static("public"));

// Multer pour stocker temporairement les fichiers dans /upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "upload"),
  filename: (req, file, cb) =>
    cb(null, `${Date.now()}-${file.originalname}`),
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE_BYTES },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "video/mp4",
      "video/quicktime",
      "video/x-msvideo",
    ];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Type de fichier non autorisé"));
    }
  },
});

// Route POST /upload
app.post("/upload", upload.array("files", 15), async (req, res) => {
  try {
    const files = req.files;
    if (!files || files.length === 0) return res.status(400).send("Aucun fichier reçu");

    const results = [];

    for (const file of files) {
      try {
        console.log(`Upload en cours : ${file.originalname}`);
        const fileId = await uploadFileToDrive(file.path, file.originalname);
        fs.unlinkSync(file.path);
        console.log(`Upload réussi : ${file.originalname} (ID: ${fileId})`);
        console.log(`🗑️ Fichier temporaire supprimé : ${file.path}`);
        results.push({ name: file.originalname, fileId });
      } catch (innerErr) {
        console.error(`Échec pour le fichier ${file.originalname} : ${innerErr.message}`);
      }
    }

    return res.status(200).json({ success: true, uploads: results });
  } catch (err) {
    console.error("Erreur d’upload globale :", err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// Middleware de gestion des erreurs
app.use((err, req, res, next) => {
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({
      success: false,
      message: `Erreur : Le fichier dépasse la taille maximale autorisée de ${MAX_SIZE_MB} Mo.`,
    });
  }

  if (err.message === "Type de fichier non autorisé") {
    return res.status(400).json({
      success: false,
      message: "Erreur : Ce type de fichier n'est pas autorisé.",
    });
  }

  console.error("Erreur inconnue :", err);
  return res.status(500).json({
    success: false,
    message: "Erreur interne du serveur.",
  });
});


app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
});
