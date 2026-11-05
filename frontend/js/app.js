/* ----------------------------------------------------
   DigitalHub - Global SPA Controller
   ---------------------------------------------------- */

document.addEventListener("DOMContentLoaded", () => {
    app.init();
});

const app = {
    user: null,

    init() {
        // Setup Routing
        window.addEventListener("hashchange", () => this.handleRouting());
        this.handleRouting();

        // Listen for token expiration
        document.addEventListener("auth-expired", () => {
            this.handleLogout(true);
        });

        // Initialize Authentication Status
        this.checkAuth();
    },

    // 1. Client Routing Engine (Hash Router)
    handleRouting() {
        const hash = window.location.hash || "#explore";
        const rootPath = hash.split("/")[0];

        // Highlight matching tab in nav
        document.querySelectorAll(".main-nav a").forEach(link => {
            if (link.getAttribute("href") === rootPath) {
                link.classList.add("active");
            } else {
                link.classList.remove("active");
            }
        });

        // Display current view section
        document.querySelectorAll(".dashboard-view").forEach(view => {
            if (view.id === `view-${rootPath.substring(1)}`) {
                view.classList.add("active");
            } else {
                view.classList.remove("active");
            }
        });

        // Broadcast navigate event for sub-module logic hooks
        if (rootPath === "#explore") {
            searchModule.init();
        } else if (rootPath === "#learn") {
            const courseId = hash.split("/")[1];
            learnModule.init(courseId);
        } else if (rootPath === "#play") {
            playModule.init();
        } else if (rootPath === "#enjoy") {
            enjoyModule.init();
        }
    },

    navigate(hash) {
        window.location.hash = hash;
    },

    // 2. Authentication State Management
    async checkAuth() {
        if (api.isAuthenticated()) {
            try {
                const profile = await api.get("/auth/profile");
                this.handleAuthSuccess(profile);
            } catch (err) {
                console.error("Session verification failed", err);
                this.handleLogout(false);
            }
        } else {
            this.handleLogout(false);
        }
    },

    handleAuthSuccess(userProfile) {
        this.user = userProfile;
        
        // Show auth layout headers
        document.getElementById("guest-controls").classList.add("hidden");
        const authControls = document.getElementById("auth-controls");
        authControls.classList.remove("hidden");

        // Set profile details
        document.getElementById("user-email-val").innerText = userProfile.email;
        this.updateHubPointsDisplay(userProfile.total_hubpoints);

        // Load user badges
        const badgesContainer = document.getElementById("user-badges-container");
        badgesContainer.innerHTML = "";
        userProfile.badges.forEach(badge => {
            const badgeSpan = document.createElement("span");
            badgeSpan.className = "user-badge-tag";
            badgeSpan.innerText = badge;
            badgesContainer.appendChild(badgeSpan);
        });

        // Hide auth prompts across sections
        const expPrompt = document.getElementById("explore-auth-prompt");
        if (expPrompt) expPrompt.classList.add("hidden");
        const habitsPrompt = document.getElementById("habits-auth-prompt");
        if (habitsPrompt) habitsPrompt.classList.add("hidden");

        // Dispatch status for modules to refresh their state
        document.dispatchEvent(new CustomEvent("user-authenticated", { detail: userProfile }));
        
        // Trigger explore recommendations build
        if (window.location.hash === "#explore" || !window.location.hash) {
            searchModule.loadRecommendations();
        }
    },

    handleLogout(isExpired = false) {
        api.clearToken();
        this.user = null;

        // Reset UI layouts
        document.getElementById("auth-controls").classList.add("hidden");
        document.getElementById("guest-controls").classList.remove("hidden");

        // Reset prompts
        const expPrompt = document.getElementById("explore-auth-prompt");
        if (expPrompt) expPrompt.classList.remove("hidden");
        const habitsPrompt = document.getElementById("habits-auth-prompt");
        if (habitsPrompt) habitsPrompt.classList.remove("hidden");
        
        // Hide explore grid recommendation
        const recoGrid = document.getElementById("recommendations-grid");
        if (recoGrid) recoGrid.classList.add("hidden");

        // Stop Synthesizer if active
        if (typeof enjoyModule !== "undefined") {
            enjoyModule.stopAudio();
        }

        document.dispatchEvent(new CustomEvent("user-logged-out"));

        if (isExpired) {
            this.showToast("Your session has expired. Please log in again.", "info");
        }
    },

    updateHubPointsDisplay(points) {
        const lbl = document.getElementById("user-points-val");
        if (lbl) {
            lbl.innerText = points;
        }
    },

    // 3. User Interface Modals Controls
    showAuthModal(tab = "login") {
        document.getElementById("auth-modal").classList.remove("hidden");
        this.toggleAuthTab(tab);
    },

    closeAuthModal() {
        document.getElementById("auth-modal").classList.add("hidden");
    },

    toggleAuthTab(tab) {
        const loginTab = document.getElementById("tab-login-btn");
        const regTab = document.getElementById("tab-register-btn");
        const loginForm = document.getElementById("login-form");
        const regForm = document.getElementById("register-form");

        if (tab === "login") {
            loginTab.classList.add("active");
            regTab.classList.remove("active");
            loginForm.classList.remove("hidden");
            regForm.classList.add("hidden");
        } else {
            loginTab.classList.remove("active");
            regTab.classList.add("active");
            loginForm.classList.add("hidden");
            regForm.classList.remove("hidden");
        }
    },

    async handleLoginSubmit(event) {
        event.preventDefault();
        const email = document.getElementById("login-email").value;
        const password = document.getElementById("login-password").value;

        try {
            const data = await api.post("/auth/login", { email, password });
            api.setToken(data.access_token);
            this.closeAuthModal();
            await this.checkAuth();
            this.showToast("Successfully logged in!", "success");
        } catch (err) {
            this.showToast(err.message, "error");
        }
    },

    async handleRegisterSubmit(event) {
        event.preventDefault();
        const email = document.getElementById("register-email").value;
        const password = document.getElementById("register-password").value;

        try {
            await api.post("/auth/register", { email, password });
            
            // Auto log in after register
            const data = await api.post("/auth/login", { email, password });
            api.setToken(data.access_token);
            this.closeAuthModal();
            await this.checkAuth();
            this.showToast("Account created successfully! Welcome Bonus awarded.", "success");
        } catch (err) {
            this.showToast(err.message, "error");
        }
    },

    // 4. Toast Notifications
    showToast(message, type = "info") {
        const container = document.getElementById("toast-container");
        const toast = document.createElement("div");
        toast.className = `toast-message toast-${type}`;
        
        let iconClass = "fa-circle-info";
        if (type === "success") iconClass = "fa-circle-check";
        if (type === "error") iconClass = "fa-triangle-exclamation";
        
        toast.innerHTML = `
            <i class="fa-solid ${iconClass}"></i>
            <div class="toast-body">${message}</div>
        `;
        
        container.appendChild(toast);
        
        // Remove toast after 4 seconds
        setTimeout(() => {
            toast.style.opacity = "0";
            toast.style.transform = "translateY(20px)";
            toast.style.transition = "all 0.3s ease";
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 4000);
    }
};
