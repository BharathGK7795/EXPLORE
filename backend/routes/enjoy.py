from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, date, timedelta
from ..database import get_db
from ..models import User, Habit, HubPointsLedger, TagInteraction
from ..schemas import HabitCreate, HabitOut
from ..auth import get_current_user

router = APIRouter(prefix="/api/enjoy", tags=["enjoy"])

@router.get("/habits", response_model=List[HabitOut])
def get_habits(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Habit).filter(Habit.user_id == current_user.id).all()

@router.post("/habits", response_model=HabitOut)
def create_habit(habit_data: HabitCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    new_habit = Habit(
        user_id=current_user.id,
        name=habit_data.name,
        frequency=habit_data.frequency,
        logs=[],
        streak=0
    )
    db.add(new_habit)
    db.commit()
    db.refresh(new_habit)
    
    # Award small point bonus for starting a new habit
    current_user.total_hubpoints += 10
    ledger = HubPointsLedger(
        user_id=current_user.id,
        points=10,
        description=f"Created Habit: {new_habit.name}"
    )
    db.add(ledger)
    db.commit()
    
    return new_habit

@router.post("/habits/{habit_id}/toggle", response_model=HabitOut)
def toggle_habit(habit_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    habit = db.query(Habit).filter(Habit.id == habit_id, Habit.user_id == current_user.id).first()
    if not habit:
        raise HTTPException(status_code=404, detail="Habit not found")
        
    today_str = date.today().strftime("%Y-%m-%d")
    yesterday_str = (date.today() - timedelta(days=1)).strftime("%Y-%m-%d")
    
    logs = list(habit.logs) if habit.logs else []
    points_earned = 0
    description = ""
    
    if today_str in logs:
        # Untoggle: remove log, decrement score
        logs.remove(today_str)
        points_earned = -2
        description = f"Unchecked Habit: {habit.name}"
        # Recalculate streak
        if yesterday_str in logs:
            # Revert to streak of 1 or recalculate
            habit.streak = max(0, habit.streak - 1)
        else:
            habit.streak = 0
    else:
        # Toggle complete: add log
        logs.append(today_str)
        points_earned = 2
        description = f"Completed Habit: {habit.name}"
        
        # Calculate streak
        if yesterday_str in logs:
            habit.streak += 1
        else:
            habit.streak = 1
            
        # Give extra bonus for achieving milestones (e.g. 7-day streak)
        if habit.streak > 0 and habit.streak % 7 == 0:
            points_earned += 15
            description += " (7-Day Streak Bonus!)"
            
            # Badge update
            user_badges = list(current_user.badges)
            if "Disciplined" not in user_badges:
                user_badges.append("Disciplined")
                current_user.badges = user_badges
                
        # Productivity tag interaction weight
        productivity_tags = ["productivity", "wellness", "habit"]
        for tag in productivity_tags:
            tag_interaction = db.query(TagInteraction).filter(
                TagInteraction.user_id == current_user.id,
                TagInteraction.tag_name == tag
            ).first()
            if not tag_interaction:
                tag_interaction = TagInteraction(user_id=current_user.id, tag_name=tag, count=0)
                db.add(tag_interaction)
            tag_interaction.count += 1
            
    habit.logs = logs
    habit.updated_at = datetime.utcnow()
    current_user.total_hubpoints += points_earned
    
    # Store points transaction if it's non-zero
    if points_earned != 0:
        ledger = HubPointsLedger(
            user_id=current_user.id,
            points=points_earned,
            description=description
        )
        db.add(ledger)
        
    db.commit()
    db.refresh(habit)
    
    return habit

@router.post("/mood")
def record_mood(mood: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Validate mood
    mood = mood.lower()
    if mood not in ["focus", "relaxed", "curious"]:
        raise HTTPException(status_code=400, detail="Invalid mood state")
        
    # Map mood states to tag weight increments
    mood_tags = {
        "focus": ["ai", "python", "productivity", "study"],
        "relaxed": ["game", "arcade", "canvas", "fun", "music"],
        "curious": ["discovery", "physics", "science", "exploration"]
    }
    
    tags_to_update = mood_tags.get(mood, [])
    for tag in tags_to_update:
        tag_interaction = db.query(TagInteraction).filter(
            TagInteraction.user_id == current_user.id,
            TagInteraction.tag_name == tag
        ).first()
        if not tag_interaction:
            tag_interaction = TagInteraction(user_id=current_user.id, tag_name=tag, count=0)
            db.add(tag_interaction)
        tag_interaction.count += 2  # Boost weight by 2 for mood selection
        
    db.commit()
    return {"status": "success", "message": f"Mood updated to {mood}. Personalized feed updated."}
