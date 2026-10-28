// Admin Authentication
const ADMIN_AUTH_API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:5050/api'
    : 'https://api.powerflowservicesltd.com/api';

class AdminAuth {
    constructor() {
        this.init();
    }

    init() {
        this.bindEvents();
        this.checkAuth();
    }

    bindEvents() {
        // Login form
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }

        // Password toggle
        const togglePassword = document.getElementById('togglePassword');
        if (togglePassword) {
            togglePassword.addEventListener('click', () => this.togglePasswordVisibility());
        }

        // Logout
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.logout());
        }
    }

    async handleLogin(e) {
        e.preventDefault();

        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const submitBtn = e.target.querySelector('button[type="submit"]');

        // Show loading state
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Logging in...';
        submitBtn.disabled = true;

        try {
            const response = await fetch(`${ADMIN_AUTH_API_BASE}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const payload = await response.json().catch(() => null);
            if (!response.ok || !payload?.success) {
                throw new Error(
                    payload?.error?.message
                    || payload?.message
                    || 'Invalid email or password.'
                );
            }

            if (payload?.data?.user?.role !== 'admin') {
                throw new Error('This account does not have admin access.');
            }

            localStorage.setItem('adminToken', payload.data.token);
            localStorage.setItem('adminUser', JSON.stringify(payload.data.user));

            window.location.href = 'dashboard.html';
        } catch (error) {
            this.showError(error.message || 'Invalid credentials. Please try again.');
        } finally {
            // Reset button
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    }

    togglePasswordVisibility() {
        const passwordInput = document.getElementById('password');
        const toggleBtn = document.getElementById('togglePassword');
        const icon = toggleBtn.querySelector('i');

        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            icon.className = 'fas fa-eye-slash';
        } else {
            passwordInput.type = 'password';
            icon.className = 'fas fa-eye';
        }
    }

    async checkAuth() {
        const token = localStorage.getItem('adminToken');
        const hasRealToken = Boolean(token && !String(token).startsWith('demo-token-'));
        const currentPath = window.location.pathname;
        const onLoginPage = currentPath === '/'
            || currentPath === '/admin'
            || currentPath.endsWith('/admin/')
            || currentPath.endsWith('/index.html');

        // If on login page and already authenticated, redirect to dashboard
        if (onLoginPage) {
            if (hasRealToken) {
                window.location.href = 'dashboard.html';
            }
            return;
        }

        // If on a protected page without a real token, redirect to login
        if (!hasRealToken) {
            this.clearSession();
            window.location.href = 'index.html';
            return;
        }

        // Verify the token with the backend; expired/invalid sessions must not
        // stay logged in just because localStorage has a value.
        try {
            const response = await fetch(`${ADMIN_AUTH_API_BASE}/auth/me`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (!response.ok) {
                throw new Error('Session expired');
            }
        } catch (_) {
            this.clearSession();
            window.location.href = 'index.html';
        }
    }

    clearSession() {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminUser');
    }

    logout() {
        const token = localStorage.getItem('adminToken');

        if (token && !String(token).startsWith('demo-token-')) {
            fetch(`${ADMIN_AUTH_API_BASE}/auth/logout`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                keepalive: true,
            }).catch(() => {});
        }

        this.clearSession();
        window.location.href = 'index.html';
    }

    showError(message) {
        // Remove existing alerts
        const existingAlert = document.querySelector('.alert');
        if (existingAlert) {
            existingAlert.remove();
        }

        // Create new alert
        const alert = document.createElement('div');
        alert.className = 'alert alert-danger alert-dismissible fade show';
        alert.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;

        // Insert before form
        const form = document.getElementById('loginForm');
        form.parentNode.insertBefore(alert, form);
    }

    getCurrentUser() {
        const userStr = localStorage.getItem('adminUser');
        return userStr ? JSON.parse(userStr) : null;
    }

    isAuthenticated() {
        const token = localStorage.getItem('adminToken');
        return Boolean(token && !String(token).startsWith('demo-token-'));
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new AdminAuth();
});