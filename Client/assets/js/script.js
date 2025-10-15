let currentEditingTemplateId = null;
let currentSchedulingTemplate = null;
let recipients = [];
let currentCampaignId = null; 
let currentCampaignDataId = null;
window.currentEditingTemplateId = null;
const alertOkBtn = document.getElementById("alertOkBtn");


window.showSuccessModal = function () {
  document.getElementById("successModal").style.display = "block";
};
window.closeModal = function () {
  document.getElementById("successModal").style.display = "none";
};

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

// ======================
// Template Gallery (all templates with edit + select button)
// ======================
async function loadGalleryTemplates() {
  const templatesGrid = document.getElementById("templatesGrid");
  if (!templatesGrid) return;

  try {
    const response = await fetch("https://pcm-app-h8mn8.ondigitalocean.app/templates");
    const templates = await response.json();

    templatesGrid.innerHTML = ""; // Clear grid
    templates.forEach((tpl) => {
      const div = document.createElement("div");
      div.classList.add("template");
      div.dataset.templateId = tpl.id;
      div.dataset.qrCodeId = tpl.qr_code_id;

      div.innerHTML = `
       <h3 class="template-title">${tpl.template_name || "Untitled Template"}</h3>
        <div class="letter-container" id="letterPreview${tpl.id}">
        
          ${tpl.html_content}
        </div>
        <div class="button-actions">
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

function setReturnTarget(sectionId) {
  sessionStorage.setItem("returnTarget", sectionId);
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
  const htmlContent = document.getElementById("letterEditor").innerHTML.trim();
  const templateName = document.getElementById("templateName").value.trim();

  if (!htmlContent) return showAlert("Please enter content.");
  if (!templateName) return showAlert("Please enter a template name.");

  let qrCodeId = null;

  // ✅ Get qr_code_id from the currently edited template
  if (window.currentEditingTemplateId) {
    const templateDiv = document.querySelector(
      `.template[data-template-id='${window.currentEditingTemplateId}']`
    );

    if (templateDiv) {
      const qrIdStr = templateDiv.dataset.qrCodeId;
      qrCodeId = qrIdStr ? parseInt(qrIdStr) : null;
      console.log("Fetched QR Code ID:", qrCodeId);
    } else {
      console.warn("Template div not found for currentEditingTemplateId");
    }
  }

  try {
    const response = await fetch("https://pcm-app-h8mn8.ondigitalocean.app/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        template_name: templateName,
        html_content: htmlContent,
        qr_code_id: qrCodeId, // ✅ Keep same QR code if available
      }),
    });

    if (!response.ok) throw new Error("Failed to create template");

    closeSaveAsNewModal();
    await loadGalleryTemplates();
    showAlert("Template created successfully!");
  } catch (err) {
    console.error("Error creating template:", err);
    showAlert("Error creating template.");
  }
}

function closeTemplateCreatedModal() {
  const modal = document.getElementById("templateCreatedModal");
  if (modal) modal.style.display = "none";
}

function showAlert(message) {
  const modal = document.getElementById("alertModal");
  const messageEl = document.getElementById("alertMessage");
  if (modal && messageEl) {
    messageEl.innerText = message;
    modal.style.display = "flex";
  }
}

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
  if (!recipients.length) {
    showAlert("⚠️ Please upload a CSV file with recipients.");
    return false;
  }
  return true;
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
      const res = await fetch("https://pcm-app-h8mn8.ondigitalocean.app/campaign-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
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


function scheduleSelectedLetter() {
  if (!ensureCampaignReadyForAction()) return;
  if (!ensureTemplateSelected()) return;
  openScheduleModal(window.currentEditingTemplateId);
}

document.addEventListener("DOMContentLoaded", async () => {
  const path = window.location.pathname;
  window.currentEditingTemplateId = null;
  localStorage.removeItem("Restored template");
  if (path.includes("templateGallery")) {
    loadGalleryTemplates();
  } else if (path.includes("campaign_management")) {
    loadTemplates();
  }
});
