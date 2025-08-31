from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException, status
from . import models, schemas

# ----- Campaign -----
def create_campaign(db: Session, payload: schemas.CampaignCreate) -> models.Campaign:
    obj = models.Campaign(**payload.model_dump())
    db.add(obj)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="campaign_name already exists")
    db.refresh(obj)
    return obj

def list_campaigns(db: Session) -> list[models.Campaign]:
    return db.query(models.Campaign).order_by(models.Campaign.id.desc()).all()

def get_campaign(db: Session, campaign_id: int) -> models.Campaign | None:
    return db.query(models.Campaign).filter(models.Campaign.id == campaign_id).first()

# ----- CampaignData -----
def create_campaign_data(db: Session, payload: schemas.CampaignDataCreate) -> models.CampaignData:
    # ensure campaign exists
    campaign = get_campaign(db, payload.campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    obj = models.CampaignData(
        campaign_id=payload.campaign_id,
        address_list=payload.address_list,
        template=payload.template,
        scheduling_info=payload.scheduling_info,
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj

def list_campaign_data(db: Session) -> list[models.CampaignData]:
    return db.query(models.CampaignData).order_by(models.CampaignData.id.desc()).all()

def list_campaign_items(db: Session, campaign_id: int) -> list[models.CampaignData]:
    return db.query(models.CampaignData).filter(models.CampaignData.campaign_id == campaign_id).all()
