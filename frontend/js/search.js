/* ----------------------------------------------------
   DigitalHub - Search & Exploration Module logic
   ---------------------------------------------------- */

const searchModule = {
    init() {
        // If logged in, fetch AI recommendations feed
        this.loadRecommendations();
        
        // Listeners for Enter key in Search bar
        const searchInput = document.getElementById("global-search-input");
        searchInput.removeEventListener("keypress", this.handleSearchKeyPress);
        searchInput.addEventListener("keypress", this.handleSearchKeyPress.bind(this));
    },

    handleSearchKeyPress(event) {
        if (event.key === "Enter") {
            this.handleSearch();
        }
    },

    // 1. Centralized Global Search
    async handleSearch() {
        const query = document.getElementById("global-search-input").value.trim();
        
        try {
            const listGrid = document.getElementById("recommendations-grid");
            const header = document.querySelector(".explore-col-main .section-header h2");
            const authPrompt = document.getElementById("explore-auth-prompt");
            
            // Override headings for search results view
            header.innerHTML = `<i class="fa-solid fa-magnifying-glass"></i> Search Results: "${query || 'All'}"`;
            
            // Show list grid and hide static auth prompts during active search
            if (authPrompt) authPrompt.classList.add("hidden");
            listGrid.classList.remove("hidden");
            
            listGrid.innerHTML = `
                <div class="py-4 text-center text-secondary col-span-2">
                    <i class="fa-solid fa-spinner fa-spin"></i> Searching database...
                </div>
            `;

            const results = await api.get(`/search?q=${encodeURIComponent(query)}`);
            listGrid.innerHTML = "";

            if (results.length === 0) {
                listGrid.innerHTML = `<p class="text-secondary py-4 col-span-2">No matching courses, games, or widgets found.</p>`;
                return;
            }

            results.forEach(item => {
                const card = document.createElement("div");
                card.className = "glass-card reco-card";
                
                let iconClass = "fa-graduation-cap";
                if (item.type === "game") iconClass = "fa-gamepad";
                else if (item.type === "widget") iconClass = "fa-stopwatch";
                else if (item.type === "article") iconClass = "fa-newspaper";
                
                const isExternal = item.url.startsWith("http");
                const onclickAction = isExternal 
                    ? `window.open('${item.url}', '_blank')` 
                    : `app.navigate('${item.url}')`;

                card.innerHTML = `
                    <div class="reco-header">
                        <span class="reco-type-tag tag-${item.type}">
                            <i class="fa-solid ${iconClass}"></i> ${item.type}
                        </span>
                        <span class="badge badge-purple-glow">${item.category}</span>
                    </div>
                    <div class="reco-body mt-2 flex-grow-1">
                        <h3 class="mb-1">${item.title}</h3>
                        <p class="text-secondary small">${item.description}</p>
                    </div>
                    <div class="mt-4 text-right">
                        <button class="btn btn-primary" onclick="${onclickAction}">
                            ${item.type === "article" ? 'Read Article <i class="fa-solid fa-arrow-up-right-from-square"></i>' : 'Launch Item'}
                        </button>
                    </div>
                `;
                listGrid.appendChild(card);
            });
        } catch (err) {
            app.showToast("Search failed: " + err.message, "error");
        }
    },

    // 2. Cosine Similarity Recommendations Feed loader
    async loadRecommendations() {
        const recoGrid = document.getElementById("recommendations-grid");
        const header = document.querySelector(".explore-col-main .section-header h2");
        const authPrompt = document.getElementById("explore-auth-prompt");
        
        // Reset Search Input Value
        document.getElementById("global-search-input").value = "";

        if (!api.isAuthenticated()) {
            if (authPrompt) authPrompt.classList.remove("hidden");
            recoGrid.classList.add("hidden");
            return;
        }

        header.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles text-glow-purple"></i> Recommended For You`;
        if (authPrompt) authPrompt.classList.add("hidden");
        recoGrid.classList.remove("hidden");

        recoGrid.innerHTML = `
            <div class="py-4 text-center text-secondary col-span-2">
                <i class="fa-solid fa-spinner fa-spin"></i> Scoring candidate assets...
            </div>
        `;

        try {
            const recommendations = await api.get("/search/recommendations");
            recoGrid.innerHTML = "";

            if (recommendations.length === 0) {
                recoGrid.innerHTML = `<p class="text-secondary py-4 col-span-2">No recommended assets available.</p>`;
                return;
            }

            recommendations.forEach(item => {
                const card = document.createElement("div");
                card.className = "glass-card reco-card";
                
                let iconClass = "fa-graduation-cap";
                if (item.type === "game") iconClass = "fa-gamepad";
                else if (item.type === "widget") iconClass = "fa-stopwatch";
                else if (item.type === "article") iconClass = "fa-newspaper";
                
                const isExternal = item.url.startsWith("http");
                const onclickAction = isExternal 
                    ? `window.open('${item.url}', '_blank')` 
                    : `app.navigate('${item.url}')`;

                // Calculate a percentage match for display from cosine similarity score
                const matchPct = Math.round(item.similarity * 100);
                const scoreDisplay = matchPct > 0 
                    ? `<span class="reco-score"><i class="fa-solid fa-bolt"></i> ${matchPct}% Match</span>` 
                    : `<span class="reco-score text-muted">New Content</span>`;

                card.innerHTML = `
                    <div class="reco-header">
                        <span class="reco-type-tag tag-${item.type}">
                            <i class="fa-solid ${iconClass}"></i> ${item.type}
                        </span>
                        ${scoreDisplay}
                    </div>
                    <div class="reco-body mt-2">
                        <h3 class="mb-1">${item.title}</h3>
                        <p class="text-secondary small">${item.description}</p>
                        <div class="reco-tags-row">
                            ${item.tags.map(tag => `<span class="reco-tag-item">#${tag}</span>`).join("")}
                        </div>
                    </div>
                    <div class="mt-4 text-right">
                        <button class="btn btn-primary" onclick="${onclickAction}">
                            ${item.type === "article" ? 'Read Article' : 'Launch Item'}
                        </button>
                    </div>
                `;
                recoGrid.appendChild(card);
            });
        } catch (err) {
            recoGrid.innerHTML = `<p class="text-secondary py-2 col-span-2">Recommendations failed to load.</p>`;
            console.error("Recommendations error", err);
        }
    }
};
