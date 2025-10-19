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
    console.log("PDF upload already initialized");
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

  console.log("✅ PDF upload initialized");
}

// Upload PDF to backend
// Call updateButtonStates() after PDF upload succeeds
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

    console.log("✅ PDF uploaded:", uploadedPdfUrl);
  } catch (error) {
    console.error("PDF upload error:", error);
    showAlert("Error uploading PDF: " + error.message);
    resetPdfUploadBox();
  }
}

// ✅ Helper function to reset PDF upload box
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

// Remove uploaded PDF
// Call updateButtonStates() after PDF removal
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

    console.log("✅ PDF removed");
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
  batchsection.style.display = "block";
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
    console.log("Restored recipients:", recipientsList);
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

    console.log("Recipients List:", recipientsList);
    saveState();
    container.innerHTML = "";
  });
}

async function searchProperties() {
  const city = document.getElementById("cityApiValue").value.trim();
  const state = document.getElementById("stateInput").value.trim();
  const zip = document.getElementById("zipInput").value.trim();
  const street = document.getElementById("streetInput").value.trim();
  const neighborhood = document
    .getElementById("neighborhoodInput")
    .value.trim();
  console.log(neighborhood);
  const minValue = document.getElementById("minValue").value.trim();
  const maxValue = document.getElementById("maxValue").value.trim();

  const minBedrooms = document.getElementById("minBedrooms").value;
  const maxBedrooms = document.getElementById("maxBedrooms").value;
  const minBathrooms = document.getElementById("minBathrooms").value;
  const maxBathrooms = document.getElementById("maxBathrooms").value;
  const minStories = document.getElementById("minStories").value;
  const maxStories = document.getElementById("maxStories").value;

  const quickList = document.getElementById("quickList").value;

  // Validation
  if (!((street && zip) || (street && city && state) || neighborhood)) {
    showAlert(
      "Please enter either 'Street + Zip Code' or 'Street + City + State' or 'Neighborhood'."
    );
    return;
  }

  // ✅ Build query (for neighborhood searches)
  let queryValue = "";
  if (neighborhood) {
    queryValue = `${neighborhood}`;
  }

  // ✅ Use different payloads depending on street input
  let payload;
  if (street) {
    payload = {
      searchCriteria: {
        query: queryValue,
        compAddress: { street, city, state, zip },
      },
      options: { useYearBuilt: true, skip: 0, take: 20, projection: "all" },
    };
  } else {
    payload = {
      searchCriteria: {
        query: queryValue,
      },
      options: { useYearBuilt: true, skip: 0, take: 20, projection: "all" },
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
  if (minStories || maxStories) {
    building.storyCount = {};
    if (minStories) building.storyCount.min = parseInt(minStories);
    if (maxStories) building.storyCount.max = parseInt(maxStories);
  }
  if (Object.keys(building).length > 0) {
    payload.searchCriteria.building = building;
  }

  // Quick list filter
  if (quickList) {
    payload.searchCriteria.orQuickLists = [quickList];
  }

  console.log("Payload:", payload);

  try {
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

    const data = await response.json();
    console.log("API Response:", data);

    let records = [];
    if (data && data.results && Array.isArray(data.results.properties)) {
      records = data.results.properties;
    }

    if (records.length > 0) {
      renderAddresses(records);
    } else {
      document.getElementById("results").innerHTML = "<p>No results found.</p>";
    }
  } catch (error) {
    console.error("Error fetching properties:", error);
    document.getElementById("results").innerHTML =
      "<p style='color:red'>Error fetching properties</p>";
  }
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

function loadNeighborhoods(cityName, stateCode) {
  const service = new google.maps.places.PlacesService(
    document.createElement("div")
  );
  const query = `neighborhoods in ${cityName}, ${stateCode}`;

  service.textSearch({ query }, (results, status) => {
    if (status === google.maps.places.PlacesServiceStatus.OK) {
      const neighborhoods = results.map((r) => r.name);

      const neighborhoodSelect = document.getElementById("neighborhoodInput");
      neighborhoodSelect.innerHTML =
        '<option value="">-- Select Neighborhood --</option>';
      neighborhoods.forEach((nb) => {
        const option = document.createElement("option");
        option.value = nb;
        option.textContent = nb;
        neighborhoodSelect.appendChild(option);
      });
    }
  });
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
  console.log("In parse function");
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      recipients = results.data.map((r) => {
        const row = Object.fromEntries(
          Object.entries(r).map(([k, v]) => [k.toLowerCase(), v])
        );
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
        console.log("✅ Template selected:", tpl.id);
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

  console.log("Opening preview...");

  const html = decodeURIComponent(encodedHtml);
  const overlay = document.getElementById("previewOverlay");
  const body = document.getElementById("previewBody");

  if (!overlay || !body) {
    console.error("Preview elements not found in DOM");
    return;
  }

  body.innerHTML = html;
  overlay.style.display = "flex";

  console.log("✅ Preview opened");
}

// Updated closePreview function
function closePreview() {
  const overlay = document.getElementById("previewOverlay");
  if (overlay) {
    overlay.style.display = "none";
    document.getElementById("previewBody").innerHTML = "";
  }
}

// Update createAndSendLetter to validate PDF or template
async function createAndSendLetter() {
  const btn = document.querySelector("button[onclick='createAndSendLetter()']");
  const isCampaign = campaignCard.classList.contains("selected");
  const isMailer = mailerCard.classList.contains("selected");

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

      // Check if either PDF or template is selected
      if (!uploadedPdfUrl && !window.currentEditingTemplateId) {
        showAlert("Please select a template or upload a PDF.");
        return;
      }

      // Step 1: Place PCM order
      const orderSuccess = await orderDesign(
        uploadedPdfUrl ? null : window.currentEditingTemplateId,
        btn
      );
      if (!orderSuccess) {
        showAlert("Order failed. Campaign not saved.");
        return;
      }

      // Step 2: Create campaign
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

      // Step 3: Save campaign data
      const campaignDataPayload = {
        campaign_id: campaign.id,
        mailer_name: mailerName,
        template_id: uploadedPdfUrl ? null : window.currentEditingTemplateId,
        address_list: JSON.stringify(recipientsList),
        schedule_time: null,
        send_date: new Date().toISOString(),
        status: "sent",
        pdf_url: uploadedPdfUrl || null, // Store PDF URL if used
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
  const btn = document.querySelector("button[onclick='createAndSendLetter()']");
  const isCampaign = campaignCard.classList.contains("selected");
  const isMailer = mailerCard.classList.contains("selected");

  if (!isCampaign && !isMailer) {
    showAlert("Please select either 'New Campaign' or 'New Mailer' option.");
    return;
  }

  try {
    if (isCampaign) {
      // 👉 Campaign workflow
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

      // Step 2: Create campaign
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

      // Step 3: Save campaign data
      const campaignDataPayload = {
        campaign_id: campaign.id,
        mailer_name: mailerName,
        template_id: null,
        address_list: JSON.stringify(recipientsList),
        schedule_time: null,
        send_date: null,
        status: "pending",
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
      // 👉 Mailer One-Off workflow
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

      // Step 2: Save mailer one-off
      const mailerPayload = {
        mailer_name: mailerName,
        template_id: null,
        address_list: JSON.stringify(recipientsList),
        schedule_time: null,
        send_date: null, // ✅ Not sending, keep null
        status: "pending",
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

async function getToken() {
  const payload = {
    apiKey: "Mzk2N2YyZTktZmNkNy00YjcwLWJhMjUtMTM4ZWFlZDhmNWU0",
    apiSecret: "YzU0NTRiMjgtOTE3Mi00YTRmLWE3YjQtYTc0ODE1N2FmOGNl",
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

// Modified orderDesign function to handle PDF URL
async function orderDesign(templateId, button) {
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

    let finalHtml = "";

    // Check if PDF is uploaded
    if (uploadedPdfUrl) {
      // Use PDF URL directly
      finalHtml = uploadedPdfUrl;
      console.log("📄 Using uploaded PDF:", finalHtml);
    } else if (templateId) {
      // Use template HTML
      const tplRes = await fetch(
        `https://pcm-app-h8mn8.ondigitalocean.app/templates/${templateId}`
      );
      if (!tplRes.ok) throw new Error("Failed to load template content");
      const tpl = await tplRes.json();
      finalHtml = (tpl.html_content || "").replace(/DATE/g, formattedDate);
      console.log("📝 Using template HTML");
    } else {
      throw new Error("Please select a template or upload a PDF");
    }

    // --- Place Order with PCM ---
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
      recipients: recipientsList,
      letter: finalHtml, // This will be either PDF URL or HTML content
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
    console.log(data);
    if (!res.ok) throw new Error(data.message || "API request failed");

    console.log("✅ Order placed:", data);
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

  console.log("🔍 updateButtonStates called");
  console.log("Save button:", createAndSaveBtn);
  console.log("Send button:", createAndSendBtn);
  console.log("Recipients:", recipientsList.length);
  console.log("Template ID:", window.currentEditingTemplateId);
  console.log("PDF URL:", uploadedPdfUrl);
  console.log(
    "Campaign selected:",
    campaignCard?.classList.contains("selected")
  );
  console.log("Mailer selected:", mailerCard?.classList.contains("selected"));

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

    console.log(
      "PDF uploaded: 'Create and Save' disabled, 'Create and Send' state updated"
    );
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

      console.log("Template selected with recipients: Both buttons enabled");
    } else {
      // Disable both if missing recipients or mode selection
      createAndSaveBtn.disabled = true;
      createAndSaveBtn.style.opacity = "0.5";
      createAndSaveBtn.style.cursor = "not-allowed";

      createAndSendBtn.disabled = true;
      createAndSendBtn.style.opacity = "0.5";
      createAndSendBtn.style.cursor = "not-allowed";

      console.log("Template selected but missing recipients or mode");
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

// Initialize button states on page load
document.addEventListener("DOMContentLoaded", async () => {
  const overlay = document.getElementById("previewOverlay");
  if (overlay) {
    // Close overlay when clicking outside the content box
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        closePreview();
      }
    });

    // Close preview with ESC key
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && overlay.style.display === "flex") {
        closePreview();
      }
    });
  }
  restoreState();

  // ✅ Initialize button states
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
      updateButtonStates(); // ✅ Update after PDF upload section is ready
    }, 100);
  }
});
