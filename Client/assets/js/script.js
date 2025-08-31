let currentEditingTemplateId = null;
let currentSchedulingTemplate = null;
let recipients = [];

// ----------------------
// Load Templates
// ----------------------
async function loadTemplates() {
  const templatesGrid = document.getElementById("templatesGrid");
  try {
    const response = await fetch("https://pcm-app-h8mn8.ondigitalocean.app/templates");
    const templates = await response.json();

    templatesGrid.innerHTML = ""; // Clear grid
    templates.forEach((tpl) => {
      const div = document.createElement("div");
      div.classList.add("template");
      div.dataset.templateId = tpl.id;
      div.dataset.qrCodeId = tpl.qr_code_id;
      console.log(tpl.qr_code_id);

      const deleteButton =
        tpl.id > 4
          ? `<button class="delete-btn" onclick="deleteTemplate(${tpl.id})" title="Delete">
             <svg xmlns="http://www.w3.org/2000/svg" width="25" height="25" 
                  fill="none" stroke="red" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
               <path d="M3 6h18"/>
               <path d="M19 6V19a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
               <path d="M10 11v6"/>
               <path d="M14 11v6"/>
               <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
             </svg>
           </button>`
          : "";

      div.innerHTML = `
        <div class="letter-container" id="letterPreview${tpl.id}">
          ${tpl.html_content}
        </div>
        <div class="button-actions">
          <button class="order-design-btn" onclick="orderDesign('letterPreview${tpl.id}', this)">
            Send Letter
          </button>
          <button class="order-design-btn" onclick="openScheduleModal(${tpl.id})">
            Schedule
          </button>
          <button class="edit-btn" onclick="openEditModal(${tpl.id})">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" 
                 stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          ${deleteButton}
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
// Edit Modal
// ----------------------
function openEditModal(templateId) {
  currentEditingTemplateId = templateId;
  const templateDiv = document.querySelector(
    `.template[data-template-id='${templateId}'] .letter-container`
  );
  document.getElementById("letterEditor").innerHTML = templateDiv.innerHTML;
  document.getElementById("editModal").style.display = "block";
}

function closeEditModal() {
  document.getElementById("editModal").style.display = "none";
}

// ----------------------
// Open/Close Create Campaign Modal
// ----------------------
function openCreateCampaignModal() {
  document.getElementById("createCampaignModal").style.display = "block";
}

function closeCreateCampaignModal() {
  document.getElementById("createCampaignModal").style.display = "none";
}
const menuToggle = document.getElementById("menuToggle");
const menu = document.getElementById("menu");

menuToggle.addEventListener("click", () => {
  menu.classList.toggle("active");
});
// ----------------------
// Save Campaign API call
// ----------------------
async function saveCampaign() {
  const campaignName = document.getElementById("campaignName").value.trim();
  const mailerName = document.getElementById("mailerName").value.trim();

  if (!campaignName || !mailerName) {
    return showAlert("Please enter both Campaign Name and Mailer Name.");
  }

  try {
    const response = await fetch("https://pcm-app-h8mn8.ondigitalocean.app/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaign_name: campaignName,
        mailer_name: mailerName,
      }),
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.detail || "Failed to create campaign");
    }

    const newCampaign = await response.json();
    closeCreateCampaignModal();
    showAlert(`Campaign "${newCampaign.campaign_name}" created successfully!`);
  } catch (err) {
    console.error("Create Campaign Error:", err);
    showAlert("Error creating campaign: " + err.message);
  }
}

// ----------------------
// Hook the header button
// ----------------------
document.getElementById("createCampaignBtn").onclick = openCreateCampaignModal;

// ----------------------
// Save As New Template
// ----------------------
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
    qrCodeId = qrIdStr ? parseInt(qrIdStr) : null; // convert to int if exists
  }
  console.log(typeof qrCodeId);

  try {
    const response = await fetch("https://pcm-app-h8mn8.ondigitalocean.app/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        html_content: htmlContent,
        qr_code_id: qrCodeId,
      }),
    });
    if (!response.ok) throw new Error("Failed to create template");

    closeSaveAsNewModal();
    loadTemplates();
    showAlert("Template created successfully!");
  } catch (err) {
    console.error(err);
    showAlert("Error creating template.");
  }
}

// ----------------------
// Delete Template
// ----------------------
async function deleteTemplate(templateId) {
  if (!confirm("Are you sure you want to delete this template?")) return;
  try {
    const response = await fetch(
      `https://pcm-app-h8mn8.ondigitalocean.app/templates/${templateId}`,
      { method: "DELETE" }
    );
    if (!response.ok) throw new Error("Failed to delete template");
    loadTemplates();
    showAlert("Template deleted successfully!");
  } catch (err) {
    console.error(err);
    showAlert("Error deleting template.");
  }
}

// ----------------------
// Alert Modal
// ----------------------
function showAlert(message) {
  const modal = document.getElementById("alertModal");
  document.getElementById("alertMessage").innerText = message;
  modal.style.display = "flex";
}
document.getElementById("alertOkBtn").onclick = () => {
  document.getElementById("alertModal").style.display = "none";
};

// ----------------------
// Schedule Modal
// ----------------------
function openScheduleModal(templateId) {
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
  if (!recipients.length) {
    return showAlert(
      "⚠️ Please upload a CSV file with recipients before scheduling a letter."
    );
  }

  const date = document.getElementById("scheduleDate").value; // yyyy-mm-dd
  const time = document.getElementById("scheduleTime").value; // hh:mm

  if (!date || !time) {
    return showAlert("Please select both date and time.");
  }
  // Combine into "2025-08-30 06:50:00" (local time string)
  const scheduleDateTime = `${date} ${time}:00`;

  try {
    // --- Fetch latest campaign from backend (same as orderDesign) ---
    const latestCampaignRes = await fetch(
      "https://pcm-app-h8mn8.ondigitalocean.app/campaigns/latest"
    );
    if (!latestCampaignRes.ok) {
      throw new Error("Failed to fetch latest campaign");
    }
    const latestCampaign = await latestCampaignRes.json();
    window.latestCampaignId = latestCampaign.id; // store globally for reuse

    // save to backend as scheduled
    const res = await fetch("https://pcm-app-h8mn8.ondigitalocean.app/campaign-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaign_id: latestCampaign.id,
        template_id: currentSchedulingTemplate,
        address_list: JSON.stringify(recipients),
        schedule_time: scheduleDateTime,
        status: "scheduled",
      }),
    });

    if (!res.ok) throw new Error("Failed to save scheduled letter");

    showAlert(`📅 Letter scheduled for ${scheduleDateTime.toLocaleString()}`);
    closeScheduleModal();
  } catch (err) {
    console.error("Schedule save error:", err);
    showAlert("Error scheduling letter.");
  }
}

// ----------------------
// CSV Upload
// ----------------------
async function parseCSV(file) {
  const campaignExists = await checkCampaignExists();
  if (!campaignExists) {
    showAlert(
      "⚠️ No campaign exists yet. Please create a campaign first before uploading recipients."
    );
    return;
  }

  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      recipients = results.data.map((r) => ({
        company: r.company || "",
        firstName: r.firstName || r.FirstName || "Test",
        lastName: r.lastName || r.LastName || "Name",
        address: r.address || r.Address || "",
        city: r.city || r.City || "",
        state: r.state || r.State || "",
        zipCode: r.zipCode || r.Zipcode || "",
      }));
      console.log("Recipients loaded:", recipients);

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
    if (file) {
      await parseCSV(file); // ✅ only parse if campaign exists
    }
  });

  csvFileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (file) {
      await parseCSV(file); // ✅ only parse if campaign exists
    }
  });

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }
}

function resetUpload() {
  document.getElementById("uploadBox").innerHTML = `
    <div class="upload-icon"><img src="./assets/images/icon.png" alt="Upload" width="52" height="52" /></div>
    <div class="upload-main-text">Drag & drop your CSV file here</div>
    <div class="upload-sub-text">or click to browse your files</div>
    <input type="file" id="csvFile" accept=".csv" style="display:none;" />
    <button class="choose-file-btn" onclick="document.getElementById('csvFile').click()">Choose File</button>
    <div class="file-size-info">Max file size: 10MB</div>
  `;
  recipients = [];
  setupDragAndDrop();
}

async function checkCampaignExists() {
  try {
    const res = await fetch("https://pcm-app-h8mn8.ondigitalocean.app/campaigns/latest");
    if (!res.ok) throw new Error("Failed to fetch campaigns");
    const latestCampaign = await res.json();
    return latestCampaign && latestCampaign.id; // true if exists
  } catch (err) {
    console.error("Error checking campaign:", err);
    return false;
  }
}

// ----------------------
// Sample CSV
// ----------------------
function downloadSampleCSV() {
  const sample = `Company,firstName,lastName,address,city,state,zipCode
PCM Integrations,Alex,Doe,2145 Sunnydale Blvd,Clearwater,FL,33765`;
  const blob = new Blob([sample], { type: "text/csv" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "sample_recipients.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ----------------------
// PCM API
// ----------------------

async function getToken() {
  const payload = {
    apiKey: "Mzk2N2YyZTktZmNkNy00YjcwLWJhMjUtMTM4ZWFlZDhmNWU0",
    apiSecret: "MmZlMzIwMzItMTlhZS00Mjk0LWE1NWYtYmI5NTg5MDUxYTM0",
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

// Modal functions
window.showSuccessModal = function () {
  document.getElementById("successModal").style.display = "block";
};

window.closeModal = function () {
  document.getElementById("successModal").style.display = "none";
};

async function orderDesign(templateId, button) {
  if (!recipients.length) {
    showAlert("Please upload a CSV file with recipients first!");
    return;
  }

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

    let finalHtml = document.getElementById(templateId).innerHTML;
    finalHtml = finalHtml.replace(/DATE/g, formattedDate);

    // --- Fetch latest campaign from backend ---
    const latestCampaignRes = await fetch(
      "https://pcm-app-h8mn8.ondigitalocean.app/campaigns/latest"
    );
    if (!latestCampaignRes.ok) {
      throw new Error("Failed to fetch latest campaign");
    }
    const latestCampaign = await latestCampaignRes.json();

    const campaignPayload = {
      campaign_id: latestCampaign.id,
      template_id: parseInt(templateId.replace(/\D/g, "")) || null,
      address_list: JSON.stringify(recipients),
      schedule_time: null, // sending immediately
      status: "sent", // ✅ mark as sent
    };

    await fetch("https://pcm-app-h8mn8.ondigitalocean.app/campaign-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(campaignPayload),
    });

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
}

// ----------------------
// Page Init
// ----------------------
document.addEventListener("DOMContentLoaded", () => {
  loadTemplates();
  resetUpload();
});
