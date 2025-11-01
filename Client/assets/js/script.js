// ============================================
// GLOBAL VARIABLES & CONTEXT MANAGEMENT
// ============================================

let currentEditingTemplateId = null;
let recipients = [];
let currentCampaignId = null;
let currentCampaignDataId = null;
window.currentEditingTemplateId = null;
const alertOkBtn = document.getElementById("alertOkBtn");

function getContextFromStorage() {
  // 1️⃣ Check campaign context first
  const campaignStored = sessionStorage.getItem("campaignContext");
  if (campaignStored) {
    const context = JSON.parse(campaignStored);
    console.log("📌 Campaign context retrieved:", context);
    return { ...context, sourceType: "campaign" };
  }

  // 2️⃣ Check mailer context next
  const mailerStored = sessionStorage.getItem("mailerContext");
  if (mailerStored) {
    const context = JSON.parse(mailerStored);
    console.log("📌 Mailer context retrieved:", context);
    return { ...context, sourceType: "mailer" };
  }

  // 3️⃣ Fallback generic context (if saved under just 'context')
  const genericStored = sessionStorage.getItem("context");
  if (genericStored) {
    const context = JSON.parse(genericStored);
    console.log("📌 Generic context retrieved:", context);
    return { ...context, sourceType: context.mode || "unknown" };
  }

  console.warn("⚠️ No context found in sessionStorage");
  return null;
}

function clearContextFromStorage() {
  sessionStorage.removeItem("campaignContext");
  sessionStorage.removeItem("mailerContext");
  sessionStorage.removeItem("context");
  console.log("🗑️ All context types cleared (campaign, mailer, generic)");
}


// ============================================
// API MODE MANAGEMENT
// ============================================

let currentMode = sessionStorage.getItem("apiMode") || "testing";
console.log("Current API Mode:", currentMode);

function getCurrentMode() {
  return sessionStorage.getItem("apiMode") || "testing";
}

function setApiMode(mode) {
  sessionStorage.setItem("apiMode", mode);
  currentMode = mode;
  console.log("API Mode set to:", mode);
}

// ============================================
// MODAL FUNCTIONS
// ============================================

window.showSuccessModal = function () {
  document.getElementById("successModal").style.display = "block";
};

window.closeModal = function () {
  document.getElementById("successModal").style.display = "none";
};

// ============================================
// AUTHENTICATION
// ============================================

async function getToken(env = null) {
  const selectedEnv = env || getCurrentMode();

  const credentials = {
    testing: {
      apiKey: "Mzk2N2YyZTktZmNkNy00YjcwLWJhMjUtMTM4ZWFlZDhmNWU0",
      apiSecret: "YzU0NTRiMjgtOTE3Mi00YTRmLWE3YjQtYTc0ODE1N2FmOGNl",
      childRefNbr: "myAccountReference",
      url: "https://v3.pcmintegrations.com/auth/login",
    },
    production: {
      apiKey: "Mzk2N2YyZTktZmNkNy00YjcwLWJhMjUtMTM4ZWFlZDhmNWU0",
      apiSecret: "YzU0NTRiMjgtOTE3Mi00YTRmLWE3YjQtYTc0ODE1N2FmOGNl",
      childRefNbr: "myAccountReference",
      url: "https://v3.pcmintegrations.com/auth/login",
    },
  };

  const creds = credentials[selectedEnv];
  const payload = {
    apiKey: creds.apiKey,
    apiSecret: creds.apiSecret,
    childRefNbr: creds.childRefNbr,
  };

  const res = await fetch(creds.url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok)
    throw new Error(`Auth failed for ${selectedEnv.toUpperCase()} environment`);
  const data = await res.json();
  return data.token;
}

// ============================================
// CANVA TEMPLATES LOADING
// ============================================

function loadCanvaTemplates() {
  const canvaGrid = document.getElementById("canvaGrid");
  if (!canvaGrid) return;

  canvaGrid.innerHTML = "";

  const canvaTemplates = [
    {
      title: "Real Estate Flyer",
      designId: "DAG3A04iRpM",
      editUrl:
        "https://www.canva.com/design/DAG3A04iRpM/Ik1a80KaHLKJ95zYfQSxRQ/edit?utm_content=DAG3A04iRpM&utm_campaign=designshare&utm_medium=link2&utm_source=sharebutton",
      embedUrl:
        "https://www.canva.com/design/DAG3A04iRpM/Ik1a80KaHLKJ95zYfQSxRQ/view",
    },
    {
      title: "Modern Postcard",
      designId: "DAG3BBYzl4g",
      editUrl:
        "https://www.canva.com/design/DAG3BBYzl4g/PwlL-5y9M5iJKap4ZxME1w/edit?utm_content=DAG3BBYzl4g&utm_campaign=designshare&utm_medium=link2&utm_source=sharebutton",
      embedUrl:
        "https://www.canva.com/design/DAG3BBYzl4g/PwlL-5y9M5iJKap4ZxME1w/view",
    },
    {
      title: "Business Card",
      designId: "DAG3BF36tis",
      editUrl:
        "https://www.canva.com/design/DAG3BF36tis/2HpHNXIuv4Z5cvJ1xCmY4w/edit?utm_content=DAG3BF36tis&utm_campaign=designshare&utm_medium=link2&utm_source=sharebutton",
      embedUrl:
        "https://www.canva.com/design/DAG3BF36tis/2HpHNXIuv4Z5cvJ1xCmY4w/view",
    },
    {
      title: "Marketing Mailer",
      designId: "DAG3BK62nU4",
      editUrl:
        "https://www.canva.com/design/DAG3BK62nU4/pZf_2nk3OPjw-1ChnCQAbg/edit?utm_content=DAG3BK62nU4&utm_campaign=designshare&utm_medium=link2&utm_source=sharebutton",
      embedUrl:
        "https://www.canva.com/design/DAG3BK62nU4/pZf_2nk3OPjw-1ChnCQAbg/view",
    },
    {
      title: "Event Invitation",
      designId: "DAG3BJ40JBI",
      editUrl:
        "https://www.canva.com/design/DAG3BJ40JBI/PKzP7Ua4TAbeKiP2w6WFDw/edit?utm_content=DAG3BJ40JBI&utm_campaign=designshare&utm_medium=link2&utm_source=sharebutton",
      embedUrl:
        "https://www.canva.com/design/DAG3BJ40JBI/PKzP7Ua4TAbeKiP2w6WFDw/view",
    },
    {
      title: "Newsletter Design",
      designId: "DAG3BE63c4M",
      editUrl:
        "https://www.canva.com/design/DAG3BE63c4M/F0Pojqnm5VB1Y4kdKk4Hag/edit?utm_content=DAG3BE63c4M&utm_campaign=designshare&utm_medium=link2&utm_source=sharebutton",
      embedUrl:
        "https://www.canva.com/design/DAG3BE63c4M/F0Pojqnm5VB1Y4kdKk4Hag/view",
    },
    {
      title: "Promotional Flyer",
      designId: "DAG3BF7HQr0",
      editUrl:
        "https://www.canva.com/design/DAG3BF7HQr0/kbGj5zkmkPaVtlyuoepvNQ/edit?utm_content=DAG3BF7HQr0&utm_campaign=designshare&utm_medium=link2&utm_source=sharebutton",
      embedUrl:
        "https://www.canva.com/design/DAG3BF7HQr0/kbGj5zkmkPaVtlyuoepvNQ/view",
    },
  ];

  canvaTemplates.forEach((template) => {
    const card = document.createElement("div");
    card.className = "tg-canva-card";
    card.innerHTML = `
        <div class="tg-canva-preview-container">
          <iframe 
            src="${template.embedUrl}?embed" 
            class="tg-canva-preview" 
            allowfullscreen 
            loading="lazy"
          ></iframe>
          <div class="tg-canva-badge">✨ Canva</div>
        </div>
        <div class="tg-canva-footer">
          <h3 class="tg-canva-title">${template.title}</h3>
          <div class="tg-canva-button-group">
            <button class="tg-canva-btn" onclick="window.open('${template.editUrl}', '_blank')">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
              Edit in Canva
            </button>
            <button class="tg-canva-btn tg-export-pdf-btn" onclick="exportCanvaPdf('${template.designId}', '${template.title}')">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              Export & Send Brochure
            </button>
          </div>
        </div>
      `;
    canvaGrid.appendChild(card);
  });
}

// ============================================
// CANVA PDF EXPORT (UPDATED FOR MAILER CONTEXT)
// ============================================

async function exportCanvaPdf(designId, designTitle) {
  // Retrieve context (campaign or mailer)
  const context = getContextFromStorage();

  if (!context) {
    showAlert(
      "⚠️ Please create a Campaign or Mailer first with recipients, then export from Canva templates."
    );
    return;
  }

  console.log("📦 Context retrieved:", context);
  console.log("🔍 Context sourceType:", context.sourceType);
  console.log("🔍 Mode:", context.mode);

  // ✅ Handle recipients based on context type
  let finalRecipients = context.recipients || [];

  // If recipients are not in context but audience_id exists, fetch from database
  if (
    context.selectedAudienceId &&
    (!finalRecipients || finalRecipients.length === 0)
  ) {
    console.log(
      `📥 ${context.sourceType} context: Fetching recipients for audience ID:`,
      context.selectedAudienceId
    );
    try {
      const response = await fetch(
        `https://pcm-app-h8mn8.ondigitalocean.app/audiences/${context.selectedAudienceId}`
      );
      if (!response.ok) throw new Error("Failed to fetch audience");

      const audience = await response.json();
      const audienceList = Array.isArray(audience.audience_list)
        ? audience.audience_list
        : JSON.parse(audience.audience_list);

      finalRecipients = audienceList;
      console.log(
        "✅ Recipients fetched from audience:",
        finalRecipients.length
      );
    } catch (err) {
      console.error("Error fetching audience:", err);
      showAlert("⚠️ Failed to fetch recipients from audience");
      return;
    }
  }

  // Verify recipients exist
  if (!finalRecipients || finalRecipients.length === 0) {
    showAlert(
      "⚠️ No recipients found. Please add recipients before exporting."
    );
    return;
  }

  console.log(
    "✅ Context validation passed. Recipients:",
    finalRecipients.length
  );
  console.log("📊 Context details:", {
    sourceType: context.sourceType,
    mode: context.mode,
    mailerId: context.mailerId,
    mailerName: context.mailerName,
    campaignName: context.campaignName,
    recipientCount: finalRecipients.length,
    selectedAudienceId: context.selectedAudienceId,
    envMode: context.envMode,
  });

  // Get button from event or find it
  const btn =
    event?.target?.closest(".tg-export-pdf-btn") ||
    document.querySelector(".tg-export-pdf-btn");

  if (!btn) {
    console.error("Export button not found");
    showAlert("⚠️ Error: Could not find export button");
    return;
  }

  const originalText = btn.innerHTML;

  btn.disabled = true;
  btn.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="1"></circle>
      <circle cx="19" cy="5" r="1"></circle>
      <circle cx="5" cy="19" r="1"></circle>
    </svg>
    Exporting...
  `;

  try {
    const tokenRes = await fetch("https://pcm-app-h8mn8.ondigitalocean.app/get_canva_token");
    if (!tokenRes.ok) {
      throw new Error("Failed to fetch access token");
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    const exportRes = await fetch("https://api.canva.com/rest/v1/exports", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        design_id: designId,
        format: {
          type: "pdf",
          size: "letter",
        },
      }),
    });

    if (!exportRes.ok) {
      const errorData = await exportRes.json();
      throw new Error(`Export failed: ${errorData.message || "Unknown error"}`);
    }

    const exportData = await exportRes.json();
    const exportId = exportData.job?.id;

    const pdfUrl = await getExportUrlUntilReady(exportId, accessToken);
    console.log(`✅ PDF URL for ${designTitle}:`, pdfUrl);

    // Pass updated context with recipients to preview modal
    const updatedContext = {
      ...context,
      recipients: finalRecipients,
    };

    showBrochurePreviewModal(pdfUrl, designTitle, updatedContext);
  } catch (err) {
    console.error("PDF export error:", err);
    showAlert(`❌ Export failed: ${err.message}`);
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
}

async function getExportUrlUntilReady(
  exportId,
  accessToken,
  interval = 3000,
  maxAttempts = 20
) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`⏳ Checking export status... (Attempt ${attempt})`);

    const res = await fetch(
      `https://api.canva.com/rest/v1/exports/${exportId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!res.ok) throw new Error("Failed to check export status");

    const data = await res.json();
    console.log("Export status:", data.job?.status);

    if (data.job?.status === "success") {
      console.log("✅ Export ready!");
      return data.job?.urls?.[0] || null;
    }

    if (data.job?.status === "failed") {
      throw new Error("❌ Export failed on Canva side");
    }

    await new Promise((r) => setTimeout(r, interval));
  }

  throw new Error(
    "⚠️ Export timeout — still processing after multiple attempts"
  );
}

// ============================================
// BROCHURE PREVIEW MODAL
// ============================================

let pdfZoomLevel = 100;

function showBrochurePreviewModal(pdfUrl, designTitle, context = null) {
  const modal = document.getElementById("brochurePreviewModal");
  if (!modal) {
    showAlert("Preview modal not found!");
    return;
  }

  const previewContent = document.getElementById("brochurePreviewContent");
  const confirmSendBtn = document.getElementById("confirmSendBrochureBtn");
  const downloadBtn = document.getElementById("downloadBrochureBtn");
  const zoomInBtn = document.getElementById("zoomInBtn");
  const zoomOutBtn = document.getElementById("zoomOutBtn");

  pdfZoomLevel = 100;

  if (previewContent) {
    previewContent.innerHTML = `
      <iframe 
        id="pdfPreviewFrame"
        src="${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0&zoom=${pdfZoomLevel}"
        style="width: 100%; height: 100%; border: none; margin: 0; padding: 0;"
      ></iframe>
    `;
  }

  if (downloadBtn) {
    downloadBtn.onclick = () => {
      const link = document.createElement("a");
      link.href = pdfUrl;
      link.download = `${designTitle}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };
  }

  if (zoomInBtn) {
    zoomInBtn.onclick = () => {
      pdfZoomLevel += 20;
      const frame = document.getElementById("pdfPreviewFrame");
      if (frame) {
        frame.src = `${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0&zoom=${pdfZoomLevel}`;
      }
    };
  }

  if (zoomOutBtn) {
    zoomOutBtn.onclick = () => {
      if (pdfZoomLevel > 50) {
        pdfZoomLevel -= 20;
        const frame = document.getElementById("pdfPreviewFrame");
        if (frame) {
          frame.src = `${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0&zoom=${pdfZoomLevel}`;
        }
      }
    };
  }

  if (confirmSendBtn) {
    confirmSendBtn.onclick = () => {
      orderDesignWithContext(pdfUrl, designTitle, context);
      modal.style.display = "none";
    };
  }

  modal.style.display = "flex";
}

function closeBrochurePreviewModal() {
  const modal = document.getElementById("brochurePreviewModal");
  if (modal) {
    modal.style.display = "none";
  }
}

// ============================================
// ORDER DESIGN WITH CONTEXT (UPDATED)
// ============================================

async function orderDesignWithContext(pdfUrl, designTitle, context) {
  try {
    console.log("📌 Starting order with context:", context);
    console.log("🔍 Context sourceType:", context.sourceType);
    console.log("🔍 Context mode:", context.mode);

    // Validate context
    if (!context) {
      showAlert("⚠️ Context not found. Please start over.");
      return;
    }

    if (!context.recipients || context.recipients.length === 0) {
      showAlert("⚠️ No recipients found.");
      return;
    }

    console.log("✅ All context validations passed");
    console.log("📊 Recipients count:", context.recipients.length);
    console.log("📊 Audience ID:", context.selectedAudienceId);
    console.log("📊 Mailer ID:", context.mailerId);

    // Get PCM API token with correct environment mode
    const token = await getToken(context.envMode || getCurrentMode());
    const today = new Date();
    const mailDate = today.toISOString().split("T")[0];

    // Build PCM order payload
    const payload = {
      mailClass: "FirstClass",
      recipients: context.recipients,
      designID: 0,
      brochure: pdfUrl,
      brochureOptions: {
        foldType: "Tri",
        exceptionalAddressingType: "resident",
      },
      extRefNbr: "12345",
      mailDate: mailDate,
      returnAddress: {
        firstName: "Mark",
        lastName: "Fazzini",
        address: "4175 Woodlands Pkwy",
        city: "Palm Harbor",
        state: "FL",
        zipCode: "34685",
      },
      cornerBorderOptions: {
        type: "square",
        color: "#FFF",
        gradient: {
          type: "radial",
          rotation: 0,
          colorStops: [{ offset: 0, color: "#FFF" }],
        },
      },
      cornerDotOptions: {
        type: "square",
        color: "#FFF",
        gradient: {
          type: "radial",
          rotation: 0,
          colorStops: [{ offset: 0, color: "#FFF" }],
        },
      },
    };

    console.log("📤 Sending order to PCM API...");

    // Send to PCM API
    const orderRes = await fetch(
      "https://v3.pcmintegrations.com/order/brochure",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    if (!orderRes.ok) {
      const errorData = await orderRes.json();
      throw new Error(`Order failed: ${errorData.message || "Unknown error"}`);
    }

    const orderData = await orderRes.json();
    console.log("✅ Order sent successfully:", orderData);

    // ✅ UPDATED LOGIC
    if (context.sourceType === "campaign" || context.mode === "campaign") {
      // --- CAMPAIGN MODE ---
      if (context.campaigndataId || context.mailerId) {
        // Update existing campaign data
        await updateCampaignDataWithCanva(context, pdfUrl);
        showAlert(`✅ Brochure sent and campaign updated successfully!`);
      } else {
        // Create new campaign
        await saveCampaignWithCanva(context, pdfUrl);
        showAlert(`✅ Brochure sent and campaign created successfully!`);
      }
    } else if (context.sourceType === "mailer" || context.mode === "mailer") {
      // --- MAILER MODE ---
      if (context.mailerId) {
        console.log("✏️ Updating existing mailer...");
        await updateMailerWithCanva(context, pdfUrl);
        showAlert(`✅ Brochure sent and mailer updated successfully!`);
      } else {
        console.log("🆕 Creating new mailer...");
        await saveMailerWithCanva(context, pdfUrl);
        showAlert(`✅ Brochure sent and mailer created successfully!`);
      }
    } else {
      console.warn(
        "⚠️ Unknown context mode. Could not determine whether to save campaign or mailer."
      );
    }
  } catch (err) {
    console.error("Order design error:", err);
    showAlert(`❌ Order failed: ${err.message}`);
  }
}

// ============================================
// UPDATE EXISTING CAMPAIGN DATA WITH CANVA LINK
// ============================================

async function updateCampaignDataWithCanva(context, canvaLink) {
  try {
    console.log("📌 Updating existing campaign_data with Canva link...");
    console.log("📦 Context:", {
      mailerId: context.mailerId || context.campaigndataId,
      campaignName: context.campaignName,
      mailerName: context.mailerName,
      recipientCount: context.recipients?.length || 0,
      selectedAudienceId: context.selectedAudienceId,
    });

    const recordId = context.campaigndataId || context.mailerId;
    if (!recordId) {
      throw new Error("Campaign data ID not found in context");
    }

    const updatePayload = {
      status: "sent",
      send_date: new Date().toISOString(),
      canva_link: canvaLink,
    };

    console.log("📊 Campaign data update payload:", updatePayload);
    console.log("📡 Updating campaign_data ID:", recordId);

    const updateRes = await fetch(
      `https://pcm-app-h8mn8.ondigitalocean.app/campaign-data/${recordId}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatePayload),
      }
    );

    if (!updateRes.ok) {
      const err = await updateRes.json();
      throw new Error(err.detail || "Failed to update campaign data");
    }

    const updatedData = await updateRes.json();
    const savedApiMode = sessionStorage.getItem("apiMode");
    sessionStorage.clear();
    if (savedApiMode) {
      sessionStorage.setItem("apiMode", savedApiMode);
      console.log("✅ apiMode restored:", savedApiMode);
    }
    window.location.href = "dashboard.html";
  } catch (err) {
    console.error("❌ Error updating campaign data:", err);
    throw err;
  }
}

// ============================================
// UPDATE MAILER WITH CANVA LINK (ONE-OFF MAILER)
// ============================================

async function updateMailerWithCanva(context, canvaLink) {
  try {
    console.log("📌 Updating one-off mailer with Canva link...");
    console.log("📦 Context:", {
      mailerId: context.mailerId,
      mailerName: context.mailerName,
      recipientCount: context.recipients?.length || 0,
      selectedAudienceId: context.selectedAudienceId,
      envMode: context.envMode,
    });

    if (!context.mailerId) {
      throw new Error("Mailer ID not found in context");
    }

    const updatePayload = {
      status: "sent",
      send_date: new Date().toISOString(),
      canva_link: canvaLink,
      env_mode: context.envMode || getCurrentMode(),
    };

    console.log("📊 Mailer update payload:", updatePayload);
    console.log("📡 Updating mailer-one-off ID:", context.mailerId);

    const updateRes = await fetch(
      `https://pcm-app-h8mn8.ondigitalocean.app/mailer-one-off/${context.mailerId}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatePayload),
      }
    );

    if (!updateRes.ok) {
      const err = await updateRes.json();
      throw new Error(err.detail || "Failed to update mailer");
    }

    const savedApiMode = sessionStorage.getItem("apiMode");
    sessionStorage.clear();
    if (savedApiMode) {
      sessionStorage.setItem("apiMode", savedApiMode);
      console.log("✅ apiMode restored:", savedApiMode);
    }
    window.location.href = "dashboard.html";

  } catch (err) {
    console.error("❌ Error updating mailer:", err);
    throw err;
  }
}

// ============================================
// SAVE NEW CAMPAIGN WITH CANVA LINK
// ============================================

async function saveCampaignWithCanva(context, canvaLink) {
  try {
    console.log("📌 Saving campaign with Canva link...");
    console.log("📊 Context:", {
      campaignName: context.campaignName,
      mailerName: context.mailerName,
      recipientCount: context.recipients.length,
      selectedAudienceId: context.selectedAudienceId,
    });

    if (!context.campaignName) {
      throw new Error("Campaign name is missing");
    }

    // Create campaign
    const campaignRes = await fetch("https://pcm-app-h8mn8.ondigitalocean.app/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaign_name: context.campaignName }),
    });

    if (!campaignRes.ok) {
      const err = await campaignRes.json();
      throw new Error(err.detail || "Failed to create campaign");
    }

    const campaign = await campaignRes.json();
    console.log("✅ Campaign created with ID:", campaign.id);

    // ✅ UPDATED: Create campaign data with audience_id
    const dataPayload = {
      campaign_id: campaign.id,
      mailer_name: context.mailerName,
      template_id: null,
      audience_id: context.selectedAudienceId || null,
      schedule_time: null,
      send_date: new Date().toISOString(),
      status: "sent",
      env_mode: context.envMode,

      canva_link: canvaLink,
    };

    const dataRes = await fetch("https://pcm-app-h8mn8.ondigitalocean.app/campaign-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dataPayload),
    });

    if (!dataRes.ok) {
      const err = await dataRes.json();
      throw new Error(err.detail || "Failed to save campaign data");
    }

    console.log("✅ Campaign data saved successfully");
    const savedApiMode = sessionStorage.getItem("apiMode");
    sessionStorage.clear();
    if (savedApiMode) {
      sessionStorage.setItem("apiMode", savedApiMode);
      console.log("✅ apiMode restored:", savedApiMode);
    }
    window.location.href = "dashboard.html";
  } catch (err) {
    console.error("Error saving campaign:", err);
    throw err;
  }
}

// ============================================
// SAVE ONE-OFF MAILER WITH CANVA LINK
// ============================================

async function saveMailerWithCanva(context, canvaLink) {
  try {
    console.log("📌 Saving mailer with Canva link...");
    console.log("📊 Context:", {
      mailerName: context.mailerName,
      recipientCount: context.recipients.length,
      selectedAudienceId: context.selectedAudienceId,
    });

    if (!context.mailerName) {
      throw new Error("Mailer name is missing");
    }

    const mailerPayload = {
      mailer_name: context.mailerName,
      template_id: null,
      audience_id: context.selectedAudienceId || null,
      schedule_time: null,
      send_date: new Date().toISOString(),
      status: "sent",
      env_mode: context.envMode,
      canva_link: canvaLink,
    };

    const mailerRes = await fetch("https://pcm-app-h8mn8.ondigitalocean.app/mailer-one-off", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mailerPayload),
    });

    if (!mailerRes.ok) {
      const err = await mailerRes.json();
      throw new Error(err.detail || "Failed to save mailer");
    }

    console.log("✅ Mailer saved successfully");
    const savedApiMode = sessionStorage.getItem("apiMode");
    sessionStorage.clear();
    if (savedApiMode) {
      sessionStorage.setItem("apiMode", savedApiMode);
      console.log("✅ apiMode restored:", savedApiMode);
    }
    window.location.href = "dashboard.html";
  } catch (err) {
    console.error("Error saving mailer:", err);
    throw err;
  }
}

// ============================================
// SIDEBAR NAVIGATION
// ============================================

function initializeSidebarNavigation() {
  const navItems = document.querySelectorAll(".tg-nav-item");

  navItems.forEach((item) => {
    item.addEventListener("click", () => {
      const view = item.dataset.view;

      navItems.forEach((navItem) => navItem.classList.remove("active"));
      item.classList.add("active");

      const letterView = document.getElementById("letterView");
      const canvaView = document.getElementById("canvaView");

      if (letterView && canvaView) {
        if (view === "letter") {
          letterView.classList.remove("hidden");
          canvaView.classList.add("hidden");
        } else if (view === "canva") {
          letterView.classList.add("hidden");
          canvaView.classList.remove("hidden");
          loadCanvaTemplates();
        }
      }
    });
  });
}

// ============================================
// TEMPLATE GALLERY
// ============================================

async function loadGalleryTemplates() {
  const templatesGrid = document.getElementById("templatesGrid");
  if (!templatesGrid) return;

  try {
    const response = await fetch("https://pcm-app-h8mn8.ondigitalocean.app/templates");
    const templates = await response.json();

    templatesGrid.innerHTML = "";

    if (templates.length === 0) {
      templatesGrid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: #64748b;">
          <p style="font-size: 1.125rem;">No templates found. Create your first template!</p>
        </div>
      `;
      return;
    }

    templates.forEach((tpl) => {
      const div = document.createElement("div");
      div.classList.add("template");
      div.dataset.templateId = tpl.id;
      div.dataset.qrCodeId = tpl.qr_code_id;

      const isEditable = tpl.id > 5;

      div.innerHTML = `
        <h3 class="template-title">${
          tpl.template_name || "Untitled Template"
        }</h3>
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
          ${
            isEditable
              ? `
            <button class="delete-btn" onclick="openDeleteConfirmModal(${tpl.id}, '${tpl.template_name}')">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" 
                   stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
            </button>
          `
              : ""
          }
        </div>
      `;

      templatesGrid.appendChild(div);
    });
  } catch (err) {
    console.error("Error loading templates:", err);
    templatesGrid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: #ef4444;">
        <p style="font-size: 1.125rem;">⚠️ Failed to load templates. Please try again later.</p>
      </div>
    `;
  }
}

// ============================================
// DELETE TEMPLATE FUNCTIONS
// ============================================

function openDeleteConfirmModal(templateId, templateName) {
  const modal = document.getElementById("deleteConfirmModal");
  if (!modal) {
    showAlert("Delete confirmation modal not found!");
    return;
  }

  const messageEl = document.getElementById("deleteConfirmMessage");
  if (messageEl) {
    messageEl.innerHTML = `Are you sure you want to delete the template "<strong>${templateName}</strong>"? This action cannot be undone.`;
  }

  const confirmBtn = document.getElementById("deleteConfirmBtn");
  const cancelBtn = document.getElementById("deleteCancelBtn");

  if (confirmBtn) {
    confirmBtn.onclick = () => {
      deleteTemplate(templateId);
    };
  }

  if (cancelBtn) {
    cancelBtn.onclick = () => {
      modal.style.display = "none";
    };
  }

  modal.style.display = "flex";
}

function closeDeleteConfirmModal() {
  const modal = document.getElementById("deleteConfirmModal");
  if (modal) {
    modal.style.display = "none";
  }
}

async function deleteTemplate(templateId) {
  try {
    const response = await fetch(
      `https://pcm-app-h8mn8.ondigitalocean.app/templates/${templateId}`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      }
    );

    if (response.status === 204) {
      closeDeleteConfirmModal();
      showAlert("✅ Template deleted successfully!");
      await loadGalleryTemplates();
    } else if (response.status === 403) {
      showAlert("⚠️ Default templates cannot be deleted.");
    } else if (response.status === 404) {
      showAlert("⚠️ Template not found.");
    } else {
      throw new Error("Failed to delete template");
    }
  } catch (err) {
    console.error("Error deleting template:", err);
    showAlert("Error deleting template: " + err.message);
  }
}

function setReturnTarget(sectionId) {
  sessionStorage.setItem("returnTarget", sectionId);
}

// ============================================
// EDIT MODAL FUNCTIONS
// ============================================

function openEditModal(templateId) {
  window.currentEditingTemplateId = templateId;
  const templateDiv = document.querySelector(
    `.template[data-template-id='${templateId}'] .letter-container`
  );
  if (templateDiv) {
    document.getElementById("letterEditor").innerHTML = templateDiv.innerHTML;
    document.getElementById("editModal").style.display = "block";
  }
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
        qr_code_id: qrCodeId,
      }),
    });

    if (!response.ok) throw new Error("Failed to create template");

    closeSaveAsNewModal();
    await loadGalleryTemplates();
    showAlert("✅ Template created successfully!");
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

// ============================================
// HAMBURGER MENU
// ============================================

function initializeHamburgerMenu() {
  const hamburger = document.getElementById("hamburger");
  const navLinks = document.querySelector(".nav-links");

  if (hamburger && navLinks) {
    hamburger.addEventListener("click", (e) => {
      e.stopPropagation();
      navLinks.classList.toggle("nav-active");
    });

    document.addEventListener("click", (e) => {
      if (
        navLinks.classList.contains("nav-active") &&
        !navLinks.contains(e.target) &&
        e.target !== hamburger
      ) {
        navLinks.classList.remove("nav-active");
      }
    });
  }
}

// ============================================
// USER GUIDE
// ============================================

function initializeUserGuide() {
  const guideIcon = document.getElementById("userGuideIcon");
  const guideOverlay = document.getElementById("userGuideOverlay");
  const closeGuide = document.getElementById("closeGuide");

  function closeUserGuide() {
    if (guideOverlay) guideOverlay.classList.remove("show");
  }

  if (guideIcon && guideOverlay) {
    guideIcon.addEventListener("click", () => {
      guideOverlay.classList.add("show");
    });
  }

  if (closeGuide) {
    closeGuide.addEventListener("click", closeUserGuide);
  }

  if (guideOverlay) {
    guideOverlay.addEventListener("click", (e) => {
      if (e.target === guideOverlay) {
        closeUserGuide();
      }
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && guideOverlay?.classList.contains("show")) {
      closeUserGuide();
    }
  });
}

// ============================================
// NO CONTEXT BUTTON (SIMPLIFIED)
// ============================================

function showNoContextButton() {
  console.log("🔔 showNoContextButton() called");

  // Check if button already exists
  const existingButton = document.getElementById("noContextButton");
  if (existingButton) {
    console.log("🔔 Button exists, making visible");
    existingButton.style.display = "block";
    return;
  }

  // Create button HTML
  const button = document.createElement("div");
  button.id = "noContextButton";
  button.innerHTML = `
    <button 
      onclick="navigateToCampaignBuilder()"
      style="
        position: absolute;
        top: 140px;
        right: 20px;
        padding: 0.9rem 1.5rem;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        border-radius: 8px;
        font-weight: 600;
        font-size: 1rem;
        cursor: pointer;
        transition: all 0.3s;
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        display: flex;
        align-items: center;
        gap: 0.5rem;
      "
      onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px rgba(102, 126, 234, 0.6)';"
      onmouseout="this.style.transform=''; this.style.boxShadow='0 4px 12px rgba(102, 126, 234, 0.4)';"
    >
      + Create Campaign/Mailer First
    </button>
  `;

  // Insert button at top of body
  document.body.appendChild(button);

  console.log("✅ No-context button created and appended to body");
}

function hideNoContextButton() {
  const button = document.getElementById("noContextButton");
  if (button) {
    button.style.display = "none";
    console.log("✅ Button hidden");
  } else {
    console.log("⚠️ No button to hide");
  }
}

function navigateToCampaignBuilder() {
  console.log("🔗 Navigating to campaign builder...");
  window.location.href = "campaign_builder.html";
}

// ============================================
// PAGE INITIALIZATION
// ============================================

document.addEventListener("DOMContentLoaded", async () => {
  const path = window.location.pathname;
  window.currentEditingTemplateId = null;
  localStorage.removeItem("Restored template");

  if (path.includes("templategallery")) {
    console.log("🔍 templateGallery page load detected");

    const context = getContextFromStorage();

    if (!context) {
      console.warn("⚠️ No context found - showing button NOW");
      showNoContextButton();
    } else {
      console.log("✅ Context available - hiding button");
      hideNoContextButton();
      console.log("📋 Context details:", JSON.stringify(context, null, 2));
    }

    // Initialize all page components
    initializeSidebarNavigation();
    initializeHamburgerMenu();
    initializeUserGuide();

    // Load templates
    loadCanvaTemplates();
    setTimeout(loadGalleryTemplates, 1000);

    if (context) {
      console.log("✅ Context Info:", {
        sourceType: context.sourceType,
        mode: context.mode,
        campaignName: context.campaignName,
        mailerName: context.mailerName,
        recipientCount: context.recipients?.length || 0,
        envMode: context.envMode,
        timestamp: context.timestamp,
      });
    }
  }
});
