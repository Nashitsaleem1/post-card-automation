# schemas.py
from datetime import datetime
import json
from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import List, Literal, Optional


# ---------- Template ----------
class TemplateBase(BaseModel):
    template_name: str
    html_content: str


class TemplateCreate(TemplateBase):
    qr_code_id: Optional[int] = None


class TemplateRead(TemplateBase):
    id: int
    qr_code_id: Optional[int] = None
    model_config = ConfigDict(from_attributes=True)


# ---------- Address ----------
class Address(BaseModel):
    firstName: str
    lastName: str
    address: str
    city: str
    state: str
    zipCode: str


# ---------- Audience ----------
class AudienceBase(BaseModel):
    audience_name: str
    audience_list: List[Address]

    # Convert JSON string from DB into list of Address objects
    @field_validator("audience_list", mode="before")
    def parse_audience_list(cls, value):
        if isinstance(value, str):
            try:
                return json.loads(value)
            except json.JSONDecodeError:
                return []
        return value


class AudienceCreate(AudienceBase):
    pass


class AudienceRead(AudienceBase):
    id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# ---------- CampaignData ----------
class CampaignDataBase(BaseModel):
    mailer_name: str
    audience_id: Optional[int] = None  # now FK to Audience table
    template_id: Optional[int] = None
    schedule_time: Optional[datetime] = None
    send_date: Optional[datetime] = None
    status: Optional[str] = "pending"
    is_qr_scanned_complete: Optional[bool] = False
    env_mode: Literal["testing", "production"] = "testing"
    canva_link: Optional[str] = None
    res_recipients : Optional[int] =  None
 #   pdf_link: Optional[str] = None

class CampaignDataCreate(CampaignDataBase):
    campaign_id: int


class CampaignDataUpdate(BaseModel):
    template_id: Optional[int] = None
    status: Optional[str] = None
    schedule_time: Optional[datetime] = None
    send_date: Optional[datetime] = None
    is_qr_scanned_complete: Optional[bool] = None
    env_mode: Optional[Literal["testing", "production"]] = None
    canva_link: Optional[str] = None
    audience_id: Optional[int] = None
    res_recipients : Optional[int] =  None
   # pdf_link: Optional[str] = None

class CampaignDataRead(CampaignDataBase):
    id: int
    campaign_id: int
    model_config = ConfigDict(from_attributes=True)


# ---------- Campaign ----------
class CampaignBase(BaseModel):
    campaign_name: str


class CampaignCreate(CampaignBase):
    pass


class CampaignRead(CampaignBase):
    id: int
    items: List[CampaignDataRead] = []
    model_config = ConfigDict(from_attributes=True)


class CampaignDataWithCampaignName(BaseModel):
    id: int
    campaign_id: int
    mailer_name: str
    template_id: Optional[int] = None
    schedule_time: Optional[datetime] = None
    send_date: Optional[datetime] = None
    status: Optional[str] = "pending"
    campaign_name: str
    audience_list: Optional[str] = None
    env_mode: Optional[str] = None
    canva_link: Optional[str] = None
    audience_id: Optional[int] = None
    res_recipients : Optional[int] =  None
  #  pdf_link: Optional[str] = None

    class Config:
        orm_mode = True


# ---------- MailerOneOff ----------
class MailerOneOffBase(BaseModel):
    mailer_name: str
    audience_id: Optional[int] = None 
    template_id: Optional[int] = None
    schedule_time: Optional[datetime] = None
    send_date: Optional[datetime] = None
    status: Optional[str] = "pending"
    env_mode: Literal["testing", "production"] = "testing"
    canva_link: Optional[str] = None
    res_recipients : Optional[int] =  None
   # pdf_link: Optional[str] = None
    
    class Config:
        from_attributes = True


class MailerOneOffCreate(MailerOneOffBase):
    pass


class MailerOneOffRead(MailerOneOffBase):
    id: int
    model_config = ConfigDict(from_attributes=True)


class MailerOneOffResponse(MailerOneOffBase):
    id: int
    audience_name: Optional[str] = None 
    audience_list: Optional[list] = []  

    class Config:
        orm_mode = True


class MailerOneOffUpdate(BaseModel):
    template_id: Optional[int] = None
    schedule_time: Optional[datetime] = None
    status: Optional[str] = None
    send_date: Optional[datetime] = None
    env_mode: Optional[Literal["testing", "production"]] = None
    canva_link: Optional[str] = None
    audience_id: Optional[int] = None
    res_recipients : Optional[int] =  None
   # pdf_link: Optional[str] = None