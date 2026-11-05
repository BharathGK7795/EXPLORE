from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from ..models import Course, CourseProgress, User, HubPointsLedger, TagInteraction
from ..schemas import CourseOut, CourseProgressOut, QuizSubmit, QuizSubmitResponse, SummarizeRequest, SummarizeResponse
from ..auth import get_current_user
from ..summarizer import summarize_text

router = APIRouter(prefix="/api/learn", tags=["learn"])

@router.get("/courses", response_model=List[CourseOut])
def get_courses(db: Session = Depends(get_db)):
    return db.query(Course).all()

@router.get("/courses/{course_id}", response_model=CourseOut)
def get_course(course_id: int, db: Session = Depends(get_db)):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    return course

@router.get("/courses/{course_id}/progress", response_model=CourseProgressOut)
def get_progress(course_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Verify course exists
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
        
    progress = db.query(CourseProgress).filter(
        CourseProgress.user_id == current_user.id,
        CourseProgress.course_id == course_id
    ).first()
    
    if not progress:
        # Create empty progress record
        progress = CourseProgress(user_id=current_user.id, course_id=course_id, completed=False)
        db.add(progress)
        db.commit()
        db.refresh(progress)
        
    return progress

@router.post("/courses/{course_id}/submit-quiz", response_model=QuizSubmitResponse)
def submit_quiz(course_id: int, quiz_sub: QuizSubmit, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
        
    questions = course.quiz_questions
    if len(quiz_sub.answers) != len(questions):
        raise HTTPException(status_code=400, detail="Answer count does not match question count")
        
    correct_count = 0
    correct_answers = []
    for idx, question in enumerate(questions):
        correct_ans = question.get("answer")
        correct_answers.append(correct_ans)
        if idx < len(quiz_sub.answers) and quiz_sub.answers[idx] == correct_ans:
            correct_count += 1
            
    score = (correct_count / len(questions)) * 100 if questions else 0.0
    passed = score >= 70.0
    
    # Track progress update
    progress = db.query(CourseProgress).filter(
        CourseProgress.user_id == current_user.id,
        CourseProgress.course_id == course_id
    ).first()
    
    if not progress:
        progress = CourseProgress(user_id=current_user.id, course_id=course_id)
        db.add(progress)
        
    was_completed = progress.completed
    progress.quiz_score = score
    if passed:
        progress.completed = True
        
    points_earned = 0
    if passed and not was_completed:
        # First time passing the course: award HubPoints!
        points_earned = 50
        current_user.total_hubpoints += points_earned
        
        # Add ledger record
        ledger = HubPointsLedger(
            user_id=current_user.id,
            points=points_earned,
            description=f"Passed Quiz: {course.title}"
        )
        db.add(ledger)
        
        # Award badge if first time
        user_badges = list(current_user.badges)
        if "Scholar" not in user_badges:
            user_badges.append("Scholar")
            current_user.badges = user_badges
            
        # Update tag interactions vector U for similarity algorithm
        for tag in course.tags:
            tag_interaction = db.query(TagInteraction).filter(
                TagInteraction.user_id == current_user.id,
                TagInteraction.tag_name == tag
            ).first()
            if not tag_interaction:
                tag_interaction = TagInteraction(user_id=current_user.id, tag_name=tag, count=0)
                db.add(tag_interaction)
            tag_interaction.count += 3 # Substantial weight for passing quizzes
            
    db.commit()
    
    return QuizSubmitResponse(
        score=score,
        passed=passed,
        points_earned=points_earned,
        correct_answers=correct_answers
    )

@router.post("/summarize", response_model=SummarizeResponse)
def summarize(req: SummarizeRequest):
    if not req.text.strip():
        return SummarizeResponse(summary="", key_points=[])
    summary, key_points = summarize_text(req.text, req.sentences_count)
    return SummarizeResponse(summary=summary, key_points=key_points)
