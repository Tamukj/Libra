"""SQLAlchemy 2.0 Database Models for Libra Platform."""

import datetime
from typing import Optional, List
from sqlalchemy import Boolean, String, Integer, Float, DateTime, ForeignKey, Text, UniqueConstraint, TypeDecorator
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class UTCDateTime(TypeDecorator):
    impl = DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is not None:
            if value.tzinfo is None:
                value = value.replace(tzinfo=datetime.timezone.utc)
            else:
                value = value.astimezone(datetime.timezone.utc)
        return value

    def process_result_value(self, value, dialect):
        if value is not None and value.tzinfo is None:
            return value.replace(tzinfo=datetime.timezone.utc)
        return value


def _utcnow() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)


class Base(DeclarativeBase):
    pass


class Clinic(Base):
    __tablename__ = "clinics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    city: Mapped[str] = mapped_column(String(100), default="")
    region: Mapped[str] = mapped_column(String(100), default="")
    created_at: Mapped[datetime.datetime] = mapped_column(UTCDateTime, default=_utcnow)

    patients: Mapped[List["Patient"]] = relationship("Patient", back_populates="clinic")


class Patient(Base):
    __tablename__ = "patients"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    side: Mapped[str] = mapped_column(String(16), default="UNSPECIFIED", nullable=False)  # LEFT, RIGHT, or UNSPECIFIED
    weight: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    height: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    leg_length: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    anthropometry_estimated: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    side_estimated: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    clinic_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("clinics.id"), index=True, nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(UTCDateTime, default=_utcnow)

    clinic: Mapped[Optional[Clinic]] = relationship("Clinic", back_populates="patients")
    sessions: Mapped[List["GaitSession"]] = relationship("GaitSession", back_populates="patient", cascade="all, delete-orphan")
    reports: Mapped[List["ClinicalReport"]] = relationship("ClinicalReport", back_populates="patient", cascade="all, delete-orphan")


class GaitSession(Base):
    __tablename__ = "gait_sessions"
    __table_args__ = (UniqueConstraint("patient_id", "visit_key", "condition", name="uq_patient_visit_condition"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    patient_id: Mapped[int] = mapped_column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), index=True, nullable=False)
    visit_key: Mapped[str] = mapped_column(String(64), default="visit-1", nullable=False)
    visit_label: Mapped[str] = mapped_column(String(128), default="", nullable=False)
    visit_date: Mapped[str] = mapped_column(String(32), default="", nullable=False)
    condition: Mapped[str] = mapped_column(String(32), nullable=False)  # Baseline, Verbal, VR
    cycle_count: Mapped[int] = mapped_column(Integer, default=0)
    avg_gps: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    avg_amin_sagh: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    avg_gvs_pelvis: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    avg_gvs_hip: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    avg_gvs_knee: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    avg_gvs_ankle: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    avg_pctm_zero: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    avg_pelvis_tilt: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    kinematics_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    source: Mapped[str] = mapped_column(String(32), default="seeded")
    recorded_at: Mapped[datetime.datetime] = mapped_column(UTCDateTime, default=_utcnow)

    patient: Mapped[Patient] = relationship("Patient", back_populates="sessions")


class ClinicalReport(Base):
    __tablename__ = "clinical_reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    patient_id: Mapped[int] = mapped_column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), index=True, nullable=False)
    visit_key: Mapped[str] = mapped_column(String(64), default="visit-1", nullable=False)
    icf_b770: Mapped[str] = mapped_column(String(16), nullable=False)
    icf_d450: Mapped[str] = mapped_column(String(16), nullable=False)
    tje: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    pcr: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="green")
    narrative_ru: Mapped[str] = mapped_column(Text, nullable=False)
    narrative_kz: Mapped[str] = mapped_column(Text, nullable=False)
    narrative_en: Mapped[str] = mapped_column(Text, nullable=False, default="")
    audience: Mapped[str] = mapped_column(String(16), default="doctor")
    created_at: Mapped[datetime.datetime] = mapped_column(UTCDateTime, default=_utcnow)

    patient: Mapped[Patient] = relationship("Patient", back_populates="reports")
