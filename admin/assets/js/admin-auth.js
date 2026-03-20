// Admin Authentication
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
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const submitBtn = e.target.querySelector('button[type="submit"]');
        
        // Show loading state
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Logging in...';
        submitBtn.disabled = true;

        try {
            // Simulate API call (replace with actual backend call)
            await this.simulateLogin(email, password);
            
            // Store auth token (in real app, use secure storage)
            localStorage.setItem('adminToken', 'demo-token-' + Date.now());
            localStorage.setItem('adminUser', JSON.stringify({
                email: email,
                name: 'Admin User',
                role: 'Administrator'
            }));

            // Redirect to dashboard
            window.location.href = 'dashboard.html';
            
        } catch (error) {
            this.showError('Invalid credentials. Please try again.');
        } finally {
            // Reset button
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    }

    async simulateLogin(email, password) {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Demo credentials (replace with actual authentication)
        const validCredentials = [
            { email: 'admin@powerflowservices.com', password: 'admin123' },
            { email: 'manager@powerflowservices.com', password: 'manager123' }
        ];

        const isValid = validCredentials.some(cred => 
            cred.email === email && cred.password === password
        );

        if (!isValid) {
            throw new Error('Invalid credentials');
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

    checkAuth() {
        const token = localStorage.getItem('adminToken');
        const currentPage = window.location.pathname;

        // If on login page and already authenticated, redirect to dashboard
        if (currentPage.includes('index.html') || currentPage.endsWith('/admin/')) {
            if (token) {
                window.location.href = 'dashboard.html';
            }
        }
        // If on protected page and not authenticated, redirect to login
        else if (!token && !currentPage.includes('index.html')) {
            window.location.href = 'index.html';
        }
    }

    logout() {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminUser');
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
        return !!localStorage.getItem('adminToken');
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new AdminAuth();
});