// ============================================
// GLOBAL VARIABLES & CONFIGURATION
// ============================================

const campaignCard = document.getElementById("newCampaignCard");
const mailerCard = document.getElementById("newMailerCard");
const campaignFields = document.getElementById("campaignFields");
const mailerFields = document.getElementById("mailerFields");
const hamburger = document.getElementById("hamburger");
const navLinks = document.querySelector(".nav-links");
const uploadcsvCard = document.getElementById("uploadcsv");
const BatchsearchCard = document.getElementById("batchsearch");
const uploadsection = document.getElementById("uploadsection");
const batchsection = document.getElementById("batchdatasearch");

let cityAutocomplete;
let recipientsList = [];
let uploadedPdfUrl = null;

const API_KEYS = {
  testing: {
    apiKey: "Mzk2N2YyZTktZmNkNy00YjcwLWJhMjUtMTM4ZWFlZDhmNWU0",
    apiSecret: "YzU0NTRiMjgtOTE3Mi00YTRmLWE3YjQtYTc0ODE1N2FmOGNl",
  },
  production: {
    apiKey: "Mzk2N2YyZTktZmNkNy00YjcwLWJhMjUtMTM4ZWFlZDhmNWU0",
    apiSecret: "YzU0NTRiMjgtOTE3Mi00YTRmLWE3YjQtYTc0ODE1N2FmOGNl",
  },
};

// ============================================
// PAGINATION & SEARCH VARIABLES
// ============================================

let allRecords = [];
let filteredRecords = [];
let selectedRecords = new Set();
let currentPage = 1;
let recordsPerPage = 20;
let totalResultsFound = 0;
let totalPages = 0;
let currentSearchPayload = null;
let allLoadedRecords = [];
let pageCache = new Map();
let currentSearchHash = null;

// ============================================
// MODE MANAGEMENT
// ============================================

function getCurrentMode() {
  const mode = sessionStorage.getItem("apiMode");
  return mode || "testing";
}

function setMode(newMode) {
  sessionStorage.setItem("apiMode", newMode);
}

// ============================================
// AUDIENCE MANAGEMENT FUNCTIONS
// ============================================

let selectedAudienceId = null;
let currentAudienceData = null;

const existingaudienceCard = document.getElementById("existingaudience");
const existingaudiencesection = document.getElementById("existingaudiencesection");

existingaudienceCard.addEventListener("click", () => {
  existingaudienceCard.classList.add("selected");
  uploadcsvCard.classList.remove("selected");
  BatchsearchCard.classList.remove("selected");
  
  existingaudiencesection.style.display = "block";
  uploadsection.style.display = "none";
  batchsection.style.display = "none";
  
  loadExistingAudiences();
  updateButtonStates();
});

async function loadExistingAudiences() {
  const audiencesGrid = document.getElementById("audiencesGrid");
  
  if (!audiencesGrid) {
    console.error("Audiences grid not found");
    return;
  }

  audiencesGrid.innerHTML = '<div class="loading-message">Loading audiences...</div>';

  try {
    const response = await fetch("https://pcm-app-h8mn8.ondigitalocean.app/audiences");
    if (!response.ok) throw new Error("Failed to load audiences");

    const audiences = await response.json();

    if (audiences.length === 0) {
      audiencesGrid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📋</div>
          <p>No saved audiences yet</p>
          <p class="empty-hint">Create audiences by uploading CSV or using Batch Search</p>
        </div>
      `;
      return;
    }

    audiencesGrid.innerHTML = "";

    audiences.forEach((audience) => {
      // audience_list comes as array from API (already parsed by backend)
      const audienceList = Array.isArray(audience.audience_list) 
        ? audience.audience_list 
        : JSON.parse(audience.audience_list);
      
      const recipientCount = audienceList.length;
      const createdDate = new Date(audience.created_at).toLocaleDateString();

      const audienceCard = document.createElement("div");
      audienceCard.className = "audience-card";
      audienceCard.dataset.audienceId = audience.id;

      audienceCard.innerHTML = `
        <div class="audience-card-header">
          <h3 class="audience-name">${audience.audience_name}</h3>
        </div>
        <div class="audience-info">
          <span class="info-item">${recipientCount} recipients</span>
          <span class="info-item">${createdDate}</span>
        </div>
        <div class="audience-actions">
          <button class="select-audience-btn">Select</button>
          <button class="view-details-btn">View Details</button>
        </div>
      `;

      audienceCard
        .querySelector(".select-audience-btn")
        .addEventListener("click", () => selectAudience(audience.id));

      audienceCard
        .querySelector(".view-details-btn")
        .addEventListener("click", () => {
          const list = Array.isArray(audience.audience_list) 
            ? audience.audience_list 
            : JSON.parse(audience.audience_list);
          viewAudienceDetails(list, audience.audience_name);
        });

      audiencesGrid.appendChild(audienceCard);
    });

  } catch (error) {
    console.error("Error loading audiences:", error);
    audiencesGrid.innerHTML = `
      <div class="error-state">
        <div class="error-icon">⚠️</div>
        <p>Failed to load audiences</p>
        <button onclick="loadExistingAudiences()" class="retry-btn">Retry</button>
      </div>
    `;
  }
}

function viewAudienceDetails(audienceList, audienceName) {
  const modal = document.createElement("div");
  modal.className = "audience-modal";

  const detailsHTML = audienceList.map((item, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td>${item.firstName} ${item.lastName}</td>
      <td>${item.address}</td>
      <td>${item.city}</td>
      <td>${item.state}</td>
      <td>${item.zipcode}</td>
    </tr>
  `).join("");

  modal.innerHTML = `
    <div class="modal-content">
      <h2>${audienceName} — ${audienceList.length} recipients</h2>
      <table class="audience-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Name</th>
            <th>Address</th>
            <th>City</th>
            <th>State</th>
            <th>Zip</th>
          </tr>
        </thead>
        <tbody>${detailsHTML}</tbody>
      </table>
      <button class="close-modal-btn" onclick="this.closest('.audience-modal').remove()">✖ Close</button>
    </div>
  `;

  document.body.appendChild(modal);
}

async function selectAudience(audienceId) {
  try {
    const response = await fetch(`https://pcm-app-h8mn8.ondigitalocean.app/audiences/${audienceId}`);
    
    if (!response.ok) {
      throw new Error("Failed to load audience details");
    }

    const audience = await response.json();
    
    selectedAudienceId = audienceId;
    currentAudienceData = audience;

    // Parse audience_list - it comes as array from API
    const audienceList = Array.isArray(audience.audience_list) 
      ? audience.audience_list 
      : JSON.parse(audience.audience_list);
    
    recipientsList = audienceList;

    document.querySelectorAll(".audience-card").forEach(card => {
      card.classList.remove("selected-audience");
    });
    
    const selectedCard = document.querySelector(`[data-audience-id="${audienceId}"]`);
    if (selectedCard) {
      selectedCard.classList.add("selected-audience");
    }

    showAlert(`✅ Audience "${audience.audience_name}" selected with ${recipientsList.length} recipients`);
    
    saveState();
    updateButtonStates();

  } catch (error) {
    console.error("Error selecting audience:", error);
    showAlert("Error loading audience: " + error.message);
  }
}

async function deleteAudience(audienceId, event) {
  event.stopPropagation();
  
  const confirmDelete = confirm("Are you sure you want to delete this audience? This action cannot be undone.");
  
  if (!confirmDelete) return;

  try {
    const response = await fetch(`https://pcm-app-h8mn8.ondigitalocean.app/audiences/${audienceId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      throw new Error("Failed to delete audience");
    }

    showAlert("✅ Audience deleted successfully");
    
    if (selectedAudienceId === audienceId) {
      selectedAudienceId = null;
      currentAudienceData = null;
      recipientsList = [];
      updateButtonStates();
    }
    
    loadExistingAudiences();

  } catch (error) {
    console.error("Error deleting audience:", error);
    showAlert("Error deleting audience: " + error.message);
  }
}

// ============================================
// AUDIENCE NAME MODAL FUNCTIONS
// ============================================

function showAudienceNameModal() {
  const modal = document.getElementById("audienceNameModal");
  const input = document.getElementById("audienceNameInput");
  
  if (modal && input) {
    input.value = "";
    modal.style.display = "flex";
    input.focus();
  }
}

function closeAudienceNameModal() {
  const modal = document.getElementById("audienceNameModal");
  if (modal) {
    modal.style.display = "none";
  }
}

async function confirmSaveAudience() {
  const audienceName = document.getElementById("audienceNameInput").value.trim();
  
  if (!audienceName) {
    showAlert("Please enter an audience name");
    return;
  }

  if (recipientsList.length === 0) {
    showAlert("No recipients to save");
    closeAudienceNameModal();
    return;
  }

  try {
  
    const payload = {
      audience_name: audienceName,
      audience_list: recipientsList 
    };

    const response = await fetch("https://pcm-app-h8mn8.ondigitalocean.app/audiences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to save audience");
    }

    const savedAudience = await response.json();
    
    selectedAudienceId = savedAudience.id;
    currentAudienceData = savedAudience;

    showAlert(`✅ Audience "${audienceName}" saved successfully with ${recipientsList.length} recipients`);
    
    closeAudienceNameModal();
    saveState();

  } catch (error) {
    console.error("Error saving audience:", error);
    showAlert("Error saving audience: " + error.message);
  }
}

// ============================================
// UI & MODAL FUNCTIONS
// ============================================

function showAlert(message) {
  const alertMessage = document.getElementById("alertMessage");
  alertMessage.textContent = message;
  const alertModal = document.getElementById("alertModal");
  alertModal.style.display = "flex";
  document.getElementById("alertOkBtn").addEventListener("click", () => {
    alertModal.style.display = "none";
  });
}

function scrollToCreateCampaign() {
  document
    .getElementById("createcampaign")
    .scrollIntoView({ behavior: "smooth" });
}

function closePreview() {
  const overlay = document.getElementById("previewOverlay");
  if (overlay) {
    overlay.style.display = "none";
    document.getElementById("previewBody").innerHTML = "";
  }
}

// ============================================
// PDF UPLOAD MANAGEMENT
// ============================================

function setupPdfUpload() {
  const pdfUploadBox = document.getElementById("pdfUploadBox");
  const pdfFileInput = document.getElementById("pdfFile");

  if (!pdfUploadBox || !pdfFileInput) {
    console.warn("PDF upload elements not found, skipping setup");
    return;
  }

  if (pdfUploadBox.dataset.initialized === "true") {
    return;
  }
  pdfUploadBox.dataset.initialized = "true";

  ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
    pdfUploadBox.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
  });

  ["dragenter", "dragover"].forEach((eventName) => {
    pdfUploadBox.addEventListener(eventName, () => {
      pdfUploadBox.style.borderColor = "#2b7fff";
      pdfUploadBox.style.backgroundColor = "#f0f7ff";
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    pdfUploadBox.addEventListener(eventName, () => {
      pdfUploadBox.style.borderColor = "#ccc";
      pdfUploadBox.style.backgroundColor = "transparent";
    });
  });

  pdfUploadBox.addEventListener("drop", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files[0];
    if (file && file.type === "application/pdf") {
      await uploadPdfFile(file);
    } else {
      showAlert("Please upload a valid PDF file");
    }
  });

  pdfFileInput.addEventListener("change", async (e) => {
    e.preventDefault();
    const file = e.target.files[0];
    if (file) {
      await uploadPdfFile(file);
      e.target.value = "";
    }
  });
}

async function uploadPdfFile(file) {
  if (file.size > 10 * 1024 * 1024) {
    showAlert("File size exceeds 10MB limit");
    return;
  }

  const pdfUploadBox = document.getElementById("pdfUploadBox");
  if (!pdfUploadBox) return;

  pdfUploadBox.innerHTML = `
    <div style="padding: 2rem;">
      <div style="font-size: 2rem; margin-bottom: 1rem;">⏳</div>
      <div style="font-size: 1.1rem; color: #666;">Uploading PDF...</div>
    </div>
  `;

  try {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("https://pcm-app-h8mn8.ondigitalocean.app/upload-pdf", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Upload failed");
    }

    const data = await response.json();
    uploadedPdfUrl = data.url;

    pdfUploadBox.innerHTML = `
      <div style="padding: 2rem;">
        <div style="font-size: 2rem; color: #28a745; margin-bottom: 1rem;">✓</div>
        <div style="font-size: 1.1rem; color: #28a745; font-weight: 600; margin-bottom: 0.5rem;">
          PDF uploaded successfully!
        </div>
        <div style="color: #666; margin-bottom: 1rem;">
          ${file.name} (${(data.size / 1024).toFixed(2)} KB)
        </div>
        <button class="remove-pdf-btn" onclick="removePdf('${
          data.filename
        }')" style="
          padding: 0.5rem 1rem;
          background: #dc3545;
          color: white;
          border: none;
          border-radius: 5px;
          cursor: pointer;
        ">
          Remove PDF
        </button>
      </div>
    `;

    document.querySelectorAll(".template-card").forEach((card) => {
      card.classList.remove("selected");
    });
    window.currentEditingTemplateId = null;

    updateButtonStates();
  } catch (error) {
    console.error("PDF upload error:", error);
    showAlert("Error uploading PDF: " + error.message);
    resetPdfUploadBox();
  }
}

function resetPdfUploadBox() {
  const pdfUploadBox = document.getElementById("pdfUploadBox");
  if (!pdfUploadBox) return;

  delete pdfUploadBox.dataset.initialized;

  pdfUploadBox.innerHTML = `
    <div class="pdf-icon" style="font-size: 3rem; color: #666; margin-bottom: 1rem;">📄</div>
    <div class="pdf-main-text" style="font-size: 1.1rem; font-weight: 600; margin-bottom: 0.5rem;">
      Drag & drop your PDF file here
    </div>
    <div class="pdf-sub-text" style="color: #666; margin-bottom: 1rem;">
      or click to browse your files
    </div>
    <label for="pdfFile" class="choose-pdf-btn" style="
      display: inline-block;
      padding: 0.75rem 1.5rem;
      background: #2b7fff;
      color: white;
      border-radius: 5px;
      cursor: pointer;
    ">
      Choose PDF File
    </label>
    <input type="file" id="pdfFile" accept=".pdf" style="display: none;" />
    <div class="pdf-size-info" style="color: #999; font-size: 0.9rem; margin-top: 1rem;">
      Max file size: 10MB
    </div>
  `;

  setupPdfUpload();
}

async function removePdf(filename) {
  try {
    const response = await fetch(
      `https://pcm-app-h8mn8.ondigitalocean.app/delete-pdf/${filename}`,
      {
        method: "DELETE",
      }
    );

    if (!response.ok) {
      throw new Error("Failed to delete PDF");
    }

    uploadedPdfUrl = null;

    const pdfUploadBox = document.getElementById("pdfUploadBox");
    if (pdfUploadBox) {
      delete pdfUploadBox.dataset.initialized;

      pdfUploadBox.innerHTML = `
        <div class="pdf-icon" style="font-size: 3rem; color: #666; margin-bottom: 1rem;">📄</div>
        <div class="pdf-main-text" style="font-size: 1.1rem; font-weight: 600; margin-bottom: 0.5rem;">
          Drag & drop your PDF file here
        </div>
        <div class="pdf-sub-text" style="color: #666; margin-bottom: 1rem;">
          or click to browse your files
        </div>
        <label for="pdfFile" class="choose-pdf-btn" style="
          display: inline-block;
          padding: 0.75rem 1.5rem;
          background: #2b7fff;
          color: white;
          border-radius: 5px;
          cursor: pointer;
        ">
          Choose PDF File
        </label>
        <input type="file" id="pdfFile" accept=".pdf" style="display: none;" />
        <div class="pdf-size-info" style="color: #999; font-size: 0.9rem; margin-top: 1rem;">
          Max file size: 10MB
        </div>
      `;
      setupPdfUpload();
    }

    updateButtonStates();
  } catch (error) {
    console.error("Error removing PDF:", error);
    showAlert("Error removing PDF: " + error.message);
  }
}

// ============================================
// CARD SELECTION HANDLERS
// ============================================

campaignCard.addEventListener("click", () => {
  campaignCard.classList.add("selected");
  mailerCard.classList.remove("selected");
  campaignFields.style.display = "block";
  mailerFields.style.display = "none";
  updateButtonStates();
});

mailerCard.addEventListener("click", () => {
  mailerCard.classList.add("selected");
  campaignCard.classList.remove("selected");
  mailerFields.style.display = "block";
  campaignFields.style.display = "none";
  updateButtonStates();
});

uploadcsvCard.addEventListener("click", () => {
  uploadcsvCard.classList.add("selected");
  existingaudienceCard.classList.remove("selected");
  BatchsearchCard.classList.remove("selected");

  uploadsection.style.display = "block";
  existingaudiencesection.style.display = "none";
  batchsection.style.display = "none";

  updateButtonStates();
});

BatchsearchCard.addEventListener("click", () => {
  BatchsearchCard.classList.add("selected");
  uploadcsvCard.classList.remove("selected");
  existingaudienceCard.classList.remove("selected");

  batchsection.style.display = "flex";
  uploadsection.style.display = "none";
  existingaudiencesection.style.display = "none";

  updateButtonStates();
});

hamburger.addEventListener("click", (e) => {
  e.stopPropagation();
  navLinks.classList.toggle("nav-active");
});

document.addEventListener("click", (e) => {
  if (
    navLinks.classList.contains("nav-active") &&
    !navLinks.contains(e.target) &&
    e.target !== hamburger
  ) {
    navLinks.classList.remove("nav-active");
  }
});

// ============================================
// STATE PERSISTENCE
// ============================================

function saveState() {
  const state = {
    mode: campaignCard.classList.contains("selected")
      ? "campaign"
      : mailerCard.classList.contains("selected")
      ? "mailer"
      : null,
    uploadMode: uploadcsvCard.classList.contains("selected")
      ? "csv"
      : BatchsearchCard.classList.contains("selected")
      ? "batch"
      : existingaudienceCard?.classList.contains("selected")
      ? "existing"
      : null,
    campaignName: document.getElementById("campaignName")?.value || "",
    mailerName: document.getElementById("mailerName")?.value || "",
    mailerNameonly: document.getElementById("mailerNameOnlyInput")?.value || "",
    recipients: recipientsList,
    selectedAudienceId: selectedAudienceId,
  };
  sessionStorage.setItem("campaignState", JSON.stringify(state));
}

function restoreState() {
  const saved = sessionStorage.getItem("campaignState");
  if (!saved) return;
  const state = JSON.parse(saved);

  if (state.mode === "campaign") {
    campaignCard.classList.add("selected");
    mailerCard.classList.remove("selected");
    campaignFields.style.display = "block";
    mailerFields.style.display = "none";
  } else if (state.mode === "mailer") {
    mailerCard.classList.add("selected");
    campaignCard.classList.remove("selected");
    mailerFields.style.display = "block";
    campaignFields.style.display = "none";
  }

  if (state.uploadMode === "csv") {
    uploadcsvCard.classList.add("selected");
    BatchsearchCard.classList.remove("selected");
    existingaudienceCard?.classList.remove("selected");
    uploadsection.style.display = "block";
    batchsection.style.display = "none";
    existingaudiencesection.style.display = "none";
  } else if (state.uploadMode === "batch") {
    BatchsearchCard.classList.add("selected");
    uploadcsvCard.classList.remove("selected");
    existingaudienceCard?.classList.remove("selected");
    batchsection.style.display = "flex";
    uploadsection.style.display = "none";
    existingaudiencesection.style.display = "none";
  } else if (state.uploadMode === "existing") {
    existingaudienceCard?.classList.add("selected");
    uploadcsvCard.classList.remove("selected");
    BatchsearchCard.classList.remove("selected");
    existingaudiencesection.style.display = "block";
    uploadsection.style.display = "none";
    batchsection.style.display = "none";
  }

  if (state.campaignName)
    document.getElementById("campaignName").value = state.campaignName;
  if (state.mailerName)
    document.getElementById("mailerName").value = state.mailerName;
  if (state.mailerNameonly)
    document.getElementById("mailerNameOnlyInput").value = state.mailerNameonly;
  
  if (state.recipients && state.recipients.length) {
    recipientsList = state.recipients;
  }
  
  if (state.selectedAudienceId) {
    selectedAudienceId = state.selectedAudienceId;
  }
}

// ============================================
// FILTERS & RESULTS MANAGEMENT
// ============================================

function clearfilters() {
  document.getElementById("cityInput").value = "";
  document.getElementById("cityApiValue").value = "";
  document.getElementById("stateInput").value = "";
  document.getElementById("zipInput").value = "";
  document.getElementById("neighborhoodInput").value = "";
  document.getElementById("streetInput").value = "";
  document.getElementById("minYearBuilt").value = "";
  document.getElementById("maxYearBuilt").value = "";
  document.getElementById("minValue").value = "";
  document.getElementById("maxValue").value = "";
  document.getElementById("minBedrooms").value = "";
  document.getElementById("maxBedrooms").value = "";
  document.getElementById("minBathrooms").value = "";
  document.getElementById("maxBathrooms").value = "";
  document.getElementById("quickList").value = "";

  allRecords = [];
  filteredRecords = [];
  allLoadedRecords = [];
  selectedRecords.clear();
  currentPage = 1;
  totalResultsFound = 0;
  totalPages = 0;
  currentSearchPayload = null;

  document.querySelector(".result-counts").innerHTML = `
    <span class="count-item">Total Results Found: <strong>0</strong></span>
  `;

  document.querySelector(".pagination-info").textContent =
    "No search results yet";

  document.querySelector(".table-container").innerHTML = `
    <table class="results-table">
      <thead>
        <tr>
          <th class="checkbox-col"><input type="checkbox" id="selectPageCheckbox" disabled></th>
          <th>First Name</th>
          <th>Last Name</th>
          <th>Address</th>
          <th>City</th>
          <th>State</th>
          <th>Zip Code</th>
        </tr>
      </thead>
      <tbody>
        <tr><td colspan="7" class="empty-row">Click "Search" to load properties</td></tr>
      </tbody>
    </table>
  `;

  const paginationBtns = document.querySelectorAll(".pagination-btn");
  paginationBtns.forEach((btn) => (btn.disabled = true));

  document.getElementById("pageNumbers").innerHTML = "";
}

function renderAddresses(addressData) {
  const container = document.getElementById("results");
  if (!container) return;

  let html = `
    <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%;">
      <thead>
        <tr>
          <th>
            <input type="checkbox" id="selectAllCheckbox" style="cursor:pointer;">
            <label for="selectAllCheckbox" style="margin-left:4px;cursor:pointer;"></label>
          </th>
          <th>First Name</th>
          <th>Last Name</th>
          <th>Street</th>
          <th>State</th>
          <th>Zipcode</th>
          <th>City</th>
        </tr>
      </thead>
      <tbody>
    `;

  addressData.forEach((item, index) => {
    let firstName = "";
    let lastName = "";

    if (item.owner?.names && item.owner.names.length > 0) {
      firstName = item.owner.names[0].first || "";
      lastName = item.owner.names[0].last || "";

      if (!firstName && lastName) firstName = lastName;
      if (!lastName && firstName) lastName = firstName;
    } else {
      const fullName = item.owner?.fullName || "Unknown";
      firstName = fullName;
      lastName = fullName;
    }

    html += `
      <tr>
        <td><input type="checkbox" class="audience-checkbox" data-index="${index}"></td>
        <td data-first="${firstName}">${firstName}</td>
        <td data-last="${lastName}">${lastName}</td>
        <td data-street="${item.address?.street || ""}">${
      item.address?.street || ""
    }</td>
        <td data-state="${item.address?.state || ""}">${
      item.address?.state || ""
    }</td>
        <td data-zip="${item.address?.zip || ""}">${
      item.address?.zip || ""
    }</td>
        <td data-city="${item.address?.city || ""}">${
      item.address?.city || ""
    }</td>
      </tr>
    `;
  });

  html += `</tbody></table>
           <button id="saveAudienceBtn" style="margin-top:15px;padding:10px 20px;cursor:pointer;background:#2b7fff;color:#fff;border:none;border-radius:5px;">
             Save Audience
           </button>`;

  container.innerHTML = html;
  updateButtonStates();

  const selectAllCheckbox = document.getElementById("selectAllCheckbox");
  const individualCheckboxes = container.querySelectorAll(".audience-checkbox");

  selectAllCheckbox.addEventListener("change", function () {
    individualCheckboxes.forEach((checkbox) => {
      checkbox.checked = this.checked;
    });
  });

  individualCheckboxes.forEach((checkbox) => {
    checkbox.addEventListener("change", function () {
      const allChecked = Array.from(individualCheckboxes).every(
        (cb) => cb.checked
      );
      const someChecked = Array.from(individualCheckboxes).some(
        (cb) => cb.checked
      );

      selectAllCheckbox.checked = allChecked;
      selectAllCheckbox.indeterminate = someChecked && !allChecked;
    });
  });

  document.getElementById("saveAudienceBtn").addEventListener("click", () => {
    recipientsList = [];

    const checkboxes = container.querySelectorAll(".audience-checkbox:checked");
    checkboxes.forEach((checkbox) => {
      const row = checkbox.closest("tr");
      const recipient = {
        firstName: row.cells[1].getAttribute("data-first"),
        lastName: row.cells[2].getAttribute("data-last"),
        address: row.cells[3].getAttribute("data-street"),
        state: row.cells[4].getAttribute("data-state"),
        zipcode: row.cells[5].getAttribute("data-zip"),
        city: row.cells[6].getAttribute("data-city"),
      };
      recipientsList.push(recipient);
    });

    saveState();
    container.innerHTML = "";
  });
}

// ============================================
// CACHE MANAGEMENT
// ============================================

function generateSearchHash(payload) {
  const hashPayload = JSON.parse(JSON.stringify(payload));
  if (hashPayload.options) {
    delete hashPayload.options.skip;
    delete hashPayload.options.take;
  }
  return JSON.stringify(hashPayload);
}

function getCachedPage(pageNum) {
  if (!currentSearchHash) {
    console.log("No search hash available yet");
    return null;
  }

  const cacheKey = `${currentSearchHash}_page_${pageNum}`;
  const memoryCache = pageCache.get(cacheKey);
  if (memoryCache) {
    return memoryCache;
  }

  return null;
}

function setCachedPage(pageNum, records) {
  if (!currentSearchHash) {
    console.warn("Cannot cache without search hash");
    return;
  }

  const cacheKey = `${currentSearchHash}_page_${pageNum}`;

  const cacheData = {
    records: records,
    timestamp: Date.now(),
  };

  pageCache.set(cacheKey, cacheData);
}

function clearPageCache() {
  pageCache.clear();
  allLoadedRecords = [];

  try {
    const keysToRemove = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.includes("_page_")) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => sessionStorage.removeItem(key));
    document.querySelector(".result-counts").innerHTML = `
  <span class="count-item">Total Results Found: <strong>0</strong></span>
  <span class="count-item">Selected: <strong>0</strong></span>
`;
  } catch (e) {
    console.warn("Could not clear sessionStorage:", e);
  }
}

// ============================================
// SEARCH FUNCTIONS
// ============================================

async function searchProperties(event, pageNum = 1) {
  if (event) event.preventDefault();
  const city = document.getElementById("cityApiValue").value.trim();
  const state = document.getElementById("stateInput").value.trim();
  const zip = document.getElementById("zipInput").value.trim();
  const street = document.getElementById("streetInput").value.trim();
  const minYearBuilt = document.getElementById("minYearBuilt").value.trim();
  const maxYearBuilt = document.getElementById("maxYearBuilt").value.trim();

  const minValue = document.getElementById("minValue").value.trim();
  const maxValue = document.getElementById("maxValue").value.trim();

  const minBedrooms = document.getElementById("minBedrooms").value;
  const maxBedrooms = document.getElementById("maxBedrooms").value;
  const minBathrooms = document.getElementById("minBathrooms").value;
  const maxBathrooms = document.getElementById("maxBathrooms").value;

  const quickList = document.getElementById("quickList").value;

  const pageSizeSelect = document.getElementById("pageSizeSelect");
  if (pageSizeSelect) {
    recordsPerPage = parseInt(pageSizeSelect.value);
  }

  if (!((street && zip) || (street && city && state) || zip)) {
    alert(
      "Please enter either 'Street + Zip Code' or 'Street + City + State' or 'zip code'."
    );
    return;
  }

  let queryValue = "";
  if (zip) {
    queryValue = `${zip}`;
  }

  const skip = (pageNum - 1) * recordsPerPage;

  let payload;
  if (street) {
    payload = {
      searchCriteria: {
        query: queryValue,
        compAddress: { street, city, state, zip },
      },
      options: {
        useYearBuilt: true,
        skip: skip,
        take: recordsPerPage,
        projection: "all",
      },
    };
  } else {
    payload = {
      searchCriteria: {
        query: queryValue,
      },
      options: {
        useYearBuilt: true,
        skip: skip,
        take: recordsPerPage,
        projection: "all",
      },
    };
  }

  if (minValue || maxValue) {
    payload.searchCriteria.valuation = { estimatedValue: {} };
    if (minValue)
      payload.searchCriteria.valuation.estimatedValue.min = parseInt(minValue);
    if (maxValue)
      payload.searchCriteria.valuation.estimatedValue.max = parseInt(maxValue);
  }

  const building = {};
  if (minBedrooms || maxBedrooms) {
    building.bedroomCount = {};
    if (minBedrooms) building.bedroomCount.min = parseInt(minBedrooms);
    if (maxBedrooms) building.bedroomCount.max = parseInt(maxBedrooms);
  }
  if (minBathrooms || maxBathrooms) {
    building.bathroomCount = {};
    if (minBathrooms) building.bathroomCount.min = parseInt(minBathrooms);
    if (maxBathrooms) building.bathroomCount.max = parseInt(maxBathrooms);
  }
  if (Object.keys(building).length > 0) {
    payload.searchCriteria.building = building;
  }

  if (minYearBuilt || maxYearBuilt) {
    if (!payload.searchCriteria.building) {
      payload.searchCriteria.building = {};
    }
    payload.searchCriteria.building.yearBuilt = {};
    if (minYearBuilt)
      payload.searchCriteria.building.yearBuilt.min = parseInt(minYearBuilt);
    if (maxYearBuilt)
      payload.searchCriteria.building.yearBuilt.max = parseInt(maxYearBuilt);
  }

  if (quickList) {
    payload.searchCriteria.orQuickLists = [quickList];
  }

  const newSearchHash = generateSearchHash(payload);

  if (currentSearchHash !== newSearchHash) {
    clearPageCache();
    currentSearchHash = newSearchHash;
  }

  currentSearchPayload = payload;

  const cachedData = getCachedPage(pageNum);

  if (cachedData && cachedData.records) {
    let records = cachedData.records;

    if (zip && records.length > 0) {
      records = records.filter((record) => {
        const recordZip =
          record?.address?.zip || record?.address?.zipCode || "";
        return recordZip.toString().startsWith(zip);
      });
    }

    allRecords = records;
    filteredRecords = records;
    currentPage = pageNum;

    if (records.length > 0) {
      renderResults();
    } else {
      renderNoResults();
    }
    return;
  }

  try {
    const tableContainer = document.querySelector(".table-container");
    if (tableContainer) {
      tableContainer.innerHTML = "<div>Loading properties...</div>";
    }

    const response = await fetch(
      "https://api.batchdata.com/api/v1/property/search",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer d5BRdPY7N0DJAzTBfjYQX8tKWMfDmFVJ53dRBmWe",
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    const responseData = await response.json();

    const data = Array.isArray(responseData) ? responseData[0] : responseData;

    if (
      data &&
      data.results &&
      data.results.meta &&
      data.results.meta.results
    ) {
      totalResultsFound = data.results.meta.results.resultsFound || 0;
      totalPages = Math.ceil(totalResultsFound / recordsPerPage);
    }

    let records = [];
    if (data && data.results && Array.isArray(data.results.properties)) {
      records = data.results.properties;
    }

    setCachedPage(pageNum, records);

    if (zip && records.length > 0) {
      records = records.filter((record) => {
        const recordZip =
          record?.address?.zip || record?.address?.zipCode || "";
        return recordZip.toString().startsWith(zip);
      });
    }

    allRecords = records;
    filteredRecords = records;
    currentPage = pageNum;

    records.forEach((record) => {
      const recordId =
        record._id || `${record.address?.street}_${record.address?.zip}`;
      const exists = allLoadedRecords.some((r) => {
        const existingId = r._id || `${r.address?.street}_${r.address?.zip}`;
        return existingId === recordId;
      });
      if (!exists) {
        allLoadedRecords.push(record);
      }
    });

    if (records.length > 0) {
      renderResults();
    } else {
      renderNoResults();
    }
  } catch (error) {
    console.error("Error fetching properties:", error);
    renderError();
  }
}

// ============================================
// RENDER FUNCTIONS
// ============================================

function renderResults() {
  const startIndex = (currentPage - 1) * recordsPerPage;
  const endIndex = Math.min(
    startIndex + filteredRecords.length,
    totalResultsFound
  );

  updateResultsHeader();

  document.querySelector(".pagination-info").textContent = `Showing ${
    startIndex + 1
  }-${endIndex} of ${totalResultsFound.toLocaleString()}`;

  const selectAllText = `Select All (${totalResultsFound.toLocaleString()})`;

  let tableHTML = `
    <table class="results-table">
      <thead>
        <tr>
          <th class="checkbox-col">
            <label class="select-all-label">
              <input
                type="checkbox"
                id="selectPageCheckbox"
                onchange="toggleSelectPage()"
                ${isPageFullySelected() ? "checked" : ""}
              />
              <span id="selectAllLabel">${selectAllText}</span>
            </label>
          </th>
          <th>First Name</th>
          <th>Last Name</th>
          <th>Address</th>
          <th>City</th>
          <th>State</th>
          <th>Zip Code</th>
        </tr>
      </thead>
      <tbody>
  `;

  filteredRecords.forEach((record, index) => {
    const globalIndex = startIndex + index;
    const recordId =
      record._id || `${record.address?.street}_${record.address?.zip}`;
    const isChecked = selectedRecords.has(recordId);

    let firstName = "";
    let lastName = "";

    if (record.owner?.names && record.owner.names.length > 0) {
      firstName = record.owner.names[0].first || "";
      lastName = record.owner.names[0].last || "";

      if (!firstName && lastName) firstName = lastName;
      if (!lastName && firstName) lastName = firstName;
    } else {
      const fullName =
        record.owner?.fullName ||
        record.owner?.firstName ||
        record.owner?.lastName ||
        "Unknown";
      firstName = fullName;
      lastName = fullName;
    }

    if (!firstName) firstName = "N/A";
    if (!lastName) lastName = "N/A";

    const street =
      record.address?.street || record.address?.streetAddress || "";
    const city = record.address?.city || "";
    const state = record.address?.state || "";
    const zip = record.address?.zip || record.address?.zipCode || "";

    tableHTML += `
      <tr class="${isChecked ? "selected-row" : ""}">
        <td class="checkbox-col">
          <input type="checkbox" class="record-checkbox" 
                 ${isChecked ? "checked" : ""} 
                 onchange="toggleRecord('${recordId}')">
        </td>
        <td>${firstName}</td>
        <td>${lastName}</td>
        <td>${street}</td>
        <td>${city}</td>
        <td>${state}</td>
        <td>${zip}</td>
      </tr>
    `;
  });

  tableHTML += `
      </tbody>
    </table>
  `;

  document.querySelector(".table-container").innerHTML = tableHTML;

  updatePaginationControls();
}

function renderNoResults() {
  updateResultsHeader();

  document.querySelector(".pagination-info").textContent =
    "No search results yet";

  document.querySelector(".table-container").innerHTML = `
    <table class="results-table">
      <thead>
        <tr>
          <th class="checkbox-col"><input type="checkbox" id="selectPageCheckbox" disabled></th>
          <th>First Name</th>
          <th>Last Name</th>
          <th>Address</th>
          <th>City</th>
          <th>State</th>
          <th>Zip Code</th>
        </tr>
      </thead>
      <tbody>
        <tr><td colspan="7" class="empty-row">No results found</td></tr>
      </tbody>
    </table>
  `;

  updatePaginationControls();
}

function renderError() {
  updateResultsHeader();

  document.querySelector(".pagination-info").textContent =
    "Error loading results";

  document.querySelector(".table-container").innerHTML = `
    <table class="results-table">
      <thead>
        <tr>
          <th class="checkbox-col"><input type="checkbox" id="selectPageCheckbox" disabled></th>
          <th>First Name</th>
          <th>Last Name</th>
          <th>Address</th>
          <th>City</th>
          <th>State</th>
          <th>Zip Code</th>
        </tr>
      </thead>
      <tbody>
        <tr><td colspan="7" class="empty-row">Error fetching properties. Please try again.</td></tr>
      </tbody>
    </table>
  `;

  updatePaginationControls();
}

function updateResultsHeader() {
  const totalSelected = selectedRecords.size;

  document.querySelector(".result-counts").innerHTML = `
    <span class="count-item">Total Results Found: <strong>${totalResultsFound.toLocaleString()}</strong></span>
    <span class="count-item">Selected: <strong>${totalSelected.toLocaleString()}</strong></span>
  `;
}

function updatePaginationControls() {
  const pageNumbers = document.getElementById("pageNumbers");
  pageNumbers.innerHTML = generatePageNumbers(currentPage, totalPages);

  const paginationBtns = document.querySelectorAll(".pagination-btn");
  if (paginationBtns.length >= 2) {
    paginationBtns[0].disabled = currentPage === 1 || totalPages === 0;
    paginationBtns[1].disabled = currentPage === totalPages || totalPages === 0;
  }
}

function isPageFullySelected() {
  return (
    filteredRecords.length > 0 &&
    filteredRecords.every((record) => {
      const recordId =
        record._id || `${record.address?.street}_${record.address?.zip}`;
      return selectedRecords.has(recordId);
    })
  );
}

function toggleSelectPage() {
  const checkbox = document.getElementById("selectPageCheckbox");

  if (checkbox.checked) {
    allLoadedRecords.forEach((record) => {
      const recordId =
        record._id || `${record.address?.street}_${record.address?.zip}`;
      selectedRecords.add(recordId);
    });
  } else {
    allLoadedRecords.forEach((record) => {
      const recordId =
        record._id || `${record.address?.street}_${record.address?.zip}`;
      selectedRecords.delete(recordId);
    });
  }

  renderResults();
}

function generatePageNumbers(current, total) {
  let html = "";
  const maxVisible = 5;
  let start = Math.max(1, current - Math.floor(maxVisible / 2));
  let end = Math.min(total, start + maxVisible - 1);

  if (end - start < maxVisible - 1) {
    start = Math.max(1, end - maxVisible + 1);
  }

  for (let i = start; i <= end; i++) {
    html += `
      <button class="page-number ${
        i === current ? "active" : ""
      }" onclick="goToPage(${i})">
        ${i}
      </button>
    `;
  }

  return html;
}

function goToPage(page) {
  if (page < 1 || page > totalPages) return;
  searchProperties(null, page);
  const tableContainer = document.querySelector(".table-container");
  if (tableContainer) {
    tableContainer.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function changePageSize() {
  const newSize = parseInt(document.getElementById("pageSizeSelect").value);
  recordsPerPage = newSize;
  totalPages = Math.ceil(totalResultsFound / recordsPerPage);
  searchProperties(event, 1);
}

function toggleRecord(recordId) {
  if (selectedRecords.has(recordId)) {
    selectedRecords.delete(recordId);
  } else {
    selectedRecords.add(recordId);
  }
  renderResults();
}

function toggleSelectAll() {
  const checkbox = document.getElementById("selectAllCheckbox");

  if (checkbox.checked) {
    allLoadedRecords.forEach((record) => {
      const recordId =
        record._id || `${record.address?.street}_${record.address?.zip}`;
      selectedRecords.add(recordId);
    });
  } else {
    allLoadedRecords.forEach((record) => {
      const recordId =
        record._id || `${record.address?.street}_${record.address?.zip}`;
      selectedRecords.delete(recordId);
    });
  }

  renderResults();
}

function exportToCSV() {
  if (selectedRecords.size === 0) {
    alert("Please select at least one property to export.");
    return;
  }

  const recordsToExport = allLoadedRecords.filter((record) => {
    const recordId =
      record._id || `${record.address?.street}_${record.address?.zip}`;
    return selectedRecords.has(recordId);
  });

  const headers = [
    "FirstName",
    "LastName",
    "Address",
    "City",
    "State",
    "ZipCode",
  ];

  let csvContent = headers.join(",") + "\n";

  recordsToExport.forEach((record) => {
    let firstName = "";
    let lastName = "";

    if (record.owner?.names && record.owner.names.length > 0) {
      firstName = record.owner.names[0].first || "";
      lastName = record.owner.names[0].last || "";

      if (!firstName && lastName) firstName = lastName;
      if (!lastName && firstName) lastName = firstName;
    } else {
      const fullName =
        record.owner?.fullName ||
        record.owner?.firstName ||
        record.owner?.lastName ||
        "Unknown";
      firstName = fullName;
      lastName = fullName;
    }

    if (!firstName) firstName = "N/A";
    if (!lastName) lastName = "N/A";

    const street =
      record.address?.street || record.address?.streetAddress || "";
    const city = record.address?.city || "";
    const state = record.address?.state || "";
    const zip = record.address?.zip || record.address?.zipCode || "";

    const row = [
      `"${firstName}"`,
      `"${lastName}"`,
      `"${street}"`,
      `"${city}"`,
      `"${state}"`,
      `"${zip}"`,
    ];
    csvContent += row.join(",") + "\n";
  });

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute(
    "download",
    `properties_export_${new Date().getTime()}.csv`
  );
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function saveAudience() {
  if (selectedRecords.size === 0) {
    alert("Please select at least one property.");
    return;
  }

  recipientsList = [];

  allLoadedRecords.forEach((record) => {
    const recordId =
      record._id || `${record.address?.street}_${record.address?.zip}`;

    if (selectedRecords.has(recordId)) {
      let firstName = "";
      let lastName = "";

      if (record.owner?.names && record.owner.names.length > 0) {
        firstName = record.owner.names[0].first || "";
        lastName = record.owner.names[0].last || "";

        if (!firstName && lastName) firstName = lastName;
        if (!lastName && firstName) lastName = firstName;
      } else {
        const fullName =
          record.owner?.fullName ||
          record.owner?.firstName ||
          record.owner?.lastName ||
          "Unknown";
        firstName = fullName;
        lastName = fullName;
      }

      if (!firstName) firstName = "N/A";
      if (!lastName) lastName = "N/A";

      const recipient = {
        firstName: firstName,
        lastName: lastName,
        address: record.address?.street || record.address?.streetAddress || "",
        city: record.address?.city || "",
        state: record.address?.state || "",
        zipCode: record.address?.zip || record.address?.zipCode || "",
      };
      recipientsList.push(recipient);
    }
  });

  showAudienceNameModal();
}

// ============================================
// CSV UPLOAD & PARSING
// ============================================

async function parseCSV(file) {
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      const recipients = results.data.map((r) => {
        const row = Object.fromEntries(
          Object.entries(r).map(([k, v]) => [k.toLowerCase(), v])
        );
        return {
          firstName: row.firstname || "Test",
          lastName: row.lastname || "Name",
          address: row.address || "",
          city: row.city || "",
          state: row.state || "",
          zipCode: row.zipcode || "",
        };
      });

      recipientsList = recipients;
      
      const uploadBox = document.getElementById("uploadBox");
      uploadBox.innerHTML = `
        <div class="upload-icon" style="color: #28a745;">✓</div>
        <div class="upload-main-text" style="color: #28a745;">File uploaded successfully!</div>
        <div class="upload-sub-text">${recipients.length} recipients loaded from ${file.name}</div>
        <div class="upload-sub-text" style="color: #ff6b6b; font-weight: 600; margin-top: 1rem;">Saving Audience...</div>
      `;
      
      saveState();
      
      // Automatically call save audience modal with a slight delay
      setTimeout(() => {
        showAudienceNameModal();
      }, 500);
    },
    error: (error) => {
      console.error("CSV parsing error:", error);
      showAlert("Error parsing CSV file. Please check the format.");
    },
  });
}

function setupDragAndDrop() {
  const uploadBox = document.getElementById("uploadBox");
  const csvFileInput = document.getElementById("csvFile");
  if (!uploadBox || !csvFileInput) {
    console.warn("uploadBox or csvFileInput not found in DOM");
    return;
  }
  ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
    uploadBox.addEventListener(eventName, preventDefaults, false);
    document.body.addEventListener(eventName, preventDefaults, false);
  });
  ["dragenter", "dragover"].forEach((eventName) =>
    uploadBox.addEventListener(
      eventName,
      () => uploadBox.classList.add("dragover"),
      false
    )
  );
  ["dragleave", "drop"].forEach((eventName) =>
    uploadBox.addEventListener(
      eventName,
      () => uploadBox.classList.remove("dragover"),
      false
    )
  );

  uploadBox.addEventListener("drop", async (e) => {
    const dt = e.dataTransfer;
    const file = dt.files[0];
    if (file) await parseCSV(file);
  });

  csvFileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (file) await parseCSV(file);
  });

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }
}

function resetUpload() {
  const uploadBox = document.getElementById("uploadBox");
  if (!uploadBox) return;

  uploadBox.innerHTML = `
    <div class="upload-icon"><img src="./assets/images/icon.png" alt="Upload" width="52" height="52" /></div>
    <div class="upload-main-text">Drag & drop your CSV file here</div>
    <div class="upload-sub-text">or click to browse your files</div>
    <input type="file" id="csvFile" accept=".csv" class="hidden-input" />
    <label for="csvFile" class="choose-file-btn">Choose File</label>
    <div class="file-size-info">Max file size: 10MB</div>
  `;

  recipientsList = [];
  sessionStorage.removeItem("recipients");
  saveState();
  setupDragAndDrop();
}

// ============================================
// TEMPLATE MANAGEMENT
// ============================================

async function loadTemplates() {
  const templatesGrid = document.getElementById("templatesGrid");
  if (!templatesGrid) return;

  try {
    const response = await fetch("https://pcm-app-h8mn8.ondigitalocean.app/templates");
    const templates = await response.json();

    templatesGrid.innerHTML = "";
    templatesGrid.style.display = "grid";
    templatesGrid.style.gridTemplateColumns = "repeat(3, 1fr)";
    templatesGrid.style.gap = "1.5rem";

    function renderTemplateCard(tpl) {
      const div = document.createElement("div");
      div.classList.add("template-card");
      div.dataset.templateId = tpl.id;

      const encodedHtml = encodeURIComponent(tpl.html_content || "");

      div.innerHTML = `
    <div class="template-preview">
      <div class="template-content collapsed">
        ${tpl.html_content}
      </div>
      <div class="template-actions">
        <button class="full-preview-btn" data-html="${encodedHtml}">
          Full Preview
        </button>
      </div>
      <div class="template-hover-name">
        ${tpl.template_name || "Untitled Template"}
      </div>
    </div>
  `;

      const fullPreviewBtn = div.querySelector(".full-preview-btn");
      fullPreviewBtn.addEventListener("click", (event) => {
        const encoded = event.currentTarget.dataset.html;
        openFullPreview(event, encoded);
      });

      div.addEventListener("click", (e) => {
        if (e.target.closest("button")) return;
        document
          .querySelectorAll(".template-card")
          .forEach((el) => el.classList.remove("selected"));
        div.classList.add("selected");
        window.currentEditingTemplateId = tpl.id;
        uploadedPdfUrl = null;
        updateButtonStates();
      });

      return div;
    }

    templates.slice(0, 6).forEach((tpl) => {
      templatesGrid.appendChild(renderTemplateCard(tpl));
    });

    if (templates.length > 6) {
      const showAllBtn = document.createElement("button");
      showAllBtn.textContent = "Show All Templates";
      showAllBtn.classList.add("show-all-btn");
      showAllBtn.style.gridColumn = "span 3";
      showAllBtn.style.padding = "0.75rem 1.5rem";
      showAllBtn.style.margin = "1rem auto";
      showAllBtn.style.cursor = "pointer";

      showAllBtn.addEventListener("click", () => {
        showAllBtn.remove();
        templates.slice(6).forEach((tpl) => {
          templatesGrid.appendChild(renderTemplateCard(tpl));
        });
      });

      templatesGrid.appendChild(showAllBtn);
    }
  } catch (err) {
    console.error("Error loading templates:", err);
    templatesGrid.innerHTML = "<p>Failed to load templates.</p>";
  }
}

function openFullPreview(event, encodedHtml) {
  event.preventDefault();
  event.stopPropagation();

  const html = decodeURIComponent(encodedHtml);
  const overlay = document.getElementById("previewOverlay");
  const body = document.getElementById("previewBody");

  if (!overlay || !body) {
    console.error("Preview elements not found in DOM");
    return;
  }

  body.innerHTML = html;
  overlay.style.display = "flex";
}

// ============================================
// GEOLOCATION FUNCTIONS
// ============================================

function initAutocomplete() {
  cityAutocomplete = new google.maps.places.Autocomplete(
    document.getElementById("cityInput"),
    { types: ["(cities)"] }
  );

  cityAutocomplete.addListener("place_changed", () => {
    const place = cityAutocomplete.getPlace();
    if (!place.geometry || !place.address_components) return;

    const stateComponent = place.address_components.find((c) =>
      c.types.includes("administrative_area_level_1")
    );
    const stateCode = stateComponent ? stateComponent.short_name : "";
    document.getElementById("stateInput").value = stateCode;

    const cityComponent = place.address_components.find((c) =>
      c.types.includes("locality")
    );
    const cityName = cityComponent ? cityComponent.long_name : "";

    document.getElementById("cityApiValue").value = cityName;
    document.getElementById("cityInput").value = place.formatted_address;

    loadZipCodes(cityName, stateCode);
  });
}

function loadZipCodes(cityName, stateCode) {
  const geocoder = new google.maps.Geocoder();
  const query = `${cityName}, ${stateCode}, USA`;

  geocoder.geocode({ address: query }, (results, status) => {
    if (status === google.maps.GeocoderStatus.OK) {
      const zipCodes = new Set();

      results.forEach((res) => {
        res.address_components.forEach((comp) => {
          if (comp.types.includes("postal_code")) {
            zipCodes.add(comp.long_name);
          }
        });
      });

      if (zipCodes.size === 0 && results[0].geometry.bounds) {
        const bounds = results[0].geometry.bounds;
        fetchZipCodesInBounds(bounds, geocoder, zipCodes);
      } else {
        populateZipDropdown(zipCodes);
      }
    }
  });
}

function fetchZipCodesInBounds(bounds, geocoder, zipCodes) {
  const latStep = 0.044;
  const lngStep = 0.044;

  for (
    let lat = bounds.getSouthWest().lat();
    lat <= bounds.getNorthEast().lat();
    lat += latStep
  ) {
    for (
      let lng = bounds.getSouthWest().lng();
      lng <= bounds.getNorthEast().lng();
      lng += lngStep
    ) {
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === google.maps.GeocoderStatus.OK) {
          results.forEach((res) => {
            res.address_components.forEach((comp) => {
              if (comp.types.includes("postal_code")) {
                zipCodes.add(comp.long_name);
                populateZipDropdown(zipCodes);
              }
            });
          });
        }
      });
    }
  }
}

function populateZipDropdown(zipCodes) {
  const zipSelect = document.getElementById("zipInput");
  zipSelect.innerHTML = '<option value="">-- Select Zip --</option>';
  Array.from(zipCodes).forEach((zip) => {
    const option = document.createElement("option");
    option.value = zip;
    option.textContent = zip;
    zipSelect.appendChild(option);
  });
}

// ============================================
// FORM STATE & BUTTON MANAGEMENT
// ============================================

function saveFormState() {
  const formState = {
    campaignFields: campaignFields
      ? campaignFields.querySelector("form")?.elements
        ? Object.fromEntries(new FormData(campaignFields.querySelector("form")))
        : {}
      : {},
    mailerFields: mailerFields
      ? mailerFields.querySelector("form")?.elements
        ? Object.fromEntries(new FormData(mailerFields.querySelector("form")))
        : {}
      : {},
    activeCard: document.querySelector(".card.active")?.id || null,
    uploadedCSV: sessionStorage.getItem("uploadedCSV") || null,
  };

  sessionStorage.setItem("formState", JSON.stringify(formState));
}

function loadFormState() {
  const saved = sessionStorage.getItem("formState");
  if (!saved) return;

  const formState = JSON.parse(saved);

  if (formState.activeCard) {
    document.getElementById(formState.activeCard)?.classList.add("active");
  }

  if (formState.campaignFields && campaignFields) {
    for (let [key, value] of Object.entries(formState.campaignFields)) {
      const input = campaignFields.querySelector(`[name="${key}"]`);
      if (input) input.value = value;
    }
  }

  if (formState.mailerFields && mailerFields) {
    for (let [key, value] of Object.entries(formState.mailerFields)) {
      const input = mailerFields.querySelector(`[name="${key}"]`);
      if (input) input.value = value;
    }
  }

  if (formState.uploadedCSV && uploadcsvCard) {
    uploadcsvCard.querySelector(".csv-filename").textContent =
      formState.uploadedCSV;
  }
}

function updateButtonStates() {
  const createAndSaveBtn = document.querySelector(
    "button[onclick='createAndSave()']"
  );
  const createAndSendBtn = document.querySelector(
    "button[onclick='createAndSendLetter()']"
  );

  if (!createAndSaveBtn || !createAndSendBtn) {
    console.warn(
      "⚠️ Buttons not found in DOM - make sure button onclick attributes match exactly"
    );
    return;
  }

  const hasRecipients = recipientsList && recipientsList.length > 0;
  const isCampaignSelected =
    campaignCard && campaignCard.classList.contains("selected");
  const isMailerSelected =
    mailerCard && mailerCard.classList.contains("selected");
  const isModeSelected = isCampaignSelected || isMailerSelected;

  if (uploadedPdfUrl) {
    if (hasRecipients && isModeSelected) {
      createAndSendBtn.disabled = false;
      createAndSendBtn.style.opacity = "1";
      createAndSendBtn.style.cursor = "pointer";
      createAndSendBtn.title = "";
    } else {
      createAndSendBtn.disabled = true;
      createAndSendBtn.style.opacity = "0.5";
      createAndSendBtn.style.cursor = "not-allowed";
    }

    createAndSaveBtn.disabled = true;
    createAndSaveBtn.style.opacity = "0.5";
    createAndSaveBtn.style.cursor = "not-allowed";
    createAndSaveBtn.title =
      "Disabled: Cannot save drafts when using PDF uploads. Use 'Send Letter' instead.";
  } else if (window.currentEditingTemplateId) {
    if (hasRecipients && isModeSelected) {
      createAndSaveBtn.disabled = false;
      createAndSaveBtn.style.opacity = "1";
      createAndSaveBtn.style.cursor = "pointer";
      createAndSaveBtn.title = "";

      createAndSendBtn.disabled = false;
      createAndSendBtn.style.opacity = "1";
      createAndSendBtn.style.cursor = "pointer";
      createAndSendBtn.title = "";
    } else {
      createAndSaveBtn.disabled = true;
      createAndSaveBtn.style.opacity = "0.5";
      createAndSaveBtn.style.cursor = "not-allowed";

      createAndSendBtn.disabled = true;
      createAndSendBtn.style.opacity = "0.5";
      createAndSendBtn.style.cursor = "not-allowed";
    }
  }
}

// ============================================
// API & TOKEN MANAGEMENT
// ============================================

async function getToken(mode) {
  const creds = API_KEYS[mode];
  if (!creds) throw new Error("Invalid mode for token generation");

  const payload = {
    apiKey: creds.apiKey,
    apiSecret: creds.apiSecret,
    childRefNbr: "myAccountReference",
  };

  const res = await fetch("https://v3.pcmintegrations.com/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error("Auth failed");
  const data = await res.json();
  return data.token;
}

async function orderDesign(templateId, button) {
  const originalText = button.textContent;
  button.textContent = "Processing...";
  button.disabled = true;

  try {
    const mode = getCurrentMode();

    const confirmSend = confirm(
      `You are about to send the letter in ${mode.toUpperCase()} mode.\n\nDo you want to proceed?`
    );

    if (!confirmSend) {
      button.textContent = originalText;
      button.disabled = false;
      return false;
    }

    const todayObj = new Date();
    const todayISO = todayObj.toISOString().split("T")[0];
    const formattedDate = todayObj.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    let finalHtml = "";

    if (uploadedPdfUrl) {
      finalHtml = uploadedPdfUrl;
    } else if (templateId) {
      const tplRes = await fetch(
        `https://pcm-app-h8mn8.ondigitalocean.app/templates/${templateId}`
      );
      if (!tplRes.ok) throw new Error("Failed to load template content");
      const tpl = await tplRes.json();
      finalHtml = (tpl.html_content || "").replace(/DATE/g, formattedDate);
    } else {
      throw new Error("Please select a template or upload a PDF");
    }

    // Use correct recipients list
    let finalRecipientsList = recipientsList;
    
    // If using existing audience, ensure we have the data
    if (selectedAudienceId && currentAudienceData) {
      const audienceList = Array.isArray(currentAudienceData.audience_list)
        ? currentAudienceData.audience_list
        : JSON.parse(currentAudienceData.audience_list);
      finalRecipientsList = audienceList;
    }

    if (finalRecipientsList.length === 0) {
      throw new Error("No recipients available");
    }
    const token = await getToken(mode);

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
      recipients: finalRecipientsList,
      letter: finalHtml,
      returnAddress: {
        firstName: "Mark",
        lastName: "Fazzini",
        address: "4175 Woodlands Pkwy",
        city: "Palm Harbor",
        state: "FL",
        zipCode: "34685",
      },
    };

    const res = await fetch("https://v3.pcmintegrations.com/order/letter", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "API request failed");

    showAlert(
      `✅ Letter order placed successfully in ${mode.toUpperCase()} mode.`
    );
    return true;
  } catch (err) {
    console.error("Order Design Error:", err);
    showAlert("Error ordering letters: " + err.message);
    return false;
  } finally {
    button.textContent = originalText;
    button.disabled = false;
  }
}

// ============================================
// UPDATED CREATE AND SEND FUNCTIONS
// ============================================

async function createAndSendLetter() {
  const btn = document.querySelector("button[onclick='createAndSendLetter()']");
  const isCampaign = campaignCard.classList.contains("selected");
  const isMailer = mailerCard.classList.contains("selected");

  if (!isCampaign && !isMailer) {
    showAlert("Please select either 'New Campaign' or 'New Mailer' option.");
    return;
  }

  const mode = getCurrentMode();

  try {
    if (isCampaign) {
      const campaignName = document
        .getElementById("campaignNameInput")
        .value.trim();
      const mailerName = document
        .getElementById("mailerNameInput")
        .value.trim();

      if (!campaignName || !mailerName) {
        showAlert("Campaign name and Mailer name are required.");
        return;
      }

      if (recipientsList.length === 0) {
        showAlert("Please select or upload recipients.");
        return;
      }

      if (!uploadedPdfUrl && !window.currentEditingTemplateId) {
        showAlert("Please select a template or upload a PDF.");
        return;
      }

      const orderSuccess = await orderDesign(
        uploadedPdfUrl ? null : window.currentEditingTemplateId,
        btn
      );
      if (!orderSuccess) {
        showAlert("Order failed. Campaign not saved.");
        return;
      }

      const campaignResp = await fetch("https://pcm-app-h8mn8.ondigitalocean.app/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaign_name: campaignName }),
      });

      if (!campaignResp.ok) {
        const err = await campaignResp.json();
        throw new Error(err.detail || "Failed to create campaign");
      }
      const campaign = await campaignResp.json();

      const campaignDataPayload = {
        campaign_id: campaign.id,
        mailer_name: mailerName,
        template_id: uploadedPdfUrl ? null : window.currentEditingTemplateId,
        audience_id: selectedAudienceId,
        schedule_time: null,
        send_date: new Date().toISOString(),
        status: "sent",
        env_mode: mode,
      };

      const dataResp = await fetch("https://pcm-app-h8mn8.ondigitalocean.app/campaign-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(campaignDataPayload),
      });

      if (!dataResp.ok) {
        const err = await dataResp.json();
        throw new Error(err.detail || "Failed to save campaign data");
      }

      showAlert("Order placed and campaign saved successfully! ✅");
      setTimeout(() => {
        window.location.href = "dashboard.html";
      }, 800);
    }

    if (isMailer) {
      const mailerName = document
        .getElementById("mailerNameOnlyInput")
        .value.trim();

      if (!mailerName) {
        showAlert("Mailer name is required.");
        return;
      }

      if (recipientsList.length === 0) {
        showAlert("Please select or upload recipients.");
        return;
      }

      if (!uploadedPdfUrl && !window.currentEditingTemplateId) {
        showAlert("Please select a template or upload a PDF.");
        return;
      }

      const orderSuccess = await orderDesign(
        uploadedPdfUrl ? null : window.currentEditingTemplateId,
        btn
      );
      if (!orderSuccess) {
        showAlert("Order failed. Mailer not saved.");
        return;
      }

    const mailerPayload = {
      mailer_name: mailerName,
      template_id: uploadedPdfUrl ? null : window.currentEditingTemplateId,
      audience_id: selectedAudienceId,  
      schedule_time: null,
      send_date: new Date().toISOString(),
      status: "sent",
      env_mode: mode,
      canva_link: null
    };

      const mailerResp = await fetch("https://pcm-app-h8mn8.ondigitalocean.app/mailer-one-off", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mailerPayload),
      });

      if (!mailerResp.ok) {
        const err = await mailerResp.json();
        throw new Error(err.detail || "Failed to save mailer one-off data");
      }

      showAlert("Order placed and one-off mailer saved successfully! ✅");
      setTimeout(() => {
        window.location.href = "dashboard.html";
      }, 800);
    }
  } catch (error) {
    console.error("Error:", error);
    showAlert(error.message || "Something went wrong.");
  }
}

async function createAndSave() {
  const isCampaign = campaignCard.classList.contains("selected");
  const isMailer = mailerCard.classList.contains("selected");

  const mode = getCurrentMode();

  if (!isCampaign && !isMailer) {
    showAlert("Please select either 'New Campaign' or 'New Mailer' option.");
    return;
  }

  try {
    if (isCampaign) {
      const campaignName = document
        .getElementById("campaignNameInput")
        .value.trim();
      const mailerName = document
        .getElementById("mailerNameInput")
        .value.trim();

      if (!campaignName || !mailerName) {
        showAlert("Campaign name and Mailer name are required.");
        return;
      }

      if (recipientsList.length === 0) {
        showAlert("Please select or upload recipients.");
        return;
      }

      const campaignResp = await fetch("https://pcm-app-h8mn8.ondigitalocean.app/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaign_name: campaignName }),
      });

      if (!campaignResp.ok) {
        const err = await campaignResp.json();
        throw new Error(err.detail || "Failed to create campaign");
      }
      const campaign = await campaignResp.json();

      const campaignDataPayload = {
        campaign_id: campaign.id,
        mailer_name: mailerName,
        template_id: null,
        audience_id: selectedAudienceId || null,
        schedule_time: null,
        send_date: null,
        status: "pending",
        env_mode: mode,
      };

      const dataResp = await fetch("https://pcm-app-h8mn8.ondigitalocean.app/campaign-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(campaignDataPayload),
      });

      if (!dataResp.ok) {
        const err = await dataResp.json();
        throw new Error(err.detail || "Failed to save campaign data");
      }

      showAlert("Campaign saved successfully! ✅");
      setTimeout(() => {
        window.location.href = "dashboard.html";
      }, 800);
    }

    if (isMailer) {
      const mailerName = document
        .getElementById("mailerNameOnlyInput")
        .value.trim();

      if (!mailerName) {
        showAlert("Mailer name is required.");
        return;
      }

      if (recipientsList.length === 0) {
        showAlert("Please select or upload recipients.");
        return;
      }

      const mailerPayload = {
        mailer_name: mailerName,
        template_id: null,
        audience_id: selectedAudienceId || null,
        schedule_time: null,
        send_date: null,
        status: "pending",
        env_mode: mode,
      };

      const mailerResp = await fetch("https://pcm-app-h8mn8.ondigitalocean.app/mailer-one-off", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mailerPayload),
      });

      if (!mailerResp.ok) {
        const err = await mailerResp.json();
        throw new Error(err.detail || "Failed to save mailer one-off data");
      }

      showAlert("One-off mailer saved successfully! ✅");
      setTimeout(() => {
        window.location.href = "dashboard.html";
      }, 800);
    }
  } catch (error) {
    console.error("Error:", error);
    showAlert(error.message || "Something went wrong.");
  }
}

function downloadSampleCSV() {
  const csvContent = `FirstName,LastName,Address,City,State,Zipcode
John,Doe,123 Main St,New York,NY,10001
Jane,Smith,456 Oak Ave,Los Angeles,CA,90001
Mike,Johnson,789 Pine Rd,Chicago,IL,60601`;

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", "sample_recipients.csv");
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ============================================
// CANVA CONTEXT MANAGEMENT
// ============================================

function handleCanvaNavigation() {
  const isCampaign = campaignCard?.classList.contains("selected");
  const isMailer = mailerCard?.classList.contains("selected");

  if (!isCampaign && !isMailer) {
    showAlert("⚠️ Please select either 'New Campaign' or 'New Mailer' first.");
    return;
  }

  let campaignName = "";
  let mailerName = "";

  if (isCampaign) {
    campaignName = document.getElementById("campaignNameInput")?.value?.trim() || "";
    mailerName = document.getElementById("mailerNameInput")?.value?.trim() || "";
  } else {
    mailerName = document.getElementById("mailerNameOnlyInput")?.value?.trim() || "";
  }

  if (isCampaign && !campaignName) {
    showAlert("⚠️ Please enter Campaign Name before proceeding.");
    return;
  }

  if (!mailerName) {
    showAlert("⚠️ Please enter Mailer Name before proceeding.");
    return;
  }

  if (!recipientsList || recipientsList.length === 0) {
    showAlert("⚠️ Please add recipients before browsing Canva templates.\n\nYou can:\n• Search for properties\n• Upload a CSV file\n• Select an existing audience");
    return;
  }

  console.log("✅ All validations passed!");
  saveCampaignContextForCanva();

  window.location.href = "templateGallery.html?view=canva";
}

function saveCampaignContextForCanva() {
  const isCampaignSelected = campaignCard?.classList.contains("selected");
  const isMailerSelected = mailerCard?.classList.contains("selected");

  let mode = null;
  let campaignName = "";
  let mailerName = "";

  if (isCampaignSelected) {
    mode = "campaign";
    campaignName = document.getElementById("campaignNameInput")?.value?.trim() || "";
    mailerName = document.getElementById("mailerNameInput")?.value?.trim() || "";
  } else if (isMailerSelected) {
    mode = "mailer";
    mailerName = document.getElementById("mailerNameOnlyInput")?.value?.trim() || "";
  }

  const context = {
    mode: mode,
    campaignName: campaignName,
    mailerName: mailerName,
    recipients: recipientsList,
    selectedAudienceId: selectedAudienceId,
    envMode: getCurrentMode(),
    timestamp: Date.now(),
  };

  const key = mode === "mailer" ? "mailerContext" : "campaignContext";
  sessionStorage.setItem(key, JSON.stringify(context));

}

// ============================================
// PAGE INITIALIZATION & EVENT LISTENERS
// ============================================

const csvInput = document.getElementById("csvUpload");
if (csvInput) {
  csvInput.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      const fileName = e.target.files[0].name;
      sessionStorage.setItem("uploadedCSV", fileName);
      saveFormState();
    }
  });
}

document.addEventListener("input", saveFormState);

window.addEventListener("DOMContentLoaded", loadFormState);

window.onload = function () {
  initAutocomplete();
  setupDragAndDrop();
};

if (performance.getEntriesByType("navigation")[0].type === "reload") {
  sessionStorage.clear();
}

document.addEventListener("DOMContentLoaded", async () => {
  const testingBtn = document.getElementById("testingModeBtn");
  const productionBtn = document.getElementById("productionModeBtn");

  let currentMode = getCurrentMode();

  if (currentMode === "production") {
    testingBtn.classList.remove("active");
    productionBtn.classList.add("active");
  } else {
    testingBtn.classList.add("active");
    productionBtn.classList.remove("active");
  }

  testingBtn.addEventListener("click", () => {
    currentMode = "testing";
    setMode("testing");
    testingBtn.classList.add("active");
    productionBtn.classList.remove("active");
    showAlert("Switched to TESTING mode");
  });

  productionBtn.addEventListener("click", () => {
    currentMode = "production";
    setMode("production");
    productionBtn.classList.add("active");
    testingBtn.classList.remove("active");
    showAlert("Switched to PRODUCTION mode");
  });

  const overlay = document.getElementById("previewOverlay");
  if (overlay) {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closePreview();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && overlay.style.display === "flex") {
        closePreview();
      }
    });
  }

  restoreState();
  updateButtonStates();

  document.getElementById("campaignName")?.addEventListener("input", saveState);
  document.getElementById("mailerName")?.addEventListener("input", saveState);
  document
    .getElementById("mailerNameOnlyInput")
    ?.addEventListener("input", saveState);

  const path = window.location.pathname;
  window.currentEditingTemplateId = null;
  sessionStorage.removeItem("Restored template");

  if (path.includes("templategallery")) {
    loadGalleryTemplates();
  } else if (path.includes("campaign_builder")) {
    await loadTemplates();
    setTimeout(() => {
      setupPdfUpload();
      updateButtonStates();
    }, 100);
  }
});