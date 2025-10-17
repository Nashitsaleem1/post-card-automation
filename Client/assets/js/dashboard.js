let currentCampaignDataIdForSchedule = null;

function formatScheduleInfo(info) {
  if (!info) return "No schedule set";
  const date = new Date(info);
  if (isNaN(date)) return "No schedule set";
  return (
    date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }) +
    " at " +
    date.toLocaleTimeString("en-GB", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
  );
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

async function orderDesign(templateId, button, campaignId) {
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
    const tplRes = await fetch(`https://pcm-app-h8mn8.ondigitalocean.app/templates/${templateId}`);
    if (!tplRes.ok) throw new Error("Failed to load template content");
    const tpl = await tplRes.json();
    let finalHtml = (tpl.html_content || "").replace(/DATE/g, formattedDate);

    // --- Place Order with PCM ---
    const token = await getToken();
    const payload = {
      extRefNbr: "prod_12345",
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

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "API request failed");

    const newDataPayload = {
      campaign_id: campaignId,
      template_id: templateId,
      address_list: JSON.stringify(recipients),
      status: "sent",
      schedule_time: null,
    };
    const resData = await fetch("https://pcm-app-h8mn8.ondigitalocean.app/campaign-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newDataPayload),
    });
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

function openCampaignScheduleModal(campaignDataId) {
  currentCampaignDataIdForSchedule = campaignDataId;
  document.getElementById("scheduleDate").value = "";
  document.getElementById("scheduleTime").value = "";
  document.getElementById("scheduleModal").style.display = "flex";
}

function closeCampaignScheduleModal() {
  document.getElementById("scheduleModal").style.display = "none";
  currentCampaignDataIdForSchedule = null;
}

async function confirmCampaignSchedule() {
  if (!currentCampaignDataIdForSchedule) return;

  const date = document.getElementById("scheduleDate").value;
  const time = document.getElementById("scheduleTime").value;

  if (!date || !time) return alert("Please select both date and time.");

  const scheduleDateTime = `${date}T${time}:00`;

  try {
    // PUT request to update campaign_data
    const res = await fetch(
      `https://pcm-app-h8mn8.ondigitalocean.app/campaign-data/${currentCampaignDataIdForSchedule}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "scheduled",
          schedule_time: scheduleDateTime,
        }),
      }
    );

    if (!res.ok) throw new Error("Failed to update campaign schedule");

    const updatedData = await res.json();

    // Update table row directly without reloading all data
    const row = document
      .querySelector(
        `button.schedule-btn[data-id="${currentCampaignDataIdForSchedule}"]`
      )
      ?.closest("tr");
    if (row) {
      const scheduleCell = row.children[4]; // 5th column = schedule
      scheduleCell.innerHTML = formatScheduleInfo(updatedData.schedule_time);
    }

    alert(
      `📅 Schedule updated for ${formatScheduleInfo(updatedData.schedule_time)}`
    );
    closeCampaignScheduleModal();
  } catch (err) {
    console.error("Error updating campaign schedule:", err);
    alert("Failed to update schedule: " + err.message);
  }
}

function formatAddresses(addressListStr) {
  let recipients = [];
  try {
    recipients =
      typeof addressListStr === "string"
        ? JSON.parse(addressListStr)
        : addressListStr;
  } catch (err) {
    console.error("Invalid address list:", err);
    return "Invalid data";
  }

  if (!Array.isArray(recipients) || !recipients.length) return "No addresses";

  return `<ul style="margin:0; padding-left:16px;">
    ${recipients
      .map(
        (r) =>
          `<li>${r.address || "Unknown"} ${
            r.scanned ? "(✅ scanned)" : ""
          }</li>`
      )
      .join("")}
  </ul>`;
}

function safeParseRecipients(addressList) {
  if (!addressList) return [];
  if (typeof addressList === "string") {
    try {
      return JSON.parse(addressList);
    } catch (e) {
      console.error("Invalid JSON in address_list:", addressList);
      return [];
    }
  }
  return addressList;
}

// ----------------------
// Generate PCM Token at runtime
// ----------------------
async function getPcmToken() {
  const payload = {
    apiKey: "Mzk2N2YyZTktZmNkNy00YjcwLWJhMjUtMTM4ZWFlZDhmNWU0",
    apiSecret: "MmZlMzIwMzItMTlhZS00Mjk0LWE1NWYtYmI5NTg5MDUxYTM0",
    childRefNbr: "myAccountReference",
  };

  try {
    const res = await fetch("https://v3.pcmintegrations.com/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.token || null;
  } catch (err) {
    console.error("Error generating PCM token:", err);
    return null;
  }
}

// ----------------------
// Fetch scanned addresses using QR code ID
// ----------------------
async function fetchScannedAddresses(qrCodeId) {
  if (!qrCodeId) return [];
  console.log("Fetching scanned for QR:", qrCodeId);

  const token = await getPcmToken();
  if (!token) return [];

  try {
    const url = `https://v3.pcmintegrations.com/qr-code/${qrCodeId}/tracking`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) return [];

    const data = await res.json();
    if (!data.results || !Array.isArray(data.results)) return [];

    return data.results.map((item) => ({
      firstName: item.recipient.firstName,
      lastName: item.recipient.lastName,
      address: item.recipient.address,
    }));
  } catch (err) {
    console.error("Error fetching scanned addresses:", err);
    return [];
  }
}

async function openCampaignDetailModal(campaignData) {
  const modal = document.getElementById("campaignModal2");
  const modalMailerName = document.getElementById("modalMailerName");
  const modalAddresses = document.getElementById("modalAddresses");
  const filterCheckbox = document.getElementById("filterScanned");

  let currentRecipients =
    typeof campaignData.address_list === "string"
      ? safeParseRecipients(campaignData.address_list)
      : campaignData.address_list;

  const scannedRecipients = await fetchScannedAddresses(
    campaignData.qr_code_id
  );

  currentRecipients = currentRecipients.map((r) => {
    const matched = scannedRecipients.find(
      (s) =>
        s.firstName === r.firstName &&
        s.lastName === r.lastName &&
        s.address === r.address
    );
    return { ...r, scanned: !!matched };
  });

  modalMailerName.textContent = campaignData.mailer_name;
  filterCheckbox.checked = false;

  // Render addresses table
  function renderAddresses() {
    let recipientsToShow = currentRecipients;
    if (filterCheckbox.checked) {
      recipientsToShow = recipientsToShow.filter((r) => r.scanned);
    }
    if (!recipientsToShow.length) {
      modalAddresses.innerHTML = "<p>No addresses available.</p>";
      return;
    }

    modalAddresses.innerHTML = `
      <div style="overflow-x:auto;">
        <table style="width:100%; border-collapse:separate; border-spacing:0 12px; font-size:14px;">
          <thead>
            <tr style="color:white; text-align:left;">
              <th style="padding:10px;">Name</th>
              <th style="padding:10px;">Address</th>
              <th style="padding:10px;">City</th>
              <th style="padding:10px;">State</th>
              <th style="padding:10px;">Zip</th>
              <th style="padding:10px;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${recipientsToShow
              .map(
                (r) => `
              <tr style="background:#fafafa; border-radius:8px;">
                <td style="padding:10px;">${r.firstName || ""} ${
                  r.lastName || ""
                }</td>
                <td style="padding:10px;">${r.address || ""}</td>
                <td style="padding:10px;">${r.city || ""}</td>
                <td style="padding:10px;">${r.state || ""}</td>
                <td style="padding:10px;">${r.zipCode || ""}</td>
                <td style="padding:10px; font-weight:bold; color:${
                  r.scanned ? "green" : "red"
                };">${r.scanned ? "✅ Scanned" : "❌ Not Scanned"}</td>
              </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  }
  renderAddresses();

  // Remove old footer if exists
  const oldFooter = modal.querySelector("#modalFooter");
  if (oldFooter) oldFooter.remove();

  // Footer container
  const footerDiv = document.createElement("div");
  footerDiv.id = "modalFooter";
  footerDiv.style.marginTop = "20px";
  // Add confirmation buttons inside modal
  footerDiv.innerHTML = `
  <p style="margin-bottom:15px; font-size:16px; font-weight:500; color:#333;">
    Do you want to send the letter again to this audience?
  </p>
  <div style="display:flex; gap:10px; margin-bottom:20px;">
    <button id="confirmResendBtn" style="
      padding:10px 25px;
      background:#2b7fff;
      color:white;
      border:none;
      border-radius:6px;
      font-size:14px;
      font-weight:500;
      cursor:pointer;
      transition: background 0.2s;
    " onmouseover="this.style.background='#1a5fcc'" onmouseout="this.style.background='#2b7fff'">
      Yes
    </button>
    <button id="cancelResendBtn" style="
      padding:10px 25px;
      background:#e0e0e0;
      color:#333;
      border:none;
      border-radius:6px;
      font-size:14px;
      font-weight:500;
      cursor:pointer;
      transition: background 0.2s;
    " onmouseover="this.style.background='#ccc'" onmouseout="this.style.background='#e0e0e0'">
      No
    </button>
  </div>
`;

  modal.querySelector(".modal-content2").appendChild(footerDiv);

  const confirmBtn = document.getElementById("confirmResendBtn");
  const cancelBtn = document.getElementById("cancelResendBtn");

  confirmBtn.onclick = async () => {
    // Capture the current recipients (apply scanned filter if checked)
    recipientsToResend = filterCheckbox.checked
      ? currentRecipients.filter((r) => r.scanned)
      : [...currentRecipients]; // copy

    // Replace footer with template grid + send button
    footerDiv.innerHTML = `
    <h3 style="margin-bottom:10px">Select a Template to Send Letter</h3>
    <div id="templatesGrid" style="display:grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem;"></div>
    <button id="sendLetterBtn" style="margin-top:20px; padding:10px 20px; background:#2b7fff; color:white; border:none; border-radius:6px; cursor:pointer;">
      Send Letter
    </button>
  `;
    await loadTemplates();

    const sendBtn = document.getElementById("sendLetterBtn");
    sendBtn.onclick = async () => {
      if (!window.currentEditingTemplateId) {
        return alert("⚠️ Please select a template first.");
      }
      try {
        // Pass the exact recipients to orderDesign
        await orderDesign(
          window.currentEditingTemplateId,
          sendBtn,
          campaignData.campaign_id || campaignData.id,
          recipientsToResend // <- new argument
        );
        await loadDashboard();
        modal.style.display = "none"; // close modal
      } catch (err) {
        console.error("Send Letter failed:", err);
        showAlert("❌ Failed to send letter. Please try again.");
      }
    };
  };

  cancelBtn.onclick = () => {
    footerDiv.innerHTML = ""; // Remove the resend confirmation buttons
  };

  modal.style.display = "block";
}

// ----------------------
// Dashboard Loader
// ----------------------

async function loadDashboard() {
  try {
    const dashboardEl = document.querySelector(".dashboard");

    // ---- Fetch Campaign Data ----
    const res = await fetch("https://pcm-app-h8mn8.ondigitalocean.app/dashboard/all");
    if (!res.ok && res.status !== 404)
      throw new Error("Failed to load campaigns");
    const data = res.status === 404 ? { data: [] } : await res.json();

    // ---- Fetch One-Off Mailers ----
    const oneOffRes = await fetch("https://pcm-app-h8mn8.ondigitalocean.app/mailer-one-off/all");
    let oneOffData = { data: [] };
    if (oneOffRes.ok) {
      const json = await oneOffRes.json();
      oneOffData.data = Array.isArray(json) ? json : json.data || [];
      oneOffData.total_one_off_mailers =
        json.total_one_off_mailers || oneOffData.data.length;
    }

    // ---- Summary Counts ----
    document.getElementById("totalCampaigns").textContent =
      data.total_campaigns || 0;
    document.getElementById("totalOneOffMailers").textContent =
      oneOffData.total_one_off_mailers || 0;

    // ---- Remove Old Table ----
    const existingTable = dashboardEl.querySelector("#campaignDataTable");
    if (existingTable) existingTable.remove();

    const detailsDiv = document.createElement("div");
    detailsDiv.id = "campaignDataTable";

    // ---- Deduplicate Campaigns ----
    let uniqueCampaigns = [];
    let seenCampaignIds = new Set();
    if (data.data) {
      for (let d of data.data) {
        if (!seenCampaignIds.has(d.campaign_id)) {
          seenCampaignIds.add(d.campaign_id);
          uniqueCampaigns.push(d);
        }
      }
    }

    // ---- Combine all items ----
    const combined = [
      ...uniqueCampaigns.map((d) => ({
        category: "Campaign",
        id: d.campaign_id,
        name: d.campaign_name,
        recipientsList: safeParseRecipients(d.address_list),
        recipients: safeParseRecipients(d.address_list).length,
        type: "campaign",
      })),
      ...oneOffData.data.map((d) => ({
        category: "One-Off Mailer",
        id: d.id,
        name: d.mailer_name,
        recipientsList: safeParseRecipients(d.address_list || "[]"),
        recipients: safeParseRecipients(d.address_list || "[]").length,
        type: "oneoff",
      })),
    ];

    // ---- Render Table ----
    if (!combined.length) {
      detailsDiv.innerHTML = `<p style="margin-top:20px; font-size:16px; color:#555;">No data to show.</p>`;
    } else {
      detailsDiv.innerHTML = `
<table style="width:100%; border-collapse: separate; border-spacing: 0 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border-radius: 8px; overflow: hidden;">
  <thead style="transform: translateY(-16px);">
    <tr style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
      <th style="padding:18px;">Type(Campaign/One-off Mailer)</th>
      <th style="padding:18px;">Name(Campaign/Mailer)</th>
      <th style="padding:18px;">Target Recipients/Audience</th>
      <th style="padding:18px;">Action</th>
    </tr>
  </thead>

        <tbody>
          ${combined
            .map(
              (d) => `
              <tr style="background:white; box-shadow:0 1px 4px rgba(0,0,0,0.05); border-radius:6px;">
                <td style="padding:12px;"><strong>${d.category}</strong></td>
                <td style="padding:12px;">${d.name}</td>
                <td style="padding:12px;">
                  <button class="view-recipients-btn" 
                          data-id="${d.id}" 
                          data-type="${d.type}"
                          style="padding:7px 12px; background:#10b981; color:white; border:none; border-radius:5px; cursor:pointer;">
                    View Recipients | ${d.recipients}
                  </button>
                </td>
                <td style="padding:12px;">
                  <button class="view-details-btn" 
                          data-id="${d.id}" 
                          data-type="${d.type}"
                          style="padding:7px 10px; background:#636185; color:white; border:none; border-radius:5px; cursor:pointer;">
                    View Details
                  </button>
                </td>
              </tr>
            `
            )
            .join("")}
        </tbody>
      </table>`;
    }

    dashboardEl.appendChild(detailsDiv);

    // ---- Recipients Modal Handler ----
    document.querySelectorAll(".view-recipients-btn").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        const id = parseInt(event.target.dataset.id);
        const type = event.target.dataset.type;
        const item = combined.find((d) => d.id === id && d.type === type);
        if (item) showRecipientsModal(item.recipientsList);
      });
    });

    // ---- Details Click ----
    document.querySelectorAll(".view-details-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        const type = btn.dataset.type;
        const url =
          type === "campaign"
            ? `./campaign_detail.html?id=${id}`
            : `./mailer_detail.html?id=${id}`;
        window.open(url, "_blank");
      });
    });
  } catch (err) {
    console.error(err);
    alert("Failed to load dashboard data");
  }
}

// ----------------------
// Modal Display
function showRecipientsModal(recipients) {
  const modal = document.getElementById("recipientsModal");
  const listContainer = document.getElementById("recipientsList");
  const closeBtn = modal.querySelector(".close-btn");

  listContainer.innerHTML = "";

  if (!recipients.length) {
    listContainer.innerHTML = "<p>No recipients found.</p>";
  } else {
    listContainer.innerHTML = `
      <ul style="list-style:none; padding:0; margin:0;">
        ${recipients
          .map(
            (r) =>
              `<li style="padding:8px 0; border-bottom:1px solid #eee;">
                 ${r.firstName} ${r.lastName} - ${r.email || r.address || ""}
               </li>`
          )
          .join("")}
      </ul>
    `;
  }

  modal.style.display = "flex";

  closeBtn.onclick = () => (modal.style.display = "none");
  modal.onclick = (e) => {
    if (e.target === modal) modal.style.display = "none";
  };
}

function openFullPreview(encodedHtml, event) {
  if (event) event.stopPropagation();
  const html = decodeURIComponent(encodedHtml);

  const overlay = document.getElementById("previewOverlay");
  const body = document.getElementById("previewBody");

  body.innerHTML = html;
  overlay.style.display = "flex";
}

function closePreview() {
  const overlay = document.getElementById("previewOverlay");
  overlay.style.display = "none";
  document.getElementById("previewBody").innerHTML = "";
}

// Auto-run on page load
document.addEventListener("DOMContentLoaded", async () => {
  console.log("Dashboard loaded");

  const viewCampaign = localStorage.getItem("viewCampaignId");
  if (viewCampaign) {
    localStorage.removeItem("viewCampaignId"); // clear so it doesn’t persist

    // ⏳ wait until campaigns load
    await loadDashboard();

    // make sure campaigns are stored globally
    const campaigns = window.allCampaigns || [];

    if (campaigns.length > 0) {
      // always open the first one (newest)
      openCampaignDetailModal(campaigns[0]);
    } else {
      console.warn("⚠️ No campaigns available to open.");
    }
  }
});

document.querySelector(".dashboard").addEventListener("click", (e) => {
  const btn = e.target.closest(".schedule-btn");
  if (!btn) return;

  // Prevent double handling
  if (btn.dataset.clicked === "true") return;
  btn.dataset.clicked = "true";

  const campaignDataId = btn.dataset.id;
  openCampaignScheduleModal(campaignDataId);

  // Remove the clicked flag after modal closes
  const modal = document.getElementById("scheduleModal");
  const removeFlag = () => {
    btn.dataset.clicked = "false";
    modal.removeEventListener("transitionend", removeFlag);
  };
  modal.addEventListener("transitionend", removeFlag);
});

document.getElementById("cancelScheduleBtn").addEventListener("click", () => {
  closeCampaignScheduleModal();
});

// Confirm schedule
document
  .getElementById("confirmScheduleBtn")
  .addEventListener("click", async () => {
    await confirmCampaignSchedule();
  });

// Optional: close modal on outside click
window.addEventListener("click", (e) => {
  const modal = document.getElementById("scheduleModal");
  if (e.target === modal) closeCampaignScheduleModal();
});

loadDashboard();
