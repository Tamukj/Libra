"""SQLAlchemy 2.0 Database Models for GaitAI Platform."""

import datetime
from typing import Optional, List
from sqlalchemy import String, Integer, Float, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

class Base(DeclarativeBase):
    pass

class Clinic(Base):
    __tablename__ = "clinics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    city: Mapped[str] = mapped_column(String(100), default="Семей")
    region: Mapped[str] = mapped_column(String(100), default="Абай облысы / Область Абай")
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)

    patients: Mapped[List["Patient"]] = relationship("Patient", back_populates="clinic", cascade="all, delete-orphan")

class Patient(Base):
    __tablename__ = "patients"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    side: Mapped[str] = mapped_column(String(16), nullable=False) # LEFT or RIGHT
    weight: Mapped[float] = mapped_column(Float, nullable=False)
    height: Mapped[float] = mapped_column(Float, nullable=False)
    leg_length: Mapped[float] = mapped_column(Float, nullable=False)
    clinic_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("clinics.id"), nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)

    clinic: Mapped[Optional[Clinic]] = relationship("Clinic", back_populates="patients")
    sessions: Mapped[List["GaitSession"]] = relationship("GaitSession", back_populates="patient", cascade="all, delete-orphan")
    reports: Mapped[List["ClinicalReport"]] = relationship("ClinicalReport", back_populates="patient", cascade="all, delete-orphan")

class GaitSession(Base):
    __tablename__ = "gait_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    patient_id: Mapped[int] = mapped_column(Integer, ForeignKey("patients.id"), nullable=False)
    condition: Mapped[str] = mapped_column(String(32), nullable=False) # Baseline, Verbal, VR
    cycle_count: Mapped[int] = mapped_column(Integer, default=0)
    avg_gps: Mapped[float] = mapped_column(Float, default=0.0)
    avg_amin_sagh: Mapped[float] = mapped_column(Float, default=0.0)
    avg_gvs_pelvis: Mapped[float] = mapped_column(Float, default=0.0)
    avg_gvs_hip: Mapped[float] = mapped_column(Float, default=0.0)
    avg_gvs_knee: Mapped[float] = mapped_column(Float, default=0.0)
    avg_gvs_ankle: Mapped[float] = mapped_column(Float, default=0.0)
    recorded_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)

    patient: Mapped[Patient] = relationship("Patient", back_populates="sessions")

class ClinicalReport(Base):
    __tablename__ = "clinical_reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    patient_id: Mapped[int] = mapped_column(Integer, ForeignKey("patients.id"), nullable=False)
    icf_b770: Mapped[str] = mapped_column(String(16), nullable=False)
    icf_d450: Mapped[str] = mapped_column(String(16), nullable=False)
    tje: Mapped[float] = mapped_column(Float, nullable=False)
    pcr: Mapped[float] = mapped_column(Float, nullable=False)
    status: Mapped[str] = mapped_column(String(16), default="green") # green, yellow, red
    narrative_ru: Mapped[str] = mapped_column(Text, nullable=False)
    narrative_kz: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)

    patient: Mapped[Patient] = relationship("Patient", back_populates="reports")
