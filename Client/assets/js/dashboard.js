// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Format date and time for display
 */
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

/**
 * Display alert modal
 */
function showAlert(message) {
  const alertModal = document.getElementById("alertModal");
  const alertMessage = document.getElementById("alertMessage");
  const alertOkBtn = document.getElementById("alertOkBtn");

  alertMessage.textContent = message;
  alertModal.style.display = "flex";

  alertOkBtn.onclick = () => {
    alertModal.style.display = "none";
  };
}

// ============================================
// MODE MANAGEMENT
// ============================================

/**
 * Get current API mode from session storage
 */
function getCurrentMode() {
  return sessionStorage.getItem("apiMode") || "testing";
}

/**
 * Set API mode in session storage
 */
function setMode(newMode) {
  sessionStorage.setItem("apiMode", newMode);
  console.log("Mode updated to:", newMode);
}

/**
 * Initialize mode switcher buttons
 */
function initializeModeSwitcher() {
  const testingBtn = document.getElementById("testingModeBtn");
  const productionBtn = document.getElementById("productionModeBtn");
  const currentMode = getCurrentMode();

  // Set initial active state
  if (currentMode === "production") {
    testingBtn?.classList.remove("active");
    productionBtn?.classList.add("active");
  } else {
    testingBtn?.classList.add("active");
    productionBtn?.classList.remove("active");
  }

  // Attach event listeners
  testingBtn?.addEventListener("click", () => {
    setMode("testing");
    testingBtn.classList.add("active");
    productionBtn.classList.remove("active");
    showAlert("Switched to TESTING mode");
    loadDashboard();
  });

  productionBtn?.addEventListener("click", () => {
    setMode("production");
    productionBtn.classList.add("active");
    testingBtn.classList.remove("active");
    showAlert("Switched to PRODUCTION mode");
    loadDashboard();
  });
}

// ============================================
// MODAL FUNCTIONS
// ============================================

/**
 * Open schedule modal for a campaign
 */
function openCampaignScheduleModal(campaignDataId) {
  window.currentCampaignDataIdForSchedule = campaignDataId;
  document.getElementById("scheduleDate").value = "";
  document.getElementById("scheduleTime").value = "";
  document.getElementById("scheduleModal").style.display = "flex";
}

/**
 * Close schedule modal
 */
function closeCampaignScheduleModal() {
  document.getElementById("scheduleModal").style.display = "none";
  window.currentCampaignDataIdForSchedule = null;
}

/**
 * Show recipients modal
 */
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
                 ${r.firstName || ""} ${r.lastName || ""} - ${
                r.email || r.address || "N/A"
              }
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

/**
 * Close preview modal
 */
function closePreview() {
  const overlay = document.getElementById("previewOverlay");
  overlay.style.display = "none";
  document.getElementById("previewBody").innerHTML = "";
}

// ============================================
// API FUNCTIONS
// ============================================

/**
 * Get PCM token for API calls
 */
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

/**
 * Confirm campaign schedule
 */
async function confirmCampaignSchedule() {
  const campaignDataId = window.currentCampaignDataIdForSchedule;
  if (!campaignDataId) return;

  const date = document.getElementById("scheduleDate").value;
  const time = document.getElementById("scheduleTime").value;

  if (!date || !time) {
    showAlert("Please select both date and time.");
    return;
  }

  const scheduleDateTime = `${date}T${time}:00`;

  try {
    const res = await fetch(
      `https://pcm-app.duckdns.org/campaign-data/${campaignDataId}`,
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
    showAlert(
      `Schedule updated for ${formatScheduleInfo(updatedData.schedule_time)}`
    );
    closeCampaignScheduleModal();
  } catch (err) {
    console.error("Error updating campaign schedule:", err);
    showAlert("Failed to update schedule: " + err.message);
  }
}

// ============================================
// DASHBOARD LOADER
// ============================================

/**
 * Load dashboard data
 */
async function loadDashboard() {
  try {
    const dashboardEl = document.querySelector(".dashboard");
    const mode = getCurrentMode();

    console.log("Loading dashboard with mode:", mode);

    // Fetch campaign data
    const res = await fetch(`https://pcm-app.duckdns.org/dashboard/all?mode=${mode}`);
    if (!res.ok && res.status !== 404)
      throw new Error("Failed to load campaigns");
    const data = res.status === 404 ? { data: [] } : await res.json();

    // Fetch one-off mailers
    const oneOffRes = await fetch(
      `https://pcm-app.duckdns.org/mailer-one-off/all?mode=${mode}`
    );
    let oneOffData = { data: [] };
    if (oneOffRes.ok) {
      const json = await oneOffRes.json();
      oneOffData.data = Array.isArray(json) ? json : json.data || [];
    }

    // Categorize data into Direct Mail Orders and RES OCC Orders
    const categorizedData = categorizeOrders(data, oneOffData);
    const directMailOrders = categorizedData.directMailOrders;
    const resOccOrders = categorizedData.resOccOrders;

    // ============================================
    // UPDATE CARD COUNTS - Direct Mail & RES OCC
    // ============================================
    document.getElementById("totalDirectMailOrders").textContent = directMailOrders.length;
    document.getElementById("totalResOccOrders").textContent = resOccOrders.length;

    // Remove existing table
    const existingTable = dashboardEl.querySelector("#campaignDataTable");
    if (existingTable) existingTable.remove();

    const detailsDiv = document.createElement("div");
    detailsDiv.id = "campaignDataTable";

    // Combine all data
    const combined = [...directMailOrders, ...resOccOrders];

    // Render table with categorized view
    if (!combined.length) {
      detailsDiv.innerHTML = `<p style="margin-top:20px; font-size:16px; color:#555; text-align:center;">No data available. Create a campaign or mailer to get started.</p>`;
    } else {
      detailsDiv.innerHTML = `
        <div style="margin-top: 24px;">
          <table style="width:100%; border-collapse: collapse; box-shadow: 0 2px 12px rgba(0,0,0,0.08); border-radius: 12px; overflow: hidden; background: white;">
            <thead>
              <tr style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
                <th style="padding:16px 20px; text-align:left; font-weight:600; font-size:14px; text-transform:uppercase; letter-spacing:0.5px;">Type</th>
                <th style="padding:16px 20px; text-align:left; font-weight:600; font-size:14px; text-transform:uppercase; letter-spacing:0.5px;">Name</th>
                <th style="padding:16px 20px; text-align:left; font-weight:600; font-size:14px; text-transform:uppercase; letter-spacing:0.5px;">Category</th>
                <th style="padding:16px 20px; text-align:left; font-weight:600; font-size:14px; text-transform:uppercase; letter-spacing:0.5px;">Audience</th>
                <th style="padding:16px 20px; text-align:center; font-weight:600; font-size:14px; text-transform:uppercase; letter-spacing:0.5px;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${combined
                .map(
                  (d) => `
                <tr style="border-bottom: 1px solid #f0f0f0; transition: background 0.2s;" onmouseover="this.style.background='#f8f9fa'" onmouseout="this.style.background='white'">
                  <td style="padding:16px 20px;">
                    <span style="display:inline-block; padding:6px 12px; border-radius:6px; font-size:12px; font-weight:600; 
                      ${getTypeStyle(d.itemType)}">
                      ${getTypeLabel(d.itemType)}
                    </span>
                  </td>
                  <td style="padding:16px 20px;">
                    <span style="display:inline-block; padding:6px 12px; border-radius:6px; font-size:13px; font-weight:600; background: #d3e0e2ff; color: #1a5b6eff;">
                      ${d.name}
                    </span>
                  </td>
                  <td style="padding:16px 20px;">
                    <span style="display:inline-block; padding:6px 12px; border-radius:6px; font-size:12px; font-weight:600; 
                      ${getCategoryStyle(d.category)}">
                      ${d.category}
                    </span>
                  </td>
                  <td style="padding:16px 20px;">
                    ${
                      d.category === "RES OCC Order"
                        ? `<span style="color:#94a3b8; font-style:italic; font-size:13px;">no audience</span>`
                        : d.audience_list && d.audience_list.length
                        ? `<button class="view-recipients-btn" 
                            data-id="${d.audience_id || d.id}" 
                            data-name="${d.audience_name}"
                            data-type="${d.itemType}"
                            style="padding:8px 16px; background:#10b981; color:white; border:none; border-radius:6px; cursor:pointer; font-size:13px; font-weight:500; transition: all 0.2s;"
                            onmouseover="this.style.background='#059669'" 
                            onmouseout="this.style.background='#10b981'">
                            ${d.audience_name}
                          </button>`
                        : `<span style="color:#94a3b8; font-size:13px;">No audience</span>`
                    }
                  </td>
                  <td style="padding:16px 20px; text-align:center;">
                    <button class="view-details-btn" 
                            data-id="${d.id}" 
                            data-type="${d.itemType}"
                            style="padding:8px 20px; background:#636185; color:white; border:none; border-radius:6px; cursor:pointer; font-size:13px; font-weight:500; transition: all 0.2s;"
                            onmouseover="this.style.background='#4a4769'" 
                            onmouseout="this.style.background='#636185'">
                      View Details
                    </button>
                  </td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
        </div>`;
    }

    dashboardEl.appendChild(detailsDiv);

    // Attach event listeners
    attachTableEventListeners(combined);
  } catch (err) {
    console.error(err);
    showAlert("Failed to load dashboard data");
  }
}

/**
 * Categorize orders into Direct Mail and RES OCC
 */
function categorizeOrders(campaignData, oneOffData) {
  const directMailOrders = [];
  const resOccOrders = [];

  // Process campaign data
  let seenCampaignIds = new Set();
  if (campaignData.data) {
    for (let d of campaignData.data) {
      if (!seenCampaignIds.has(d.campaign_id)) {
        seenCampaignIds.add(d.campaign_id);

        if (!d.res_recipients || d.res_recipients === null) {
          // Direct Mail Order
          directMailOrders.push({
            id: d.campaign_id,
            itemType: "campaign",
            name: d.campaign_name,
            audience_name: d.audience_name || "Unknown",
            audience_id: d.audience_id || null,
            audience_list: d.audience_list || [],
            category: "Direct Mail Order",
            status: d.status,
            send_date: d.send_date,
          });
        } else {
          // RES OCC Order
          resOccOrders.push({
            id: d.campaign_id,
            itemType: "campaign",
            name: d.campaign_name,
            audience_name: d.audience_name || "Unknown",
            audience_id: d.audience_id || null,
            audience_list: d.audience_list || [],
            category: "RES OCC Order",
            status: d.status,
            send_date: d.send_date,
          });
        }
      }
    }
  }

  // Process one-off mailers
  oneOffData.data.forEach((d) => {
    if (!d.res_recipients || d.res_recipients === null) {
      // Direct Mail Order
      directMailOrders.push({
        id: d.id,
        itemType: "oneoff",
        name: d.mailer_name,
        audience_name: d.audience_name || "Unknown",
        audience_id: d.audience_id || null,
        audience_list: d.audience_list || [],
        category: "Direct Mail Order",
        status: d.status,
        send_date: d.send_date,
      });
    } else {
      // RES OCC Order
      resOccOrders.push({
        id: d.id,
        itemType: "oneoff",
        name: d.mailer_name,
        audience_name: d.audience_name || "Unknown",
        audience_id: d.audience_id || null,
        audience_list: d.audience_list || [],
        category: "RES OCC Order",
        status: d.status,
        send_date: d.send_date,
      });
    }
  });

  return { directMailOrders, resOccOrders };
}

/**
 * Get type badge styling
 */
function getTypeStyle(type) {
  switch (type) {
    case "campaign":
      return "background:#dbeafe; color:#1e40af;";
    case "oneoff":
      return "background:#d1fae5; color:#065f46;";
    default:
      return "background:#f3f4f6; color:#4b5563;";
  }
}

/**
 * Get type label
 */
function getTypeLabel(type) {
  switch (type) {
    case "campaign":
      return "Campaign";
    case "oneoff":
      return "One-Off Mailer";
    default:
      return "Unknown";
  }
}

/**
 * Get category badge styling
 */
function getCategoryStyle(category) {
  switch (category) {
    case "Direct Mail Order":
      return "background:#fce7f3; color:#9d174d;";
    case "RES OCC Order":
      return "background:#fef3c7; color:#92400e;";
    default:
      return "background:#f3f4f6; color:#4b5563;";
  }
}

/**
 * Attach event listeners to table buttons
 */
function attachTableEventListeners(data) {
  document.querySelectorAll(".view-recipients-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const audienceId = btn.dataset.id;
      const record = data.find(
        (d) => String(d.audience_id) === String(audienceId)
      );

      if (!record || !record.audience_list || !record.audience_list.length) {
        Swal.fire({
          icon: "info",
          title: "No recipients found",
          text: `No recipients available for ${
            record?.audience_name || "this audience"
          }.`,
        });
        return;
      }

      const recipients = record.audience_list
        .map(
          (r, i) => `
          <tr style="border-bottom: 1px solid #f0f0f0;">
            <td style="padding:10px 12px; font-size:13px;">${
              r.address || ""
            }</td>
            <td style="padding:10px 12px; font-size:13px;">${r.city || ""}</td>
            <td style="padding:10px 12px; font-size:13px;">${r.state || ""}</td>
            <td style="padding:10px 12px; font-size:13px;">${
              r.zipCode || ""
            }</td>
          </tr>`
        )
        .join("");

      Swal.fire({
        title: `Audience: ${record.audience_name}`,
        html: `
          <div style="max-height:400px; overflow-y:auto; text-align:left;">
            <table style="width:100%; border-collapse: collapse; margin-top:10px;">
              <thead>
                <tr style="background:#667eea; color:white;">
                  <th style="padding:12px; text-align:left; font-size:13px; font-weight:600;">Address</th>
                  <th style="padding:12px; text-align:left; font-size:13px; font-weight:600;">City</th>
                  <th style="padding:12px; text-align:left; font-size:13px; font-weight:600;">State</th>
                  <th style="padding:12px; text-align:left; font-size:13px; font-weight:600;">Zip</th>
                </tr>
              </thead>
              <tbody>${recipients}</tbody>
            </table>
          </div>
        `,
        width: 700,
        confirmButtonText: "Close",
      });
    });
  });

  // Details button clicks
  document.querySelectorAll(".view-details-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const type = btn.dataset.type;

      let url;
      if (type === "campaign") {
        url = `./campaign_detail.html?id=${id}`;
      } else {
        url = `./mailer_detail.html?id=${id}`;
      }

      // This updates the current tab's URL
      window.location.href = url;
    });
  });
}

// ============================================
// EVENT LISTENERS
// ============================================

document.addEventListener("DOMContentLoaded", async () => {
  console.log("Dashboard initialized");

  initializeModeSwitcher();
  await loadDashboard();
});

// Schedule modal - confirm button
document
  .getElementById("confirmScheduleBtn")
  ?.addEventListener("click", confirmCampaignSchedule);

// Schedule modal - cancel button
document
  .getElementById("cancelScheduleBtn")
  ?.addEventListener("click", closeCampaignScheduleModal);

// Schedule modal - close on outside click
window.addEventListener("click", (e) => {
  const modal = document.getElementById("scheduleModal");
  if (e.target === modal) closeCampaignScheduleModal();
});
