from sqlalchemy import Integer, String, ForeignKey, Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .database import Base
from datetime import datetime


class Campaign(Base):
    __tablename__ = "campaigns"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    campaign_name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    mailer_name: Mapped[str] = mapped_column(String(255), nullable=False)

    # One-to-many relationship
    items: Mapped[list["CampaignData"]] = relationship(
        back_populates="campaign",
        cascade="all, delete-orphan",
    )


class CampaignData(Base):
    __tablename__ = "campaign_data"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    campaign_id: Mapped[int] = mapped_column(
        ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False
    )
    template_id: Mapped[int] = mapped_column(
        ForeignKey("templates.id", ondelete="SET NULL"), nullable=True
    )

    address_list: Mapped[str] = mapped_column(String, nullable=False)   # e.g., a list name or CSV path
    schedule_time: Mapped[datetime] = mapped_column(DateTime, nullable=True)  # renamed & proper type

    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="pending"   # possible values: pending, scheduled, sent, failed
    )

    # Relationships
    campaign: Mapped["Campaign"] = relationship(back_populates="items")
    template: Mapped["Template"] = relationship(back_populates="campaign_data")


class QRCodeInfo(Base):
    __tablename__ = "qr_code_info"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    qr_code_id: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    # Relationship: One QR code can be assigned to multiple templates (if needed)
    templates: Mapped[list["Template"]] = relationship(
        back_populates="qr_code",
        cascade="all, delete-orphan",
    )

class Template(Base):
    __tablename__ = "templates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    template: Mapped[str] = mapped_column(Text, nullable=False)  # HTML content
    qr_code_id: Mapped[int] = mapped_column(
        ForeignKey("qr_code_info.id", ondelete="SET NULL"), nullable=True
    )

    # One-to-many: A template can be used in multiple campaign_data rows
    campaign_data: Mapped[list["CampaignData"]] = relationship(
        back_populates="template",
        cascade="all, delete-orphan",
    )

    # Relationship to QR code
    qr_code: Mapped["QRCodeInfo"] = relationship(back_populates="templates")