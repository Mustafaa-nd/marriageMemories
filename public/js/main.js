
  const form = document.getElementById("uploadForm");
  const fileInput = document.getElementById("files");
  const message = document.getElementById("message");
  const preview = document.getElementById("preview");

  const MAX_SIZE_MB = 300;
  let selectedFiles = [];
  let messageId = 0;  // identifiant global du message affiché

  fileInput.addEventListener("change", () => {
    for (let file of fileInput.files) {
      if (selectedFiles.some(f => f.name === file.name && f.size === file.size)) continue;
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        showMessage(`Attention, le fichier "${file.name}" dépasse 300 Mo.`, "error");
        continue;
      }
      selectedFiles.push(file);
    }

    const allValid = selectedFiles.every(f => f.size <= MAX_SIZE_MB * 1024 * 1024);
    if (allValid) {
      message.textContent = "";
      message.className = "message";
    }

    fileInput.value = "";
    updatePreview();
  });

  function updatePreview() {
    preview.innerHTML = "";
    selectedFiles.forEach((file, index) => {
      const fileURL = URL.createObjectURL(file);
      const wrapper = document.createElement("div");
      wrapper.style.position = "relative";

      const removeBtn = document.createElement("button");
      removeBtn.textContent = "🗑️";
      removeBtn.style.position = "absolute";
      removeBtn.style.top = "0";
      removeBtn.style.right = "0";
      removeBtn.style.background = "red";
      removeBtn.style.color = "white";
      removeBtn.style.border = "none";
      removeBtn.style.borderRadius = "3px";
      removeBtn.style.cursor = "pointer";
      removeBtn.onclick = () => {
        selectedFiles.splice(index, 1);
        updatePreview();
      };

      if (file.type.startsWith("image/")) {
        const img = document.createElement("img");
        img.src = fileURL;
        wrapper.appendChild(img);
      } else if (file.type.startsWith("video/")) {
        const vid = document.createElement("video");
        vid.src = fileURL;
        vid.controls = true;
        wrapper.appendChild(vid);
      }

      wrapper.appendChild(removeBtn);
      preview.appendChild(wrapper);
    });
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    showMessage("", ""); // vide le message précédent

    const loader = document.getElementById("loader");
    loader.style.display = "block";

    if (selectedFiles.length === 0) {
      loader.style.display = "none";
      showMessage("Choisissez des fichiers à partager.", "error");
      return;
    }

    const formData = new FormData();
    selectedFiles.forEach(file => formData.append("files", file));

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/upload");

    xhr.onload = function () {
      loader.style.display = "none";
      if (xhr.status === 200) {
        showMessage("Souvenir(s) envoyé(s) avec succès ! Mr et Mme MBAYE vous remercie pour votre présence ❤️", "success");
        selectedFiles = [];
        updatePreview();
      } else {
        try {
          const res = JSON.parse(xhr.responseText);
          showMessage("Oups ! " + (res.message || "Erreur lors de l'envoi."), "error");
        } catch {
          showMessage("Erreur inattendue du serveur.", "error");
        }
      }
    };

    xhr.onerror = function () {
      loader.style.display = "none";
      showMessage("Oups ! Échec de la connexion au serveur.", "error");
    };

    xhr.send(formData);
  });

  // version améliorée de showMessage
  function showMessage(text, type) {
    const currentId = ++messageId;
    message.textContent = text;
    message.className = `message ${type}`;

    if (type !== "error" && text.trim() !== "") {
      setTimeout(() => {
        if (currentId === messageId) {
          message.textContent = "";
          message.className = "message";
        }
      }, 12500);
    }
  }