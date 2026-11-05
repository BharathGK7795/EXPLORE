/* ----------------------------------------------------
   DigitalHub - Enjoy Module (Web Audio & Widgets)
   ---------------------------------------------------- */

const enjoyModule = {
    // Audio synthesis fields
    audioCtx: null,
    analyser: null,
    masterGain: null,
    activeNodes: [],
    mood: null,
    isAudioPlaying: false,
    visualizerId: null,
    
    // Pomodoro fields
    pomoTimeLeft: 25 * 60,
    pomoMaxTime: 25 * 60,
    pomoTimerId: null,
    pomoIsRunning: false,
    pomoState: "work", // "work" | "short" | "long"
    
    // Habits fields
    habits: [],

    init() {
        // Toggle elements based on auth
        this.updateAuthStates();
        
        // Render static visualizer
        this.drawVisualizerStatic();
        
        // Reset Pomodoro display
        this.updatePomodoroDisplay();
    },

    updateAuthStates() {
        const habitsPrompt = document.getElementById("habits-auth-prompt");
        const habitsContainer = document.getElementById("habits-view-container");
        const playPauseBtn = document.getElementById("enjoy-play-pause-btn");

        if (api.isAuthenticated()) {
            habitsPrompt.classList.add("hidden");
            habitsContainer.classList.remove("hidden");
            this.loadHabits();
        } else {
            habitsPrompt.classList.remove("hidden");
            habitsContainer.classList.add("hidden");
        }
        
        // Audio controls are always available, enable play button
        playPauseBtn.removeAttribute("disabled");
    },

    // 1. Procedural Web Audio Ambient Synthesizer
    initAudio() {
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioCtx.createAnalyser();
            this.analyser.fftSize = 256;
            
            this.masterGain = this.audioCtx.createGain();
            const volVal = document.getElementById("synth-volume").value;
            this.masterGain.gain.setValueAtTime(volVal / 100 * 0.5, this.audioCtx.currentTime);
            
            this.masterGain.connect(this.analyser);
            this.analyser.connect(this.audioCtx.destination);
        }
        if (this.audioCtx.state === "suspended") {
            this.audioCtx.resume();
        }
    },

    async setMood(selectedMood) {
        this.initAudio();
        
        // Highlight mood buttons
        document.querySelectorAll(".mood-btn").forEach(btn => {
            btn.classList.remove("active");
        });
        document.getElementById(`mood-btn-${selectedMood}`).classList.add("active");
        
        this.mood = selectedMood;
        document.getElementById("audio-status-txt").innerText = `${selectedMood.toUpperCase()} theme active`;

        // If currently playing, reboot synthesizer nodes for new mood
        if (this.isAudioPlaying) {
            this.stopSynthesizer();
            this.startSynthesizer();
        } else {
            // Auto start audio on theme selection
            this.toggleAudio();
        }

        // POST mood change to update recommendation search vectors
        if (api.isAuthenticated()) {
            try {
                await api.post(`/enjoy/mood?mood=${selectedMood}`);
                // Refresh exploration recommendation grid quietly
                searchModule.loadRecommendations();
            } catch (e) {}
        }
    },

    toggleAudio() {
        if (!this.mood) {
            app.showToast("Please select a mood to synthesize first.", "info");
            return;
        }

        this.initAudio();
        const btn = document.getElementById("enjoy-play-pause-btn");

        if (this.isAudioPlaying) {
            this.stopAudio();
        } else {
            this.isAudioPlaying = true;
            btn.innerHTML = `<i class="fa-solid fa-pause"></i>`;
            btn.classList.add("pulse-animation");
            
            this.startSynthesizer();
            this.startVisualizer();
        }
    },

    stopAudio() {
        const btn = document.getElementById("enjoy-play-pause-btn");
        if (!btn) return;
        
        this.isAudioPlaying = false;
        btn.innerHTML = `<i class="fa-solid fa-play"></i>`;
        btn.classList.remove("pulse-animation");
        
        this.stopSynthesizer();
        this.stopVisualizer();
    },

    startSynthesizer() {
        const ctx = this.audioCtx;
        const now = ctx.currentTime;

        if (this.mood === "focus") {
            // Focus: Binaural Beats (100Hz Left, 104Hz Right) + Soft Brownian Noise
            const merger = ctx.createChannelMerger(2);
            
            // Left Oscillator
            const oscL = ctx.createOscillator();
            oscL.frequency.setValueAtTime(100, now);
            const gainL = ctx.createGain();
            gainL.gain.setValueAtTime(0.3, now);
            oscL.connect(gainL);
            gainL.connect(merger, 0, 0); // Connect to Left output channel
            
            // Right Oscillator
            const oscR = ctx.createOscillator();
            oscR.frequency.setValueAtTime(104, now); // 4Hz difference
            const gainR = ctx.createGain();
            gainR.gain.setValueAtTime(0.3, now);
            oscR.connect(gainR);
            gainR.connect(merger, 0, 1); // Connect to Right output channel
            
            merger.connect(this.masterGain);

            oscL.start(now);
            oscR.start(now);
            this.activeNodes.push(oscL, oscR);

            // Generate Soft Brownian Noise
            const bufferSize = 2 * ctx.sampleRate;
            const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const output = noiseBuffer.getChannelData(0);
            
            let lastOut = 0.0;
            for (let i = 0; i < bufferSize; i++) {
                const white = Math.random() * 2 - 1;
                // Brown noise filter formula
                output[i] = (lastOut + (0.02 * white)) / 1.02;
                lastOut = output[i];
                output[i] *= 3.5; // Gain boost
            }
            
            const noiseSource = ctx.createBufferSource();
            noiseSource.buffer = noiseBuffer;
            noiseSource.loop = true;
            
            const lowpass = ctx.createBiquadFilter();
            lowpass.type = "lowpass";
            lowpass.frequency.setValueAtTime(180, now);
            
            const noiseGain = ctx.createGain();
            noiseGain.gain.setValueAtTime(0.2, now);
            
            noiseSource.connect(lowpass);
            lowpass.connect(noiseGain);
            noiseGain.connect(this.masterGain);
            
            noiseSource.start(now);
            this.activeNodes.push(noiseSource);

        } else if (this.mood === "relaxed") {
            // Relaxed: Procedural Hearth Crackle & Rain Waves
            
            // Rain wave simulator: Modulating bandpassed white noise
            const bufferSize = 2 * ctx.sampleRate;
            const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const output = noiseBuffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                output[i] = Math.random() * 2 - 1;
            }
            
            const rainSource = ctx.createBufferSource();
            rainSource.buffer = noiseBuffer;
            rainSource.loop = true;
            
            const bandpass = ctx.createBiquadFilter();
            bandpass.type = "bandpass";
            bandpass.frequency.setValueAtTime(600, now);
            bandpass.Q.setValueAtTime(1.0, now);
            
            const rainGain = ctx.createGain();
            rainGain.gain.setValueAtTime(0.12, now);
            
            // Slow volume modulation simulating wave gusts
            const modulator = ctx.createOscillator();
            modulator.frequency.setValueAtTime(0.15, now); // 0.15 Hz slow sweep
            const modGain = ctx.createGain();
            modGain.gain.setValueAtTime(0.04, now);
            
            modulator.connect(modGain);
            modGain.connect(rainGain.gain);
            
            rainSource.connect(bandpass);
            bandpass.connect(rainGain);
            rainGain.connect(this.masterGain);
            
            modulator.start(now);
            rainSource.start(now);
            this.activeNodes.push(modulator, rainSource);

            // Hearth Crackle Spark scheduling loop
            const crackleGain = ctx.createGain();
            crackleGain.gain.setValueAtTime(0.06, now);
            crackleGain.connect(this.masterGain);

            const scheduleSpark = () => {
                if (!this.isAudioPlaying || this.mood !== "relaxed") return;
                
                try {
                    // Short high-frequency burst
                    const clickOsc = ctx.createOscillator();
                    const clickGain = ctx.createGain();
                    
                    clickOsc.type = "sine";
                    clickOsc.frequency.setValueAtTime(1200 + Math.random() * 3000, ctx.currentTime);
                    
                    clickGain.gain.setValueAtTime(0.02 + Math.random() * 0.08, ctx.currentTime);
                    clickGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.01);
                    
                    clickOsc.connect(clickGain);
                    clickGain.connect(crackleGain);
                    
                    clickOsc.start();
                    clickOsc.stop(ctx.currentTime + 0.015);
                } catch (e) {}

                // Schedule next spark randomly
                const delay = 50 + Math.random() * 450;
                setTimeout(scheduleSpark, delay);
            };
            
            scheduleSpark();

        } else if (this.mood === "curious") {
            // Curious: Spacey Generative Minor Pentatonic Chimes with Delay Echo
            const delayNode = ctx.createDelay();
            delayNode.delayTime.setValueAtTime(0.4, now); // 400ms delay echo
            
            const feedback = ctx.createGain();
            feedback.gain.setValueAtTime(0.4, now);
            
            // Loop feedback path
            delayNode.connect(feedback);
            feedback.connect(delayNode);
            
            delayNode.connect(this.masterGain);

            const scale = [261.63, 293.66, 311.13, 392.00, 466.16, 523.25]; // C Minor Pentatonic
            
            const playNote = () => {
                if (!this.isAudioPlaying || this.mood !== "curious") return;
                
                try {
                    const osc = ctx.createOscillator();
                    const filter = ctx.createBiquadFilter();
                    const gain = ctx.createGain();
                    
                    osc.connect(filter);
                    filter.connect(gain);
                    gain.connect(this.masterGain);
                    gain.connect(delayNode); // Feed echo path
                    
                    osc.type = "triangle";
                    const note = scale[Math.floor(Math.random() * scale.length)];
                    osc.frequency.setValueAtTime(note, ctx.currentTime);
                    
                    filter.type = "lowpass";
                    filter.frequency.setValueAtTime(1200, ctx.currentTime);
                    
                    gain.gain.setValueAtTime(0.08, ctx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
                    
                    osc.start();
                    osc.stop(ctx.currentTime + 0.6);
                } catch (e) {}
                
                // Play random intervals
                const delay = 800 + Math.random() * 1500;
                setTimeout(playNote, delay);
            };

            playNote();
        }
    },

    stopSynthesizer() {
        this.activeNodes.forEach(node => {
            try {
                node.stop();
            } catch (e) {}
        });
        this.activeNodes = [];
    },

    setVolume(value) {
        if (this.masterGain && this.audioCtx) {
            // Normalized volume 0-0.5 max to keep it ambient
            this.masterGain.gain.setValueAtTime(value / 100 * 0.5, this.audioCtx.currentTime);
        }
    },

    // 2. Oscilloscope Canvas Visualizer
    startVisualizer() {
        const canvas = document.getElementById("synth-visualizer");
        const ctx = canvas.getContext("2d");
        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
            if (!this.isAudioPlaying) return;
            
            this.visualizerId = requestAnimationFrame(draw);
            this.analyser.getByteTimeDomainData(dataArray);

            ctx.fillStyle = "#040508";
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw glowing visualizer center line
            ctx.lineWidth = 2.0;
            ctx.strokeStyle = this.getMoodGlowColor();
            ctx.shadowBlur = 8;
            ctx.shadowColor = this.getMoodGlowColor();

            ctx.beginPath();
            const sliceWidth = canvas.width * 1.0 / bufferLength;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                const v = dataArray[i] / 128.0;
                const y = v * canvas.height / 2;

                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
                x += sliceWidth;
            }

            ctx.lineTo(canvas.width, canvas.height / 2);
            ctx.stroke();
            
            // Reset shadows
            ctx.shadowBlur = 0;
        };

        draw();
    },

    stopVisualizer() {
        if (this.visualizerId) {
            cancelAnimationFrame(this.visualizerId);
        }
        this.drawVisualizerStatic();
    },

    drawVisualizerStatic() {
        const canvas = document.getElementById("synth-visualizer");
        if (!canvas) return;
        
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#040508";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Static baseline center line
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
        ctx.beginPath();
        ctx.moveTo(0, canvas.height / 2);
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
    },

    getMoodGlowColor() {
        if (this.mood === "focus") return "#6366f1"; // Indigo
        if (this.mood === "relaxed") return "#0ea5e9"; // Blue
        if (this.mood === "curious") return "#8b5cf6"; // Violet
        return "#64748b";
    },

    // 3. Pomodoro Timer logic
    togglePomodoro() {
        const btn = document.getElementById("pomo-start-stop-btn");
        
        if (this.pomoIsRunning) {
            // Stop
            this.pomoIsRunning = false;
            clearInterval(this.pomoTimerId);
            btn.innerText = "Start";
            btn.className = "btn btn-primary";
        } else {
            // Start
            this.pomoIsRunning = true;
            btn.innerText = "Pause";
            btn.className = "btn btn-secondary";
            
            this.pomoTimerId = setInterval(() => {
                this.pomoTimeLeft--;
                this.updatePomodoroDisplay();
                
                if (this.pomoTimeLeft <= 0) {
                    this.playAlarmChime();
                    this.handlePomodoroCompletion();
                }
            }, 1000);
        }
    },

    resetPomodoro() {
        this.pomoIsRunning = false;
        clearInterval(this.pomoTimerId);
        
        const btn = document.getElementById("pomo-start-stop-btn");
        btn.innerText = "Start";
        btn.className = "btn btn-primary";
        
        this.pomoTimeLeft = this.pomoMaxTime;
        this.updatePomodoroDisplay();
    },

    setTimerConfig(minutes, type) {
        // Highlight active tab
        document.querySelectorAll(".timer-settings button").forEach(btn => {
            btn.classList.remove("active");
        });
        document.getElementById(`pomo-opt-${type}`).classList.add("active");

        this.pomoState = type;
        this.pomoMaxTime = minutes * 60;
        this.pomoTimeLeft = this.pomoMaxTime;
        
        // Update label state title
        const stateLbl = document.getElementById("pomo-state-lbl");
        if (type === "work") {
            stateLbl.innerText = "Work Session";
            document.getElementById("pomo-progress").style.stroke = "var(--color-red)";
        } else if (type === "short") {
            stateLbl.innerText = "Short Rest";
            document.getElementById("pomo-progress").style.stroke = "var(--color-green)";
        } else {
            stateLbl.innerText = "Long Break";
            document.getElementById("pomo-progress").style.stroke = "var(--color-blue)";
        }
        
        this.resetPomodoro();
    },

    updatePomodoroDisplay() {
        // Format time mm:ss
        const m = Math.floor(this.pomoTimeLeft / 60).toString().padStart(2, "0");
        const s = (this.pomoTimeLeft % 60).toString().padStart(2, "0");
        document.getElementById("pomo-time-lbl").innerText = `${m}:${s}`;
        
        // SVG circle progression stroke-dashoffset: 0 to 553 (circumference)
        const progress = (this.pomoMaxTime - this.pomoTimeLeft) / this.pomoMaxTime;
        const offset = 553 - (progress * 553);
        document.getElementById("pomo-progress").style.strokeDashoffset = offset;
    },

    handlePomodoroCompletion() {
        this.pomoIsRunning = false;
        clearInterval(this.pomoTimerId);
        
        const btn = document.getElementById("pomo-start-stop-btn");
        btn.innerText = "Start";
        btn.className = "btn btn-primary";

        if (this.pomoState === "work") {
            app.showToast("Pomodoro finished! Take a break. +10 HP", "success");
            
            // Award HubPoints for completing work session
            if (api.isAuthenticated()) {
                api.post("/enjoy/habits", { name: "Completed Pomodoro Session", frequency: "daily" })
                    .then(() => {
                        app.checkAuth();
                    }).catch(() => {});
            }
            this.setTimerConfig(5, "short");
        } else {
            app.showToast("Rest completed! Ready to lock back in?", "info");
            this.setTimerConfig(25, "work");
        }
    },

    playAlarmChime() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const now = ctx.currentTime;
            
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            osc.type = "sine";
            osc.frequency.setValueAtTime(587.33, now); // D5
            osc.frequency.exponentialRampToValueAtTime(880.00, now + 0.15); // A5
            
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
            
            osc.start();
            osc.stop(now + 0.5);
        } catch(e) {}
    },

    // 4. Streak Habit Board Manager
    async loadHabits() {
        try {
            const list = document.getElementById("habits-list");
            list.innerHTML = `<div class="text-secondary small py-2"><i class="fa-solid fa-spinner fa-spin"></i> Syncing habits...</div>`;
            
            this.habits = await api.get("/enjoy/habits");
            list.innerHTML = "";

            if (this.habits.length === 0) {
                list.innerHTML = `<p class="text-secondary small text-center py-4">Add your first custom habit above!</p>`;
                return;
            }

            // Render habits
            const todayStr = new Date().toISOString().split("T")[0];
            
            this.habits.forEach(habit => {
                const logs = habit.logs || [];
                const isChecked = logs.includes(todayStr);
                
                const item = document.createElement("div");
                item.className = "habit-item";
                
                item.innerHTML = `
                    <div class="habit-details">
                        <div class="habit-checkbox ${isChecked ? 'checked' : ''}" onclick="enjoyModule.toggleHabit(${habit.id})">
                            <i class="fa-solid fa-check"></i>
                        </div>
                        <span class="habit-name">${habit.name}</span>
                    </div>
                    ${habit.streak > 0 ? `<span class="habit-streak"><i class="fa-solid fa-fire"></i> ${habit.streak}d</span>` : ''}
                `;
                list.appendChild(item);
            });
        } catch (err) {
            app.showToast("Failed to fetch habits: " + err.message, "error");
        }
    },

    async createHabit() {
        const input = document.getElementById("new-habit-input");
        const name = input.value.trim();
        if (!name) return;

        try {
            await api.post("/enjoy/habits", { name });
            input.value = "";
            this.loadHabits();
            app.showToast("Habit added! +10 welcome points.", "success");
            app.checkAuth();
        } catch (err) {
            app.showToast(err.message, "error");
        }
    },

    async toggleHabit(habitId) {
        try {
            await api.post(`/enjoy/habits/${habitId}/toggle`);
            
            // Play a success tick sound
            this.playTickSound();
            
            // Refresh
            this.loadHabits();
            app.checkAuth();
        } catch (err) {
            app.showToast("Failed to toggle habit: " + err.message, "error");
        }
    },

    playTickSound() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const now = ctx.currentTime;
            
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            osc.type = "sine";
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.exponentialRampToValueAtTime(1000, now + 0.05);
            
            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
            
            osc.start();
            osc.stop(now + 0.08);
        } catch(e) {}
    }
};

// Check auth changes to reload habits calendar
document.addEventListener("user-authenticated", () => {
    enjoyModule.updateAuthStates();
});
document.addEventListener("user-logged-out", () => {
    enjoyModule.updateAuthStates();
});
