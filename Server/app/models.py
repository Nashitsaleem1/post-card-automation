from sqlalchemy import Boolean, Integer, String, ForeignKey, Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .database import Base
from datetime import datetime


class Campaign(Base):
    __tablename__ = "campaigns"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    campaign_name: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True
    )

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
    mailer_name: Mapped[str] = mapped_column(String(255), nullable=False)
    template_id: Mapped[int] = mapped_column(
        ForeignKey("templates.id", ondelete="SET NULL"), nullable=True
    )

    #  Foreign key to Audience table (keeps same column name)
    audience_id: Mapped[int] = mapped_column(
        ForeignKey("audiences.id", ondelete="SET NULL"), nullable=True
    )

    schedule_time: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    send_date: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=True, default="pending")
    is_qr_scanned_complete: Mapped[bool] = mapped_column(Boolean, default=False)
    env_mode: Mapped[str] = mapped_column(String(20), nullable=False, default="testing")
    canva_link: Mapped[str | None] = mapped_column(String, nullable=True, default=None)

    # Relationships
    campaign: Mapped["Campaign"] = relationship(back_populates="items")
    template: Mapped["Template"] = relationship(back_populates="campaign_data")

    # Relationship to Audience
    audience: Mapped["Audience"] = relationship(back_populates="campaign_data_list")


class MailerOneOff(Base):
    __tablename__ = "mailer_one_off"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    mailer_name: Mapped[str] = mapped_column(String(255), nullable=False)
    template_id: Mapped[int] = mapped_column(
        ForeignKey("templates.id", ondelete="SET NULL"), nullable=True
    )

    # Foreign key to Audience table (keeps same column name)
    audience_id: Mapped[int] = mapped_column(
        ForeignKey("audiences.id", ondelete="SET NULL"), nullable=True
    )

    schedule_time: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    send_date: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=True, default="pending")

    env_mode: Mapped[str] = mapped_column(String(20), nullable=False, default="testing")
    canva_link: Mapped[str | None] = mapped_column(String, nullable=True, default=None)

    # Relationships
    template: Mapped["Template"] = relationship(back_populates="mailer_one_offs")

    # Relationship to Audience
    audience: Mapped["Audience"] = relationship(back_populates="mailer_one_off_list")


class QRCodeInfo(Base):
    __tablename__ = "qr_code_info"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    qr_code_id: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)

    templates: Mapped[list["Template"]] = relationship(
        back_populates="qr_code",
        cascade="all, delete-orphan",
    )


class Template(Base):
    __tablename__ = "templates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    template_name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    template: Mapped[str] = mapped_column(Text, nullable=False)  # HTML content
    qr_code_id: Mapped[int] = mapped_column(
        ForeignKey("qr_code_info.id", ondelete="SET NULL"), nullable=True
    )

    campaign_data: Mapped[list["CampaignData"]] = relationship(
        back_populates="template",
        cascade="all, delete-orphan",
    )
    mailer_one_offs: Mapped[list["MailerOneOff"]] = relationship(
        back_populates="template",
        cascade="all, delete-orphan",
    )

    qr_code: Mapped["QRCodeInfo"] = relationship(back_populates="templates")


class Audience(Base):
    __tablename__ = "audiences"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    audience_name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    audience_list: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    campaign_data_list: Mapped[list["CampaignData"]] = relationship(
        back_populates="audience",
        cascade="all, delete-orphan",
    )
    mailer_one_off_list: Mapped[list["MailerOneOff"]] = relationship(
        back_populates="audience",
        cascade="all, delete-orphan",
    )
