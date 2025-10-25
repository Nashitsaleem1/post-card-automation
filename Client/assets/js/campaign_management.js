// // --- Prevent page reload/close confirmation ---
// window.addEventListener("beforeunload", function (e) {
//   // Custom confirmation message
//   const confirmationMessage =
//     "Are you sure you want to reload or leave this page?";

//   // Standard way to show the confirmation dialog
//   e.preventDefault();
//   e.returnValue = confirmationMessage; // Some browsers use this
//   return confirmationMessage; // For older ones
// });
// ---- Mode Management ----

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
// ---- API Credentials ----
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

let uploadedPdfUrl = null;

// Add PDF upload section after template selection (add to HTML)
function createPdfUploadSection() {
  const pdfUploadHtml = `
  <div class="pdf-upload-section" style="margin: 3rem 0; text-align: center;">
    <h3 style="
      margin-bottom: 2rem;
      font-size: 1.5rem;
      color: var(--text-primary, #333);
      font-weight: 700;
    ">
      Or Upload Your Own PDF Letter
    </h3>

    <div class="upload-box" id="pdfUploadBox" style="
      background: white;
      border: 2px dashed var(--border-color, #ccc);
      border-radius: var(--radius-lg, 12px);
      padding: 3rem;
      text-align: center;
      width: 100%;
      max-width: 480px;
      margin: 0 auto;
      cursor: pointer;
      transition: all 0.3s ease;
      position: relative;
      box-shadow: var(--shadow-sm, 0 2px 8px rgba(0, 0, 0, 0.05));
    ">

      <div class="upload-icon" style="
        font-size: 3rem;
        margin-bottom: 1.25rem;
        color: var(--primary-color, #667eea);
      ">📄</div>

      <div class="upload-main-text" style="
        font-size: 1.25rem;
        font-weight: 600;
        color: var(--text-primary, #222);
        margin-bottom: 0.75rem;
      ">
        Drag & drop your PDF file here
      </div>

      <div class="upload-sub-text" style="
        font-size: 1rem;
        color: var(--text-secondary, #666);
        margin-bottom: 1.75rem;
      ">
        or click to browse your files
      </div>

      <label for="pdfFile" class="choose-file-btn" style="
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.875rem 1.75rem;
        background: var(--primary-gradient, linear-gradient(135deg, #667eea 0%, #764ba2 100%));
        color: white;
        font-weight: 600;
        border: none;
        border-radius: var(--radius-md, 8px);
        cursor: pointer;
        transition: all 0.3s ease;
        box-shadow: var(--shadow-sm, 0 2px 6px rgba(0, 0, 0, 0.1));
      "
      onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 10px rgba(0,0,0,0.15)';"
      onmouseout="this.style.transform=''; this.style.boxShadow='0 2px 6px rgba(0,0,0,0.1)';"
      >
        Choose PDF File
      </label>

      <input
        type="file"
        id="pdfFile"
        accept=".pdf"
        style="display: none;"
      />

      <div class="pdf-size-info" style="
        color: #999;
        font-size: 0.9rem;
        margin-top: 1rem;
      ">
        Max file size: 10MB
      </div>
    </div>
  </div>
`;

  // Insert after templates grid
  const templatesGrid = document.getElementById("templatesGrid");
  if (templatesGrid && !document.querySelector(".pdf-upload-section")) {
    templatesGrid.insertAdjacentHTML("afterend", pdfUploadHtml);
    setupPdfUpload();
  }
}

// Setup PDF upload functionality
function setupPdfUpload() {
  const pdfUploadBox = document.getElementById("pdfUploadBox");
  const pdfFileInput = document.getElementById("pdfFile");

  if (!pdfUploadBox || !pdfFileInput) {
    console.warn("PDF upload elements not found, skipping setup");
    return;
  }

  // Check if already initialized to prevent duplicate listeners
  if (pdfUploadBox.dataset.initialized === "true") {
    return;
  }
  pdfUploadBox.dataset.initialized = "true";

  // Prevent defaults for drag and drop
  ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
    pdfUploadBox.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
  });

  // Highlight on drag
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

  // Handle drop
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

  // Handle file input change
  pdfFileInput.addEventListener("change", async (e) => {
    e.preventDefault();
    const file = e.target.files[0];
    if (file) {
      await uploadPdfFile(file);
      e.target.value = ""; // Clear input
    }
  });
}

// Upload PDF to backend
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

    // Deselect any template when PDF is uploaded
    document.querySelectorAll(".template-card").forEach((card) => {
      card.classList.remove("selected");
    });
    window.currentEditingTemplateId = null;

    // ✅ UPDATE BUTTON STATES AFTER PDF UPLOAD
    updateButtonStates();

    // console.log("✅ PDF uploaded:", uploadedPdfUrl);
  } catch (error) {
    console.error("PDF upload error:", error);
    showAlert("Error uploading PDF: " + error.message);
    resetPdfUploadBox();
  }
}

// Helper function to reset PDF upload box
function resetPdfUploadBox() {
  const pdfUploadBox = document.getElementById("pdfUploadBox");
  if (!pdfUploadBox) return;

  // ✅ Remove the initialized flag so we can reinitialize
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

  // ✅ Now reinitialize
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

    // ✅ UPDATE BUTTON STATES AFTER PDF REMOVAL
    updateButtonStates();

    // console.log("✅ PDF removed");
  } catch (error) {
    console.error("Error removing PDF:", error);
    showAlert("Error removing PDF: " + error.message);
  }
}

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
  BatchsearchCard.classList.remove("selected");
  uploadsection.style.display = "block";
  batchsection.style.display = "none";
  updateButtonStates();
});

BatchsearchCard.addEventListener("click", () => {
  BatchsearchCard.classList.add("selected");
  uploadcsvCard.classList.remove("selected");
  batchsection.style.display = "flex";
  uploadsection.style.display = "none";
  updateButtonStates();
});

// Toggle menu when hamburger clicked
hamburger.addEventListener("click", (e) => {
  e.stopPropagation(); // prevent triggering document click
  navLinks.classList.toggle("nav-active");
});

// Close menu if clicking outside
document.addEventListener("click", (e) => {
  if (
    navLinks.classList.contains("nav-active") &&
    !navLinks.contains(e.target) &&
    e.target !== hamburger
  ) {
    navLinks.classList.remove("nav-active");
  }
});

/* ---------------- STATE PERSISTENCE ---------------- */
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
      : null,
    campaignName: document.getElementById("campaignName")?.value || "",
    mailerName: document.getElementById("mailerName")?.value || "",
    mailerNameonly: document.getElementById("mailerNameOnlyInput")?.value || "",
    recipients: recipientsList,
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
    uploadsection.style.display = "block";
    batchsection.style.display = "none";
  } else if (state.uploadMode === "batch") {
    BatchsearchCard.classList.add("selected");
    uploadcsvCard.classList.remove("selected");
    batchsection.style.display = "block";
    uploadsection.style.display = "none";
  }

  if (state.campaignName)
    document.getElementById("campaignName").value = state.campaignName;
  if (state.mailerName)
    document.getElementById("mailerName").value = state.mailerName;
  if (state.mailerNameonly)
    document.getElementById("mailerNameOnlyInput").value = state.mailerNameonly;
  if (state.recipients && state.recipients.length) {
    recipientsList = state.recipients;
    // console.log("Restored recipients:", recipientsList);
    document.getElementById("uploadBox").innerHTML = `
      <div class="upload-icon" style="color: #28a745;">✓</div>
      <div class="upload-main-text" style="color: #28a745;">File uploaded successfully!</div>
      <div class="upload-sub-text">${recipientsList.length} recipients restored</div>
      <button class="choose-file-btn" onclick="resetUpload()" style="background: #6c757d; margin-top: 1rem;">
        Upload Different File
      </button>`;
  }
}

function scrollToCreateCampaign() {
  document
    .getElementById("createcampaign")
    .scrollIntoView({ behavior: "smooth" });
}

function clearfilters() {
  const filterBox = document.querySelector(".filter-box");
  if (!filterBox) return;

  // 1) Clear all input fields (text, number, hidden, readonly)
  filterBox.querySelectorAll("input").forEach((input) => {
    input.value = "";
  });

  // 2) Reset all selects
  filterBox.querySelectorAll("select").forEach((select) => {
    // try to find a placeholder option (empty value or text like "-- Select")
    let placeholderIndex = -1;
    for (let i = 0; i < select.options.length; i++) {
      const opt = select.options[i];
      if (opt.value === "" || /--\s*Select/i.test(opt.text)) {
        placeholderIndex = i;
        break;
      }
    }

    if (placeholderIndex >= 0) {
      select.selectedIndex = placeholderIndex;
    } else {
      select.selectedIndex = 0;
    }

    // Ensure dependent UI updates: dispatch change
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });

  // 3) If you want to completely clear dynamic options and restore only the placeholder:
  const neighborhood = document.getElementById("neighborhoodInput");
  if (neighborhood) {
    neighborhood.innerHTML =
      '<option value="">-- Select Neighborhood --</option>';
    neighborhood.selectedIndex = 0;
    neighborhood.dispatchEvent(new Event("change", { bubbles: true }));
  }

  const zip = document.getElementById("zipInput");
  if (zip) {
    zip.innerHTML = '<option value="">-- Select Zip --</option>';
    zip.selectedIndex = 0;
    zip.dispatchEvent(new Event("change", { bubbles: true }));
  }

  // 4) clear hidden city API value (if used)
  const cityApi = document.getElementById("cityApiValue");
  if (cityApi) cityApi.value = "";

  const results = document.getElementById("results");
  if (results) results.innerHTML = "";
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
  // Add Select All functionality
  const selectAllCheckbox = document.getElementById("selectAllCheckbox");
  const individualCheckboxes = container.querySelectorAll(".audience-checkbox");

  selectAllCheckbox.addEventListener("change", function () {
    individualCheckboxes.forEach((checkbox) => {
      checkbox.checked = this.checked;
    });
  });

  // Update Select All checkbox when individual checkboxes change
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

  // Attach event listener for save button
  document.getElementById("saveAudienceBtn").addEventListener("click", () => {
    recipientsList = []; // reset before saving

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

    // console.log("Recipients List:", recipientsList);
    saveState();
    container.innerHTML = "";
  });
}

// Global variables for pagination
let allRecords = [];
let filteredRecords = [];
let selectedRecords = new Set();
let currentPage = 1;
let recordsPerPage = 20;
let totalResultsFound = 0;
let totalPages = 0;
let currentSearchPayload = null;
let allLoadedRecords = [];

// Page cache to store already loaded pages
let pageCache = new Map(); // Key: page number, Value: {records, timestamp}
let currentSearchHash = null; // To detect if search criteria changed

function generateSearchHash(payload) {
  // Remove skip/take from hash since those change per page
  const hashPayload = JSON.parse(JSON.stringify(payload));
  if (hashPayload.options) {
    delete hashPayload.options.skip;
    delete hashPayload.options.take;
  }
  return JSON.stringify(hashPayload);
}

// Check if we have cached data for this page
function getCachedPage(pageNum) {
  if (!currentSearchHash) {
    console.log("No search hash available yet");
    return null;
  }

  const cacheKey = `${currentSearchHash}_page_${pageNum}`;
  console.log("Looking for cache key:", cacheKey);

  // First try memory cache
  const memoryCache = pageCache.get(cacheKey);
  if (memoryCache) {
    console.log("Found in memory cache");
    return memoryCache;
  }

  console.log("No cache found for page", pageNum);
  return null;
}

// Store page data in cache
function setCachedPage(pageNum, records) {
  if (!currentSearchHash) {
    console.warn("Cannot cache without search hash");
    return;
  }

  const cacheKey = `${currentSearchHash}_page_${pageNum}`;
  console.log("Caching page", pageNum, "with key:", cacheKey);

  const cacheData = {
    records: records,
    timestamp: Date.now(),
  };

  // Store in memory
  pageCache.set(cacheKey, cacheData);
  console.log("Cached in memory. Total cached pages:", pageCache.size);
}

// Clear cache when search criteria changes
function clearPageCache() {
  console.log("Clearing page cache");
  pageCache.clear();
  allLoadedRecords = [];

  // Optional: Clear sessionStorage
  try {
    const keysToRemove = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.includes("_page_")) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => sessionStorage.removeItem(key));
    console.log("Cleared", keysToRemove.length, "items from sessionStorage");
  } catch (e) {
    console.warn("Could not clear sessionStorage:", e);
  }
}

async function searchProperties(event, pageNum = 1) {
  if (event) event.preventDefault();
  const city = document.getElementById("cityApiValue").value.trim();
  const state = document.getElementById("stateInput").value.trim();
  const zip = document.getElementById("zipInput").value.trim();
  const street = document.getElementById("streetInput").value.trim();
  const minYearBuilt = document.getElementById("minYearBuilt").value.trim();
  const maxYearBuilt = document.getElementById("maxYearBuilt").value.trim();
  const neighborhood = document
    .getElementById("neighborhoodInput")
    .value.trim();
  const minValue = document.getElementById("minValue").value.trim();
  const maxValue = document.getElementById("maxValue").value.trim();

  const minBedrooms = document.getElementById("minBedrooms").value;
  const maxBedrooms = document.getElementById("maxBedrooms").value;
  const minBathrooms = document.getElementById("minBathrooms").value;
  const maxBathrooms = document.getElementById("maxBathrooms").value;

  const quickList = document.getElementById("quickList").value;

  // Get selected page size from dropdown
  const pageSizeSelect = document.getElementById("pageSizeSelect");
  if (pageSizeSelect) {
    recordsPerPage = parseInt(pageSizeSelect.value);
  }

  // Validation
  if (!((street && zip) || (street && city && state) || neighborhood)) {
    alert(
      "Please enter either 'Street + Zip Code' or 'Street + City + State' or 'Neighborhood'."
    );
    return;
  }

  // Build query (for neighborhood searches)
  let queryValue = "";
  if (neighborhood) {
    queryValue = `${neighborhood}, ${state}`;
  }

  // Calculate skip parameter based on page number
  const skip = (pageNum - 1) * recordsPerPage;

  // Use different payloads depending on street input
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

  // Valuation filter
  if (minValue || maxValue) {
    payload.searchCriteria.valuation = { estimatedValue: {} };
    if (minValue)
      payload.searchCriteria.valuation.estimatedValue.min = parseInt(minValue);
    if (maxValue)
      payload.searchCriteria.valuation.estimatedValue.max = parseInt(maxValue);
  }

  // Building filter
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

  // Year built filter
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

  // Quick list filter
  if (quickList) {
    payload.searchCriteria.orQuickLists = [quickList];
  }

  // Generate search hash to track if search criteria changed
  const newSearchHash = generateSearchHash(payload);

  // If search criteria changed, clear cache
  if (currentSearchHash !== newSearchHash) {
    clearPageCache();
    currentSearchHash = newSearchHash;
  }

  // Store payload for page navigation
  currentSearchPayload = payload;

  // NEW: Check if we have cached data for this page
  const cachedData = getCachedPage(pageNum);

  if (cachedData && cachedData.records) {
    console.log(`Using cached data for page ${pageNum}`);

    // Use cached records
    let records = cachedData.records;

    // Filter by zip code if selected (apply same filter as fresh data)
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

    // Render immediately with cached data
    if (records.length > 0) {
      renderResults();
    } else {
      renderNoResults();
    }
    return; // Exit early, no API call needed
  }

  // If no cache, proceed with API call
  try {
    // Show loading state only in table container
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
    console.log("Full Response:", responseData);

    // Handle array wrapper - API returns data in array format
    const data = Array.isArray(responseData) ? responseData[0] : responseData;

    // Extract metadata from correct path
    if (
      data &&
      data.results &&
      data.results.meta &&
      data.results.meta.results
    ) {
      totalResultsFound = data.results.meta.results.resultsFound || 0;
      totalPages = Math.ceil(totalResultsFound / recordsPerPage);
      console.log("Total Results Found:", totalResultsFound);
      console.log("Total Pages:", totalPages);
    }

    let records = [];
    if (data && data.results && Array.isArray(data.results.properties)) {
      records = data.results.properties;
    }

    console.log("Records:", records);

    // NEW: Cache the raw records before filtering
    setCachedPage(pageNum, records);

    // Filter by zip code if selected
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

    // Add current page records to allLoadedRecords
    records.forEach((record) => {
      const recordId =
        record._id || `${record.address?.street}_${record.address?.zip}`;
      // Check if record already exists in allLoadedRecords
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

function renderResults() {
  const startIndex = (currentPage - 1) * recordsPerPage;
  const endIndex = startIndex + filteredRecords.length;

  // Update results header
  updateResultsHeader();

  // Update pagination info
  document.querySelector(".pagination-info").textContent = `Showing ${
    startIndex + 1
  }-${endIndex} of ${totalResultsFound.toLocaleString()}`;

  // Render table
  let tableHTML = `
    <table class="results-table">
      <thead>
        <tr>
          <th class="checkbox-col">
            <input type="checkbox" id="selectPageCheckbox" onchange="toggleSelectPage()" 
                   ${isPageFullySelected() ? "checked" : ""}>
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

  // Update table container
  document.querySelector(".table-container").innerHTML = tableHTML;

  // Update pagination controls
  updatePaginationControls();
}

function renderNoResults() {
  // Update results header with zeros
  updateResultsHeader();

  // Update pagination info
  document.querySelector(".pagination-info").textContent =
    "No search results yet";

  // Clear table container
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

  // Disable pagination
  updatePaginationControls();
}

function renderError() {
  // Update results header with zeros
  updateResultsHeader();

  // Update pagination info
  document.querySelector(".pagination-info").textContent =
    "Error loading results";

  // Clear table container
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

  // Disable pagination
  updatePaginationControls();
}

function updateResultsHeader() {
  const allRecordsSelected =
    allLoadedRecords.length > 0 &&
    allLoadedRecords.every((record) => {
      const recordId =
        record._id || `${record.address?.street}_${record.address?.zip}`;
      return selectedRecords.has(recordId);
    });

  document.querySelector(".result-counts").innerHTML = `
    <span class="count-item">Total Results Found: <strong>${totalResultsFound.toLocaleString()}</strong></span>
  `;
}

function updatePaginationControls() {
  const pageNumbers = document.getElementById("pageNumbers");
  pageNumbers.innerHTML = generatePageNumbers(currentPage, totalPages);

  // Update pagination buttons
  const paginationBtns = document.querySelectorAll(".pagination-btn");
  if (paginationBtns.length >= 2) {
    paginationBtns[0].disabled = currentPage === 1 || totalPages === 0; // Previous
    paginationBtns[1].disabled = currentPage === totalPages || totalPages === 0; // Next
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
    // Select ALL records that have been loaded from API so far
    allLoadedRecords.forEach((record) => {
      const recordId =
        record._id || `${record.address?.street}_${record.address?.zip}`;
      selectedRecords.add(recordId);
    });
  } else {
    // Deselect ALL loaded records
    allLoadedRecords.forEach((record) => {
      const recordId =
        record._id || `${record.address?.street}_${record.address?.zip}`;
      selectedRecords.delete(recordId);
    });
  }

  // Re-render only the current page to reflect updated selection
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
    // Select all loaded records from API
    allLoadedRecords.forEach((record) => {
      const recordId =
        record._id || `${record.address?.street}_${record.address?.zip}`;
      selectedRecords.add(recordId);
    });
  } else {
    // Deselect all loaded records
    allLoadedRecords.forEach((record) => {
      const recordId =
        record._id || `${record.address?.street}_${record.address?.zip}`;
      selectedRecords.delete(recordId);
    });
  }

  // Re-render to update checkboxes on current page
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

  // CSV headers
  const headers = [
    "FirstName",
    "LastName",
    "Address",
    "City",
    "State",
    "ZipCode",
  ];

  // Build CSV content
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

  // Download CSV
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

  // Reset results header
  document.querySelector(".result-counts").innerHTML = `
    <span class="count-item">Total Results Found: <strong>0</strong></span>
  `;

  // Reset pagination info
  document.querySelector(".pagination-info").textContent =
    "No search results yet";

  // Reset table
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

  // Disable pagination buttons
  const paginationBtns = document.querySelectorAll(".pagination-btn");
  paginationBtns.forEach((btn) => (btn.disabled = true));

  // Clear page numbers
  document.getElementById("pageNumbers").innerHTML = "";
}

function saveAudience() {
  if (selectedRecords.size === 0) {
    alert("Please select at least one property.");
    return;
  }

  // Get all selected records from allLoadedRecords
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
        zipcode: record.address?.zip || record.address?.zipCode || "",
      };
      recipientsList.push(recipient);
    }
  });

  console.log("Recipients List:", recipientsList);
  alert(
    `Audience saved successfully! Total selected: ${recipientsList.length}`
  );
}

function showAlert(message) {
  alert(message);
}

function loadZipCodes(cityName, stateCode) {
  const geocoder = new google.maps.Geocoder();
  const query = `${cityName}, ${stateCode}, USA`; // more specific query

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

      // ✅ fallback: if no postal_code directly, expand search using bounds
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
  const latStep = 0.044; // ~5km steps
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

async function loadNeighborhoods(cityName, stateCode) {
  const neighborhoodSelect = document.getElementById("neighborhoodInput");
  neighborhoodSelect.innerHTML =
    '<option value="">Loading neighborhoods...</option>';

  // Build the Overpass QL query for exact neighborhood matches
  const query = `
    [out:json][timeout:25];
    area["name"="${cityName}"]["admin_level"="8"]->.city;
    (
      node["place"="neighbourhood"](area.city);
      way["place"="neighbourhood"](area.city);
      relation["place"="neighbourhood"](area.city);
      node["place"="suburb"](area.city);
      way["place"="suburb"](area.city);
      relation["place"="suburb"](area.city);
      node["place"="quarter"](area.city);
      way["place"="quarter"](area.city);
      relation["place"="quarter"](area.city);
    );
    out tags;
  `;

  try {
    const response = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: query,
    });
    const data = await response.json();

    // Extract unique neighborhood names
    const neighborhoods = [
      ...new Set(
        data.elements
          .map((el) => el.tags && el.tags.name)
          .filter((name) => !!name)
      ),
    ];
    console.log(neighborhoods);

    // Clear dropdown and populate
    neighborhoodSelect.innerHTML =
      '<option value="">-- Select Neighborhood --</option>';

    // Always add city name as first option
    const cityOption = document.createElement("option");
    cityOption.value = cityName;
    cityOption.textContent = cityName;
    neighborhoodSelect.appendChild(cityOption);

    // Add neighborhoods if found
    neighborhoods.forEach((nb) => {
      const option = document.createElement("option");
      option.value = nb;
      option.textContent = nb;
      neighborhoodSelect.appendChild(option);
    });
  } catch (error) {
    console.error("Error fetching neighborhoods:", error);
    // On error, still add city name
    neighborhoodSelect.innerHTML =
      '<option value="">-- Select Neighborhood --</option>';
    const option = document.createElement("option");
    option.value = cityName;
    option.textContent = cityName;
    neighborhoodSelect.appendChild(option);
  }
}

function showAlert(message) {
  const alertMessage = document.getElementById("alertMessage");
  alertMessage.textContent = message;
  const alertModal = document.getElementById("alertModal");
  alertModal.style.display = "flex";
  document.getElementById("alertOkBtn").addEventListener("click", () => {
    alertModal.style.display = "none";
  });
}

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

    // Fetch more zips & neighborhoods
    loadZipCodes(cityName, stateCode);
    loadNeighborhoods(cityName, stateCode);
  });
}

async function parseCSV(file) {
  // console.log("In parse function");
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      recipients = results.data.map((r) => {
        const row = Object.fromEntries(
          Object.entries(r).map(([k, v]) => [k.toLowerCase(), v])
        );
        console.log(row);
        return {
          firstName: row.firstname || "Test",
          lastName: row.lastname || "Name",
          address: row.address || "",
          city: row.city || "",
          state: row.state || "",
          zipcode: row.zipcode || "",
        };
      });

      recipientsList = [...recipientsList, ...recipients];
      saveState();
      sessionStorage.setItem("recipients", JSON.stringify(recipientsList));
      // console.log("Recipients List:", recipientsList);

      const uploadBox = document.getElementById("uploadBox");
      uploadBox.innerHTML = `
  <div class="upload-icon" style="color: #28a745;">✓</div>
  <div class="upload-main-text" style="color: #28a745;">File uploaded successfully!</div>
  <div class="upload-sub-text">${recipients.length} recipients loaded from ${file.name}</div>
  <button class="choose-file-btn" onclick="resetUpload()" style="background: #6c757d; margin-top: 1rem;">
    Upload Different File
  </button>
`;
      updateButtonStates();
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

  recipients = [];
  sessionStorage.removeItem("recipients");
  saveState();
  setupDragAndDrop();
}

async function loadTemplates() {
  const templatesGrid = document.getElementById("templatesGrid");
  if (!templatesGrid) return;

  try {
    const response = await fetch("https://pcm-app-h8mn8.ondigitalocean.app/templates");
    const templates = await response.json();

    templatesGrid.innerHTML = ""; // Clear old templates
    templatesGrid.style.display = "grid";
    templatesGrid.style.gridTemplateColumns = "repeat(3, 1fr)";
    templatesGrid.style.gap = "1.5rem";

    //  Function to render a template card
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

      // Attach safe event listener
      const fullPreviewBtn = div.querySelector(".full-preview-btn");
      fullPreviewBtn.addEventListener("click", (event) => {
        const encoded = event.currentTarget.dataset.html;
        openFullPreview(event, encoded);
      });

      // Template selection logic
      div.addEventListener("click", (e) => {
        if (e.target.closest("button")) return;
        document
          .querySelectorAll(".template-card")
          .forEach((el) => el.classList.remove("selected"));
        div.classList.add("selected");
        window.currentEditingTemplateId = tpl.id;
        uploadedPdfUrl = null;
        updateButtonStates();
        // console.log("✅ Template selected:", tpl.id);
      });

      return div;
    }

    // 👉 Render first 6 templates
    templates.slice(0, 6).forEach((tpl) => {
      templatesGrid.appendChild(renderTemplateCard(tpl));
    });

    // 👉 If more than 6, add "Show All" button
    if (templates.length > 6) {
      const showAllBtn = document.createElement("button");
      showAllBtn.textContent = "Show All Templates";
      showAllBtn.classList.add("show-all-btn");
      showAllBtn.style.gridColumn = "span 3"; // center button in grid
      showAllBtn.style.padding = "0.75rem 1.5rem";
      showAllBtn.style.margin = "1rem auto";
      showAllBtn.style.cursor = "pointer";

      showAllBtn.addEventListener("click", () => {
        // Remove button after click
        showAllBtn.remove();

        // Render remaining templates
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

// Updated openFullPreview - prevent event propagation
function openFullPreview(event, encodedHtml) {
  event.preventDefault();
  event.stopPropagation();

  // console.log("Opening preview...");

  const html = decodeURIComponent(encodedHtml);
  const overlay = document.getElementById("previewOverlay");
  const body = document.getElementById("previewBody");

  if (!overlay || !body) {
    console.error("Preview elements not found in DOM");
    return;
  }

  body.innerHTML = html;
  overlay.style.display = "flex";

  // console.log("✅ Preview opened");
}

// Updated closePreview function
function closePreview() {
  const overlay = document.getElementById("previewOverlay");
  if (overlay) {
    overlay.style.display = "none";
    document.getElementById("previewBody").innerHTML = "";
  }
}

async function createAndSendLetter() {
  const btn = document.querySelector("button[onclick='createAndSendLetter()']");
  const isCampaign = campaignCard.classList.contains("selected");
  const isMailer = mailerCard.classList.contains("selected");

  if (!isCampaign && !isMailer) {
    showAlert("Please select either 'New Campaign' or 'New Mailer' option.");
    return;
  }

  // ✅ Get mode RIGHT HERE
  const mode = getCurrentMode();
  console.log("📮 createAndSendLetter - Current mode:", mode);

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
        address_list: JSON.stringify(recipientsList),
        schedule_time: null,
        send_date: new Date().toISOString(),
        status: "sent",
        pdf_url: uploadedPdfUrl || null,
        env_mode: mode, // ✅ Pass env_mode instead of mode
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
        address_list: JSON.stringify(recipientsList),
        schedule_time: null,
        send_date: new Date().toISOString(),
        status: "sent",
        pdf_url: uploadedPdfUrl || null,
        env_mode: mode, // ✅ Pass env_mode instead of mode
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

// ✅ FIXED: Update createAndSave to use getCurrentMode()
async function createAndSave() {
  const btn = document.querySelector("button[onclick='createAndSendLetter()']");
  const isCampaign = campaignCard.classList.contains("selected");
  const isMailer = mailerCard.classList.contains("selected");

  // ✅ Get mode RIGHT HERE
  const mode = getCurrentMode();
  console.log("💾 createAndSave - Current mode:", mode);

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
        address_list: JSON.stringify(recipientsList),
        schedule_time: null,
        send_date: null,
        status: "pending",
        env_mode: mode, // ✅ Pass env_mode instead of mode
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
        address_list: JSON.stringify(recipientsList),
        schedule_time: null,
        send_date: null,
        status: "pending",
        env_mode: mode, // ✅ Pass env_mode instead of mode
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
// ---- Get Token Function ----
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
    // ✅ Get current mode from sessionStorage RIGHT HERE
    const mode = getCurrentMode();
    console.log("📦 orderDesign - Current mode:", mode);

    // Confirm with user about the current mode
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

    // Check if PDF is uploaded
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

    // Get token based on CURRENT mode
    const token = await getToken(mode);
    console.log("🔑 Got token for", mode.toUpperCase(), "mode");

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
      recipients: recipientsList,
      letter: finalHtml,
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
// ========= Helper functions =========
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

  // Restore active card
  if (formState.activeCard) {
    document.getElementById(formState.activeCard)?.classList.add("active");
  }

  // Restore campaign fields
  if (formState.campaignFields && campaignFields) {
    for (let [key, value] of Object.entries(formState.campaignFields)) {
      const input = campaignFields.querySelector(`[name="${key}"]`);
      if (input) input.value = value;
    }
  }

  // Restore mailer fields
  if (formState.mailerFields && mailerFields) {
    for (let [key, value] of Object.entries(formState.mailerFields)) {
      const input = mailerFields.querySelector(`[name="${key}"]`);
      if (input) input.value = value;
    }
  }

  // Restore uploaded CSV filename (if any)
  if (formState.uploadedCSV && uploadcsvCard) {
    uploadcsvCard.querySelector(".csv-filename").textContent =
      formState.uploadedCSV;
  }
}

// Save on CSV upload
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

// Add this function to manage button states based on PDF/template selection
function updateButtonStates() {
  const createAndSaveBtn = document.querySelector(
    "button[onclick='createAndSave()']"
  );
  const createAndSendBtn = document.querySelector(
    "button[onclick='createAndSendLetter()']"
  );

  // console.log("🔍 updateButtonStates called");
  // console.log("Save button:", createAndSaveBtn);
  // console.log("Send button:", createAndSendBtn);
  // console.log("Recipients:", recipientsList.length);
  // console.log("Template ID:", window.currentEditingTemplateId);
  // console.log("PDF URL:", uploadedPdfUrl);
  // console.log(
  //   "Campaign selected:",
  //   campaignCard?.classList.contains("selected")
  // );
  // console.log("Mailer selected:", mailerCard?.classList.contains("selected"));

  if (!createAndSaveBtn || !createAndSendBtn) {
    console.warn(
      "⚠️ Buttons not found in DOM - make sure button onclick attributes match exactly"
    );
    return;
  }

  // Check if recipients are selected
  const hasRecipients = recipientsList && recipientsList.length > 0;

  // Check if campaign or mailer is selected
  const isCampaignSelected =
    campaignCard && campaignCard.classList.contains("selected");
  const isMailerSelected =
    mailerCard && mailerCard.classList.contains("selected");
  const isModeSelected = isCampaignSelected || isMailerSelected;

  // If PDF is uploaded
  if (uploadedPdfUrl) {
    // Enable "Create and Send" if recipients and mode are selected
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

    // Always disable "Create and Save" when PDF is uploaded
    createAndSaveBtn.disabled = true;
    createAndSaveBtn.style.opacity = "0.5";
    createAndSaveBtn.style.cursor = "not-allowed";
    createAndSaveBtn.title =
      "Disabled: Cannot save drafts when using PDF uploads. Use 'Send Letter' instead.";

    // console.log(
    //   "PDF uploaded: 'Create and Save' disabled, 'Create and Send' state updated"
    // );
  }
  // If template is selected (no PDF)
  else if (window.currentEditingTemplateId) {
    // Enable both buttons if recipients and mode are selected
    if (hasRecipients && isModeSelected) {
      createAndSaveBtn.disabled = false;
      createAndSaveBtn.style.opacity = "1";
      createAndSaveBtn.style.cursor = "pointer";
      createAndSaveBtn.title = "";

      createAndSendBtn.disabled = false;
      createAndSendBtn.style.opacity = "1";
      createAndSendBtn.style.cursor = "pointer";
      createAndSendBtn.title = "";

      // console.log("Template selected with recipients: Both buttons enabled");
    } else {
      // Disable both if missing recipients or mode selection
      createAndSaveBtn.disabled = true;
      createAndSaveBtn.style.opacity = "0.5";
      createAndSaveBtn.style.cursor = "not-allowed";

      createAndSendBtn.disabled = true;
      createAndSendBtn.style.opacity = "0.5";
      createAndSendBtn.style.cursor = "not-allowed";

      // console.log("Template selected but missing recipients or mode");
    }
  }
}

// Save on every input change
document.addEventListener("input", saveFormState);

// On page load restore form state
window.addEventListener("DOMContentLoaded", loadFormState);

window.onload = function () {
  initAutocomplete();
  setupDragAndDrop();
};

if (performance.getEntriesByType("navigation")[0].type === "reload") {
  sessionStorage.clear();
}

// ✅ FIXED: Function to get current mode from sessionStorage
function getCurrentMode() {
  const mode = sessionStorage.getItem("apiMode");
  console.log("getCurrentMode() called - mode from storage:", mode);
  return mode || "testing";
}

// ✅ UPDATE: Mode Management at DOMContentLoaded
document.addEventListener("DOMContentLoaded", async () => {
  const testingBtn = document.getElementById("testingModeBtn");
  const productionBtn = document.getElementById("productionModeBtn");

  // ✅ Get initial mode from storage
  let currentMode = getCurrentMode();
  console.log("🔍 Initial mode on page load:", currentMode);

  // ✅ Set initial button states based on storage
  if (currentMode === "production") {
    testingBtn.classList.remove("active");
    productionBtn.classList.add("active");
  } else {
    testingBtn.classList.add("active");
    productionBtn.classList.remove("active");
  }

  // ✅ Testing mode button click
  testingBtn.addEventListener("click", () => {
    currentMode = "testing";
    sessionStorage.setItem("apiMode", "testing");
    console.log("✅ Switched to TESTING mode");
    testingBtn.classList.add("active");
    productionBtn.classList.remove("active");
    showAlert("Switched to TESTING mode");
  });

  // ✅ Production mode button click
  productionBtn.addEventListener("click", () => {
    currentMode = "production";
    sessionStorage.setItem("apiMode", "production");
    console.log("✅ Switched to PRODUCTION mode");
    productionBtn.classList.add("active");
    testingBtn.classList.remove("active");
    showAlert("Switched to PRODUCTION mode");
  });

  // Rest of the initialization...
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