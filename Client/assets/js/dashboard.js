// Global state
let recipients = [];
let currentMailer = null;
let currentSchedulingTemplate = null;
window.currentEditingTemplateId = null;

// Helper functions
function getQueryParam(key) {
  const params = new URLSearchParams(window.location.search);
  return params.get(key);
}

// ==== Schedule Functions ====
function openScheduleModal(templateId) {
  window.currentEditingTemplateId = templateId;
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
  if (!window.currentEditingTemplateId) {
    alert("Please select a template first.");
    return;
  }

  const date = document.getElementById("scheduleDate").value;
  const time = document.getElementById("scheduleTime").value;
  if (!date || !time) return alert("Please select both date and time.");

  const scheduleDateTime = `${date}T${time}:00`;
  const mailerId = getQueryParam("id");

  try {
    const payload = {
      template_id: window.currentEditingTemplateId,
      schedule_time: scheduleDateTime,
      status: "scheduled",
    };

    const res = await fetch(
      `https://pcm-app-h8mn8.ondigitalocean.app/mailer-one-off/${mailerId}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    if (!res.ok) throw new Error("Failed to schedule mailer");

    await res.json();

    alert("Mailer scheduled successfully!");
    closeScheduleModal();
    location.reload();
  } catch (err) {
    console.error(err);
    alert("Error scheduling mailer: " + err.message);
  }
}

// ==== PCM Auth & Send ====
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

async function orderDesign(templateId, button) {
  const originalText = button.textContent;
  button.textContent = "Processing...";
  button.disabled = true;

  try {
    const mailerId = getQueryParam("id");
    if (!mailerId) throw new Error("Mailer ID not found");

    const todayObj = new Date();
    const todayISO = todayObj.toISOString().split("T")[0];
    const formattedDate = todayObj.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // --- Step 1: Load template content ---
    const tplRes = await fetch(`https://pcm-app-h8mn8.ondigitalocean.app/templates/${templateId}`);
    if (!tplRes.ok) throw new Error("Failed to load template content");
    const tpl = await tplRes.json();
    const finalHtml = (tpl.html_content || "").replace(/DATE/g, formattedDate);

    // --- Step 2: Get PCM token ---
    const token = await getToken();

    // --- Step 3: Send letter via PCM ---
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
      recipients: recipients,
      letter: finalHtml,
    };

    const res = await fetch("https://v3.pcmintegrations.com/order/letter", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(pcmPayload),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "PCM API request failed");

    alert("✅ Letter sent successfully!");

    // --- Step 4: Update backend only after PCM succeeds ---
    const updatePayload = {
      status: "sent",
      send_date: new Date().toISOString(),
      template_id: templateId,
    };

    const updateRes = await fetch(`https://pcm-app-h8mn8.ondigitalocean.app/mailer-one-off/${mailerId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatePayload),
    });

    if (!updateRes.ok) {
      const errData = await updateRes.json().catch(() => ({}));
      throw new Error(errData.detail || "Failed to update mailer table");
    }

    const updatedMailer = await updateRes.json();

    // --- Step 5: Update frontend ---
    currentMailer = { ...updatedMailer };
    renderMailerInfo(currentMailer);

    return true;

  } catch (err) {
    console.error("Order Design Error:", err);
    alert("Error sending letter: " + err.message);
    return false;
  } finally {
    button.textContent = originalText;
    button.disabled = false;
  }
}


// ==== Integrate with Render Buttons ====
function attachMailerActions(mailer) {
  const actions = document.getElementById("actionButtons");
  actions.innerHTML = "";

  const schedBtn = document.createElement("button");
  schedBtn.className = "btn btn-secondary";
  schedBtn.innerHTML = "📅 Schedule";
  schedBtn.onclick = () => openScheduleModal(window.currentEditingTemplateId);
  actions.appendChild(schedBtn);

  const sendBtn = document.createElement("button");
  sendBtn.className = "btn btn-primary";
  sendBtn.innerHTML = "✉️ Send Letter";
  sendBtn.onclick = (e) => {
    if (!window.currentEditingTemplateId) {
      alert("Please select a template before sending.");
      return;
    }
    orderDesign(window.currentEditingTemplateId, sendBtn);
  };
  actions.appendChild(sendBtn);
}

function formatSchedule(dateString) {
  if (!dateString) return "No schedule set";
  const d = new Date(dateString);
  if (isNaN(d)) return "No schedule set";
  return (
    d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }) +
    " at " +
    d.toLocaleTimeString("en-GB", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
  );
}

// Render mailer info and action buttons
function renderMailerInfo(mailer) {
  currentMailer = mailer;

  document.getElementById("mailerName").textContent = mailer.mailer_name;

  const statusEl = document.getElementById("mailerStatus");

  // --- Handle statuses ---
  if (mailer.status === "sent") {
    statusEl.textContent = "Sent";
    statusEl.className = "status-sent";

    handleSentMailer(mailer);
    return;
  }

  if (mailer.status === "scheduled") {
    statusEl.textContent = "Scheduled";
    statusEl.className = "status-scheduled";

    handleScheduledMailer(mailer);
    return;
  }

  // Default: pending
  statusEl.textContent = "Pending";
  statusEl.className = "status-pending";

  handlePendingMailer(mailer);
}

function handleScheduledMailer(mailer) {
  const infoContent = document.getElementById("mailerInfoContent");
  if (!infoContent) return;

  infoContent.innerHTML = ""; // clear only the dynamic section

  // Send Date
  const sendDateItem = document.createElement("div");
  sendDateItem.className = "info-item";
  sendDateItem.innerHTML = `
    <strong>Send Date & Time</strong>
    <span>${formatSchedule(mailer.schedule_time)}</span>
  `;
  infoContent.appendChild(sendDateItem);

  // Expected Delivery
  const expectedDelivery = new Date(mailer.schedule_time);
  expectedDelivery.setDate(expectedDelivery.getDate() + 7);

  const deliveryItem = document.createElement("div");
  deliveryItem.className = "info-item";
  deliveryItem.innerHTML = `
    <strong>Expected Delivery</strong>
    <span>${expectedDelivery.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })}</span>
  `;
  infoContent.appendChild(deliveryItem);

  // Cost
  const recipientCount = JSON.parse(mailer.address_list || "[]").length;
  const totalCost = (recipientCount * 1.31).toFixed(2);

  const costItem = document.createElement("div");
  costItem.className = "info-item";
  costItem.innerHTML = `
    <strong>Total Cost</strong>
    <span>$${totalCost}</span>
  `;
  infoContent.appendChild(costItem);

  // Hide template & action buttons
  document.getElementById("actionButtons").innerHTML = "";
  document.getElementById("templateSection").classList.remove("visible");
}

function handlePendingMailer(mailer) {
  // Show template picker + actions
  document.getElementById("templateSection").classList.add("visible");

  // Load templates if pending
  loadTemplates();

  const infoContent = document.getElementById("mailerInfoContent");
  if (!infoContent) return;

  // Clear only dynamic section
  infoContent.innerHTML = "";

  // Status update
  document.getElementById("mailerStatus").textContent =
    "Pending (Not scheduled or sent)";

  // Show cost preview
  const recipientCount = JSON.parse(mailer.address_list || "[]").length;
  const totalCost = (recipientCount * 1.31).toFixed(2);

  const costItem = document.createElement("div");
  costItem.className = "info-item";
  costItem.innerHTML = `
    <strong>Estimated Cost</strong>
    <span>$${totalCost}</span>
  `;
  infoContent.appendChild(costItem);

  // Attach actions
  attachMailerActions(mailer);
}

async function fetchScannedRecipients(qrCodeId) {
  if (!qrCodeId) return [];
  
  const token = await getToken();
  if (!token) return [];

  try {
    const res = await fetch(`https://v3.pcmintegrations.com/qr-code/${qrCodeId}/tracking`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) return [];

    const data = await res.json();
    if (!data.results || !Array.isArray(data.results)) return [];

    return data.results.map(item => ({
      firstName: item.recipient.firstName,
      lastName: item.recipient.lastName,
      address: item.recipient.address,
      city: item.recipient.city,
      state: item.recipient.state,
      zipcode: item.recipient.zipCode,
    }));
  } catch (err) {
    console.error("Error fetching scanned recipients:", err);
    return [];
  }
}


function handleSentMailer(mailer) {
  const infoContent = document.getElementById("mailerInfoContent");
  if (!infoContent) return;

  // Clear only dynamic section
  infoContent.innerHTML = "";

  // Update status
  document.getElementById("mailerStatus").textContent = "Sent";

  // Actual send date
  const sendDateItem = document.createElement("div");
  sendDateItem.className = "info-item";
  sendDateItem.innerHTML = `
    <strong>Sent Date & Time</strong>
    <span>${formatSchedule(mailer.send_date)}</span>
  `;
  infoContent.appendChild(sendDateItem);

  // Expected delivery = send_date + 7
  const expectedDelivery = new Date(mailer.send_date);
  expectedDelivery.setDate(expectedDelivery.getDate() + 7);

  const deliveryItem = document.createElement("div");
  deliveryItem.className = "info-item";
  deliveryItem.innerHTML = `
    <strong>Expected Delivery</strong>
    <span>${expectedDelivery.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })}</span>
  `;
  infoContent.appendChild(deliveryItem);

  // Cost
  const recipientCount = JSON.parse(mailer.address_list || "[]").length;
  const totalCost = (recipientCount * 1.31).toFixed(2);

  const costItem = document.createElement("div");
  costItem.className = "info-item";
  costItem.innerHTML = `
    <strong>Total Cost</strong>
    <span>$${totalCost}</span>
  `;
  infoContent.appendChild(costItem);

  // Hide template picker + clear actions
  document.getElementById("actionButtons").innerHTML = "";
  document.getElementById("templateSection").classList.remove("visible");
}

async function loadTemplates(selectedTemplateId = null) {
  const templatesGrid = document.getElementById("templatesGrid");

  try {
    const response = await fetch("https://pcm-app-h8mn8.ondigitalocean.app/templates");
    const templates = await response.json();

    templatesGrid.innerHTML = "";

    function renderTemplateCard(tpl) {
      const div = document.createElement("div");
      div.classList.add("template-card");
      div.dataset.templateId = tpl.id;

      if (selectedTemplateId && tpl.id === selectedTemplateId) {
        div.classList.add("selected");
        window.currentEditingTemplateId = tpl.id;
      }

      div.innerHTML = `
              <div class="template-preview">${tpl.html_content}</div>
              <button class="full-preview-btn" onclick="openFullPreview('${encodeURIComponent(
                tpl.html_content
              )}', event)">
                Full Preview
              </button>
            `;

      div.addEventListener("click", (e) => {
        if (e.target.classList.contains("full-preview-btn")) return;

        document
          .querySelectorAll(".template-card")
          .forEach((el) => el.classList.remove("selected"));
        div.classList.add("selected");
        window.currentEditingTemplateId = tpl.id;
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


function openFullPreview(encodedHtml, event) {
  event.stopPropagation();
  const html = decodeURIComponent(encodedHtml);
  const overlay = document.getElementById("previewOverlay");
  const body = document.getElementById("previewBody");
  body.innerHTML = html;
  overlay.style.display = "flex";
}

function closePreview() {
  document.getElementById("previewOverlay").style.display = "none";
  document.getElementById("previewBody").innerHTML = "";
}

async function loadMailerRecipients(mailer) {
  let currentRecipients = JSON.parse(mailer.address_list || "[]");
  const scannedRecipients = await fetchScannedRecipients(mailer.qr_code_id);

  // Add a flag if scanned
  currentRecipients = currentRecipients.map(r => {
    const matched = scannedRecipients.find(
      s => s.firstName === r.firstName && s.lastName === r.lastName && s.address === r.address
    );
    return { ...r, scanned: !!matched };
  });

  return currentRecipients;
}

// --- Fetch QR code ID for a given template ID ---
async function getQrCodeIdFromTemplate(templateId) {
  if (!templateId) return null;
  try {
    const res = await fetch(`https://pcm-app-h8mn8.ondigitalocean.app/templates/${templateId}`);
    if (!res.ok) throw new Error("Failed to fetch template for QR code");
    const template = await res.json();
    return template.qr_code_id || null;
  } catch (err) {
    console.error("Error fetching QR code ID:", err);
    return null;
  }
}

// --- Render recipients with dynamic scanned status ---
async function renderRecipients(list, templateId = null) {
  let qrCodeId = null;
  if (templateId) {
    qrCodeId = await getQrCodeIdFromTemplate(templateId);
  }
  console.log(qrCodeId)

  if (qrCodeId) {
    try {
      const scannedRecipients = await fetchScannedRecipients(qrCodeId);

      // Merge scanned info
      list = list.map((r) => {
        const matched = scannedRecipients.find(
          (s) =>
            s.firstName === r.firstName &&
            s.lastName === r.lastName &&
            s.address === r.address
        );
        return { ...r, scanned: !!matched };
      });

      recipients = list; // update global array
    } catch (err) {
      console.error("Error updating scanned status:", err);
    }
  }

  const tableDiv = document.getElementById("recipientsTable");
  if (!list.length) {
    tableDiv.innerHTML = "<p>No recipients available.</p>";
    return;
  }

  tableDiv.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Address</th>
          <th>City</th>
          <th>State</th>
          <th>Zip</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${list
          .map(
            (r) => `
          <tr>
            <td>${r.firstName || ""} ${r.lastName || ""}</td>
            <td>${r.address || ""}</td>
            <td>${r.city || ""}</td>
            <td>${r.state || ""}</td>
            <td>${r.zipcode || ""}</td>
            <td>
              <span class="status-badge ${
                r.scanned ? "scanned" : "not-scanned"
              }">
                ${r.scanned ? "✓ Scanned" : "✗ Not Scanned"}
              </span>
            </td>
          </tr>
        `
          )
          .join("")}
      </tbody>
    </table>
  `;
}

// --- Update recipients with filter ---
async function updateRecipients() {
  if (!currentMailer) return;

  const filter = document.getElementById("filterScanned").checked;

  // always use the original list from mailer, don't overwrite 'recipients'
  const originalList = JSON.parse(currentMailer.address_list || "[]");

  await renderRecipients(
    filter 
      ? originalList.filter((r) => r.scanned) 
      : originalList, 
    currentMailer.template_id // pass template_id to get QR code
  );
}


// --- Load mailer details ---
async function loadMailerDetail() {
  const mailerId = getQueryParam("id");
  if (!mailerId) {
    alert("No mailer ID provided");
    return;
  }

  try {
    const res = await fetch(`https://pcm-app-h8mn8.ondigitalocean.app/mailer-one-off/${mailerId}`);
    if (!res.ok) throw new Error("Failed to fetch mailer details");

    const mailer = await res.json();
    currentMailer = mailer;
    renderMailerInfo(mailer);

    recipients = JSON.parse(mailer.address_list || "[]");
    await updateRecipients();
  } catch (err) {
    console.error(err);
    alert("Could not load mailer details");
  }
}


// Event listeners
document
  .getElementById("filterScanned")
  .addEventListener("change", updateRecipients);
window.onload = loadMailerDetail;
