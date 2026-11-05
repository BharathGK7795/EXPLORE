from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from datetime import datetime
from ..database import get_db
from ..models import User, GameScore, HubPointsLedger, TagInteraction
from ..schemas import GameScoreCreate, GameScoreOut, LeaderboardEntry
from ..auth import get_current_user
import jwt
from ..auth import SECRET_KEY, ALGORITHM

router = APIRouter(prefix="/api/play", tags=["play"])

# Connection Manager for WebSocket leaderboard updates
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in list(self.active_connections):
            try:
                await connection.send_json(message)
            except Exception:
                self.disconnect(connection)

manager = ConnectionManager()

def mask_email(email: str) -> str:
    if "@" not in email:
        return email
    name, domain = email.split("@", 1)
    if len(name) <= 3:
        return name + "***" + "@" + domain
    return name[:3] + "***" + "@" + domain

def fetch_top_leaderboard(db: Session, game_name: str = "Neo-Vortex") -> List[LeaderboardEntry]:
    # Fetch top 10 unique user scores for a game
    subquery = db.query(
        GameScore.user_id,
        func.max(GameScore.score).label("max_score")
    ).filter(GameScore.game_name == game_name)\
     .group_by(GameScore.user_id)\
     .subquery()
     
    results = db.query(User.email, subquery.c.max_score, GameScore.created_at)\
        .join(subquery, User.id == subquery.c.user_id)\
        .join(GameScore, (GameScore.user_id == User.id) & (GameScore.score == subquery.c.max_score))\
        .order_by(subquery.c.max_score.desc())\
        .limit(10).all()
        
    entries = []
    # Deduplicate in case of multiple matching max scores for same user
    seen_users = set()
    rank = 1
    for email, max_score, created_at in results:
        if email in seen_users:
            continue
        seen_users.add(email)
        entries.append(LeaderboardEntry(
            email=mask_email(email),
            score=max_score,
            rank=rank,
            created_at=created_at.strftime("%Y-%m-%d %H:%M")
        ))
        rank += 1
    return entries

@router.get("/leaderboard", response_model=List[LeaderboardEntry])
def get_leaderboard(game_name: str = "Neo-Vortex", db: Session = Depends(get_db)):
    return fetch_top_leaderboard(db, game_name)

@router.post("/submit-score", response_model=GameScoreOut)
async def submit_score(score_data: GameScoreCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Record new score
    new_score = GameScore(
        user_id=current_user.id,
        game_name=score_data.game_name,
        score=score_data.score
    )
    db.add(new_score)
    
    # Calculate previous personal high score
    prev_high = db.query(func.max(GameScore.score)).filter(
        GameScore.user_id == current_user.id,
        GameScore.game_name == score_data.game_name
    ).scalar()
    
    is_new_high = prev_high is None or score_data.score > prev_high
    
    # Base play rewards
    points_earned = 5
    description = f"Played game: {score_data.game_name}"
    
    if is_new_high:
        points_earned += 15 # Bonus points for new personal record
        description = f"New Personal High Score on {score_data.game_name}!"
        
    # Award points
    current_user.total_hubpoints += points_earned
    ledger = HubPointsLedger(
        user_id=current_user.id,
        points=points_earned,
        description=description
    )
    db.add(ledger)
    
    # Update badges
    user_badges = list(current_user.badges)
    if "Gamer" not in user_badges:
        user_badges.append("Gamer")
    if is_new_high and score_data.score >= 500 and "Vortex Master" not in user_badges:
        user_badges.append("Vortex Master")
    current_user.badges = user_badges
    
    # Update user vector tags for game interactions
    game_tags = ["game", "arcade", "canvas", "fun"]
    for tag in game_tags:
        tag_interaction = db.query(TagInteraction).filter(
            TagInteraction.user_id == current_user.id,
            TagInteraction.tag_name == tag
        ).first()
        if not tag_interaction:
            tag_interaction = TagInteraction(user_id=current_user.id, tag_name=tag, count=0)
            db.add(tag_interaction)
        tag_interaction.count += 1 if not is_new_high else 2
        
    db.commit()
    db.refresh(new_score)
    
    # Broadcast updated leaderboard to active sockets
    leaderboard = fetch_top_leaderboard(db, score_data.game_name)
    leaderboard_dicts = [entry.model_dump() for entry in leaderboard]
    await manager.broadcast({
        "type": "leaderboard_update",
        "game_name": score_data.game_name,
        "leaderboard": leaderboard_dicts,
        "new_score": {
            "email": mask_email(current_user.email),
            "score": score_data.score
        }
    })
    
    return new_score

@router.websocket("/leaderboard/ws")
async def websocket_leaderboard(websocket: WebSocket, token: str = None, db: Session = Depends(get_db)):
    # Authenticate optionally if token is passed via query params
    # ws connects don't easily allow Bearer headers in standard browser JS
    user_email = None
    if token:
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            user_email = payload.get("sub")
        except Exception:
            pass
            
    await manager.connect(websocket)
    try:
        # Send initial leaderboard on connection
        leaderboard = fetch_top_leaderboard(db, "Neo-Vortex")
        leaderboard_dicts = [entry.model_dump() for entry in leaderboard]
        await websocket.send_json({
            "type": "welcome",
            "leaderboard": leaderboard_dicts
        })
        
        while True:
            # Keep connection open, handle incoming pings
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)
