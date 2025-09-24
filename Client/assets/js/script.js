let currentEditingTemplateId = null;
let currentSchedulingTemplate = null;
let recipients = [];
let currentCampaignId = null; // campaign id
let currentCampaignDataId = null;
window.currentEditingTemplateId = null;

// ======================
// Campaign Management (limit to 6 templates)
// ======================
async function loadTemplates() {
  const templatesGrid = document.getElementById("templatesGrid");
  if (!templatesGrid) return;

  try {
    const response = await fetch(
      "https://pcm-app-h8mn8.ondigitalocean.app/templates"
    );
    const templates = await response.json();

    templatesGrid.innerHTML = "";
    templatesGrid.style.display = "grid";
    templatesGrid.style.gridTemplateColumns = "repeat(3, 1fr)";
    templatesGrid.style.gap = "1.5rem";

    // Only first 6 templates
    templates.slice(0, 6).forEach((tpl) => {
      const div = document.createElement("div");
      div.classList.add("template-card");
      div.dataset.templateId = tpl.id;

      div.innerHTML = `
        <div class="template-preview">
          <div class="template-content collapsed">
            ${tpl.html_content}
          </div>
          <button class="show-more-btn" onclick="toggleShowMore(this, event)">Show More</button>

        </div>
      `;

      div.addEventListener("click", () => {
        document
          .querySelectorAll(".template-card")
          .forEach((el) => el.classList.remove("selected"));
        div.classList.add("selected");
        window.currentEditingTemplateId = tpl.id;
        console.log("✅ Template selected:", tpl.id);
      });

      templatesGrid.appendChild(div);
    });
  } catch (err) {
    console.error("Error loading templates:", err);
    templatesGrid.innerHTML = "<p>Failed to load templates.</p>";
  }
}

function toggleShowMore(button, event) {
  event.stopPropagation(); // Prevent parent div click
  const contentDiv = button.previousElementSibling; // .template-content
  if (!contentDiv) return;

  contentDiv.classList.toggle("collapsed");
  button.textContent = contentDiv.classList.contains("collapsed")
    ? "Show More"
    : "Show Less";
}

// ======================
// Template Gallery (all templates with edit + select button)
// ======================
async function loadGalleryTemplates() {
  const templatesGrid = document.getElementById("templatesGrid");
  if (!templatesGrid) return;

  try {
    const response = await fetch(
      "https://pcm-app-h8mn8.ondigitalocean.app/templates"
    );
    const templates = await response.json();

    templatesGrid.innerHTML = ""; // Clear grid
    templates.forEach((tpl) => {
      const div = document.createElement("div");
      div.classList.add("template");
      div.dataset.templateId = tpl.id;
      div.dataset.qrCodeId = tpl.qr_code_id;

      div.innerHTML = `
        <div class="letter-container" id="letterPreview${tpl.id}">
          ${tpl.html_content}
        </div>
        <div class="button-actions">
          <button class="order-design-btn" onclick="selectTemplate(${tpl.id}, this)">
            Select Letter
          </button>
          <button class="edit-btn" onclick="openEditModal(${tpl.id})">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" 
                 stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
        </div>
      `;

      templatesGrid.appendChild(div);
    });
  } catch (err) {
    console.error("Error loading templates:", err);
    templatesGrid.innerHTML = "<p>Failed to load templates.</p>";
  }
}

// ----------------------
// Sample CSV
// ----------------------
function downloadSampleCSV() {
  const sample = `firstName,lastName,address,city,state,zipCode
Alex,Doe,2145 Sunnydale Blvd,Clearwater,FL,33765`;
  const blob = new Blob([sample], { type: "text/csv" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "sample_recipients.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function selectTemplate(templateId, btn) {
  // Unselect if same template clicked again
  if (window.currentEditingTemplateId === templateId) {
    window.currentEditingTemplateId = null;
    localStorage.removeItem("currentEditingTemplateId");
    if (btn) btn.textContent = "Select Letter";

    const selectedDiv = document.querySelector(
      `.template[data-template-id='${templateId}']`
    );
    if (selectedDiv) selectedDiv.classList.remove("selected");

    console.log("❌ Template unselected");
    return;
  }

  // Clear previous selections
  const allTemplates = document.querySelectorAll(".template");
  allTemplates.forEach((el) => {
    el.classList.remove("selected");
    const selectBtn = el.querySelector(".order-design-btn");
    if (selectBtn) selectBtn.textContent = "Select Letter";
  });

  // Mark new selection
  const selectedDiv = document.querySelector(
    `.template[data-template-id='${templateId}']`
  );
  if (selectedDiv) selectedDiv.classList.add("selected");

  if (btn) btn.textContent = "✅ Selected";

  // Save globally + persist
  window.currentEditingTemplateId = templateId;
  localStorage.setItem("currentEditingTemplateId", templateId);

  console.log("✅ Template selected:", templateId);
}

function openEditModal(templateId) {
  window.currentEditingTemplateId = templateId; // ✅ update global
  const templateDiv = document.querySelector(
    `.template[data-template-id='${templateId}'] .letter-container`
  );
  document.getElementById("letterEditor").innerHTML = templateDiv.innerHTML;
  document.getElementById("editModal").style.display = "block";
}

function closeEditModal() {
  document.getElementById("editModal").style.display = "none";
}

function openSaveAsNewModal() {
  document.getElementById("saveAsNewModal").style.display = "block";
}

function closeSaveAsNewModal() {
  document.getElementById("saveAsNewModal").style.display = "none";
}

async function saveAsNewTemplate() {
  const htmlContent = document.getElementById("letterEditor").innerHTML;

  if (!htmlContent.trim()) return showAlert("Please enter content.");

  let qrCodeId = null;
  if (currentEditingTemplateId) {
    const templateDiv = document.querySelector(
      `.template[data-template-id='${currentEditingTemplateId}']`
    );
    const qrIdStr = templateDiv.dataset.qrCodeId;
    qrCodeId = qrIdStr ? parseInt(qrIdStr) : null;
  }

  try {
    const response = await fetch(
      "https://pcm-app-h8mn8.ondigitalocean.app/templates",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          html_content: htmlContent,
          qr_code_id: qrCodeId,
        }),
      }
    );
    if (!response.ok) throw new Error("Failed to create template");

    closeSaveAsNewModal();
    loadGalleryTemplates();
    showAlert("Template created successfully!");
  } catch (err) {
    console.error(err);
    showAlert("Error creating template.");
  }
}

function closeTemplateCreatedModal() {
  const modal = document.getElementById("templateCreatedModal");
  if (modal) modal.style.display = "none";
}

// ======================
// Helpers / Guards
// ======================
function showAlert(message) {
  const modal = document.getElementById("alertModal");
  const messageEl = document.getElementById("alertMessage");
  if (modal && messageEl) {
    messageEl.innerText = message;
    modal.style.display = "flex";
  }
}
const alertOkBtn = document.getElementById("alertOkBtn");
if (alertOkBtn) {
  alertOkBtn.onclick = () => {
    const modal = document.getElementById("alertModal");
    if (modal) modal.style.display = "none";
  };
}
function ensureTemplateSelected() {
  const tplId = window.currentEditingTemplateId;
  if (!tplId) {
    showAlert("⚠️ Please select a template first.");
    return false;
  }
  return true;
}

function ensureCampaignReadyForAction() {
  if (!currentCampaignId || !currentCampaignDataId) {
    showAlert(
      "⚠️ Please create a campaign first (Campaign Name, Mailer Name, and CSV upload are required)."
    );
    return false;
  }
  console.log(recipients)
  if (!recipients.length) {
    showAlert("⚠️ Please upload a CSV file with recipients.");
    return false;
  }
  return true;
}

// ======================
// Create Campaign (NO MODAL) -> uses the inline form inside #createcampaign
// ======================
async function CreateCampaign() {
  // grab the two inputs inside the create-campaign section
  const section = document.querySelector(
    "#createcampaign .create-campaign-form"
  );
  const inputs = section ? section.querySelectorAll(".campaign-input") : [];
  const campaignName = inputs[0]?.value.trim() || "";
  const mailerName = inputs[1]?.value.trim() || "";

  if (!campaignName || !mailerName) {
    showAlert("⚠️ Campaign Name and Mailer Name are required.");
    return false; // ⛔ stop
  }
  if (!recipients.length) {
    showAlert("⚠️ Please upload your CSV before creating a campaign.");
    return false; // ⛔ stop
  }

  try {
    // 1) Create the campaign only
    const resCampaign = await fetch(
      "https://pcm-app-h8mn8.ondigitalocean.app/campaigns",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaign_name: campaignName,
          mailer_name: mailerName,
        }),
      }
    );

    if (!resCampaign.ok) {
      const err = await resCampaign.json().catch(() => ({}));
      throw new Error(err.detail || "Failed to create campaign");
    }

    const newCampaign = await resCampaign.json();
    currentCampaignId = newCampaign.id;
    localStorage.setItem("currentCampaignId", currentCampaignId);

    console.log("✅ Campaign created:", newCampaign);
    return true; // ✅ success
  } catch (err) {
    console.error("CreateCampaign Error:", err);
    showAlert("❌ " + err.message);
    return false; // ❌ failure
  }
}

async function createAndSend() {
  if (!ensureTemplateSelected()) return;

  // Always force brand new campaign
  currentCampaignId = null;
  currentCampaignDataId = null;
  localStorage.removeItem("currentCampaignId");
  localStorage.removeItem("currentCampaignDataId");

  const ok = await CreateCampaign();
  if (!ok) return; // ⛔ stop if campaign creation failed

  const btn = document.querySelector("button[onclick='createAndSend()']");
  orderDesign(window.currentEditingTemplateId, btn);
}

function showCampaignSuccessModal() {
  const modal = document.getElementById("campaignSuccessModal");
  if (!modal) return;
  modal.style.display = "flex";

  const okBtn = document.getElementById("successOkBtn");
  const viewBtn = document.getElementById("viewCampaignBtn");

  okBtn.onclick = () => {
    modal.style.display = "none";
    window.location.href = "dashboard.html";
  };

  viewBtn.onclick = () => {
    modal.style.display = "none";
    // Save campaignId for dashboard to pick up
    localStorage.setItem("viewCampaignId", currentCampaignId);
    window.location.href = "dashboard.html";
  };
}

// ======================
// Schedule Modal
// ======================
function openScheduleModal(templateId) {
  window.currentEditingTemplateId = templateId; // ✅ sync with global
  currentSchedulingTemplate = templateId;
  document.getElementById("scheduleDate").value = "";
  document.getElementById("scheduleTime").value = "";
  document.getElementById("scheduleModal").style.display = "flex";
}

function closeScheduleModal() {
  document.getElementById("scheduleModal").style.display = "none";
  currentSchedulingTemplate = null;
}

async function confirmSchedule() {
  // requires campaign + recipients + template
  if (!ensureCampaignReadyForAction()) return;
  if (!ensureTemplateSelected()) return;

  const date = document.getElementById("scheduleDate").value;
  const time = document.getElementById("scheduleTime").value;
  if (!date || !time) return showAlert("Please select both date and time.");

  const scheduleDateTime = `${date}T${time}:00`;

  try {
    let createNewRow = true;

    if (currentCampaignDataId) {
      const res = await fetch(
        `https://pcm-app-h8mn8.ondigitalocean.app/campaign-data/${currentCampaignDataId}`
      );
      if (!res.ok) throw new Error("Failed to fetch current campaign_data");
      const currentData = await res.json();

      if (currentData.template_id === currentEditingTemplateId) {
        createNewRow = false;
      }
    }

    if (createNewRow) {
      const payload = {
        campaign_id: currentCampaignId,
        template_id: currentEditingTemplateId,
        address_list: JSON.stringify(recipients),
        schedule_time: scheduleDateTime,
        status: "scheduled",
      };
      const res = await fetch(
        "https://pcm-app-h8mn8.ondigitalocean.app/campaign-data",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok)
        throw new Error("Failed to create new scheduled campaign_data");

      const newData = await res.json();
      currentCampaignDataId = newData.id;
    } else {
      const res = await fetch(
        `https://pcm-app-h8mn8.ondigitalocean.app/campaign-data/${currentCampaignDataId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            template_id: currentEditingTemplateId,
            status: "scheduled",
            schedule_time: scheduleDateTime,
          }),
        }
      );
      if (!res.ok) throw new Error("Failed to update scheduled letter");
    }

    showAlert(`📅 Letter scheduled for ${scheduleDateTime}`);
    closeScheduleModal();

    window.location.href = "dashboard.html";
    // optional 1s delay so alert shows briefly
  } catch (err) {
    console.error("Schedule update error:", err);
    showAlert("Error scheduling letter: " + err.message);
  }
}

function saveTemplate() {
  if (!window.currentEditingTemplateId) {
    showAlert("⚠️ Please select a template first.");
    return;
  }

  // Grab the updated HTML from the editor modal
  const editorDiv = document.getElementById("letterEditor");
  if (!editorDiv) {
    showAlert("⚠️ Could not find the editor.");
    return;
  }
  const updatedHtml = editorDiv.innerHTML;

  // Find the template in the gallery grid
  const templateDiv = document.querySelector(
    `.template[data-template-id='${window.currentEditingTemplateId}'] .letter-container`
  );
  if (!templateDiv) {
    showAlert("⚠️ Could not find the template in the gallery.");
    return;
  }

  // Update the gallery
  templateDiv.innerHTML = updatedHtml;
  templateDiv.classList.add("saved-highlight");

  // Persist in localStorage
  localStorage.setItem("savedTemplateHtml", updatedHtml);
  localStorage.setItem("savedTemplateId", window.currentEditingTemplateId);

  showAlert("✅ Template saved!");
  console.log("Template saved locally and updated in gallery:", {
    id: window.currentEditingTemplateId,
    html: updatedHtml,
  });
}

// ======================
// CSV Upload (unchanged, but enforces campaign before upload)
// ======================
async function parseCSV(file) {
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      console.log(results.data); // Log parsed data to inspect

      // Filter out empty rows or invalid data
      const recipients = results.data
        .map((r) => {
          const row = Object.fromEntries(
            Object.entries(r).map(([k, v]) => [k.toLowerCase(), v])
          );

          // Only return non-empty rows that have required data
          if (row.firstname && row.lastname && row.address && row.city && row.state && row.zipcode) {
            return {
              firstName: row.firstname || "Test",
              lastName: row.lastname || "Name",
              address: row.address || "",
              city: row.city || "",
              state: row.state || "",
              zipCode: row.zipcode || "",
            };
          } else {
            return null; // Return null for invalid rows
          }
        })
        .filter((recipient) => recipient !== null); // Remove any null rows

      localStorage.setItem("recipients", JSON.stringify(recipients));
      console.log(recipients)
      const uploadBox = document.getElementById("uploadBox");
      uploadBox.innerHTML = `
        <div class="upload-icon" style="color: #28a745;">✓</div>
        <div class="upload-main-text" style="color: #28a745;">File uploaded successfully!</div>
        <div class="upload-sub-text">${recipients.length} recipients loaded from ${file.name}</div>
        <button class="choose-file-btn" onclick="resetUpload()" style="background: #6c757d; margin-top: 1rem;">
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


function setupDragAndDrop() {
  const uploadBox = document.getElementById("uploadBox");
  const csvFileInput = document.getElementById("csvFile");

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
  localStorage.removeItem("recipients");
  setupDragAndDrop();
}

// ======================
// PCM API Auth (unchanged)
// ======================
async function getToken() {
  const payload = {
    apiKey: "ZDczYjA4OGEtOTA0ZS00YmIxLWFmYWItNzkzYzQzOWM5ZDIy",
    apiSecret: "OWU4YWQ4MTMtNTE3ZC00Y2QzLTg1YjEtYTQxZWEzNDAwYmIx",
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

// ======================
// Order + update campaign_data to SENT
// ======================
window.showSuccessModal = function () {
  document.getElementById("successModal").style.display = "block";
};
window.closeModal = function () {
  document.getElementById("successModal").style.display = "none";
};

async function fetchLatestCampaign() {
  try {
    const res = await fetch(
      "https://pcm-app-h8mn8.ondigitalocean.app/campaigns"
    );
    if (!res.ok) throw new Error("Failed to fetch campaigns");
    const campaigns = await res.json();
    return campaigns.length ? campaigns[campaigns.length - 1] : null;
  } catch (err) {
    console.error("Error fetching campaigns:", err);
    return null;
  }
}

async function orderDesign(templateId, button) {
  // Guard: campaign + recipients + template
  if (!ensureTemplateSelected()) return;

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

    // Fetch template HTML by id (don't assume it's in the DOM)
    const tplRes = await fetch(
      `https://pcm-app-h8mn8.ondigitalocean.app/templates/${templateId}`
    );
    if (!tplRes.ok) throw new Error("Failed to load template content");
    const tpl = await tplRes.json();
    let finalHtml = (tpl.html_content || "").replace(/DATE/g, formattedDate);

    // --- Place Order with PCM ---
    const token = await getToken();
    console.log(token);
    const payload = {
      extRefNbr: "prod_12345",
      designID: 0,
      mailClass: "FirstClass",
      mailDate: todayISO,
      color: true,
      printOnBothSides: true,
      returnAddress: {
        firstName: "Mark",
        lastName: "Fazzini",
        address: "4175 Woodlands Pkwy",
        city: "Palm Harbor",
        state: "FL",
        zipCode: "34685",
      },
      insertAddressingPage: true,
      envelope: {
        font: "Bradley Hand",
        type: "fullWindow",
        fontColor: "Black",
      },
      recipients,
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
    console.log(res);

    const data = await res.json().catch((err) => {
      console.log("Error parsing response body:", err);
      return {};
    });
    console.log(data); // This will give you more insight into the error
    if (!res.ok) throw new Error(data.message || "API request failed");

    // Always create a new campaign_data row (no update)
    const newDataPayload = {
      campaign_id: currentCampaignId,
      template_id: templateId,
      address_list: JSON.stringify(recipients),
      status: "sent",
      schedule_time: null,
    };
    const resData = await fetch(
      "https://pcm-app-h8mn8.ondigitalocean.app/campaign-data",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newDataPayload),
      }
    );
    if (!resData.ok)
      throw new Error("Failed to create new campaign_data entry");
    const newCampaignData = await resData.json();
    currentCampaignDataId = newCampaignData.id;
    localStorage.setItem("currentCampaignDataId", currentCampaignDataId);

    showCampaignSuccessModal();
  } catch (err) {
    console.error("Order Design Error:", err);
    showAlert("Error ordering letters: " + err.message);
  } finally {
    button.textContent = originalText;
    button.disabled = false;
  }
}

function scheduleSelectedLetter() {
  if (!ensureCampaignReadyForAction()) return;
  if (!ensureTemplateSelected()) return;
  openScheduleModal(window.currentEditingTemplateId);
}

// ======================
// Page Init
// ======================
document.addEventListener("DOMContentLoaded", async () => {
  console.log("App started");
  const path = window.location.pathname;

  if (path.includes("templategallery")) {
    // Template Gallery page → load all templates with edit + select buttons
    loadGalleryTemplates();
  } else if (path.includes("campaign_management")) {
    // Campaign Management page → only first 6 templates
    loadTemplates();
  }

  // Restore campaign, campaign_data, recipients
  const savedCampaignId = localStorage.getItem("currentCampaignId");
  const savedCampaignDataId = localStorage.getItem("currentCampaignDataId");
  if (savedCampaignId) currentCampaignId = parseInt(savedCampaignId, 10);
  if (savedCampaignDataId)
    currentCampaignDataId = parseInt(savedCampaignDataId, 10);

  const savedRecipients = localStorage.getItem("recipients");
  if (savedRecipients) {
    recipients = JSON.parse(savedRecipients);
    const uploadBox = document.getElementById("uploadBox");
    if (uploadBox) {
      uploadBox.innerHTML = `
        <div class="upload-icon" style="color: #28a745;">✓</div>
        <div class="upload-main-text" style="color: #28a745;">File uploaded successfully!</div>
        <div class="upload-sub-text">${recipients.length} recipients restored from last session</div>
        <button class="choose-file-btn" onclick="resetUpload()" style="background: #6c757d; margin-top: 1rem;">
          Upload Different File
        </button>
      `;
    }
  } else {
    resetUpload();
  }
  // Restore template selection
  const savedTemplateId = localStorage.getItem("currentEditingTemplateId");
  if (savedTemplateId) {
    window.currentEditingTemplateId = parseInt(savedTemplateId, 10);

    // If we’re on gallery page → update UI
    const selectedDiv = document.querySelector(
      `.template[data-template-id='${savedTemplateId}']`
    );
    if (selectedDiv) {
      selectedDiv.classList.add("selected");
      const btn = selectedDiv.querySelector(".order-design-btn");
      if (btn) btn.textContent = "✅ Selected";
    }

    console.log("🔄 Restored template:", window.currentEditingTemplateId);
  }
});
