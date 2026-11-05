/* ----------------------------------------------------
   DigitalHub - Play Module Game & WebSocket Controller
   ---------------------------------------------------- */

const playModule = {
    canvas: null,
    ctx: null,
    gameLoopId: null,
    isPlaying: false,
    isMuted: false,
    
    // Web Audio Context for synthesizers
    audioCtx: null,
    
    // WebSocket
    socket: null,
    
    // Game Entities & State
    score: 0,
    player: {
        x: 300,
        y: 350,
        width: 30,
        height: 25,
        targetX: 300,
        targetY: 350,
        speed: 8,
        shields: 100
    },
    lasers: [],
    enemies: [],
    particles: [],
    gems: [],
    keys: {},
    stars: [],
    lastEnemyTime: 0,
    lastGemTime: 0,
    lastFireTime: 0,

    init() {
        this.canvas = document.getElementById("arcade-canvas");
        this.ctx = this.canvas.getContext("2d");
        
        // Listeners for keyboard controls
        window.removeEventListener("keydown", this.handleKeyDown);
        window.removeEventListener("keyup", this.handleKeyUp);
        window.addEventListener("keydown", this.handleKeyDown.bind(this));
        window.addEventListener("keyup", this.handleKeyUp.bind(this));
        
        // Listeners for mouse controls
        this.canvas.removeEventListener("mousemove", this.handleMouseMove);
        this.canvas.addEventListener("mousemove", this.handleMouseMove.bind(this));
        
        this.canvas.removeEventListener("mousedown", this.handleMouseDown);
        this.canvas.addEventListener("mousedown", this.handleMouseDown.bind(this));

        // Generate static starfields
        this.initStars();
        
        // Draw initial static state
        this.drawGameStatic();

        // Connect Leaderboard WebSockets
        this.connectLeaderboardSocket();
    },

    // 1. Starfield background
    initStars() {
        this.stars = [];
        for (let i = 0; i < 60; i++) {
            this.stars.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                size: Math.random() * 2,
                speed: 0.5 + Math.random() * 1.5
            });
        }
    },

    // 2. Browser Web Audio procedural effects
    initAudio() {
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.audioCtx.state === "suspended") {
            this.audioCtx.resume();
        }
    },

    playLaserSound() {
        if (this.isMuted) return;
        this.initAudio();
        try {
            const osc = this.audioCtx.createOscillator();
            const gainNode = this.audioCtx.createGain();
            
            osc.connect(gainNode);
            gainNode.connect(this.audioCtx.destination);
            
            osc.type = "sawtooth";
            osc.frequency.setValueAtTime(800, this.audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(150, this.audioCtx.currentTime + 0.12);
            
            gainNode.gain.setValueAtTime(0.15, this.audioCtx.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.12);
            
            osc.start();
            osc.stop(this.audioCtx.currentTime + 0.12);
        } catch (e) {}
    },

    playExplosionSound() {
        if (this.isMuted) return;
        this.initAudio();
        try {
            // Synthesizing explosion via low noise sweep
            const osc = this.audioCtx.createOscillator();
            const filter = this.audioCtx.createBiquadFilter();
            const gain = this.audioCtx.createGain();
            
            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.audioCtx.destination);
            
            osc.type = "triangle";
            osc.frequency.setValueAtTime(180, this.audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(30, this.audioCtx.currentTime + 0.3);
            
            filter.type = "lowpass";
            filter.frequency.setValueAtTime(400, this.audioCtx.currentTime);
            
            gain.gain.setValueAtTime(0.3, this.audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.35);
            
            osc.start();
            osc.stop(this.audioCtx.currentTime + 0.35);
        } catch (e) {}
    },

    playGemSound() {
        if (this.isMuted) return;
        this.initAudio();
        try {
            const now = this.audioCtx.currentTime;
            
            const osc1 = this.audioCtx.createOscillator();
            const osc2 = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            
            osc1.connect(gain);
            osc2.connect(gain);
            gain.connect(this.audioCtx.destination);
            
            osc1.type = "sine";
            osc1.frequency.setValueAtTime(523.25, now); // C5
            osc1.frequency.setValueAtTime(659.25, now + 0.08); // E5
            
            osc2.type = "sine";
            osc2.frequency.setValueAtTime(783.99, now); // G5
            osc2.frequency.setValueAtTime(1046.50, now + 0.08); // C6
            
            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
            
            osc1.start();
            osc2.start();
            osc1.stop(now + 0.25);
            osc2.stop(now + 0.25);
        } catch (e) {}
    },

    toggleMute() {
        this.isMuted = !this.isMuted;
        const btn = document.getElementById("game-mute-btn");
        if (this.isMuted) {
            btn.innerHTML = `<i class="fa-solid fa-volume-xmark"></i>`;
            btn.style.color = "var(--color-red)";
        } else {
            btn.innerHTML = `<i class="fa-solid fa-volume-high"></i>`;
            btn.style.color = "var(--text-primary)";
        }
    },

    // 3. User Controls Event handlers
    handleKeyDown(e) {
        this.keys[e.code] = true;
        if (e.code === "Space" && this.isPlaying) {
            e.preventDefault(); // Stop page scrolling
            this.fireLaser();
        }
    },

    handleKeyUp(e) {
        this.keys[e.code] = false;
    },

    handleMouseMove(e) {
        if (!this.isPlaying) return;
        const rect = this.canvas.getBoundingClientRect();
        // Translate mouse coords inside canvas bounds
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        this.player.targetX = (e.clientX - rect.left) * scaleX;
        this.player.targetY = (e.clientY - rect.top) * scaleY;
    },

    handleMouseDown(e) {
        if (this.isPlaying) {
            this.fireLaser();
        }
    },

    // 4. Core Game Engine Flow
    startGame() {
        this.initAudio();
        
        // Hide overlays
        document.getElementById("canvas-start-overlay").classList.add("hidden");
        document.getElementById("canvas-gameover-overlay").classList.add("hidden");
        
        // Reset states
        this.isPlaying = true;
        this.score = 0;
        this.player.shields = 100;
        this.player.x = 300;
        this.player.y = 350;
        this.player.targetX = 300;
        this.player.targetY = 350;
        
        this.lasers = [];
        this.enemies = [];
        this.particles = [];
        this.gems = [];
        this.lastEnemyTime = Date.now();
        this.lastGemTime = Date.now();
        this.lastFireTime = 0;

        document.getElementById("game-live-score").innerText = "0";
        this.updateShieldsDisplay();

        // Cancel previous loop
        if (this.gameLoopId) cancelAnimationFrame(this.gameLoopId);
        
        // Start game loop
        this.gameLoop();
    },

    gameOver() {
        this.isPlaying = false;
        if (this.gameLoopId) cancelAnimationFrame(this.gameLoopId);

        document.getElementById("canvas-gameover-overlay").classList.remove("hidden");
        document.getElementById("canvas-final-score").innerText = this.score;

        const authPrompt = document.getElementById("score-auth-prompt-play");
        if (api.isAuthenticated()) {
            authPrompt.innerText = "Saving score and updating leaderboard...";
            this.submitHighScore();
        } else {
            authPrompt.innerText = "Create an account to submit your high score and earn HubPoints!";
        }
    },

    async submitHighScore() {
        try {
            await api.post("/play/submit-score", {
                game_name: "Neo-Vortex",
                score: this.score
            });
            app.showToast("Score submitted successfully! HubPoints synced.", "success");
            document.getElementById("score-auth-prompt-play").innerText = "High score recorded! Play again to set a new record.";
            // Refreshes sidebar points
            app.checkAuth();
        } catch (e) {
            app.showToast("Failed to submit score: " + e.message, "error");
            document.getElementById("score-auth-prompt-play").innerText = "High score submission failed.";
        }
    },

    fireLaser() {
        const now = Date.now();
        if (now - this.lastFireTime > 200) { // Cooldown limit 200ms
            this.lasers.push({
                x: this.player.x,
                y: this.player.y - 12,
                speed: 10,
                radius: 3
            });
            this.playLaserSound();
            this.lastFireTime = now;
        }
    },

    createParticles(x, y, color, count = 10) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1 + Math.random() * 4;
            this.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                radius: 1 + Math.random() * 2,
                alpha: 1.0,
                decay: 0.02 + Math.random() * 0.03,
                color: color
            });
        }
    },

    // 5. Physics updates & Collision checking
    gameLoop() {
        if (!this.isPlaying) return;

        this.updatePhysics();
        this.checkCollisions();
        this.renderCanvas();

        this.gameLoopId = requestAnimationFrame(() => this.gameLoop());
    },

    updatePhysics() {
        // Update Star Background scrolling
        this.stars.forEach(star => {
            star.y += star.speed;
            if (star.y > this.canvas.height) {
                star.y = 0;
                star.x = Math.random() * this.canvas.width;
            }
        });

        // Update player ship coords (mouse smoothing or key controls)
        if (this.keys["ArrowLeft"] || this.keys["KeyA"]) {
            this.player.x -= this.player.speed;
        } else if (this.keys["ArrowRight"] || this.keys["KeyD"]) {
            this.player.x += this.player.speed;
        } else {
            // Smooth mouse follow interpolation
            this.player.x += (this.player.targetX - this.player.x) * 0.25;
        }

        if (this.keys["ArrowUp"] || this.keys["KeyW"]) {
            this.player.y -= this.player.speed;
        } else if (this.keys["ArrowDown"] || this.keys["KeyS"]) {
            this.player.y += this.player.speed;
        } else {
            this.player.y += (this.player.targetY - this.player.y) * 0.25;
        }

        // Clamp player coordinates inside canvas
        this.player.x = Math.max(15, Math.min(this.canvas.width - 15, this.player.x));
        this.player.y = Math.max(15, Math.min(this.canvas.height - 15, this.player.y));

        // Update Lasers movement
        this.lasers.forEach((laser, idx) => {
            laser.y -= laser.speed;
            if (laser.y < 0) this.lasers.splice(idx, 1);
        });

        // Spawn Enemy Vortex Nodes periodically
        const now = Date.now();
        const spawnDelay = Math.max(600, 1500 - this.score * 1.5); // Spawns faster as score increases
        if (now - this.lastEnemyTime > spawnDelay) {
            this.enemies.push({
                x: 20 + Math.random() * (this.canvas.width - 40),
                y: -20,
                speed: 1.5 + Math.random() * 3 + (this.score / 300),
                radius: 12 + Math.random() * 10,
                color: Math.random() > 0.5 ? "#f43f5e" : "#ec4899"
            });
            this.lastEnemyTime = now;
        }

        // Spawn Energy Gems
        if (now - this.lastGemTime > 6000) {
            this.gems.push({
                x: 30 + Math.random() * (this.canvas.width - 60),
                y: -15,
                speed: 2.0,
                radius: 8,
                color: "#10b981"
            });
            this.lastGemTime = now;
        }

        // Move Enemies
        this.enemies.forEach((enemy, idx) => {
            enemy.y += enemy.speed;
            if (enemy.y > this.canvas.height + 20) {
                this.enemies.splice(idx, 1);
                // Deduct shields for letting node slip
                this.adjustShields(-10);
            }
        });

        // Move Gems
        this.gems.forEach((gem, idx) => {
            gem.y += gem.speed;
            if (gem.y > this.canvas.height + 20) {
                this.gems.splice(idx, 1);
            }
        });

        // Update Particles fading
        this.particles.forEach((p, idx) => {
            p.x += p.vx;
            p.y += p.vy;
            p.alpha -= p.decay;
            if (p.alpha <= 0) this.particles.splice(idx, 1);
        });
    },

    checkCollisions() {
        // Laser hits enemies
        for (let lIdx = this.lasers.length - 1; lIdx >= 0; lIdx--) {
            const laser = this.lasers[lIdx];
            for (let eIdx = this.enemies.length - 1; eIdx >= 0; eIdx--) {
                const enemy = this.enemies[eIdx];
                const dist = Math.hypot(laser.x - enemy.x, laser.y - enemy.y);
                
                if (dist < enemy.radius + laser.radius) {
                    // Explode node
                    this.createParticles(enemy.x, enemy.y, enemy.color, 12);
                    this.playExplosionSound();
                    
                    // Increment score
                    const scoreWorth = Math.round(30 - enemy.radius);
                    this.score += scoreWorth;
                    document.getElementById("game-live-score").innerText = this.score;

                    // Remove laser and enemy
                    this.lasers.splice(lIdx, 1);
                    this.enemies.splice(eIdx, 1);
                    break;
                }
            }
        }

        // Enemy collisions with player ship
        for (let eIdx = this.enemies.length - 1; eIdx >= 0; eIdx--) {
            const enemy = this.enemies[eIdx];
            const dist = Math.hypot(this.player.x - enemy.x, this.player.y - enemy.y);
            
            if (dist < enemy.radius + 15) {
                // Damaged!
                this.createParticles(enemy.x, enemy.y, enemy.color, 8);
                this.playExplosionSound();
                this.adjustShields(-Math.round(enemy.radius));
                
                this.enemies.splice(eIdx, 1);
            }
        }

        // Gem collections
        for (let gIdx = this.gems.length - 1; gIdx >= 0; gIdx--) {
            const gem = this.gems[gIdx];
            const dist = Math.hypot(this.player.x - gem.x, this.player.y - gem.y);
            
            if (dist < gem.radius + 15) {
                // Collected gem
                this.createParticles(gem.x, gem.y, gem.color, 15);
                this.playGemSound();
                
                // Add shields + score
                this.adjustShields(25);
                this.score += 50;
                document.getElementById("game-live-score").innerText = this.score;

                this.gems.splice(gIdx, 1);
            }
        }
    },

    adjustShields(amount) {
        this.player.shields = Math.max(0, Math.min(100, this.player.shields + amount));
        this.updateShieldsDisplay();
        
        if (this.player.shields <= 0) {
            this.gameOver();
        }
    },

    updateShieldsDisplay() {
        const text = document.getElementById("game-live-shields");
        text.innerText = `${this.player.shields}%`;
        if (this.player.shields > 50) {
            text.className = "shield-indicator";
            text.style.color = "var(--color-green)";
        } else if (this.player.shields > 25) {
            text.className = "shield-indicator";
            text.style.color = "var(--color-yellow)";
        } else {
            text.className = "shield-indicator";
            text.style.color = "var(--color-red)";
        }
    },

    // 6. Draw frames
    renderCanvas() {
        // Clear screen with alpha trace to make trailing light streaks
        this.ctx.fillStyle = "rgba(4, 5, 8, 0.3)";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw Starfield Background
        this.ctx.fillStyle = "#ffffff";
        this.stars.forEach(star => {
            this.ctx.globalAlpha = star.speed / 2.0;
            this.ctx.fillRect(star.x, star.y, star.size, star.size);
        });
        this.ctx.globalAlpha = 1.0;

        // Draw Player Ship (neon cyan triangle)
        this.ctx.save();
        this.ctx.translate(this.player.x, this.player.y);
        
        this.ctx.strokeStyle = "#0ea5e9";
        this.ctx.lineWidth = 2.5;
        this.ctx.shadowBlur = 10;
        this.ctx.shadowColor = "#0ea5e9";
        
        this.ctx.beginPath();
        this.ctx.moveTo(0, -12);
        this.ctx.lineTo(-12, 10);
        this.ctx.lineTo(12, 10);
        this.ctx.closePath();
        this.ctx.stroke();

        // Mini thruster flame
        this.ctx.strokeStyle = "#f59e0b";
        this.ctx.shadowColor = "#f59e0b";
        this.ctx.beginPath();
        this.ctx.moveTo(-4, 12);
        this.ctx.lineTo(0, 12 + Math.random() * 8);
        this.ctx.lineTo(4, 12);
        this.ctx.stroke();
        
        this.ctx.restore();

        // Draw Lasers (cyan particles)
        this.lasers.forEach(laser => {
            this.ctx.fillStyle = "#38bdf8";
            this.ctx.shadowBlur = 8;
            this.ctx.shadowColor = "#0ea5e9";
            this.ctx.beginPath();
            this.ctx.arc(laser.x, laser.y, laser.radius, 0, Math.PI * 2);
            this.ctx.fill();
        });

        // Draw Vortex Node Enemies (glowing hot pink rings)
        this.enemies.forEach(enemy => {
            this.ctx.strokeStyle = enemy.color;
            this.ctx.lineWidth = 2;
            this.ctx.shadowBlur = 10;
            this.ctx.shadowColor = enemy.color;
            this.ctx.beginPath();
            this.ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
            this.ctx.stroke();
            
            // Draw central nucleus dot
            this.ctx.fillStyle = "#ffffff";
            this.ctx.beginPath();
            this.ctx.arc(enemy.x, enemy.y, 4, 0, Math.PI * 2);
            this.ctx.fill();
        });

        // Draw Energy Gems (spinning green diamonds)
        this.gems.forEach(gem => {
            this.ctx.save();
            this.ctx.translate(gem.x, gem.y);
            
            const rotation = (Date.now() / 200) % (Math.PI * 2);
            this.ctx.rotate(rotation);
            
            this.ctx.fillStyle = "#10b981";
            this.ctx.shadowBlur = 12;
            this.ctx.shadowColor = "#10b981";
            
            this.ctx.beginPath();
            this.ctx.moveTo(0, -gem.radius);
            this.ctx.lineTo(gem.radius, 0);
            this.ctx.lineTo(0, gem.radius);
            this.ctx.lineTo(-gem.radius, 0);
            this.ctx.closePath();
            this.ctx.fill();
            
            this.ctx.restore();
        });

        // Draw Explosion Fading Particles
        this.particles.forEach(p => {
            this.ctx.fillStyle = p.color;
            this.ctx.globalAlpha = p.alpha;
            this.ctx.shadowBlur = 0;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            this.ctx.fill();
        });
        
        // Reset defaults
        this.ctx.globalAlpha = 1.0;
        this.ctx.shadowBlur = 0;
    },

    drawGameStatic() {
        this.ctx.fillStyle = "#040508";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw static scrolling star field background
        this.ctx.fillStyle = "#ffffff";
        this.stars.forEach(star => {
            this.ctx.globalAlpha = star.speed / 3.0;
            this.ctx.fillRect(star.x, star.y, star.size, star.size);
        });
        this.ctx.globalAlpha = 1.0;
    },

    // 7. WebSockets Leaderboard Connection
    connectLeaderboardSocket() {
        if (this.socket) {
            this.socket.close();
        }

        const wsPath = "/play/leaderboard/ws";
        this.socket = api.getWebSocket(wsPath);

        const indicator = document.getElementById("leaderboard-ws-status");

        this.socket.onopen = () => {
            indicator.className = "badge badge-yellow-glow";
            indicator.innerHTML = `<span class="ws-indicator online"></span> WebSocket Connected`;
        };

        this.socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === "welcome" || data.type === "leaderboard_update") {
                    this.renderLeaderboard(data.leaderboard);
                }
                
                // Show notification when a different player scores
                if (data.type === "leaderboard_update" && data.new_score) {
                    if (app.user && data.new_score.email !== app.user.email) {
                        app.showToast(`Active Player ${data.new_score.email} posted a score of ${data.new_score.score}!`, "info");
                    }
                }
            } catch (e) {
                console.error("Failed to parse leaderboard ws message", e);
            }
        };

        this.socket.onclose = () => {
            indicator.className = "badge badge-purple-glow";
            indicator.innerHTML = `<span class="ws-indicator offline"></span> WebSocket Offline`;
            
            // Auto reconnect after 5s if still looking at page
            setTimeout(() => {
                if (window.location.hash === "#play") {
                    this.connectLeaderboardSocket();
                }
            }, 5000);
        };
        
        this.socket.onerror = () => {
            this.socket.close();
        };
    },

    renderLeaderboard(leaderboard) {
        const body = document.getElementById("leaderboard-body");
        body.innerHTML = "";
        
        if (!leaderboard || leaderboard.length === 0) {
            body.innerHTML = `<tr><td colspan="4" class="text-center text-secondary py-4">No scores posted yet</td></tr>`;
            return;
        }

        leaderboard.forEach(entry => {
            const tr = document.createElement("tr");
            
            let rankBadge = entry.rank;
            if (entry.rank === 1) rankBadge = `<i class="fa-solid fa-crown text-glow-yellow"></i>`;
            else if (entry.rank === 2) rankBadge = `<span style="color:#cbd5e1">2</span>`;
            else if (entry.rank === 3) rankBadge = `<span style="color:#b45309">3</span>`;
            
            tr.innerHTML = `
                <td><strong>${rankBadge}</strong></td>
                <td>${entry.email}</td>
                <td class="text-right"><strong>${entry.score}</strong></td>
                <td class="text-right text-muted">${entry.created_at}</td>
            `;
            body.appendChild(tr);
        });
    }
};

// Reconnect socket if user signs in
document.addEventListener("user-authenticated", () => {
    if (window.location.hash === "#play") {
        playModule.connectLeaderboardSocket();
    }
});
