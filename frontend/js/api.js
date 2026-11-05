/* ----------------------------------------------------
   DigitalHub - Central API Client Manager
   ---------------------------------------------------- */

const API_BASE = `${window.location.origin}/api`;

const api = {
    // Session token operations
    getToken() {
        return localStorage.getItem("dh_token");
    },
    
    setToken(token) {
        localStorage.setItem("dh_token", token);
    },
    
    clearToken() {
        localStorage.removeItem("dh_token");
    },
    
    isAuthenticated() {
        return !!this.getToken();
    },

    // HTTP methods wrapping fetch
    async request(path, options = {}) {
        const url = `${API_BASE}${path}`;
        
        // Prepare headers
        const headers = {
            ...options.headers
        };
        
        if (!(options.body instanceof FormData)) {
            headers["Content-Type"] = "application/json";
        }
        
        // Append JWT Bearer authorization if logged in
        const token = this.getToken();
        if (token) {
            headers["Authorization"] = `Bearer ${token}`;
        }
        
        const response = await fetch(url, {
            ...options,
            headers
        });
        
        if (!response.ok) {
            // Handle unauthorized globally
            if (response.status === 418) {
                // Ignore test or custom error
            }
            if (response.status === 401) {
                // Silent logout on credentials invalidation
                this.clearToken();
                document.dispatchEvent(new CustomEvent("auth-expired"));
            }
            const errBody = await response.json().catch(() => ({}));
            throw new Error(errBody.detail || `API request failed with code: ${response.status}`);
        }
        
        return response.json();
    },
    
    get(path) {
        return this.request(path, { method: "GET" });
    },
    
    post(path, body) {
        const options = {
            method: "POST"
        };
        if (body !== undefined) {
            options.body = JSON.stringify(body);
        }
        return this.request(path, options);
    },

    // WebSockets connection helper
    getWebSocket(path) {
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${protocol}//${window.location.host}/api${path}`;
        const token = this.getToken();
        
        // Pass token as query parameter for authentication
        const urlWithAuth = token ? `${wsUrl}?token=${token}` : wsUrl;
        return new WebSocket(urlWithAuth);
    }
};
