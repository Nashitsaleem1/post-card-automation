// Global variables
let recipients = [];
let currentEditingTemplate = null;
let templateCounter = 5; // Start from 5 since we have 4 initial templates

// Alert function
window.showAlert = function (message) {
  const modal = document.getElementById("alertModal");
  const messageDiv = document.getElementById("alertMessage");
  const okBtn = document.getElementById("alertOkBtn");

  messageDiv.textContent = message;
  modal.style.display = "flex";

  // Close modal when OK button is clicked
  okBtn.onclick = () => {
    modal.style.display = "none";
  };

  // Optional: close modal if user clicks outside content
  window.onclick = (e) => {
    if (e.target === modal) {
      modal.style.display = "none";
    }
  };
};

// Function to load and render user templates
window.loadUserTemplates = async function () {
  try {
    const templates = await window.loadTemplatesFromFirebase();
    const templatesGrid = document.getElementById("templatesGrid");

    // Remove existing user templates (keep default ones)
    const userTemplates = templatesGrid.querySelectorAll(
      ".template[data-firebase-id]"
    );
    userTemplates.forEach((template) => template.remove());

    // Add Firebase templates
    templates.forEach((template) => {
      if (template.isUserCreated) {
        const newTemplateId = `firebase_${template.id}`;
        const newTemplate = document.createElement("div");
        newTemplate.className = "template";
        newTemplate.setAttribute("data-firebase-id", template.id);

        newTemplate.innerHTML = `
          <div class="letter-container" id="${newTemplateId}">
            ${template.content}
          </div>

          <div class="button-actions">
            <button class="order-design-btn" onclick="orderDesign('${newTemplateId}')">
              Order Design
            </button>
            <button class="edit-btn" onclick="openEditModal('${newTemplateId}')">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
            <button class="delete-btn" onclick="deleteTemplate('${newTemplateId}', '${template.id}')" style="background: #dc3545; color: white; border: none; padding: 8px; border-radius: 4px; cursor: pointer; margin-left: 8px;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3,6 5,6 21,6"></polyline>
                <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
            </button>
          </div>
        `;

        templatesGrid.appendChild(newTemplate);
      }
    });
  } catch (error) {
    console.error("Error loading user templates:", error);
  }
};

// Modal functions
window.showSuccessModal = function () {
  document.getElementById("successModal").style.display = "block";
};

window.closeModal = function () {
  document.getElementById("successModal").style.display = "none";
};

window.showTemplateCreatedModal = function (templateName) {
  document.getElementById(
    "templateCreatedMessage"
  ).textContent = `Your new template "${templateName}" has been created successfully.`;
  document.getElementById("templateCreatedModal").style.display = "block";
};

window.closeTemplateCreatedModal = function () {
  document.getElementById("templateCreatedModal").style.display = "none";
};

// File handling functions
function handleFiles(files) {
  if (files.length > 0) {
    const file = files[0];
    if (file.type === "text/csv" || file.name.endsWith(".csv")) {
      parseCSV(file);
    } else {
      showAlert("Please upload a CSV file.");
    }
  }
}

// Letter Editing functions
window.openEditModal = function (templateId) {
  window.currentEditingTemplate = templateId;
  const editor = document.getElementById("letterEditor");
  editor.innerHTML = document.getElementById(templateId).innerHTML;
  document.getElementById("editModal").style.display = "block";
};

window.closeEditModal = function () {
  document.getElementById("editModal").style.display = "none";
  window.currentEditingTemplate = null;
};

window.saveTemplate = function () {
  if (window.currentEditingTemplate) {
    document.getElementById(window.currentEditingTemplate).innerHTML =
      document.getElementById("letterEditor").innerHTML;
  }
  window.closeEditModal();
};

// Save as New Template Functionality
window.openSaveAsNewModal = function () {
  const preview = document.getElementById("newTemplatePreview");
  preview.innerHTML = document.getElementById("letterEditor").innerHTML;
  document.getElementById("templateName").value = "";
  document.getElementById("saveAsNewModal").style.display = "block";
};

window.closeSaveAsNewModal = function () {
  document.getElementById("saveAsNewModal").style.display = "none";
};

window.saveAsNewTemplate = async function () {
  const templateName = document
    .getElementById("templateName")
    .value.trim();

  if (!templateName) {
    showAlert("Please enter a template name.");
    return;
  }

  const templateContent =
    document.getElementById("letterEditor").innerHTML;

  try {
    // Save to Firebase
    const firebaseId = await window.saveNewTemplateToFirebase(
      templateName,
      templateContent
    );

    // Close modals
    window.closeSaveAsNewModal();
    window.closeEditModal();

    // Show success message
    window.showTemplateCreatedModal(templateName);

    // Reload templates to show the new one
    await window.loadUserTemplates();
  } catch (error) {
    console.error("Error saving template:", error);
    showAlert("Error saving template. Please try again.");
  }
};

// Delete Template Function
window.deleteTemplate = async function (templateId, firebaseId = null) {
  const confirmed = await showConfirm("Are you sure you want to delete this template?");
  if (!confirmed) return;

  try {
    if (firebaseId) {
      // Delete from Firebase
      await window.deleteTemplateFromFirebase(firebaseId);

      // Remove from DOM
      const templateElement = document.querySelector(
        `[data-firebase-id="${firebaseId}"]`
      );
      if (templateElement) {
        templateElement.remove();
      }

      showAlert("Template deleted successfully!");
    } else {
      showAlert("Cannot delete default templates.");
    }
  } catch (error) {
    console.error("Error deleting template:", error);
    showAlert("Error deleting template. Please try again.");
  }
};


function showConfirm(message) {
  return new Promise((resolve) => {
    const confirmModal = document.getElementById("confirmModal");
    const confirmMessage = document.getElementById("confirmMessage");
    const yesBtn = document.getElementById("confirmYesBtn");
    const noBtn = document.getElementById("confirmNoBtn");

    confirmMessage.textContent = message;
    confirmModal.style.display = "flex";

    // Cleanup function
    function close(result) {
      confirmModal.style.display = "none";
      yesBtn.removeEventListener("click", onYes);
      noBtn.removeEventListener("click", onNo);
      resolve(result);
    }

    function onYes() {
      close(true);
    }

    function onNo() {
      close(false);
    }

    yesBtn.addEventListener("click", onYes);
    noBtn.addEventListener("click", onNo);
  });
}


// CSV Upload functions
function parseCSV(file) {
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      window.recipients = results.data.map((r) => ({
        company: r.company || "",
        firstName: r.firstName || r.FirstName || "Test",
        lastName: r.lastName || r.LastName || "Name",
        address: r.address || r.Address || "",
        city: r.city || r.City || "",
        state: r.state || r.State || "",
        zipCode: r.zipCode || r.Zipcode || "",
      }));
      console.log("Recipients loaded:", window.recipients);

      // Update upload box to show success
      const uploadBox = document.getElementById("uploadBox");
      uploadBox.innerHTML = `
        <div class="upload-icon" style="color: #28a745;">✓</div>
        <div class="upload-main-text" style="color: #28a745;">File uploaded successfully!</div>
        <div class="upload-sub-text">${window.recipients.length} recipients loaded from ${file.name}</div>
        <button class="choose-file-btn" onclick="resetUpload()" style="background: #6c757d; margin-top: 1rem;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="1 4 1 10 7 10"/>
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
          </svg>
          Upload Different File
        </button>
      `;
    },
    error: (error) => {
      console.error("CSV parsing error:", error);
      showAlert("Error parsing CSV file. Please check the format.");
    },
  });
}

window.resetUpload = function () {
  const uploadBox = document.getElementById("uploadBox");
  uploadBox.innerHTML = `
    <div class="upload-icon"><img src="assets/icon.png" alt="Upload" width="52" height="52" /></div>
    <div class="upload-main-text">Drag & drop your CSV file here</div>
    <div class="upload-sub-text">or click to browse your files</div>
    
    <label for="csvFile" class="choose-file-btn">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
        <polyline points="14,2 14,8 20,8"/>
      </svg>
      Choose File
    </label>
    
    <div class="file-size-info">Max file size: 10MB</div>
  `;

  // Re-add event listeners
  setupDragAndDrop();
  
  window.recipients = [];
  const csvFileInput = document.getElementById("csvFile");
  csvFileInput.value = "";
};

// Download Sample CSV
window.downloadSampleCSV = function () {
  const sample = `Company,firstName,lastName,address,city,state,zipCode
PCM Integrations,Alex,Doe,2145 Sunnydale Blvd,Clearwater,FL,33765
`;

  const blob = new Blob([sample], { type: "text/csv" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "sample_recipients.csv";
  link.click();
};

function downloadHTML(content, filename = "letter.html") {
  const blob = new Blob([content], { type: "text/html" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

// API functions
async function getToken() {
  const payload = {
    apiKey: "Mzk2N2YyZTktZmNkNy00YjcwLWJhMjUtMTM4ZWFlZDhmNWU0",
    apiSecret: "MmZlMzIwMzItMTlhZS00Mjk0LWE1NWYtYmI5NTg5MDUxYTM0",
    childRefNbr: "myAccountReference",
  };
  const res = await fetch("https://v3.pcmintegrations.com/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Auth failed");
  const data = await res.json();
  return data.token;
}

window.orderDesign = async function (templateId) {
  if (!window.recipients.length) {
    showAlert("Please upload a CSV file with recipients first!");
    return;
  }

  const button = event.target;
  const originalText = button.textContent;
  button.textContent = "Processing...";
  button.disabled = true;

  try {
    const todayObj = new Date();
    const todayISO = todayObj.toISOString().split("T")[0];
    const formattedDate = todayObj.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Get the HTML content from the specific template
    let finalHtml = document.getElementById(templateId).innerHTML;
    finalHtml = finalHtml.replace(/DATE/g, formattedDate);

    const token = await getToken();
    const payload = {
      extRefNbr: "12345",
      designID: 0,
      mailClass: "FirstClass",
      mailDate: todayISO,
      color: true,
      printOnBothSides: true,
      insertAddressingPage: true,
      envelope: {
        font: "Bradley Hand",
        type: "fullWindow",
        fontColor: "Black",
      },
      recipients: window.recipients,
      letter: finalHtml,
    };

    const res = await fetch(
      "https://v3.pcmintegrations.com/order/letter",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      }
    );

    const data = await res.json();
    console.log("Order Response:", data);

    if (res.ok) {
      window.showSuccessModal();
    } else {
      throw new Error(data.message || "API request failed");
    }
  } catch (err) {
    console.error("Order Design Error:", err);
    showAlert("Error ordering letters: " + err.message);
  } finally {
    button.textContent = originalText;
    button.disabled = false;
  }
};

// Drag and Drop Setup
function setupDragAndDrop() {
  const uploadBox = document.getElementById("uploadBox");
  const csvFileInput = document.getElementById("csvFile");

  // Prevent default drag behaviors
  ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
    uploadBox.addEventListener(eventName, preventDefaults, false);
    document.body.addEventListener(eventName, preventDefaults, false);
  });

  // Highlight drop area when item is dragged over it
  ["dragenter", "dragover"].forEach((eventName) => {
    uploadBox.addEventListener(eventName, highlight, false);
  });

  ["dragleave", "drop"].forEach((eventName) => {
    uploadBox.addEventListener(eventName, unhighlight, false);
  });

  // Handle dropped files
  uploadBox.addEventListener("drop", handleDrop, false);

  // Handle file input change
  csvFileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    parseCSV(file);
  });

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  function highlight() {
    uploadBox.classList.add("dragover");
  }

  function unhighlight() {
    uploadBox.classList.remove("dragover");
  }

  function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    handleFiles(files);
  }
}

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", function() {
  setupDragAndDrop();
});