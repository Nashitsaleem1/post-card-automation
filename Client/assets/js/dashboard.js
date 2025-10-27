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

/**
 * Safely parse address list from JSON string
 */
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
                 ${r.firstName || ""} ${r.lastName || ""} - ${r.email || r.address || "N/A"}
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
      `https://pcm-app-h8mn8.ondigitalocean.app/campaign-data/${campaignDataId}`,
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
      `📅 Schedule updated for ${formatScheduleInfo(updatedData.schedule_time)}`
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
    const res = await fetch(
      `https://pcm-app-h8mn8.ondigitalocean.app/dashboard/all?mode=${mode}`
    );
    if (!res.ok && res.status !== 404)
      throw new Error("Failed to load campaigns");
    const data = res.status === 404 ? { data: [] } : await res.json();

    // Fetch one-off mailers
    const oneOffRes = await fetch(
      `https://pcm-app-h8mn8.ondigitalocean.app/mailer-one-off/all?mode=${mode}`
    );
    let oneOffData = { data: [] };
    if (oneOffRes.ok) {
      const json = await oneOffRes.json();
      oneOffData.data = Array.isArray(json) ? json : json.data || [];
      oneOffData.total_one_off_mailers =
        json.total_one_off_mailers || oneOffData.data.length;
    }

    // Update counts
    document.getElementById("totalCampaigns").textContent =
      data.total_campaigns || 0;
    document.getElementById("totalOneOffMailers").textContent =
      oneOffData.total_one_off_mailers || 0;

    // Remove existing table
    const existingTable = dashboardEl.querySelector("#campaignDataTable");
    if (existingTable) existingTable.remove();

    const detailsDiv = document.createElement("div");
    detailsDiv.id = "campaignDataTable";

    // Deduplicate campaigns
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

    // Combine campaigns and mailers
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

    // Render table or empty state
    if (!combined.length) {
      detailsDiv.innerHTML = `<p style="margin-top:20px; font-size:16px; color:#555;">No data to show.</p>`;
    } else {
      detailsDiv.innerHTML = `
        <table style="width:100%; border-collapse: separate; border-spacing: 0 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border-radius: 8px; overflow: hidden;">
          <thead style="transform: translateY(-16px);">
            <tr style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
              <th style="padding:18px;">Type</th>
              <th style="padding:18px;">Name</th>
              <th style="padding:18px;">Recipients</th>
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

    // Attach event listeners
    attachTableEventListeners(combined);
  } catch (err) {
    console.error(err);
    showAlert("Failed to load dashboard data");
  }
}

/**
 * Attach event listeners to table buttons
 */
function attachTableEventListeners(combined) {
  // Recipients button clicks
  document.querySelectorAll(".view-recipients-btn").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      const id = parseInt(event.target.dataset.id);
      const type = event.target.dataset.type;
      const item = combined.find((d) => d.id === id && d.type === type);
      if (item) showRecipientsModal(item.recipientsList);
    });
  });

  // Details button clicks
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