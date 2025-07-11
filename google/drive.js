const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { google } = require("googleapis");

const CREDENTIALS_PATH = path.join(__dirname, "credentials.json");
const TOKEN_PATH = path.join(__dirname, "token.json");
const SCOPES = ["https://www.googleapis.com/auth/drive.file"];

function authorize(callback) {
  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
  const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

  // Token déjà obtenu ?
  if (fs.existsSync(TOKEN_PATH)) {
    const token = JSON.parse(fs.readFileSync(TOKEN_PATH));
    oAuth2Client.setCredentials(token);
    callback(oAuth2Client);
  } else {
    getAccessToken(oAuth2Client, callback);
  }
}

function getAccessToken(oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({ access_type: "offline", scope: SCOPES });

  console.log("\n👉 Ouvre cette URL dans ton navigateur pour autoriser l'accès :\n", authUrl);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question("\n🧾 Colle ici le code affiché après autorisation : ", (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error("❌ Erreur lors de l'obtention du token :", err.message);
      oAuth2Client.setCredentials(token);
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(token));
      console.log("✅ Jeton enregistré avec succès !");
      callback(oAuth2Client);
    });
  });
}

function uploadFileToDrive(filePath, filename) {
  return new Promise((resolve, reject) => {
    authorize(async (auth) => {
      const drive = google.drive({ version: "v3", auth });
      const fileMetadata = {
        name: filename,
        parents: [process.env.GOOGLE_FOLDER_ID],
      };
      const media = {
        mimeType: "image/jpeg",
        body: fs.createReadStream(filePath),
      };

      try {
        const res = await drive.files.create({
          requestBody: fileMetadata,
          media,
          fields: "id",
        });
        console.log(`✅ Upload réussi : ${filename} (ID: ${res.data.id})`);
        resolve(res.data.id);
      } catch (err) {
        console.error(`❌ Upload échoué pour ${filename} :`, err.message);
        reject(err);
      }
    });
  });
}

module.exports = { uploadFileToDrive };
