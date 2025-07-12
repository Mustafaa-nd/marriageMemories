const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const ffmpeg = require("fluent-ffmpeg");
require("dotenv").config();
const { uploadFileToDrive } = require("./google/drive");

const app = express();
const PORT = process.env.PORT || 3000;

const MAX_FILE_SIZE_MB = 300;
const MAX_TOTAL_SIZE_MB = 500;
const MAX_FILES = 30;

const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const MAX_TOTAL_SIZE_BYTES = MAX_TOTAL_SIZE_MB * 1024 * 1024;

app.use(cors());
app.use(express.static("public"));

if (!fs.existsSync("upload")) {
  fs.mkdirSync("upload");
}

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "upload"),
  filename: (req, file, cb) =>
    cb(null, `${Date.now()}-${file.originalname}`),
});

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: MAX_FILES,
    fieldSize: MAX_TOTAL_SIZE_BYTES,
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

// Pour logs des requêtes
app.use((req, res, next) => {
  console.log("Requête reçue :", req.method, req.url);
  next();
});

// Conversion .mov -> .mp4
function convertMovToMp4(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions("-c:v libx264")
      .toFormat("mp4")
      .save(outputPath)
      .on("end", () => resolve(outputPath))
      .on("error", (err) => reject(err));
  });
}

// Route POST /upload
app.post("/upload", (req, res, next) => {
  upload.array("files", MAX_FILES)(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      console.error("MulterError attrapé :", err.message);
      return res.status(400).json({ success: false, message: err.message });
    } else if (err) {
      console.error("Erreur inconnue dans upload.array :", err);
      return res.status(500).json({ success: false, message: err.message });
    }

    next();
  });
}, async (req, res) => {
  try {
    const files = req.files;
    if (!files || files.length === 0) return res.status(400).send("Aucun fichier reçu");

    const results = [];

    for (const file of files) {
      try {
        let filePath = file.path;
        let fileName = file.originalname;
        let mimeType = file.mimetype;

        // 🎞️ Conversion MOV ➝ MP4
        if (file.mimetype === "video/quicktime" && path.extname(file.originalname).toLowerCase() === ".mov") {
          const newFilename = file.originalname.replace(/\.mov$/i, ".mp4");
          const convertedPath = filePath.replace(/\.mov$/i, ".mp4");

          console.log(`🎞️ Conversion de ${file.originalname} en MP4...`);
          await convertMovToMp4(file.path, convertedPath);
          fs.unlinkSync(file.path); // Supprime l'original

          filePath = convertedPath;
          fileName = newFilename;
          mimeType = "video/mp4";
        }

        console.log(`Upload en cours : ${fileName}`);
        const fileId = await uploadFileToDrive(filePath, fileName, mimeType);
        fs.unlinkSync(filePath);
        console.log(`Upload réussi : ${fileName} (ID: ${fileId})`);
        results.push({ name: fileName, fileId });

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

// Middleware d'erreur
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
