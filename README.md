# DigitalHub - Unified AI Web Ecosystem

DigitalHub is a modern web platform integrating AI-assisted learning modules, interactive gaming, leisure widgets, and intelligent search into a single ecosystem.

## Features

- **Learn**: Interactive AI-driven courses and quizzes.
- **Play**: Lightweight browser-based gaming and challenges.
- **Enjoy**: Leisure widgets, music/audio relaxation, and entertainment.
- **Search**: Integrated search across course content and resources.
- **Authentication**: JWT-based secure user authentication and profile management.

## Tech Stack

- **Backend**: FastAPI, SQLAlchemy, SQLite, Pydantic, Uvicorn, Python-Jose / PyJWT, Passlib / Bcrypt
- **Frontend**: Responsive HTML5, CSS3, Modern Vanilla JavaScript, FontAwesome
- **Architecture**: RESTful ASGI API with static frontend serving

## Getting Started

### Prerequisites

- Python 3.10+ installed

### Quick Start (Windows)

Simply double-click `start.bat` or run:

```bash
start.bat
```

This will automatically create a virtual environment, install dependencies from `requirements.txt`, launch the server at `http://127.0.0.1:8000`, and open the application in your browser.

### Manual Setup

1. **Create and activate a virtual environment**:
   ```bash
   python -m venv venv
   # On Windows:
   venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```

2. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Run the application**:
   ```bash
   python run.py
   ```
   Or directly via Uvicorn:
   ```bash
   uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
   ```

4. **Access the portal**:
   Open [http://127.0.0.1:8000](http://127.0.0.1:8000) in your web browser.
