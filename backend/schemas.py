from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, EmailStr, Field

# Authentication schemas
class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class UserOut(BaseModel):
    id: int
    email: EmailStr
    total_hubpoints: int
    badges: List[str]
    created_at: datetime

    class Config:
        from_attributes = True

# Learn module schemas
class QuizQuestion(BaseModel):
    question: str
    options: List[str]
    answer: int

class Chapter(BaseModel):
    title: str
    text: str

class CourseOut(BaseModel):
    id: int
    title: str
    category: str
    description: str
    difficulty: str
    content: List[Chapter]
    quiz_questions: List[QuizQuestion]
    tags: List[str]

    class Config:
        from_attributes = True

class CourseProgressOut(BaseModel):
    course_id: int
    completed: bool
    quiz_score: Optional[float] = None
    last_updated: datetime

    class Config:
        from_attributes = True

class QuizSubmit(BaseModel):
    answers: List[int]

class QuizSubmitResponse(BaseModel):
    score: float
    passed: bool
    points_earned: int
    correct_answers: List[int]

# Play module schemas
class GameScoreCreate(BaseModel):
    game_name: str
    score: int

class GameScoreOut(BaseModel):
    id: int
    game_name: str
    score: int
    created_at: datetime

    class Config:
        from_attributes = True

class LeaderboardEntry(BaseModel):
    email: str
    score: int
    rank: int
    created_at: str

# Enjoy module schemas
class HabitCreate(BaseModel):
    name: str
    frequency: str = "daily"

class HabitOut(BaseModel):
    id: int
    name: str
    frequency: str
    logs: List[str]
    streak: int
    updated_at: datetime

    class Config:
        from_attributes = True

# Summarization schemas
class SummarizeRequest(BaseModel):
    text: str
    sentences_count: int = Field(3, ge=1, le=10)

class SummarizeResponse(BaseModel):
    summary: str
    key_points: List[str]

# Search/Explore schemas
class SearchResult(BaseModel):
    id: str  # e.g. "course_1", "game_shooter", "widget_pomodoro"
    title: str
    type: str  # "course" | "game" | "widget"
    description: str
    category: str
    url: str

class RecommendationItem(BaseModel):
    id: str
    title: str
    type: str
    description: str
    category: str
    tags: List[str]
    similarity: float
    url: str
