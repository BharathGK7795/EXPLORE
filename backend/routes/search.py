from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from ..database import get_db
from ..models import User, Course, TagInteraction
from ..schemas import SearchResult, RecommendationItem
from ..auth import get_current_user
from ..recommendation import calculate_cosine_similarity

router = APIRouter(prefix="/api/search", tags=["search"])

# Static items definitions (Games, Widgets, and Articles)
STATIC_ITEMS = [
    {
        "id": "game_vortex",
        "title": "Neo-Vortex Space Shooter",
        "type": "game",
        "description": "High-velocity neon space shooter on HTML5 Canvas. Fire lasers, break vortex nodes, and dodge particle hazards.",
        "category": "Arcade",
        "tags": ["game", "arcade", "canvas", "fun"],
        "url": "#play"
    },
    {
        "id": "widget_pomodoro",
        "title": "Aesthetic Pomodoro",
        "type": "widget",
        "description": "A glassmorphic interval timer designed to keep you focused. Features procedural sound notification.",
        "category": "Productivity",
        "tags": ["productivity", "study", "habit"],
        "url": "#enjoy"
    },
    {
        "id": "widget_habits",
        "title": "Habit Board",
        "type": "widget",
        "description": "Track daily milestones, record progress, and maintain streaks with satisfying point rewards.",
        "category": "Wellness",
        "tags": ["productivity", "wellness", "habit"],
        "url": "#enjoy"
    },
    {
        "id": "article_web_audio",
        "title": "Web Audio API Synthesis",
        "type": "article",
        "description": "An introductory guide to generating synthesizer sounds, oscillators, and envelopes dynamically in the browser.",
        "category": "Coding",
        "tags": ["music", "canvas", "exploration"],
        "url": "https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API"
    },
    {
        "id": "article_neural_nets",
        "title": "Intro to Artificial Intelligence",
        "type": "article",
        "description": "A quick visual explanation of nodes, weights, and layers that make modern neural networks function.",
        "category": "AI",
        "tags": ["ai", "discovery", "science"],
        "url": "https://wikipedia.org/wiki/Artificial_neural_network"
    },
    {
        "id": "article_physics_relativity",
        "title": "The Physics of Space-Time",
        "type": "article",
        "description": "Grasp Einstein's theories of Special and General relativity with straightforward conceptual diagrams.",
        "category": "Physics",
        "tags": ["physics", "science", "exploration"],
        "url": "https://wikipedia.org/wiki/Theory_of_relativity"
    }
]

def get_all_candidate_items(db: Session) -> List[dict]:
    candidates = list(STATIC_ITEMS)
    
    # Load all courses from database
    courses = db.query(Course).all()
    for c in courses:
        candidates.append({
            "id": f"course_{c.id}",
            "title": c.title,
            "type": "course",
            "description": c.description,
            "category": c.category,
            "tags": c.tags,
            "url": f"#learn/{c.id}"
        })
        
    return candidates

@router.get("", response_model=List[SearchResult])
def search(q: Optional[str] = "", db: Session = Depends(get_db)):
    candidates = get_all_candidate_items(db)
    if not q:
        # Return all items if no query
        return [SearchResult(
            id=c["id"],
            title=c["title"],
            type=c["type"],
            description=c["description"],
            category=c["category"],
            url=c["url"]
        ) for c in candidates]
        
    q_lower = q.lower()
    results = []
    for c in candidates:
        # Match against title, category, description, and tags
        matches = (
            q_lower in c["title"].lower() or
            q_lower in c["category"].lower() or
            q_lower in c["description"].lower() or
            any(q_lower in tag.lower() for tag in c["tags"])
        )
        if matches:
            results.append(SearchResult(
                id=c["id"],
                title=c["title"],
                type=c["type"],
                description=c["description"],
                category=c["category"],
                url=c["url"]
            ))
            
    return results

@router.get("/recommendations", response_model=List[RecommendationItem])
def get_recommendations(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    candidates = get_all_candidate_items(db)
    
    # Load user vector: query TagInteraction records
    user_vector = {}
    interactions = db.query(TagInteraction).filter(TagInteraction.user_id == current_user.id).all()
    for item in interactions:
        user_vector[item.tag_name] = item.count
        
    recommended = []
    for c in candidates:
        similarity = calculate_cosine_similarity(user_vector, c["tags"])
        recommended.append(RecommendationItem(
            id=c["id"],
            title=c["title"],
            type=c["type"],
            description=c["description"],
            category=c["category"],
            tags=c["tags"],
            similarity=round(similarity, 4),
            url=c["url"]
        ))
        
    # Sort: highest similarity first, secondary alphabetical by title
    recommended.sort(key=lambda x: (x.similarity, x.title), reverse=True)
    return recommended
