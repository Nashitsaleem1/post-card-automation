# schemas.py
from datetime import datetime
from pydantic import BaseModel, ConfigDict
from typing import List, Literal, Optional


class TemplateBase(BaseModel):
    template_name: str
    html_content: str


class TemplateCreate(TemplateBase):
    qr_code_id: int | None = None


class TemplateRead(TemplateBase):
    id: int
    qr_code_id: int | None = None
    model_config = ConfigDict(from_attributes=True)


# ---------- CampaignData ----------
class CampaignDataBase(BaseModel):
    mailer_name: str
    address_list: str
    template_id: Optional[int] = None
    schedule_time: Optional[datetime] = None
    send_date: Optional[datetime] = None
    status: Optional[str] = "pending"
    is_qr_scanned_complete: Optional[bool] = False
    env_mode: Literal["testing", "production"] = "testing" 


class CampaignDataUpdate(BaseModel):
    template_id: Optional[int] = None
    status: Optional[str] = None
    schedule_time: Optional[datetime] = None
    send_date: Optional[datetime] = None
    is_qr_scanned_complete: Optional[bool] = None
    env_mode: Optional[Literal["testing", "production"]] = None  


class CampaignDataCreate(CampaignDataBase):
    campaign_id: int
    send_date: Optional[datetime] = None


class CampaignDataRead(CampaignDataBase):
    id: int
    campaign_id: int
    send_date: Optional[datetime] = None
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
    address_list: str
    template_id: int | None = None
    schedule_time: datetime | None = None
    send_date: datetime | None = None
    status: str | None = "pending"
    campaign_name: str 
    env_mode: str | None = None  

    class Config:
        orm_mode = True


class MailerOneOffBase(BaseModel):
    mailer_name: str
    address_list: str
    template_id: Optional[int] = None
    schedule_time: Optional[datetime] = None
    send_date: Optional[datetime] = None
    status: Optional[str] = "pending"
    env_mode: Literal["testing", "production"] = "testing" 


class MailerOneOffCreate(MailerOneOffBase):
    pass


class MailerOneOffRead(MailerOneOffBase):
    id: int
    model_config = ConfigDict(from_attributes=True)


class MailerOneOffResponse(MailerOneOffBase):
    id: int

    class Config:
        orm_mode = True


class MailerOneOffUpdate(BaseModel):
    template_id: Optional[int] = None
    schedule_time: Optional[datetime] = None
    status: Optional[str] = None
    send_date: Optional[datetime] = None
    env_mode: Optional[Literal["testing", "production"]] = None  
