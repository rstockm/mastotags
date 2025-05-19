// Security functions for Mastotags

// Rate Limiting
const rateLimiter = {
    requests: new Map(),
    maxRequests: 10,
    timeWindow: 60000, // 1 minute
    
    isAllowed: function(ip) {
        const now = Date.now();
        const userRequests = this.requests.get(ip) || [];
        
        // Remove old requests
        const recentRequests = userRequests.filter(time => now - time < this.timeWindow);
        
        if (recentRequests.length >= this.maxRequests) {
            return false;
        }
        
        recentRequests.push(now);
        this.requests.set(ip, recentRequests);
        return true;
    }
};

// Input Sanitization
function sanitizeInput(input) {
    if (typeof input !== 'string') return '';
    return input.replace(/[&<>"']/g, function(match) {
        const entities = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        };
        return entities[match];
    });
}

// Hashtag Validation
function validateHashtag(hashtag) {
    if (typeof hashtag !== 'string') return false;
    const hashtagRegex = /^[a-zA-Z0-9_]+$/;
    return hashtagRegex.test(hashtag.replace(/^#/, ''));
}

// Secure API Calls
async function secureApiCall(url, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
            headers: {
                ...options.headers,
                'X-Requested-With': 'XMLHttpRequest'
            }
        });
        clearTimeout(timeout);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return response;
    } catch (error) {
        clearTimeout(timeout);
        throw new Error('API request failed: ' + error.message);
    }
}

// CSRF Token Management
const csrfToken = {
    generate: function() {
        return crypto.getRandomValues(new Uint8Array(32))
            .reduce((acc, val) => acc + val.toString(16).padStart(2, '0'), '');
    },
    
    validate: function(token) {
        const storedToken = localStorage.getItem('csrfToken');
        return token === storedToken;
    },
    
    set: function() {
        const token = this.generate();
        localStorage.setItem('csrfToken', token);
        return token;
    }
};

// Content Security Policy
const csp = {
    getHeaders: function() {
        return {
            'Content-Security-Policy': "default-src 'self'; " +
                "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
                "style-src 'self' 'unsafe-inline'; " +
                "img-src 'self' data: https:; " +
                "connect-src 'self' https://mastodon.social; " +
                "frame-ancestors 'none'; " +
                "form-action 'self';"
        };
    }
};

// Export all security functions
export {
    rateLimiter,
    sanitizeInput,
    validateHashtag,
    secureApiCall,
    csrfToken,
    csp
}; 