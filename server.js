const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
require("dotenv").config();
const { uploadFileToDrive } = require("./google/drive");

const app = express();
const PORT = process.env.PORT || 3000;

const MAX_FILE_SIZE_MB = 300;
const MAX_TOTAL_SIZE_MB = 500;

const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const MAX_TOTAL_SIZE_BYTES = MAX_TOTAL_SIZE_MB * 1024 * 1024;


app.use(cors());
app.use(express.static("public"));

if (!fs.existsSync("upload")) {
  fs.mkdirSync("upload");
}


// Multer pour stocker temporairement les fichiers dans /upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "upload"),
  filename: (req, file, cb) =>
    cb(null, `${Date.now()}-${file.originalname}`),
});

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 30, // sécurité côté serveur
    fieldSize: MAX_TOTAL_SIZE_BYTES, // limite la taille totale de tous les champs du formulaire
  },
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


// Important : désactiver les parseurs incompatibles avec multer
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


app.use((req, res, next) => {
  console.log("📥 Requête reçue :", req.method, req.url);
  next();
});


// Route POST /upload
app.post("/upload", (req, res, next) => {
  console.log("📤 Champs reçus via multer :", req.files?.map(f => f.fieldname));
  console.log("📤 Corps brut reçu :", req.body);
  upload.array("files", MAX_FILES)(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      console.error("❌ MulterError attrapé :", err.message);
      return res.status(400).json({ success: false, message: err.message });
    } else if (err) {
      console.error("❌ Erreur inconnue dans upload.array :", err);
      return res.status(500).json({ success: false, message: err.message });
    }

    // Si pas d'erreur, on continue vers le traitement des fichiers :
    next();
  });
}, async (req, res) => {
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
  if (err.code === "LIMIT_FILE_SIZE" || err.code === "LIMIT_FIELD_SIZE") {
    return res.status(413).json({
      success: false,
      message: `Erreur : La requête dépasse la taille maximale autorisée de ${MAX_TOTAL_SIZE_MB} Mo.`,
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
