const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");
require("dotenv").config();

const KEYFILEPATH = path.join(__dirname, "credentials.json"); // à placer ici
const SCOPES = ["https://www.googleapis.com/auth/drive.file"];

const auth = new google.auth.GoogleAuth({
  keyFile: KEYFILEPATH,
  scopes: SCOPES,
});

const driveService = google.drive({ version: "v3", auth });

async function uploadFileToDrive(filePath, filename) {
  console.log(`📁 Démarrage de l'upload : ${filename}`);

  const fileMetadata = {
    name: filename,
    parents: [process.env.GOOGLE_FOLDER_ID],
  };

  const media = {
    mimeType: "image/jpeg",
    body: fs.createReadStream(filePath),
  };

  try {
    const response = await driveService.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: "id",
    });

    console.log(`Fichier "${filename}" uploadé avec succès (ID: ${response.data.id})`);
    return response.data.id;
  } catch (error) {
    console.error(`Erreur lors de l’upload de "${filename}" :`, error.message);
    throw error;
  }
}


module.exports = { uploadFileToDrive };
