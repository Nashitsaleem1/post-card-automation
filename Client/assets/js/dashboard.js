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
async function loadDashboard() {
  try {
    const res = await fetch("http://127.0.0.1:8000/dashboard/latest");

    if (res.status === 404) {
      document.getElementById("totalCampaigns").textContent = "0";
      document.getElementById("latestCampaign").textContent =
        "No campaign created yet!";
      document.getElementById("totalRecipients").textContent = "0";

      const dashboardEl = document.querySelector(".dashboard");
      const existingTable = dashboardEl.querySelector("#campaignDataTable");
      if (existingTable) existingTable.remove();

      const detailsDiv = document.createElement("div");
      detailsDiv.id = "campaignDataTable";
      detailsDiv.innerHTML = `<p style="margin-top: 20px; font-size:16px; color:#555;">
        No campaign data to show.
      </p>`;
      dashboardEl.appendChild(detailsDiv);
      return;
    }

    if (!res.ok) throw new Error("Failed to load dashboard");

    const data = await res.json();

    // --- Fill summary cards ---
    const totalCampaigns = data.campaign ? 1 : 0;
    document.getElementById("totalCampaigns").textContent = totalCampaigns;

    document.getElementById("latestCampaign").textContent = data.campaign
      ? `${data.campaign.campaign_name} (Mailer: ${data.campaign.mailer_name})`
      : "No campaigns";

    document.getElementById("totalRecipients").textContent = data.data
      ? data.data.reduce(
          (sum, d) => sum + (safeParseRecipients(d.address_list).length || 0),
          0
        )
      : "0";

    // --- Show campaign data table ---
    const dashboardEl = document.querySelector(".dashboard");
    const existingTable = dashboardEl.querySelector("#campaignDataTable");
    if (existingTable) existingTable.remove();

    const detailsDiv = document.createElement("div");
    detailsDiv.id = "campaignDataTable";

    if (!data.data || !data.data.length) {
      detailsDiv.innerHTML = `<p style="margin-top: 20px; font-size:16px; color:#555;">
        No campaign data to show.
      </p>`;
    } else {
      detailsDiv.innerHTML = `
  <h2>📋 Campaign Data</h2>
  <table style="margin-top:30px; width:100%; border-spacing:0 16px; border-collapse:separate; box-shadow:0 2px 8px rgba(0,0,0,0.1); border-radius:8px; overflow:hidden;">
    <thead>
      <tr style="background:#1a365d; color:white;">
        <th style="padding:18px; text-align:left; width:18%;">Campaign Name</th>
        <th style="padding:18px; text-align:left; width:15%;">Recipients</th>
        <th style="padding:18px; text-align:left; width:18%;">Template</th>
        <th style="padding:18px; text-align:left; width:20%;">Schedule Time</th>
        <th style="padding:18px; text-align:left; width:11%;">Status</th>
        <th style="padding:18px; text-align:left; width:17%;">Action</th>
      </tr>
    </thead>
    <tbody>
      ${data.data
        .map((d, i) => {
          const statusClass =
            d.status?.toLowerCase() === "sent"
              ? "background:#5a9c69; color:white; padding:6px 10px; border-radius:20px; font-size:13px; min-width:90px; min-height:30px; display:inline-block; text-align:center;"
              : d.status?.toLowerCase() === "scheduled"
              ? "background:#17a2b8; color:white; padding:6px 10px;  border-radius:20px; font-size:13px; min-width:90px;  min-height:30px; display:inline-block; text-align:center;"
              : "background:#6c757d; color:white; padding:6px 10px;  border-radius:20px; font-size:13px; min-width:90px;  min-height:30px; display:inline-block; text-align:center;";

          return `
          <tr style="background:white; box-shadow:0 1px 4px rgba(0,0,0,0.05); border-radius:6px;">
            <td style="padding:12px; width:20%;">${
              data.campaign.campaign_name
            }</td>
            <td style="padding:12px; width:15%;">${formatAddresses(
              d.address_list
            )}</td>
            <td style="padding:12px; width:15%;">
              <button class="toggle-template-btn" data-index="${i}" style="padding:7px 10px; background:#1abc9c; color:white; border:none; border-radius:5px; cursor:pointer;">
                View Template
              </button>
              <div id="template-preview-${i}" style="display:none; margin-top:8px; border:1px solid #ddd; padding:8px; border-radius:6px; background:#fafafa;">
                ${d.template_preview || "N/A"}
              </div>
            </td>
            <td style="padding:12px; width:20%;">${formatScheduleInfo(
              d.schedule_time
            )}</td>
            <td style="padding:12px; width:12%;"><span style="${statusClass}">${
            d.status
          }</span></td>
            <td style="padding:12px; width:13%;">
              <button class="view-details-btn" data-index="${i}" style="padding:7px 10px; background:#636185; color:white; border:none; border-radius:5px; cursor:pointer;">
                View Details
              </button>
            </td>
          </tr>`;
        })
        .join("")}
    </tbody>
  </table>
`;
    }

    dashboardEl.appendChild(detailsDiv);

    // --- Template toggle logic ---
    document.querySelectorAll(".toggle-template-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = btn.dataset.index;
        const preview = document.getElementById(`template-preview-${idx}`);
        if (preview.style.display === "none") {
          preview.style.display = "block";
          btn.textContent = "Hide Template";
        } else {
          preview.style.display = "none";
          btn.textContent = "View Template";
        }
      });
    });

    // --- Modal Logic ---
    const modal = document.getElementById("campaignModal2");
    const closeBtn = modal.querySelector(".close");
    const modalCampaignName = document.getElementById("modalCampaignName");
    const modalMailerName = document.getElementById("modalMailerName");
    const modalAddresses = document.getElementById("modalAddresses");
    const filterCheckbox = document.getElementById("filterScanned");

    let currentRecipients = [];

    function renderAddresses() {
      let recipientsToShow = currentRecipients;
      if (filterCheckbox.checked) {
        recipientsToShow = recipientsToShow.filter((r) => r.scanned);
      }

      modalAddresses.innerHTML = recipientsToShow.length
        ? `<ul>${recipientsToShow
            .map(
              (r) =>
                `<li><strong>Address:</strong> ${r.address}<br/>
                 <strong>Status:</strong> ${
                   r.scanned ? "✅ Scanned" : "❌ Not Scanned"
                 }</li>`
            )
            .join("")}</ul>`
        : "<p>No addresses available.</p>";
    }

    document.querySelectorAll(".view-details-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const index = btn.dataset.index;
        const d = data.data[index];

        modalCampaignName.textContent = data.campaign.campaign_name;
        modalMailerName.textContent = data.campaign.mailer_name;

        currentRecipients =
          typeof d.address_list === "string"
            ? safeParseRecipients(d.address_list)
            : d.address_list;

        const scannedRecipients = await fetchScannedAddresses(d.qr_code_id);

        currentRecipients = currentRecipients.map((r) => {
          const matched = scannedRecipients.find(
            (s) =>
              s.firstName === r.firstName &&
              s.lastName === r.lastName &&
              s.address === r.address
          );
          return { ...r, scanned: !!matched };
        });

        filterCheckbox.checked = false;
        renderAddresses();
        modal.style.display = "block";
      });
    });

    closeBtn.onclick = () => (modal.style.display = "none");
    window.onclick = (e) => {
      if (e.target === modal) modal.style.display = "none";
    };

    filterCheckbox.addEventListener("change", renderAddresses);
  } catch (err) {
    console.error(err);
    alert("Failed to load dashboard data");
  }
}

loadDashboard();
