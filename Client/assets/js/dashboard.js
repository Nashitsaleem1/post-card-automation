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


// ----------------------
// Dashboard Loader
// ----------------------
let currentMode = sessionStorage.getItem('apiMode') || 'testing';
console.log('Current API Mode:', currentMode);

// Function to get current mode
function getCurrentMode() {
  return sessionStorage.getItem('apiMode') || 'testing';
}

async function loadDashboard() {
  try {
    const dashboardEl = document.querySelector(".dashboard");
    mode = getCurrentMode();

    // ---- Fetch Campaign Data ----
    const res = await fetch(`https://pcm-app-h8mn8.ondigitalocean.app/dashboard/all?mode=${mode}`);
    if (!res.ok && res.status !== 404)
      throw new Error("Failed to load campaigns");
    const data = res.status === 404 ? { data: [] } : await res.json();

    // ---- Fetch One-Off Mailers ----
    const oneOffRes = await fetch(`https://pcm-app-h8mn8.ondigitalocean.app/mailer-one-off/all?mode=${mode}`);
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

    // // make sure campaigns are stored globally
    // const campaigns = window.allCampaigns || [];

    // if (campaigns.length > 0) {
    //   // always open the first one (newest)
    //   openCampaignDetailModal(campaigns[0]);
    // } else {
    //   console.warn("⚠️ No campaigns available to open.");
    // }
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
