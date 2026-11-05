import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from .database import engine, Base, SessionLocal
from .models import Course
from .routes import auth, learn, play, enjoy, search

# Initialize database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="DigitalHub API",
    description="Unified API endpoints for learning, gaming, leisure widgets, and personalized search",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Seed database with courses on startup
def seed_courses():
    db = SessionLocal()
    try:
        if db.query(Course).count() == 0:
            courses = [
                Course(
                    title="Introduction to Artificial Intelligence",
                    category="Computer Science",
                    description="Learn the core concepts of AI, Machine Learning, and how neural networks learn from data.",
                    difficulty="Beginner",
                    content=[
                        {
                            "title": "1. What is AI?",
                            "text": "Artificial Intelligence is the simulation of human intelligence by computers. Unlike traditional programming where algorithms follow strict predefined conditions, AI uses statistical methods to learn patterns from examples. The machine extracts features from data input and produces generalizations that apply to unseen tasks."
                        },
                        {
                            "title": "2. Machine Learning Fundamentals",
                            "text": "Machine Learning (ML) is a subset of AI focused on training models using optimization algorithms. In supervised learning, the model is fed labeled training data. The optimizer iteratively adjusts weights and parameters to minimize error (loss function) through gradient descent. Once trained, the model can make predictions on test datasets."
                        }
                    ],
                    quiz_questions=[
                        {
                            "question": "What is the primary difference between AI and traditional programming?",
                            "options": [
                                "AI programs do not require a compiler",
                                "AI learns rules from data patterns rather than relying on hardcoded conditions",
                                "AI runs exclusively on quantum systems",
                                "There is no functional difference"
                            ],
                            "answer": 1
                        },
                        {
                            "question": "In machine learning, what does the training phase accomplish?",
                            "options": [
                                "Writing source unit tests",
                                "Iteratively adjusting model parameters to minimize a loss function",
                                "Compiling code to web assemblies",
                                "Clearing cache registers"
                            ],
                            "answer": 1
                        }
                    ],
                    tags=["ai", "discovery", "science"]
                ),
                Course(
                    title="Web Audio Synthesis 101",
                    category="Web Development",
                    description="Explore the Web Audio API to create synthesizers, sound effects, and digital musical instruments directly in your browser.",
                    difficulty="Intermediate",
                    content=[
                        {
                            "title": "1. Understanding the AudioContext",
                            "text": "The Web Audio API operates within an AudioContext. The context controls the creation of audio nodes and schedules sound execution. Nodes are linked together in a modular graph. Audio flows from sources (oscillators, buffers) through processors (gain control, filters, delay) and terminates at the destination (speakers or headphones)."
                        },
                        {
                            "title": "2. Oscillators and Envelopes",
                            "text": "An OscillatorNode generates a periodic waveform (Sine, Triangle, Sawtooth, or Square). It serves as the raw signal generator. To shape the sound, we connect it to a GainNode, controlling amplitude. By applying an envelope (Attack, Decay, Sustain, Release) to the gain parameter, we turn a continuous drone into a musical note with pluck, sustain, and fade characteristics."
                        }
                    ],
                    quiz_questions=[
                        {
                            "question": "What does the AudioContext 'destination' node represent?",
                            "options": [
                                "The local sqlite database file path",
                                "The output audio hardware (speakers, headphones, etc.)",
                                "A websocket server pipeline",
                                "The browser local storage buffer"
                            ],
                            "answer": 1
                        },
                        {
                            "question": "Which basic oscillator waveform possesses the brightest harmonic profile?",
                            "options": [
                                "Sine wave (pure tone)",
                                "Triangle wave (soft tone)",
                                "Sawtooth wave (rich buzzy tone)",
                                "All waveforms have identical harmonics"
                            ],
                            "answer": 2
                        }
                    ],
                    tags=["music", "canvas", "exploration"]
                ),
                Course(
                    title="Physics of Special Relativity",
                    category="Physics",
                    description="An intuitive conceptual dive into Einstein's theories of time dilation, length contraction, and energy-mass equivalence.",
                    difficulty="Advanced",
                    content=[
                        {
                            "title": "1. Postulates of Special Relativity",
                            "text": "Albert Einstein's 1905 theory is built on two postulates: 1. The laws of physics are identical in all inertial (non-accelerating) reference frames. 2. The speed of light in a vacuum (c) is constant for all observers, regardless of the motion of the light source or the observer. These postulates lead directly to the collapse of absolute space and time."
                        },
                        {
                            "title": "2. Time Dilation and Mass Equivalence",
                            "text": "Because the speed of light must remain constant, moving clocks must run slower relative to a stationary observer. This phenomenon is time dilation. Additionally, length contracts in the direction of travel. As objects accelerate, their kinetic energy increases, leading to the equivalence of mass and energy expressed by the equation: E = mc²."
                        }
                    ],
                    quiz_questions=[
                        {
                            "question": "According to Special Relativity, what remains invariant across all reference frames?",
                            "options": [
                                "The flow rate of absolute time",
                                "The length of physical rods",
                                "The speed of light in a vacuum",
                                "The gravitational force field strength"
                            ],
                            "answer": 2
                        },
                        {
                            "question": "What fundamental relation does E = mc² state?",
                            "options": [
                                "Mass and energy are equivalent and interconvertible",
                                "Force is proportional to acceleration",
                                "Electricity and magnetism are unrelated",
                                "Temperature dictates volume pressure ratios"
                            ],
                            "answer": 0
                        }
                    ],
                    tags=["physics", "science", "exploration"]
                )
            ]
            db.add_all(courses)
            db.commit()
    finally:
        db.close()

# Seed courses on startup
seed_courses()

# Mount routers
app.include_router(auth.router)
app.include_router(learn.router)
app.include_router(play.router)
app.include_router(enjoy.router)
app.include_router(search.router)

# Mount static files folder for frontend SPA dashboard
frontend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend")
if os.path.exists(frontend_dir):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")
else:
    # Handle folder missing gracefully
    pass
