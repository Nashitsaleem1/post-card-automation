import os
import json
from typing import List
import requests
from datetime import datetime
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.date import DateTrigger
import requests
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import desc
from .database import Base, engine, get_db
from . import schemas
from pytz import timezone, utc
from .models import Template, Campaign, CampaignData, QRCodeInfo
from sqlalchemy.orm import Session, joinedload

API_URL = "https://v3.pcmintegrations.com/auth/login"
API_KEY = "Mzk2N2YyZTktZmNkNy00YjcwLWJhMjUtMTM4ZWFlZDhmNWU0"
API_SECRET = "MmZlMzIwMzItMTlhZS00Mjk0LWE1NWYtYmI5NTg5MDUxYTM0"
CHILD_REF_NBR = "myAccountReference"

# ---------- Scheduler ----------
scheduler = BackgroundScheduler()
scheduler.start()

# ---------- App ----------
app = FastAPI(title="PCM Automation", version="1.0.0")

# ---------- CORS ----------
origins_env = os.getenv("CORS_ORIGINS", "")
origins = [o.strip() for o in origins_env.split(",") if o.strip()]

# Allowed origins
origins = [
    "http://127.0.0.1:5500",        
    "http://localhost:5500",         
    "https://physical-mail-automation.netlify.app" # Netlify frontend
]

if not origins:
    origins = ["*"]


app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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


# ---------- Scheduler Job ----------
def send_letter_job(campaign_data_id: int):
    from .database import SessionLocal

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

        # --- Prepare payload ---
        today_obj = datetime.utcnow()
        today_iso = today_obj.strftime("%Y-%m-%d")
        formatted_date = today_obj.strftime("%B %d, %Y")

        final_html = template.template.replace("DATE", formatted_date)

        recipients = json.loads(campaign_data.address_list)

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

        # --- If success, update status to 'sent' ---
        if all(k in data for k in ["batchID", "orderID", "extRefNbr"]):
            campaign_data.status = "sent"
            db.commit()
            print(f"✅ CampaignData {campaign_data_id} marked as SENT")
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


# ---------- Health ----------
@app.get("/")
def root():
    return {"Welcome to PCM Automation"}


@app.get("/healthz")
def healthz():
    return {"status": "ok"}


# ---------- Templates ----------
@app.get("/templates", response_model=list[schemas.TemplateRead])
def get_templates(db: Session = Depends(get_db)):
    templates = db.query(Template).all()
    return [
        {
            "id": t.id,
            "html_content": t.template,  # map field
            "qr_code_id": t.qr_code_id,
        }
        for t in templates
    ]


@app.post("/templates", response_model=schemas.TemplateRead)
def create_template(template: schemas.TemplateCreate, db: Session = Depends(get_db)):
    new_template = Template(
        template=template.html_content, qr_code_id=template.qr_code_id
    )
    db.add(new_template)
    db.commit()
    db.refresh(new_template)

    return {
        "id": new_template.id,
        "html_content": new_template.template,  # map column to field
        "qr_code_id": new_template.qr_code_id,
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

    new_campaign = Campaign(
        campaign_name=campaign.campaign_name, mailer_name=campaign.mailer_name
    )
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

    run_time = data.schedule_time  # keep as provided, no tz conversion

    # Create CampaignData
    new_data = CampaignData(
        campaign_id=data.campaign_id,
        template_id=data.template_id,
        address_list=data.address_list,
        schedule_time=run_time,
        status=data.status,
    )
    db.add(new_data)
    db.commit()
    db.refresh(new_data)

    # Schedule job only if schedule_time is provided
    if run_time is not None:
        scheduler.add_job(
            send_letter_job,
            trigger=DateTrigger(run_date=run_time),
            args=[new_data.id],
            id=f"campaign_data_{new_data.id}",
            replace_existing=True,
        )
        print(f"✅ Scheduled CampaignData {new_data.id} at {run_time}")
    else:
        print(
            f"⏩ CampaignData {new_data.id} has no schedule; sending immediately or waiting."
        )

    return new_data


@app.get("/campaigns/latest", response_model=schemas.CampaignRead)
def get_latest_campaign(db: Session = Depends(get_db)):
    latest_campaign = db.query(Campaign).order_by(desc(Campaign.id)).first()
    if not latest_campaign:
        raise HTTPException(status_code=404, detail="No campaigns found")
    return latest_campaign


@app.get("/campaigns", response_model=List[schemas.CampaignRead])
def get_all_campaigns(db: Session = Depends(get_db)):
    campaigns = db.query(Campaign).order_by(desc(Campaign.id)).all()
    if not campaigns:
        raise HTTPException(status_code=404, detail="No campaigns found")
    return campaigns


@app.get("/campaigns/dashboard", response_model=list[schemas.CampaignRead])
def get_campaign_dashboard(db: Session = Depends(get_db)):
    campaigns = db.query(Campaign).all()
    return campaigns




@app.get("/dashboard/all")
def get_dashboard_all(db: Session = Depends(get_db)):
    # Get all campaigns
    campaigns = db.query(Campaign).order_by(desc(Campaign.id)).all()
    if not campaigns:
        raise HTTPException(status_code=404, detail="No campaigns found")

    # Get the latest campaign
    latest_campaign = campaigns[0]

    # Get all campaign_data records with joined template + campaign
    all_campaign_data = (
        db.query(CampaignData)
        .options(joinedload(CampaignData.template), joinedload(CampaignData.campaign))
        .order_by(desc(CampaignData.id))
        .all()
    )

    # Calculate total recipients
    total_recipients = 0
    for data_record in all_campaign_data:
        address_list = data_record.address_list
        if address_list:
            try:
                if isinstance(address_list, str):
                    recipients = json.loads(address_list)
                else:
                    recipients = address_list
                if isinstance(recipients, list):
                    total_recipients += len(recipients)
            except (json.JSONDecodeError, TypeError):
                continue

    return {
        "total_campaigns": len(campaigns),
        "latest_campaign": {
            "id": latest_campaign.id,
            "campaign_name": latest_campaign.campaign_name,
            "mailer_name": latest_campaign.mailer_name,
        },
        "total_recipients": total_recipients,
        "all_campaigns": [
            {
                "id": campaign.id,
                "campaign_name": campaign.campaign_name,
                "mailer_name": campaign.mailer_name,
            }
            for campaign in campaigns
        ],
        "data": [
            {
                "id": d.id,
                "campaign_id": d.campaign_id,
                "campaign_name": d.campaign.campaign_name if d.campaign else None,
                "mailer_name": d.campaign.mailer_name if d.campaign else None,
                "address_list": d.address_list,
                "schedule_time": d.schedule_time,
                "status": d.status,
                "template_id": d.template_id,
                "template_preview": d.template.template if d.template else None,
                "qr_code_id": d.template.qr_code_id if d.template else None,
            }
            for d in all_campaign_data
        ],
    }
