// campaign-detail.js
// Updated: Template selection via side panel button

// Global State
let recipients = [];
let currentCampaign = null;
let allMailers = [];
window.currentEditingTemplateId = null;
window.currentEditingMailerId = null;
window.currentSideMailerId = null;
let templatesCache = [];

// Get mode from session storage
let currentMode = sessionStorage.getItem('apiMode') || 'testing';
console.log('Current API Mode:', currentMode);

// Function to get current mode
function getCurrentMode() {
  return sessionStorage.getItem('apiMode') || 'testing';
}

// Helper to get query param
function getQueryParam(key) {
  return new URLSearchParams(window.location.search).get(key);
}

async function getToken(env = null) {
  // Use provided env or fall back to current mode from session
  const selectedEnv = env || getCurrentMode();
  
  // Define credentials for both environments
  const credentials = {
    testing: {
      apiKey: "Mzk2N2YyZTktZmNkNy00YjcwLWJhMjUtMTM4ZWFlZDhmNWU0",
      apiSecret: "YzU0NTRiMjgtOTE3Mi00YTRmLWE3YjQtYTc0ODE1N2FmOGNl",
      childRefNbr: "myAccountReference",
      url: "https://v3.pcmintegrations.com/auth/login"
    },
    production: {
      apiKey: "Mzk2N2YyZTktZmNkNy00YjcwLWJhMjUtMTM4ZWFlZDhmNWU0",
      apiSecret: "YzU0NTRiMjgtOTE3Mi00YTRmLWE3YjQtYTc0ODE1N2FmOGNl",
      childRefNbr: "myAccountReference",
      url: "https://v3.pcmintegrations.com/auth/login"
    }
  };

  const creds = credentials[selectedEnv];
  const payload = {
    apiKey: creds.apiKey,
    apiSecret: creds.apiSecret,
    childRefNbr: creds.childRefNbr
  };

  const res = await fetch(creds.url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error(`Auth failed for ${selectedEnv.toUpperCase()} environment`);
  const data = await res.json();
  return data.token;
}


async function fetchScannedRecipients(qrCodeId) {
  if (!qrCodeId) return [];
  try {
    // Always fetch a production token
    const mode = getCurrentMode();
    const token = await getToken(mode);

    const res = await fetch(
      `https://v3.pcmintegrations.com/qr-code/${qrCodeId}/tracking`,
      {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!res.ok) return [];
    const data = await res.json();

    if (!Array.isArray(data.results)) return [];

    return data.results.map((item) => ({
      firstName: item.recipient.firstName,
      lastName: item.recipient.lastName,
      address: item.recipient.address,
      city: item.recipient.city,
      state: item.recipient.state,
      zipcode: item.recipient.zipCode,
    }));
  } catch (err) {
    console.error("fetchScannedRecipients error:", err);
    return [];
  }
}


async function getQrCodeIdFromTemplate(templateId) {
  if (!templateId) return null;
  try {
    const res = await fetch(`https://pcm-app-h8mn8.ondigitalocean.app/templates/${templateId}`);
    if (!res.ok) return null;
    const tpl = await res.json();
    return tpl.qr_code_id || null;
  } catch (err) {
    console.error("getQrCodeIdFromTemplate:", err);
    return null;
  }
}

/* ---------- Utility ---------- */
function formatSchedule(dateString) {
  if (!dateString) return "Not Scheduled";
  const d = new Date(dateString);
  if (isNaN(d)) return "Not Scheduled";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function addDaysToDate(dateString, days) {
  try {
    const d = new Date(dateString);
    if (isNaN(d)) return null;
    d.setDate(d.getDate() + days);
    return d.toISOString();
  } catch {
    return null;
  }
}

/* ---------- Templates ---------- */
async function loadTemplates() {
  try {
    const res = await fetch("https://pcm-app-h8mn8.ondigitalocean.app/templates");
    if (!res.ok) throw new Error("Failed to fetch templates");
    const templates = await res.json();
    templatesCache = templates || [];
    return templates;
  } catch (err) {
    console.error("loadTemplates error:", err);
    return [];
  }
}

/* ---------- Render templates in grid with preview ---------- */
async function renderTemplateGrid(templates, containerId, selectable = true) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!templates || templates.length === 0) {
    container.innerHTML =
      "<p style='text-align:center;color:#64748b;padding:1rem;'>No templates available</p>";
    return;
  }

  container.innerHTML =
    '<div style="text-align:center;padding:2rem;color:#64748b;">Loading templates...</div>';

  const fragment = document.createDocumentFragment();

  for (const tpl of templates) {
    const card = document.createElement("div");
    card.className = "template-card";
    card.dataset.id = tpl.id;

    card.innerHTML = `
      <div class="template-mini-preview" data-template-id="${tpl.id}">
        <div style="padding:1rem;color:#94a3b8;text-align:center;font-size:12px;">Loading preview...</div>
      </div>
      <div class="template-card-body">
        <button class="template-preview-btn" onclick="previewTemplate(${tpl.id}, event)">
          Preview
        </button>
      </div>
    `;

    if (selectable) {
      card.addEventListener("click", (e) => {
        if (e.target.classList.contains("template-preview-btn")) return;
        document
          .querySelectorAll(`#${containerId} .template-card`)
          .forEach((c) => c.classList.remove("selected"));
        card.classList.add("selected");
        window.currentEditingTemplateId = tpl.id;
      });
    }

    fragment.appendChild(card);
  }

  container.innerHTML = "";
  container.appendChild(fragment);

  templates.forEach(async (tpl) => {
    try {
      const res = await fetch(`https://pcm-app-h8mn8.ondigitalocean.app/templates/${tpl.id}`);
      if (res.ok) {
        const templateData = await res.json();
        const previewHtml =
          templateData.html_content ||
          '<div style="padding:1rem;color:#94a3b8;">No content</div>';
        const previewDiv = container.querySelector(
          `[data-template-id="${tpl.id}"]`
        );
        if (previewDiv) {
          previewDiv.innerHTML = `<iframe srcdoc="${previewHtml.replace(
            /"/g,
            "&quot;"
          )}" style="width:100%;height:100%;border:none;pointer-events:none;transform:scale(0.3);transform-origin:0 0;width:333%;height:333%;"></iframe>`;
        }
      }
    } catch (err) {
      console.error("Failed to load template preview:", err);
    }
  });
}

/* ---------- Preview template ---------- */
async function previewTemplate(templateId, event) {
  if (event) event.stopPropagation();

  try {
    const res = await fetch(`https://pcm-app-h8mn8.ondigitalocean.app/templates/${templateId}`);
    if (!res.ok) throw new Error("Failed to load template");
    const tpl = await res.json();

    const todayObj = new Date();
    const formattedDate = todayObj.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const finalHtml = (tpl.html_content || "").replace(/DATE/g, formattedDate);

    document.getElementById("fullPreviewContent").innerHTML = finalHtml;
    document.getElementById("fullPreviewModal").style.display = "flex";
  } catch (err) {
    console.error("previewTemplate error:", err);
    alert("Could not load template preview");
  }
}

function closeFullPreview() {
  document.getElementById("fullPreviewModal").style.display = "none";
}

/* ---------- Render recipients ---------- */
async function renderRecipientsForContainer(
  list,
  containerId,
  templateId = null,
  mailerStatus = "pending",
  filterScanned = false,
  searchTerm = ""
) {
  const container = document.getElementById(containerId);
  if (!container) return;

  // Only fetch scanned recipients if status is "sent"
  if (templateId && mailerStatus === "sent") {
    try {
      const qrCodeId = await getQrCodeIdFromTemplate(templateId);
      if (qrCodeId) {
        const scanned = await fetchScannedRecipients(qrCodeId);
        list = list.map((r) => {
          const matched = scanned.find(
            (s) =>
              s.firstName === r.firstName &&
              s.lastName === r.lastName &&
              s.address === r.address
          );
          return { ...r, scanned: !!matched };
        });
      } else {
        list = list.map((r) => ({ ...r, scanned: !!r.scanned }));
      }
    } catch (err) {
      console.error("renderRecipientsForContainer:", err);
    }
  } else {
    // For pending or scheduled, don't mark as scanned
    list = list.map((r) => ({ ...r, scanned: false }));
  }

  let filtered = list.slice();
  if (filterScanned) filtered = filtered.filter((r) => r.scanned);
  if (searchTerm) {
    const st = searchTerm.toLowerCase();
    filtered = filtered.filter((r) =>
      ((r.firstName || "") + " " + (r.lastName || ""))
        .toLowerCase()
        .includes(st)
    );
  }

  if (!filtered.length) {
    container.innerHTML =
      "<p style='text-align:center;color:#64748b;padding:1rem;'>No recipients available</p>";
    return;
  }

  // Only show scanned status badge if mailer status is "sent"
  const showScannedStatus = mailerStatus === "sent";

  container.innerHTML = filtered
    .map(
      (r) => `
    <div class="recipient-item">
      <div class="recipient-name">${r.firstName || ""} ${r.lastName || ""}</div>
      <div class="recipient-address">${r.address || ""}, ${r.city || ""} ${
        r.state || ""
      } ${r.zipcode || ""}</div>
      ${
        showScannedStatus
          ? `<span class="recipient-status ${
              r.scanned ? "scanned" : "not-scanned"
            }">${r.scanned ? "✓ Scanned" : "Not Scanned"}</span>`
          : ""
      }
    </div>
  `
    )
    .join("");
}

/* ---------- Compute expected delivery ---------- */
function computeExpectedDeliveryForMailer(mailer) {
  if (mailer.send_date) return addDaysToDate(mailer.send_date, 9);
  if (mailer.schedule_time) return addDaysToDate(mailer.schedule_time, 9);
  return null;
}

/* ---------- Render mailers ---------- */
function renderMailers(mailers) {
  const mailersSection = document.getElementById("mailersSection");
  mailersSection.innerHTML = "";

  if (!mailers || mailers.length === 0) {
    mailersSection.innerHTML =
      "<p style='text-align:center;color:#64748b;padding:2rem;'>No mailers found for this campaign</p>";
    return;
  }

  const hasSinglePending =
    mailers.length === 1 && mailers[0].status === "pending";

  mailers.forEach((mailer) => {
    const recipientCount = JSON.parse(mailer.address_list || "[]").length;
    const totalCost = (recipientCount * 1.31).toFixed(2);
    const expectedIso = computeExpectedDeliveryForMailer(mailer);
    const expectedText = expectedIso
      ? new Date(expectedIso).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "TBD";
    const statusClass =
      mailer.status === "pending"
        ? "status-pending"
        : mailer.status === "scheduled"
        ? "status-scheduled"
        : "status-sent";

    const card = document.createElement("div");
    card.className = "mailer-card";

    const canDelete = mailer.status === "pending" || mailer.status === "scheduled";
    
    const actionButtons = hasSinglePending
      ? `
      <button class="btn btn-outline" onclick="openSidePanel(${mailer.id})">View Detail</button>
      <button class="btn btn-secondary" onclick="openTemplateSelector(${mailer.id}, event)">Select Template</button>
      <button class="btn btn-secondary" onclick="openScheduleModal(${mailer.id})">Schedule</button>
      <button class="btn btn-primary" onclick="sendMailer(${mailer.id}, this)">Send Letter</button>
      ${canDelete ? `<button class="btn btn-danger" onclick="deleteMailer(${mailer.id})">Delete</button>` : ""}
    `
      : `
      <button class="btn btn-outline" onclick="openSidePanel(${mailer.id}, event)">View Detail</button>
      ${canDelete ? `<button class="btn btn-danger" onclick="deleteMailer(${mailer.id})">Delete</button>` : ""}
    `;

    card.innerHTML = `
      <div>
        <div class="mailer-card-head">
          <div>
            <h3>${mailer.mailer_name || "Unnamed Mailer"}</h3>
            <div class="mailer-meta">Recipients: ${recipientCount}</div>
          </div>
          <div style="text-align:right">
            <div class="status-badge ${statusClass}">${(
      mailer.status || "pending"
    ).toUpperCase()}</div>
            <div style="margin-top:8px" class="mailer-cost">$${totalCost}</div>
          </div>
        </div>
        <div style="margin-top:10px;color:#64748b;font-size:13px">Expected delivery: ${expectedText}</div>
      </div>
      <div class="mailer-actions">
        ${actionButtons}
      </div>
    `;

    mailersSection.appendChild(card);
  });
}


/* ---------- Delete Mailer ---------- */
async function deleteMailer(mailerId) {
  const mailer = allMailers.find((m) => m.id === mailerId);
  if (!mailer) {
    alert("Mailer not found");
    return;
  }

  const mailerEnvMode = mailer.env_mode || "testing";

  // ❌ Prevent deletion if sent in production
  if (mailer.status === "sent" && mailerEnvMode === "production") {
    alert(`❌ Cannot delete sent mailers in PRODUCTION mode.`);
    return;
  }

  // If only one mailer and deletable, confirm full campaign deletion
  const canDeleteSent = mailerEnvMode === "testing" && mailer.status === "sent";
  if (
    allMailers.length === 1 &&
    ["pending", "scheduled"].includes(mailer.status) ||
    canDeleteSent
  ) {
    const confirmDelete = confirm(
      `This is the only mailer in this campaign.\n\nWould you like to:\nOK = Delete entire campaign and mailer\nCancel = Keep campaign`
    );
    if (!confirmDelete) return;
    await deleteCampaign();
    return;
  }

  // Confirm deletion of individual mailer
  const confirmDelete = confirm(
    `Are you sure you want to delete "${mailer.mailer_name}"?\nThis action cannot be undone.`
  );
  if (!confirmDelete) return;

  try {
    const res = await fetch(`https://pcm-app-h8mn8.ondigitalocean.app/campaign-data/${mailerId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(txt || "Failed to delete mailer");
    }

    alert(`Mailer deleted successfully!`);
    closeSidePanel();
    await loadCampaignDetail();
  } catch (err) {
    console.error("deleteMailer error:", err);
    alert("Error deleting mailer: " + err.message);
  }
}

/* ---------- Delete Campaign ---------- */
async function deleteCampaign() {
  const campaignId = getQueryParam("id");
  if (!campaignId) {
    alert("No campaign ID found");
    return;
  }

  // Get env_mode from the first mailer
  const firstMailerEnvMode = allMailers.length > 0 ? (allMailers[0].env_mode || "testing") : "testing";

  // Check if first mailer is sent and env_mode is production
  if (allMailers.length > 0) {
    const firstMailerStatus = allMailers[0].status || "pending";
    if (firstMailerStatus === "sent" && firstMailerEnvMode === "production") {
      alert(`Cannot delete campaigns with sent mailers in PRODUCTION mode.\n\nFirst mailer environment: ${firstMailerEnvMode.toUpperCase()}`);
      return;
    }
  }

  const confirmDelete = confirm(
    `Are you sure you want to delete this entire campaign? This action cannot be undone.\n\nCampaign environment: ${firstMailerEnvMode.toUpperCase()}`
  );
  if (!confirmDelete) return;

  try {
    const res = await fetch(
      `https://pcm-app-h8mn8.ondigitalocean.app/campaigns/${campaignId}`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      }
    );

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(txt || "Failed to delete campaign");
    }

    alert(`Campaign deleted successfully!`);
    // Redirect to campaigns list or home page
    window.location.href = "dashboard.html";
  } catch (err) {
    console.error("deleteCampaign error:", err);
    alert("Error deleting campaign: " + err.message);
  }
}

/* ---------- Update visibility of delete campaign button ---------- */
function updateDeleteCampaignButtonVisibility() {
  const deleteBtn = document.getElementById("deleteCampaignBtn");
  if (!deleteBtn) return;

  if (allMailers && allMailers.length > 0) {
    const firstMailer = allMailers[0];
    const firstMailerStatus = firstMailer.status || "pending";
    const firstMailerEnvMode = firstMailer.env_mode || "testing";

    // ✅ TESTING mode → always show delete button
    if (firstMailerEnvMode === "testing") {
      deleteBtn.style.display = "block";
      return;
    }

    // ✅ PRODUCTION mode → only show if status = pending or scheduled
    if (firstMailerEnvMode === "production") {
      const canDelete = ["pending", "scheduled"].includes(firstMailerStatus);
      deleteBtn.style.display = canDelete ? "block" : "none";
      return;
    }
  }

  // ✅ If no mailers found, allow campaign deletion
  deleteBtn.style.display = "block";
}

/* ---------- Update delete mailer button visibility in side panel ---------- */
function updateDeleteMailerButtonVisibility(mailer) {
  if (!mailer) return false;
  const mailerEnvMode = mailer.env_mode || "testing";

  // ✅ Always allow delete for pending/scheduled
  if (["pending", "scheduled"].includes(mailer.status)) return true;

  // ✅ Allow delete for sent only in TESTING mode
  if (mailer.status === "sent" && mailerEnvMode === "testing") return true;

  // ❌ Block delete for sent mailers in PRODUCTION
  return false;
}


/* ---------- Open Template Selector in Side Panel ---------- */
async function openTemplateSelector(mailerId, event) {
  event?.stopPropagation?.();
  const side = document.getElementById("sidePanel");
  const layout = document.getElementById("layoutContainer");
  const templateSection = document.getElementById("templateGridSection");
  const mailer = allMailers.find((m) => m.id === mailerId);
  if (!mailer) return alert("Mailer not found");

  // Hide any open side panel
  side.classList.remove("visible");
  side.setAttribute("aria-hidden", "true");

  window.currentSideMailerId = mailerId;
  window.currentEditingMailerId = mailerId;

  document.getElementById("detailMailerName").textContent = "Select Template";
  document.getElementById("detailMailerSub").textContent =
    mailer.mailer_name || "Unnamed Mailer";

  document.getElementById("detailInfoSection").style.display = "none";
  document.getElementById("detailRecipientsSection").style.display = "none";

  templateSection.classList.add("visible");
  layout.classList.remove("has-side");
  layout.classList.add("has-side-with-templates");

  const templates = await loadTemplates();
  await renderTemplateGrid(templates, "templateGrid", true);
}

/* ---------- Side panel ---------- */
async function openSidePanel(mailerId, event) {
  event?.stopPropagation?.();
  const side = document.getElementById("sidePanel");
  const layout = document.getElementById("layoutContainer");
  const templateSection = document.getElementById("templateGridSection");
  const mailer = allMailers.find((m) => m.id === mailerId);
  if (!mailer) return alert("Mailer not found");

  // Check if this is the same mailer already open - if so, skip loading
  if (
    window.currentSideMailerId === mailerId &&
    side.classList.contains("visible")
  ) {
    return;
  }

  window.currentSideMailerId = mailerId;

  // Hide template section and show only side panel
  templateSection.classList.remove("visible");
  layout.classList.remove("has-side-with-templates");
  layout.classList.add("has-side");

  side.classList.add("visible");
  side.setAttribute("aria-hidden", "false");

  // Show loading state
  document.getElementById("detailMailerName").textContent =
    mailer.mailer_name || "Unnamed Mailer";
  document.getElementById("detailMailerSub").textContent =
    mailer.campaign_name || "";
  document.getElementById("detailRecipients").innerHTML =
    '<div style="text-align:center;padding:2rem;color:#64748b;">Loading recipients...</div>';

  // Show recipient details section
  document.getElementById(
    "detailStatus"
  ).parentElement.parentElement.style.display = "block";
  document.querySelector(
    '[style*="font-weight: 700"]'
  ).parentElement.style.display = "block";

  document.getElementById("detailStatus").textContent = (
    mailer.status || "pending"
  ).toUpperCase();
  document.getElementById("detailCost").textContent =
    "$" + (JSON.parse(mailer.address_list || "[]").length * 1.31).toFixed(2);
  const expectedIso = computeExpectedDeliveryForMailer(mailer);
  document.getElementById("detailExpected").textContent = expectedIso
    ? new Date(expectedIso).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "TBD";

  const recipientsList = JSON.parse(mailer.address_list || "[]");
  await renderRecipientsForContainer(
    recipientsList,
    "detailRecipients",
    mailer.template_id || window.currentEditingTemplateId,
    mailer.status || "pending",
    false,
    ""
  );
  // --- View Template button logic ---
  // Inside openSidePanel()
  const viewTemplateBtn = document.getElementById("viewTemplateBtn");

  if (viewTemplateBtn) {
    // Enable or disable based on whether a template is assigned
    const hasTemplate = !!(
      mailer.template_id || window.currentEditingTemplateId
    );
    viewTemplateBtn.disabled = !hasTemplate;
    viewTemplateBtn.style.opacity = hasTemplate ? 1 : 0.6;

    // Remove old event listener to avoid duplicate handlers
    const newBtn = viewTemplateBtn.cloneNode(true);
    viewTemplateBtn.parentNode.replaceChild(newBtn, viewTemplateBtn);

    newBtn.addEventListener("click", async () => {
      const templateId = mailer.template_id || window.currentEditingTemplateId;
      if (!templateId) {
        alert("No template selected for this mailer.");
        return;
      }
      await openTemplatePreview(templateId);
    });
  }

  const search = document.getElementById("detailSearch");
  const only = document.getElementById("detailOnlyScanned");

  const searchClone = search.cloneNode(true);
  search.parentNode.replaceChild(searchClone, search);
  const onlyClone = only.cloneNode(true);
  only.parentNode.replaceChild(onlyClone, only);

  // Only show the "Only Scanned" filter for sent status
  const showScannedFilter = (mailer.status || "pending") === "sent";
  onlyClone.parentElement.style.display = showScannedFilter ? "block" : "none";

  searchClone.addEventListener("input", async () => {
    await renderRecipientsForContainer(
      recipientsList,
      "detailRecipients",
      mailer.template_id || window.currentEditingTemplateId,
      mailer.status || "pending",
      onlyClone.checked,
      searchClone.value.trim()
    );
  });

  onlyClone.addEventListener("change", async () => {
    await renderRecipientsForContainer(
      recipientsList,
      "detailRecipients",
      mailer.template_id || window.currentEditingTemplateId,
      mailer.status || "pending",
      onlyClone.checked,
      searchClone.value.trim()
    );
  });
}

async function openTemplatePreview(templateId) {
  try {
    // Fetch template directly from API to ensure we have latest data
    const res = await fetch(`https://pcm-app-h8mn8.ondigitalocean.app/templates/${templateId}`);
    if (!res.ok) {
      throw new Error("Failed to fetch template");
    }
    const template = await res.json();

    // Replace DATE placeholder with formatted date
    const todayObj = new Date();
    const formattedDate = todayObj.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const finalHtml = (template.html_content || "<p>No content available</p>").replace(/DATE/g, formattedDate);

    const previewModal = document.createElement("div");
    previewModal.className = "template-preview-modal";
    previewModal.innerHTML = `
      <div class="template-preview-overlay" onclick="this.parentElement.remove()"></div>
      <div class="template-preview-content">
        <div class="template-preview-header">
          <h3>Template Preview</h3>
          <button class="btn btn-outline" onclick="this.closest('.template-preview-modal').remove()">Close</button>
        </div>
        <iframe srcdoc="${finalHtml.replace(/"/g, '&quot;')}"
                style="width:100%;height:80vh;border:none;margin-top:1rem;"></iframe>
      </div>
    `;
    document.body.appendChild(previewModal);
  } catch (err) {
    console.error("openTemplatePreview error:", err);
    alert("Could not load template preview. Please try again.");
  }
}

function closeSidePanel() {
  const side = document.getElementById("sidePanel");
  const layout = document.getElementById("layoutContainer");
  const templateSection = document.getElementById("templateGridSection");

  side.classList.remove("visible");
  side.setAttribute("aria-hidden", "true");
  layout.classList.remove("has-side");
  layout.classList.remove("has-side-with-templates");

  // Always hide template section when closing side panel
  templateSection.classList.remove("visible");

  window.currentSideMailerId = null;
}

/* ---------- Schedule modal ---------- */
function openScheduleModal(mailerId) {
  if (!window.currentEditingTemplateId) {
    alert(
      "Please select a template first by clicking 'Select Template' button."
    );
    return;
  }
  window.currentEditingMailerId = mailerId;
  document.getElementById("scheduleDate").value = "";
  document.getElementById("scheduleTime").value = "";
  document.getElementById("scheduleModal").style.display = "flex";
}

function closeScheduleModal() {
  document.getElementById("scheduleModal").style.display = "none";
}

async function confirmSchedule() {
  const date = document.getElementById("scheduleDate").value;
  const time = document.getElementById("scheduleTime").value;

  if (!window.currentEditingTemplateId) {
    alert("Please select a template before scheduling.");
    return;
  }
  if (!date || !time) {
    alert("Please select both date and time.");
    return;
  }
  if (!window.currentEditingMailerId) {
    alert("No mailer selected for scheduling.");
    return;
  }

  const scheduleDateTime = `${date}T${time}:00`;

  try {
    const payload = {
      template_id: window.currentEditingTemplateId,
      schedule_time: scheduleDateTime,
      status: "scheduled",
    };
    const res = await fetch(
      `https://pcm-app-h8mn8.ondigitalocean.app/campaign-data/${window.currentEditingMailerId}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(txt || "Failed to schedule");
    }
    alert("Mailer scheduled successfully! (Currently in TESTING phase scheduling)");
    closeScheduleModal();
    await loadCampaignDetail();
  } catch (err) {
    console.error("confirmSchedule error:", err);
    alert("Error scheduling mailer: " + err.message);
  }
}

/* ---------- Send mailer ---------- */
async function sendMailer(mailerId, button) {
  if (!window.currentEditingTemplateId) {
    alert("Please select a template first by clicking 'Select Template' button.");
    return;
  }

  const originalText = button.textContent;
  button.textContent = "Processing...";
  button.disabled = true;

  try {
    // --- Use the selected mode from session storage ---
    const mode = getCurrentMode();

    // --- Confirm with user about the current mode ---
    const confirmSend = confirm(
      `You are about to send the letter in ${mode.toUpperCase()} mode.\n\nDo you want to proceed?`
    );

    if (!confirmSend) {
      button.textContent = originalText;
      button.disabled = false;
      return false;
    }

    console.log(`📦 Sending mailer using ${mode.toUpperCase()} environment...`);

    // --- Find mailer info ---
    const mailer = allMailers.find((m) => m.id === mailerId);
    if (!mailer) throw new Error("Mailer not found");

    // --- Fetch template HTML ---
    const tplRes = await fetch(`https://pcm-app-h8mn8.ondigitalocean.app/templates/${window.currentEditingTemplateId}`);
    if (!tplRes.ok) throw new Error("Failed to load template content");
    const tpl = await tplRes.json();

    // --- Prepare HTML content with date ---
    const todayObj = new Date();
    const todayISO = todayObj.toISOString().split("T")[0];
    const formattedDate = todayObj.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const finalHtml = (tpl.html_content || "").replace(/DATE/g, formattedDate);

    // --- Get PCM Token ---
    const token = await getToken(mode);

    // --- Parse recipients ---
    const mailerRecipients = JSON.parse(mailer.address_list || "[]");

    // --- Build PCM payload ---
    const pcmPayload = {
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
      recipients: mailerRecipients,
      letter: finalHtml,
    };

    // --- Use correct API base URL ---
    const baseUrl = "https://v3.pcmintegrations.com";

    // --- Send to PCM API ---
    const res = await fetch(`${baseUrl}/order/letter`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(pcmPayload),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "PCM API error");

    alert(`Mailer sent successfully using ${mode.toUpperCase()} environment!`);

    // --- Update backend (only after success) ---
    const updatePayload = {
      status: "sent",
      send_date: new Date().toISOString(),
      template_id: window.currentEditingTemplateId,
    };

    const updateRes = await fetch(`https://pcm-app-h8mn8.ondigitalocean.app/campaign-data/${mailerId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatePayload),
    });

    if (!updateRes.ok) {
      const errData = await updateRes.json().catch(() => ({}));
      throw new Error(errData.detail || "Failed to update mailer record");
    }

    await loadCampaignDetail();
  } catch (err) {
    console.error("sendMailer error:", err);
    alert("Error sending mailer: " + err.message);
  } finally {
    button.textContent = originalText;
    button.disabled = false;
  }
}


/* ---------- Create mailer modal ---------- */
async function openCreateMailerModal() {
  if (
    allMailers &&
    allMailers.length === 1 &&
    allMailers[0].status === "pending"
  ) {
    alert(
      "You cannot add a new mailer until the first one is scheduled or sent."
    );
    return;
  }

  const templates = await loadTemplates();
  renderTemplateGrid(templates, "createTemplateGrid", true);

  document.getElementById("createNewmailerName").value = "";
  window.currentEditingTemplateId = null;
  document.getElementById("createMailerModal").style.display = "flex";
}

function closeCreateMailerModal() {
  document.getElementById("createMailerModal").style.display = "none";
}

async function createMailer() {
  mode = getCurrentMode();
  const mailerName = document
    .getElementById("createNewmailerName")
    .value.trim();

  if (!mailerName) {
    alert("Please provide a mailer name");
    return;
  }
  if (!window.currentEditingTemplateId) {
    alert("Please select a template");
    return;
  }

  let expectedSendDateIso = null;
  let expectedDeliveryIso = null;

  const firstMailer = allMailers.length > 0 ? allMailers[0] : null;

  if (firstMailer) {
    let firstMailerExpectedDelivery = null;
    if (firstMailer.send_date) {
      firstMailerExpectedDelivery = addDaysToDate(firstMailer.send_date, 9);
    } else if (firstMailer.schedule_time) {
      firstMailerExpectedDelivery = addDaysToDate(firstMailer.schedule_time, 9);
    }

    if (firstMailerExpectedDelivery) {
      expectedSendDateIso = addDaysToDate(firstMailerExpectedDelivery, 8);
      expectedDeliveryIso = addDaysToDate(expectedSendDateIso, 7);
    }
  }

  const campaignId = getQueryParam("id");
  const baseRecipients = JSON.parse(currentCampaign.address_list || "[]");

  const requestData = {
    campaign_id: campaignId,
    mailer_name: mailerName,
    address_list: JSON.stringify(baseRecipients),
    schedule_time: null,
    send_date: null,
    status: "pending",
    template_id: window.currentEditingTemplateId,
    expected_send_date: expectedSendDateIso,
    expected_delivery: expectedDeliveryIso,
    mode:mode
  };

  try {
    const res = await fetch("https://pcm-app-h8mn8.ondigitalocean.app/campaign-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestData),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(txt || "Failed to add a new mailer");
    }
    alert("A new mailer has been added as follow up.");
    closeCreateMailerModal();
    await loadCampaignDetail();
  } catch (err) {
    console.error("createMailer error:", err);
    alert("Error creating mailer: " + err.message);
  }
}

/* ---------- Load campaign detail ---------- */
async function loadCampaignDetail() {
  const campaignId = getQueryParam("id");
  if (!campaignId) {
    alert("No campaign ID provided");
    return;
  }

  try {
    const res = await fetch(
      `https://pcm-app-h8mn8.ondigitalocean.app/campaign-data-with-name/${campaignId}`
    );
    if (!res.ok) throw new Error("Failed to fetch campaign details");
    const campaignData = await res.json();

    if (!campaignData || campaignData.length === 0) {
      alert("No campaign data found");
      return;
    }

    allMailers = campaignData;
    currentCampaign = campaignData[0];

    document.getElementById("campaignName").textContent =
      currentCampaign.campaign_name || "Unnamed Campaign";

    renderMailers(campaignData);
    updateDeleteCampaignButtonVisibility(); // Add this line

    // Always hide template section on initial load
    const templateSection = document.getElementById("templateGridSection");
    templateSection.classList.remove("visible");

    closeSidePanel();
  } catch (err) {
    console.error("loadCampaignDetail error:", err);
    alert("Could not load campaign details");
  }
}

/* ---------- Event wiring ---------- */
document
  .getElementById("openAddMailerBtn")
  .addEventListener("click", openCreateMailerModal);
document
  .getElementById("createMailerSubmit")
  .addEventListener("click", createMailer);
document
  .getElementById("closeSideBtn")
  .addEventListener("click", closeSidePanel);

document.querySelectorAll(".modal-overlay").forEach((modal) => {
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.style.display = "none";
  });
});

document.getElementById("fullPreviewModal").addEventListener("click", (e) => {
  if (e.target === document.getElementById("fullPreviewModal"))
    closeFullPreview();
});

window.onload = loadCampaignDetail;
