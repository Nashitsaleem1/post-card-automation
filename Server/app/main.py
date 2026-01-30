import base64
import os
import json
from typing import List
import requests
from datetime import datetime, timedelta
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.date import DateTrigger
import requests
from fastapi import FastAPI, Depends, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import desc
from .database import Base, engine, get_db
from . import schemas
from pytz import timezone, utc
from .models import Template, Campaign, CampaignData, MailerOneOff, QRCodeInfo, Audience
from sqlalchemy.orm import Session, joinedload
from .database import SessionLocal
from fastapi.staticfiles import StaticFiles
import uuid
import time
from pathlib import Path
import pytz
from fastapi import FastAPI, UploadFile, File, HTTPException

API_URL = "https://v3.pcmintegrations.com/auth/login"
API_KEY = "Mzk2N2YyZTktZmNkNy00YjcwLWJhMjUtMTM4ZWFlZDhmNWU0"
API_SECRET = "YzU0NTRiMjgtOTE3Mi00YTRmLWE3YjQtYTc0ODE1N2FmOGNl"
CHILD_REF_NBR = "myAccountReference"

STATIC_DIR = Path("uploads/pdfs")
STATIC_DIR.mkdir(parents=True, exist_ok=True)

CLIENT_ID = "OC-AZn4e_GgzZAp"
CLIENT_SECRET = "cnvcaQ5z-PNqcsxXWKVvJ1G_ocl159sYRDGvunfWsY2xcrIk80f1e095"
TOKEN_URL = "https://api.canva.com/rest/v1/oauth/token"
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TOKENS_FILE = os.path.join(BASE_DIR, "canva_tokens.json")

# ---------- Scheduler ----------
scheduler = BackgroundScheduler()
scheduler.start()


# ---------- App ----------
app = FastAPI(title="PCM Automation", version="1.0.0")

# ---------- CORS ----------
origins_env = os.getenv("CORS_ORIGINS", "")
origins = [o.strip() for o in origins_env.split(",") if o.strip()]

# Add new mount for uploads:
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


# Allowed origins
origins = ["https://physical-mail-automation.netlify.app"] 

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def load_tokens():
    if os.path.exists(TOKENS_FILE):
        with open(TOKENS_FILE) as f:
            return json.load(f)
    return None


def save_tokens(token_data):
    # Save with an expiry timestamp
    token_data["expires_at"] = int(time.time()) + token_data.get("expires_in", 3600)
    print(token_data["expires_at"])
    with open(TOKENS_FILE, "w") as f:
        json.dump(token_data, f, indent=2)


def is_token_expired(token_data):
    return time.time() >= token_data.get("expires_at", 0)


def refresh_access_token(refresh_token):
    auth_str = f"{CLIENT_ID}:{CLIENT_SECRET}"
    b64_auth = base64.b64encode(auth_str.encode()).decode()

    headers = {
        "Authorization": f"Basic {b64_auth}",
        "Content-Type": "application/x-www-form-urlencoded",
    }

    data = {"grant_type": "refresh_token", "refresh_token": refresh_token}

    response = requests.post(TOKEN_URL, headers=headers, data=data)
    response.raise_for_status()
    token_data = response.json()
    save_tokens(token_data)
    return token_data


@app.get("/get_canva_token")
def get_canva_token():
    token_data = load_tokens()
    if not token_data:
        return {"error": "No token found. Run initial OAuth first."}

    if is_token_expired(token_data):
        print("🔁 Access token expired — refreshing...")
        token_data = refresh_access_token(token_data["refresh_token"])
        return {"access_token": token_data["access_token"], "status": "refreshed"}

    return {"access_token": token_data["access_token"], "status": "valid"}


# ---------- Utility: Token Fetch ----------
def get_pcm_token():
    payload = {
        "apiKey": API_KEY,
        "apiSecret": API_SECRET,
        "childRefNbr": CHILD_REF_NBR,
    }
    resp = requests.post(
        API_URL,
        json=payload,
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    )
    resp.raise_for_status()
    data = resp.json()
    return data.get("token")


def get_campaign_data_recipients(campaign_data):
    """
    Fetch recipients from either audience_id or address_list
    Priority: audience_id > address_list
    """
    recipients = []

    # Try fetching from Audience table first
    if campaign_data.audience_id:
        from .models import Audience  # Import here to avoid circular imports

        audience = Audience.query.filter(
            Audience.id == campaign_data.audience_id
        ).first()
        if audience:
            recipients = json.loads(audience.audience_list)
            print(
                f"✅ Recipients fetched from Audience ID {campaign_data.audience_id}: {len(recipients)} recipients"
            )
            return recipients

    # Fallback to address_list if it exists
    if hasattr(campaign_data, "address_list") and campaign_data.address_list:
        recipients = json.loads(campaign_data.address_list)
        print(f"✅ Recipients fetched from address_list: {len(recipients)} recipients")
        return recipients

    print(f"⚠️ No recipients found for CampaignData {campaign_data.id}")
    return []


def get_mailer_recipients(mailer):
    """
    Fetch recipients from either audience_id or address_list
    Priority: audience_id > address_list
    """
    recipients = []

    # Try fetching from Audience table first
    if mailer.audience_id:
        from .models import Audience  # Import here to avoid circular imports

        audience = Audience.query.filter(Audience.id == mailer.audience_id).first()
        if audience:
            recipients = json.loads(audience.audience_list)
            print(
                f"✅ Recipients fetched from Audience ID {mailer.audience_id}: {len(recipients)} recipients"
            )
            return recipients

    # Fallback to address_list if it exists
    if hasattr(mailer, "address_list") and mailer.address_list:
        recipients = json.loads(mailer.address_list)
        print(f"✅ Recipients fetched from address_list: {len(recipients)} recipients")
        return recipients

    print(f"⚠️ No recipients found for Mailer {mailer.id}")
    return []


# ---------- Scheduler Job for Campaign ----------
def send_letter_job(campaign_data_id: int):
    db = SessionLocal()

    try:
        campaign_data = (
            db.query(CampaignData).filter(CampaignData.id == campaign_data_id).first()
        )
        if not campaign_data:
            print(f"⚠️ CampaignData {campaign_data_id} not found")
            return

        template = (
            db.query(Template).filter(Template.id == campaign_data.template_id).first()
        )
        if not template:
            print(f"⚠️ Template {campaign_data.template_id} not found")
            return

        # --- Ensure it's pending ---
        if campaign_data.status != "pending":
            print(
                f"⏩ Mailer {campaign_data.id} already processed ({campaign_data.status})"
            )
            return

        # --- Prepare payload ---
        today_obj = datetime.utcnow()
        today_iso = today_obj.strftime("%Y-%m-%d")
        formatted_date = today_obj.strftime("%B %d, %Y")

        final_html = template.template.replace("DATE", formatted_date)

        recipients = get_campaign_data_recipients(campaign_data)
        if not recipients:
            print(f"❌ No recipients found for CampaignData {campaign_data_id}")
            campaign_data.status = "failed"
            db.commit()
            return

        payload = {
            "extRefNbr": "12345",
            "designID": 0,
            "mailClass": "FirstClass",
            "mailDate": today_iso,
            "color": True,
            "printOnBothSides": True,
            "insertAddressingPage": True,
            "envelope": {
                "font": "Bradley Hand",
                "type": "fullWindow",
                "fontColor": "Black",
            },
            "recipients": recipients,
            "letter": final_html,
        }

        # --- Call PCM API ---
        token = get_pcm_token()
        res = requests.post(
            "https://v3.pcmintegrations.com/order/letter",
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json",
                "Authorization": f"Bearer {token}",
            },
            json=payload,
        )

        data = res.json()
        print("📨 PCM API Response:", data)

        # --- If success, update status ---
        if all(k in data for k in ["batchID", "orderID", "extRefNbr"]):
            campaign_data.status = "sent"
            campaign_data.send_date = datetime.utcnow()
            db.commit()
            print(f"✅ CampaignData {campaign_data_id} marked as SENT")

            # Schedule QR tracking after 24 hours
            track_time = datetime.utcnow() + timedelta(hours=24)
            scheduler.add_job(
                qr_tracking_job,
                trigger=DateTrigger(run_date=track_time),
                args=[campaign_data.id],
                id=f"qr_track_{campaign_data.id}",
                replace_existing=True,
            )
            print(
                f"📅 Scheduled QR tracking for CampaignData {campaign_data.id} in 24h."
            )
        else:
            campaign_data.status = "failed"
            db.commit()
            print(f"❌ Failed to send CampaignData {campaign_data_id}")

    except Exception as e:
        print("❌ Error sending letter:", e)
        try:
            campaign_data = (
                db.query(CampaignData)
                .filter(CampaignData.id == campaign_data_id)
                .first()
            )
            if campaign_data:
                campaign_data.status = "failed"
                db.commit()
        except:
            pass
    finally:
        db.close()


# ---------- QR Tracking Job ----------
def qr_tracking_job(campaign_data_id: int):

    db = SessionLocal()
    try:
        campaign_data = (
            db.query(CampaignData).filter(CampaignData.id == campaign_data_id).first()
        )
        if not campaign_data:
            print(f"⚠️ CampaignData {campaign_data_id} not found for QR tracking")
            return

        template = (
            db.query(Template).filter(Template.id == campaign_data.template_id).first()
        )
        if not template or not template.qr_code_id:
            print(f"⚠️ Template {campaign_data.template_id} has no QR code linked")
            return

        qr_code = (
            db.query(QRCodeInfo).filter(QRCodeInfo.id == template.qr_code_id).first()
        )
        if not qr_code:
            print(f"⚠️ QR Code {template.qr_code_id} not found")
            return

        # --- Fetch QR Tracking Data ---
        token = get_pcm_token()
        url = f"https://v3.pcmintegrations.com/qr-code/{qr_code.id}/tracking"
        headers = {"Accept": "application/json", "Authorization": f"Bearer {token}"}
        resp = requests.get(url, headers=headers)
        data = resp.json()

        results = data.get("results", [])
        if not results:
            print(f"ℹ️ No QR scans found yet for QR {qr_code.id} — retrying in 24h.")
            next_run = datetime.utcnow() + timedelta(hours=24)
            scheduler.add_job(
                qr_tracking_job,
                trigger=DateTrigger(run_date=next_run),
                args=[campaign_data_id],
                id=f"qr_track_{campaign_data_id}",
                replace_existing=True,
            )
            return

        recipients = get_campaign_data_recipients(campaign_data)
        if not recipients:
            print(
                f"No recipients found for QR tracking of CampaignData {campaign_data_id}"
            )
            return

        # --- Compare recipients ---
        matched_recipients = []
        for rec in recipients:
            for scan in results:
                r = scan.get("recipient", {})
                if (
                    r.get("firstName") == rec.get("firstName")
                    and r.get("lastName") == rec.get("lastName")
                    and r.get("address") == rec.get("address")
                ):
                    matched_recipients.append(rec)
                    break

        matched = len(matched_recipients)
        total = len(recipients)

        if matched == total:
            print(
                f"All {matched} recipients scanned QR for CampaignData {campaign_data_id}"
            )
            campaign_data.is_qr_scanned_complete = True
            db.commit()

            # --- NEW: Write log of scanned mailers ---
            log_entry = (
                f"[{datetime.utcnow()}] CampaignData ID: {campaign_data_id} | "
                f"Mailer: {campaign_data.mailer_name or 'Unnamed'} | "
                f"Recipients Scanned: {matched}/{total}\n"
                f"Recipients:\n{json.dumps(matched_recipients, indent=2)}\n"
                + "-" * 60
                + "\n"
            )

            log_path = os.path.join(os.getcwd(), "scanned_mailers_log.txt")
            with open(log_path, "a", encoding="utf-8") as log_file:
                log_file.write(log_entry)
            print(f"📝 Log written to {log_path}")

            send_scan_complete_notification(
                campaign_data_id,
                campaign_data.mailer_name or f"Mailer-{campaign_data_id}",
                matched_recipients,
            )

            # --- Fetch next pending mailer ---
            next_pending = (
                db.query(CampaignData)
                .filter(
                    CampaignData.campaign_id == campaign_data.campaign_id,
                    CampaignData.status == "pending",
                )
                .order_by(CampaignData.id.asc())
                .first()
            )

            if next_pending:
                print(f"Sending next pending CampaignData {next_pending.id}")
                send_letter_job(next_pending.id)
            else:
                print(
                    f" No more pending mailers left in campaign {campaign_data.campaign_id}"
                )
        else:
            print(f" Only {matched}/{total} recipients scanned QR — retrying in 24h.")
            next_run = datetime.utcnow() + timedelta(hours=24)
            scheduler.add_job(
                qr_tracking_job,
                trigger=DateTrigger(run_date=next_run),
                args=[campaign_data_id],
                id=f"qr_track_{campaign_data_id}",
                replace_existing=True,
            )

    except Exception as e:
        print(f"Error in qr_tracking_job: {e}")
    finally:
        db.close()


def send_scan_complete_notification(
    campaign_data_id: int, mailer_name: str, recipients: list
):
    """
    Send a notification (can be replaced with email, webhook, etc.)
    """
    print(
        f"Notification: Mailer '{mailer_name}' (ID {campaign_data_id}) fully scanned by all recipients."
    )
    print("👥 Scanned Recipients:")
    for r in recipients:
        print(f" - {r.get('firstName')} {r.get('lastName')} @ {r.get('address')}")


def campaign_watcher_job():
    """
    Runs every 24 hours to find any newly added mailers
    that are still pending and not yet processed.
    """
    db = SessionLocal()
    try:
        pending_mailers = (
            db.query(CampaignData)
            .filter(
                CampaignData.status == "pending",
                CampaignData.is_qr_scanned_complete == False,
            )
            .all()
        )

        for mailer in pending_mailers:
            print(
                f" Found new pending mailer {mailer.id} in campaign {mailer.campaign_id}"
            )
            send_letter_job(mailer.id)

    except Exception as e:
        print(f"Error in campaign_watcher_job: {e}")
    finally:
        db.close()


def send_oneoff_job(mailer_id: int):
    db = SessionLocal()

    try:
        mailer = db.query(MailerOneOff).filter(MailerOneOff.id == mailer_id).first()
        if not mailer:
            print(f" MailerOneOff {mailer_id} not found")
            return

        template = db.query(Template).filter(Template.id == mailer.template_id).first()
        if not template:
            print(f"Template {mailer.template_id} not found")
            mailer.status = "failed"
            db.commit()
            return

        # --- Prepare payload ---
        today_obj = datetime.utcnow()
        today_iso = today_obj.strftime("%Y-%m-%d")
        formatted_date = today_obj.strftime("%B %d, %Y")

        final_html = template.template.replace("DATE", formatted_date)

        recipients = get_mailer_recipients(mailer)
        if not recipients:
            print(f"No recipients found for MailerOneOff {mailer_id}")
            mailer.status = "failed"
            db.commit()
            return

        payload = {
            "extRefNbr": "12345",
            "designID": 0,
            "mailClass": "FirstClass",
            "mailDate": today_iso,
            "color": True,
            "printOnBothSides": True,
            "insertAddressingPage": True,
            "envelope": {
                "font": "Bradley Hand",
                "type": "fullWindow",
                "fontColor": "Black",
            },
            "recipients": recipients,
            "letter": final_html,
        }

        # --- Call PCM API ---
        token = get_pcm_token()
        res = requests.post(
            "https://v3.pcmintegrations.com/order/letter",
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json",
                "Authorization": f"Bearer {token}",
            },
            json=payload,
            timeout=30,
        )

        data = res.json()
        print("PCM API Response:", data)

        # --- Update status based on response ---
        if all(k in data for k in ["batchID", "orderID", "extRefNbr"]):
            mailer.status = "sent"
            db.commit()
            print(f"MailerOneOff {mailer_id} marked as SENT")
        else:
            mailer.status = "failed"
            db.commit()
            print(
                f"Failed to send MailerOneOff {mailer_id}: Missing response fields"
            )

    except Exception as e:
        print(f"Error sending one-off mailer {mailer_id}:", e)
        try:
            mailer = db.query(MailerOneOff).filter(MailerOneOff.id == mailer_id).first()
            if mailer:
                mailer.status = "failed"
                db.commit()
        except:
            pass
    finally:
        db.close()


# ---------- Health ----------
@app.get("/")
def root():
    return {"Welcome to PCM Automation"}


@app.get("/healthz")
def healthz():
    return {"status": "ok"}


# ---------- PDF Upload ----------
@app.post("/upload-pdf")
async def upload_pdf(file: UploadFile = File(...)):
    """
    Upload a PDF file and return its public URL
    """
    # Validate file type
    if not file.content_type == "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")

    # Validate file size (max 10MB)
    file_size = 0
    chunk_size = 1024 * 1024  # 1MB chunks
    content = await file.read()
    file_size = len(content)

    if file_size > 10 * 1024 * 1024:  # 10MB
        raise HTTPException(status_code=400, detail="File size exceeds 10MB limit")

    try:
        file_extension = os.path.splitext(file.filename)[1]
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        file_path = STATIC_DIR / unique_filename

        with open(file_path, "wb") as f:
            f.write(content)

        # file_url = f"https://pcm-app-h8mn8.ondigitalocean.app/uploads/pdfs/{unique_filename}"
        file_url = f"https://pcm-app.duckdns.org/uploads/pdfs/{unique_filename}"

        return {
            "success": True,
            "filename": unique_filename,
            "url": file_url,
            "size": file_size,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error uploading file: {str(e)}")


# ---------- Delete PDF ----------
@app.delete("/delete-pdf/{filename}")
async def delete_pdf(filename: str):
    """
    Delete a PDF file from static folder
    """
    try:
        file_path = STATIC_DIR / filename

        if not file_path.exists():
            raise HTTPException(status_code=404, detail="File not found")

        os.remove(file_path)

        return {"success": True, "message": f"File {filename} deleted successfully"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting file: {str(e)}")


# ---------- Start Campaign Watcher ----------
scheduler.add_job(
    campaign_watcher_job,
    trigger="interval",
    hours=24,
    id="campaign_watcher_job",
    replace_existing=True,
)


# ---------- Templates ----------
@app.get("/templates", response_model=list[schemas.TemplateRead])
def get_templates(db: Session = Depends(get_db)):
    templates = db.query(Template).all()
    return [
        {
            "id": t.id,
            "html_content": t.template,
            "qr_code_id": t.qr_code_id,
            "template_name": t.template_name,
        }
        for t in templates
    ]


@app.post("/templates", response_model=schemas.TemplateRead)
def create_template(template: schemas.TemplateCreate, db: Session = Depends(get_db)):
    new_template = Template(
        template=template.html_content,
        qr_code_id=template.qr_code_id,
        template_name=template.template_name,
    )
    db.add(new_template)
    db.commit()
    db.refresh(new_template)

    return {
        "id": new_template.id,
        "html_content": new_template.template,
        "qr_code_id": new_template.qr_code_id,
        "template_name": new_template.template_name,
    }


# Delete a template
@app.delete("/templates/{template_id}", status_code=204)
def delete_template(template_id: int, db: Session = Depends(get_db)):
    if template_id <= 4:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Default templates cannot be deleted.",
        )

    template = db.query(Template).filter(Template.id == template_id).first()
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Template not found."
        )

    db.delete(template)
    db.commit()
    return {"detail": "Template deleted successfully."}


# Get single template
@app.get("/templates/{template_id}", response_model=schemas.TemplateRead)
def get_template(template_id: int, db: Session = Depends(get_db)):
    template = db.query(Template).filter(Template.id == template_id).first()
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Template not found."
        )
    return {
        "id": template.id,
        "html_content": template.template,
        "qr_code_id": template.qr_code_id,
        "template_name": template.template_name,
    }


# ---------- Campaigns ----------
@app.post("/campaigns", response_model=schemas.CampaignRead)
def create_campaign(campaign: schemas.CampaignCreate, db: Session = Depends(get_db)):
    existing = (
        db.query(Campaign)
        .filter(Campaign.campaign_name == campaign.campaign_name)
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=400, detail="Campaign with this name already exists."
        )

    new_campaign = Campaign(campaign_name=campaign.campaign_name)
    db.add(new_campaign)
    db.commit()
    db.refresh(new_campaign)
    return new_campaign


@app.post("/campaign-data", response_model=schemas.CampaignDataRead)
def create_campaign_data(
    data: schemas.CampaignDataCreate, db: Session = Depends(get_db)
):
    # Check if campaign exists
    campaign = db.query(Campaign).filter(Campaign.id == data.campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    print(data)

    # Create CampaignData
    new_data = CampaignData(
        campaign_id=data.campaign_id,
        mailer_name=data.mailer_name,
        template_id=data.template_id,
        audience_id=data.audience_id,
        schedule_time=data.schedule_time,
        send_date=data.send_date,
        status=data.status or "pending",
        env_mode=data.env_mode,
        canva_link=data.canva_link,
        res_recipients=data.res_recipients,
        pdf_link = data.pdf_link
    )

    db.add(new_data)
    db.commit()
    db.refresh(new_data)

    # Schedule QR tracking only if sent immediately
    if new_data.status == "sent":
        track_time = datetime.utcnow() + timedelta(hours=1)
        scheduler.add_job(
            qr_tracking_job,
            trigger=DateTrigger(run_date=track_time),
            args=[new_data.id],
            id=f"qr_track_{new_data.id}",
            replace_existing=True,
        )
        print(f"📅 Scheduled first QR check in 1 hour for CampaignData {new_data.id}")

    return new_data


@app.get("/campaigns", response_model=List[schemas.CampaignRead])
def get_all_campaigns(db: Session = Depends(get_db)):
    campaigns = db.query(Campaign).order_by(desc(Campaign.id)).all()
    if not campaigns:
        raise HTTPException(status_code=404, detail="No campaigns found")
    return campaigns


@app.get("/campaign-data/{campaign_id}", response_model=List[schemas.CampaignDataRead])
def get_campaign_data_by_campaign(campaign_id: int, db: Session = Depends(get_db)):
    campaign_data_list = (
        db.query(CampaignData).filter(CampaignData.campaign_id == campaign_id).all()
    )
    if not campaign_data_list:
        raise HTTPException(status_code=404, detail="CampaignData not found")
    return campaign_data_list


@app.get(
    "/campaign-data-with-name/{campaign_id}",
    response_model=List[schemas.CampaignDataWithCampaignName],
)
def get_campaign_data_with_name(campaign_id: int, db: Session = Depends(get_db)):
    # Query CampaignData joined with Campaign AND Audience to get all necessary data
    data = (
        db.query(
            CampaignData,
            Campaign.campaign_name.label("campaign_name"),
            CampaignData.env_mode.label("env_mode"),
            CampaignData.canva_link.label("canva_link"),
            Audience.audience_list.label("audience_list"),
            CampaignData.pdf_link.label("pdf_link")
        )
        .join(Campaign, Campaign.id == CampaignData.campaign_id)
        .outerjoin(
            Audience, Audience.id == CampaignData.audience_id
        )  
        .filter(CampaignData.campaign_id == campaign_id)
        .all()
    )

    if not data:
        raise HTTPException(status_code=404, detail="CampaignData not found")

    # Convert to list of dicts for response
    result = []
    for cd, cname, env_mode, canva_link, audience_list, pdf_link in data:
        row = cd.__dict__.copy()
        row.pop("_sa_instance_state", None)
        row["campaign_name"] = cname
        row["env_mode"] = env_mode
        row["canva_link"] = canva_link
        row["audience_list"] = audience_list
        row["pdf_link"] = pdf_link
        result.append(row)

    return result


@app.get("/dashboard/all")
def get_dashboard_all(mode: str, db: Session = Depends(get_db)):
    if mode not in ["testing", "production"]:
        raise HTTPException(status_code=400, detail="Invalid mode value")

    campaign_ids = (
        db.query(CampaignData.campaign_id)
        .filter(CampaignData.env_mode == mode)
        .distinct()
        .all()
    )
    campaign_ids = [cid[0] for cid in campaign_ids]

    campaigns = (
        db.query(Campaign)
        .filter(Campaign.id.in_(campaign_ids))
        .order_by(desc(Campaign.id))
        .all()
    )

    all_campaign_data = (
        db.query(CampaignData)
        .options(
            joinedload(CampaignData.template),
            joinedload(CampaignData.campaign),
            joinedload(CampaignData.audience),
        )
        .filter(CampaignData.env_mode == mode)
        .order_by(desc(CampaignData.id))
        .all()
    )

    total_recipients = 0

    for data_record in all_campaign_data:
        if data_record.audience and data_record.audience.audience_list:
            try:
                recipients = json.loads(data_record.audience.audience_list)
                if isinstance(recipients, list):
                    total_recipients += len(recipients)
            except Exception:
                pass

    return {
        "total_campaigns": len(campaigns),
        "latest_campaign": {
            "id": campaigns[0].id if campaigns else None,
            "campaign_name": campaigns[0].campaign_name if campaigns else None,
        },
        "total_recipients": total_recipients,
        "data": [
            {
                "id": d.id,
                "campaign_id": d.campaign_id,
                "campaign_name": d.campaign.campaign_name if d.campaign else None,
                "mailer_name": d.mailer_name,
                "schedule_time": d.schedule_time,
                "status": d.status,
                "template_id": d.template_id,
                "template_preview": d.template.template if d.template else None,
                "qr_code_id": d.template.qr_code_id if d.template else None,
                "env_mode": d.env_mode,
                "audience_id": d.audience.id if d.audience else None,
                "audience_name": d.audience.audience_name if d.audience else None,
                "audience_list": (
                    json.loads(d.audience.audience_list)
                    if d.audience and d.audience.audience_list
                    else []
                ),
                "res_recipients": d.res_recipients,
            }
            for d in all_campaign_data
        ],
    }


@app.put("/campaign-data/{campaign_data_id}")
def update_campaign_data(
    campaign_data_id: int,
    payload: schemas.CampaignDataUpdate,
    db: Session = Depends(get_db),
):
    campaign_data = (
        db.query(CampaignData).filter(CampaignData.id == campaign_data_id).first()
    )
    if not campaign_data:
        raise HTTPException(status_code=404, detail="CampaignData not found")

    # Update only provided fields
    if payload.template_id is not None:
        campaign_data.template_id = payload.template_id
    if payload.status is not None:
        campaign_data.status = payload.status
    if payload.schedule_time is not None:
        campaign_data.schedule_time = payload.schedule_time
    if payload.send_date is not None:
        campaign_data.send_date = payload.send_date
    if payload.canva_link is not None:
        campaign_data.canva_link = payload.canva_link

    db.commit()
    db.refresh(campaign_data)

    #  Case 1: If schedule_time is provided → schedule sending job
    if payload.schedule_time is not None:
        scheduler.add_job(
            send_letter_job,
            trigger=DateTrigger(run_date=payload.schedule_time),
            args=[campaign_data.id],
            id=f"campaign_data_{campaign_data.id}",
            replace_existing=True,
        )
        print(f" Scheduled CampaignData {campaign_data.id} at {payload.schedule_time}")

    # Case 2: If no schedule_time but status is 'sent' → schedule QR tracking job
    elif payload.status == "sent":
        track_time = datetime.utcnow() + timedelta(hours=24)
        scheduler.add_job(
            qr_tracking_job,
            trigger=DateTrigger(run_date=track_time),
            args=[campaign_data.id],
            id=f"qr_track_{campaign_data.id}",
            replace_existing=True,
        )
        print(
            f"📅 CampaignData {campaign_data.id} marked as SENT — scheduled QR tracking in 24h"
        )

    else:
        print(
            f"⏩ CampaignData {campaign_data.id} has no schedule and not sent yet — waiting."
        )

    return campaign_data


@app.post("/mailer-one-off", response_model=schemas.MailerOneOffResponse)
def create_mailer_one_off(
    payload: schemas.MailerOneOffCreate, db: Session = Depends(get_db)
):
    try:
        # Create new MailerOneOff entry
        mailer = MailerOneOff(
            mailer_name=payload.mailer_name,
            template_id=payload.template_id,
            audience_id=payload.audience_id,
            schedule_time=payload.schedule_time,
            send_date=payload.send_date,
            status=payload.status or "pending",
            env_mode=payload.env_mode or "testing",
            canva_link=payload.canva_link,
            res_recipients=payload.res_recipients,
            pdf_link = payload.pdf_link
        )

        db.add(mailer)
        db.commit()
        db.refresh(mailer)

        # Schedule job if schedule_time is provided
        if mailer.schedule_time:
            scheduler.add_job(
                send_oneoff_job,
                trigger=DateTrigger(run_date=mailer.schedule_time),
                args=[mailer.id],
                id=f"oneoff_{mailer.id}",
                replace_existing=True,
            )
            print(f"Scheduled one-off mailer {mailer.id} at {mailer.schedule_time}")
        else:
            print(
                f"Mailer {mailer.id} has no schedule_time — sending immediately or waiting."
            )

        return mailer

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Failed to create mailer: {str(e)}"
        )


@app.get("/mailer-one-off/all")
def get_all_one_off_mailers(mode: str, db: Session = Depends(get_db)):
    """
    mode: 'testing' or 'production'
    Example: /mailer-one-off/all?mode=production
    """
    if mode not in ["testing", "production"]:
        raise HTTPException(status_code=400, detail="Invalid mode value")

    try:
        mailers = (
            db.query(MailerOneOff)
            .options(joinedload(MailerOneOff.audience))  # eager-load audience
            .filter(MailerOneOff.env_mode == mode)
            .all()
        )

        # Build structured response with audience info
        response_data = []
        for mailer in mailers:
            response_data.append(
                {
                    "id": mailer.id,
                    "mailer_name": mailer.mailer_name,
                    "env_mode": mailer.env_mode,
                    "audience_id": mailer.audience_id,
                    "audience_name": (
                        mailer.audience.audience_name if mailer.audience else None
                    ),
                    "audience_list": (
                        json.loads(mailer.audience.audience_list)
                        if mailer.audience and mailer.audience.audience_list
                        else []
                    ),
                    "res_recipients": mailer.res_recipients,
                }
            )

        return {
            "total_one_off_mailers": len(response_data),
            "data": response_data,
        }

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to fetch one-off mailers: {str(e)}"
        )


@app.get("/mailer-one-off/{mailer_id}", response_model=schemas.MailerOneOffResponse)
def get_mailer_one_off(mailer_id: int, db: Session = Depends(get_db)):
    try:
        mailer = db.query(MailerOneOff).filter(MailerOneOff.id == mailer_id).first()
        if not mailer:
            raise HTTPException(status_code=404, detail="Mailer not found")

        #  Include related audience info if available
        audience_name = mailer.audience.audience_name if mailer.audience else None
        audience_list = (
            json.loads(mailer.audience.audience_list)
            if mailer.audience and mailer.audience.audience_list
            else []
        )

        return {
            "id": mailer.id,
            "mailer_name": mailer.mailer_name,
            "audience_id": mailer.audience_id,
            "audience_name": audience_name,
            "audience_list": audience_list,
            "template_id": mailer.template_id,
            "schedule_time": mailer.schedule_time,
            "send_date": mailer.send_date,
            "status": mailer.status,
            "env_mode": mailer.env_mode,
            "canva_link": mailer.canva_link,
            "res_recipients": mailer.res_recipients,
            "pdf_link": mailer.pdf_link
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch mailer: {str(e)}")


@app.put("/mailer-one-off/{mailer_id}", response_model=schemas.MailerOneOffResponse)
def update_mailer_one_off(
    mailer_id: int, payload: schemas.MailerOneOffUpdate, db: Session = Depends(get_db)
):
    try:
        mailer = db.query(MailerOneOff).filter(MailerOneOff.id == mailer_id).first()
        if not mailer:
            raise HTTPException(status_code=404, detail="Mailer not found")

        # --- Update only provided fields ---
        if payload.template_id is not None:
            mailer.template_id = payload.template_id
        if payload.schedule_time is not None:
            mailer.schedule_time = payload.schedule_time
        if payload.status is not None:
            mailer.status = payload.status
        if payload.send_date is not None:
            mailer.send_date = payload.send_date
        if payload.canva_link is not None:
            mailer.canva_link = payload.canva_link

        db.commit()
        db.refresh(mailer)

        # --- ✅ Schedule the job if schedule_time is provided ---
        if payload.schedule_time is not None:
            scheduler.add_job(
                send_oneoff_job,
                trigger=DateTrigger(run_date=payload.schedule_time),
                args=[mailer.id],
                id=f"oneoff_{mailer.id}",
                replace_existing=True,
            )
            print(f"✅ One-off mailer {mailer.id} scheduled at {payload.schedule_time}")

        return mailer

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Failed to update mailer: {str(e)}"
        )


@app.delete("/mailer-one-off/{mailer_id}")
def delete_mailer_one_off(mailer_id: int, db: Session = Depends(get_db)):
    """
    Delete a one-off mailer with rules based on env_mode stored in database
    - TESTING mode (env_mode='testing'): all statuses can be deleted
    - PRODUCTION mode (env_mode='production'): only 'pending' and 'scheduled' can be deleted (NOT 'sent')
    """
    try:
        mailer = db.query(MailerOneOff).filter(MailerOneOff.id == mailer_id).first()
        if not mailer:
            raise HTTPException(status_code=404, detail="Mailer not found")

        # Get the env_mode from the mailer record (when it was created)
        mailer_env_mode = mailer.env_mode or "testing"

        # Define allowed deletion statuses based on mailer's env_mode
        if mailer_env_mode == "production":
            # Production: only allow deletion for 'scheduled' or 'pending' (NOT 'sent')
            if mailer.status not in ["scheduled", "pending"]:
                raise HTTPException(
                    status_code=400,
                    detail=f"Cannot delete mailer with status '{mailer.status}' created in PRODUCTION mode. Only 'scheduled' or 'pending' mailers can be deleted in production.",
                )
        elif mailer_env_mode == "testing":
            # Testing: allow deletion for all statuses - 'scheduled', 'pending', and 'sent'
            if mailer.status not in ["scheduled", "pending", "sent"]:
                raise HTTPException(
                    status_code=400,
                    detail=f"Cannot delete mailer with status '{mailer.status}'. Valid statuses for testing mode are 'scheduled', 'pending', or 'sent'.",
                )
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid env_mode '{mailer_env_mode}' on mailer. Must be 'testing' or 'production'.",
            )

        # Remove scheduled job if it exists
        if mailer.status == "scheduled":
            try:
                scheduler.remove_job(f"oneoff_{mailer.id}")
                print(f"✅ Removed scheduled job for mailer {mailer.id}")
            except Exception as e:
                print(
                    f"⚠️ Could not remove scheduled job for mailer {mailer.id}: {str(e)}"
                )

        # Proceed with deletion
        db.delete(mailer)
        db.commit()

        return {
            "success": True,
            "message": f"Mailer {mailer.id} deleted successfully (created in {mailer_env_mode.upper()} mode).",
            "env_mode": mailer_env_mode,
            "status": mailer.status,
        }

    except HTTPException:
        raise  # re-raise known errors
    except Exception as e:
        db.rollback()
        print(f"Error deleting mailer {mailer_id}: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to delete mailer: {str(e)}"
        )


@app.delete("/campaign-data/{mailer_id}")
def delete_mailer(mailer_id: int, db: Session = Depends(get_db)):
    """
    Delete a mailer and cancel any associated scheduled jobs
    Uses env_mode from the CampaignData record:
    - TESTING: all statuses ('pending', 'scheduled', 'sent') can be deleted
    - PRODUCTION: only 'pending' or 'scheduled' can be deleted (NOT 'sent')
    """
    try:
        mailer = db.query(CampaignData).filter(CampaignData.id == mailer_id).first()
        if not mailer:
            raise HTTPException(status_code=404, detail="Mailer not found")

        # Get env_mode from the CampaignData record itself
        mailer_env_mode = mailer.env_mode or "testing"

        # Define allowed deletion statuses based on mailer's env_mode
        if mailer_env_mode == "production":
            # Production: only allow deletion for 'scheduled' or 'pending' (NOT 'sent')
            if mailer.status not in ["scheduled", "pending"]:
                raise HTTPException(
                    status_code=400,
                    detail=f"Cannot delete mailer with status '{mailer.status}' in PRODUCTION mode. Only 'scheduled' or 'pending' mailers can be deleted.",
                )
        elif mailer_env_mode == "testing":
            # Testing: allow deletion for all statuses - 'scheduled', 'pending', and 'sent'
            if mailer.status not in ["scheduled", "pending", "sent"]:
                raise HTTPException(
                    status_code=400,
                    detail=f"Cannot delete mailer with status '{mailer.status}'. Only 'scheduled', 'pending', or 'sent' mailers can be deleted in TESTING mode.",
                )
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid env_mode '{mailer_env_mode}'. Must be 'testing' or 'production'.",
            )

        # Remove scheduled job if it exists
        if mailer.status == "scheduled":
            try:
                scheduler.remove_job(f"campaign_data_{mailer.id}")
                print(f"✅ Removed scheduled job for mailer {mailer.id}")
            except Exception as e:
                print(
                    f"⚠️ Could not remove scheduled job for mailer {mailer.id}: {str(e)}"
                )

        # Proceed with deletion
        db.delete(mailer)
        db.commit()

        return {
            "success": True,
            "message": f"Mailer {mailer.id} deleted successfully (campaign env_mode: {mailer_env_mode}).",
            "env_mode": mailer_env_mode,
            "status": mailer.status,
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"Error deleting mailer {mailer_id}: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to delete mailer: {str(e)}"
        )


@app.delete("/campaigns/{campaign_id}")
def delete_campaign(campaign_id: int, db: Session = Depends(get_db)):
    """
    Delete an entire campaign
    Uses env_mode from the first CampaignData record for this campaign:
    - TESTING: all first mailer statuses can be deleted ('pending', 'scheduled', 'sent')
    - PRODUCTION: only 'pending' or 'scheduled' first mailer statuses can be deleted
    """
    try:
        # Get the campaign
        campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
        if not campaign:
            raise HTTPException(status_code=404, detail="Campaign not found")

        # Get all mailers for this campaign
        mailers = (
            db.query(CampaignData).filter(CampaignData.campaign_id == campaign_id).all()
        )

        if not mailers:
            raise HTTPException(status_code=404, detail="Campaign has no mailers")

        first_mailer = mailers[0]

        # Get env_mode from the first CampaignData record
        campaign_env_mode = first_mailer.env_mode or "testing"

        # Define allowed deletion statuses based on first mailer's env_mode
        if campaign_env_mode == "production":
            if first_mailer.status not in ["scheduled", "pending"]:
                raise HTTPException(
                    status_code=400,
                    detail=f"Cannot delete campaign with first mailer status '{first_mailer.status}' in PRODUCTION mode. Only campaigns with 'scheduled' or 'pending' first mailers can be deleted.",
                )
        elif campaign_env_mode == "testing":
            if first_mailer.status not in ["scheduled", "pending", "sent"]:
                raise HTTPException(
                    status_code=400,
                    detail=f"Cannot delete campaign with first mailer status '{first_mailer.status}'. Only campaigns with 'scheduled', 'pending', or 'sent' first mailers can be deleted in TESTING mode.",
                )
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid env_mode '{campaign_env_mode}'. Must be 'testing' or 'production'.",
            )

        # Remove all scheduled jobs for all mailers in this campaign
        for mailer in mailers:
            if mailer.status == "scheduled":
                try:
                    scheduler.remove_job(f"campaign_data_{mailer.id}")
                    print(f"✅ Removed scheduled job for mailer {mailer.id}")
                except Exception as e:
                    print(
                        f"⚠️ Could not remove scheduled job for mailer {mailer.id}: {str(e)}"
                    )

        # Delete all mailers in the campaign
        for mailer in mailers:
            db.delete(mailer)

        # Delete the campaign itself
        db.delete(campaign)
        print(f"✅ Deleted campaign {campaign_id}")

        db.commit()

        return {
            "success": True,
            "message": f"Campaign {campaign_id} and all its mailers deleted successfully (env_mode: {campaign_env_mode}).",
            "env_mode": campaign_env_mode,
            "mailers_deleted": len(mailers),
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"Error deleting campaign {campaign_id}: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to delete campaign: {str(e)}"
        )


@app.post("/audiences", response_model=schemas.AudienceRead)
def create_audience(audience: schemas.AudienceCreate, db: Session = Depends(get_db)):
    """Create a new audience"""
    # Check if audience name already exists
    existing = (
        db.query(Audience)
        .filter(Audience.audience_name == audience.audience_name)
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Audience name already exists")

    # Convert list of address objects to JSON string for DB storage
    db_audience = Audience(
        audience_name=audience.audience_name,
        audience_list=json.dumps(
            [addr.model_dump() for addr in audience.audience_list]
        ),
    )

    db.add(db_audience)
    db.commit()
    db.refresh(db_audience)
    return db_audience


@app.get("/audiences", response_model=List[schemas.AudienceRead])
def get_all_audiences(db: Session = Depends(get_db)):
    """Get all audiences"""
    audiences = db.query(Audience).order_by(Audience.created_at.desc()).all()
    return audiences


@app.get("/audiences/{audience_id}", response_model=schemas.AudienceRead)
def get_audience_by_id(audience_id: int, db: Session = Depends(get_db)):
    """Get a specific audience by ID"""
    audience = db.query(Audience).filter(Audience.id == audience_id).first()
    if not audience:
        raise HTTPException(status_code=404, detail="Audience not found")
    return audience


@app.delete("/audiences/{audience_id}")
def delete_audience(audience_id: int, db: Session = Depends(get_db)):
    """Delete an audience"""
    audience = db.query(Audience).filter(Audience.id == audience_id).first()
    if not audience:
        raise HTTPException(status_code=404, detail="Audience not found")

    db.delete(audience)
    db.commit()
    return {"message": "Audience deleted successfully"}
