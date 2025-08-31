# schemas.py
from datetime import datetime
from pydantic import BaseModel, ConfigDict
from typing import List, Optional

# ---------- Template ----------
class TemplateBase(BaseModel):
    html_content: str

class TemplateCreate(TemplateBase):
    qr_code_id: int | None = None

class TemplateRead(TemplateBase):
    id: int
    qr_code_id: int | None  # add this
    model_config = ConfigDict(from_attributes=True)

# ---------- CampaignData ----------

class CampaignDataBase(BaseModel):
    address_list: str
    template_id: Optional[int] = None
    schedule_time: Optional[datetime] = None   
    status: Optional[str] = "pending"          
    

class CampaignDataCreate(CampaignDataBase):
    campaign_id: int

class CampaignDataRead(CampaignDataBase):
    id: int
    campaign_id: int
    model_config = ConfigDict(from_attributes=True)
    
# ---------- Campaign ----------
class CampaignBase(BaseModel):
    campaign_name: str
    mailer_name: str

class CampaignCreate(CampaignBase):
    pass

class CampaignRead(CampaignBase):
    id: int
    items: List[CampaignDataRead] = []
    model_config = ConfigDict(from_attributes=True)



# ---------- Join views ----------
class CampaignWithData(CampaignRead):
    items: list[CampaignDataRead] = []  # campaign’s associated data
