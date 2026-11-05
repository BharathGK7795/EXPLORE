from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, ForeignKey, JSON
from sqlalchemy.orm import relationship
from .database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    total_hubpoints = Column(Integer, default=0)
    badges = Column(JSON, default=list)  # List of strings, e.g. ["first_quiz", "high_score"]
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    points_history = relationship("HubPointsLedger", back_populates="user", cascade="all, delete-orphan")
    course_progress = relationship("CourseProgress", back_populates="user", cascade="all, delete-orphan")
    game_scores = relationship("GameScore", back_populates="user", cascade="all, delete-orphan")
    habits = relationship("Habit", back_populates="user", cascade="all, delete-orphan")
    tag_interactions = relationship("TagInteraction", back_populates="user", cascade="all, delete-orphan")

class HubPointsLedger(Base):
    __tablename__ = "hub_points_ledger"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    points = Column(Integer, nullable=False)
    description = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="points_history")

class Course(Base):
    __tablename__ = "courses"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    category = Column(String(100), nullable=False)
    description = Column(String(500), nullable=False)
    difficulty = Column(String(50), nullable=False)
    content = Column(JSON, nullable=False)          # [{"title": "Chapter 1", "text": "..."}]
    quiz_questions = Column(JSON, nullable=False)   # [{"question": "...", "options": ["A", "B"], "answer": 0}]
    tags = Column(JSON, nullable=False)             # ["ai", "python"]

class CourseProgress(Base):
    __tablename__ = "course_progress"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    completed = Column(Boolean, default=False)
    quiz_score = Column(Float, nullable=True)
    last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="course_progress")
    course = relationship("Course")

class GameScore(Base):
    __tablename__ = "game_scores"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    game_name = Column(String(100), nullable=False)
    score = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="game_scores")

class Habit(Base):
    __tablename__ = "habits"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(255), nullable=False)
    frequency = Column(String(50), default="daily")
    logs = Column(JSON, default=list)  # ["2026-07-21"]
    streak = Column(Integer, default=0)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="habits")

class TagInteraction(Base):
    __tablename__ = "tag_interactions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    tag_name = Column(String(100), nullable=False, index=True)
    count = Column(Integer, default=0)

    user = relationship("User", back_populates="tag_interactions")
