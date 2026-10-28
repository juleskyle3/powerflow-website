const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const DEFAULT_BACKEND_URL = (process.env.VERCEL || process.env.NODE_ENV === 'production')
    ? 'https://api.powerflowservicesltd.com'
    : 'http://localhost:5050';
const BACKEND_API_BASE = (process.env.BACKEND_URL || DEFAULT_BACKEND_URL)
    .replace(/\/+$/, '')
    .replace(/\/api$/, '');

const ADMIN_HOSTNAMES = [
    'admin.powerflowservicesltd.com',
    'admin.localhost',
];

app.use(cors());

function isAdminHost(req) {
    const host = (req.get('x-forwarded-host') || req.get('host') || req.hostname || '')
        .toLowerCase()
        .split(':')[0];
    return ADMIN_HOSTNAMES.some((h) => host === h || host.endsWith('.' + h));
}

// On the admin subdomain, serve the admin portal from the root so paths like
// /pages/orders.html and /assets/... work (including OAuth redirects).
const adminPortalStatic = express.static(path.join(__dirname, 'admin'));
app.use((req, res, next) => {
    if (!isAdminHost(req)) {
        return next();
    }

    return adminPortalStatic(req, res, next);
});

// Always serve client images and assets (needed by both sites)
app.use('/images', express.static(path.join(__dirname, 'client', 'images')));
app.use('/css', express.static(path.join(__dirname, 'client', 'css')));
app.use('/js', express.static(path.join(__dirname, 'client', 'js')));
app.use('/client', express.static(path.join(__dirname, 'client')));

// Admin portal static assets
app.use('/admin/assets', express.static(path.join(__dirname, 'admin', 'assets')));
app.use('/admin/images', express.static(path.join(__dirname, 'admin', 'images')));
app.use('/admin/pages', express.static(path.join(__dirname, 'admin', 'pages')));
app.use('/admin', express.static(path.join(__dirname, 'admin')));

// Client website static assets
app.use('/', express.static(path.join(__dirname, 'client')));

// Invoices live on the backend API. Redirect old frontend-relative invoice
// links so previously shared/emailed links still reach the PDF.
app.get('/api/orders/:id/invoice', (req, res) => {
    const token = typeof req.query.token === 'string' && req.query.token
        ? `?token=${encodeURIComponent(req.query.token)}`
        : '';
    res.redirect(302, `${BACKEND_API_BASE}/api/orders/${encodeURIComponent(req.params.id)}/invoice${token}`);
});

// Admin subdomain: serve admin at root
app.get('/', (req, res, next) => {
    if (isAdminHost(req)) {
        return res.sendFile(path.join(__dirname, 'admin', 'index.html'));
    }
    res.sendFile(path.join(__dirname, 'client', 'index.html'));
});

app.get('/dashboard', (req, res, next) => {
    if (isAdminHost(req)) {
        return res.sendFile(path.join(__dirname, 'admin', 'dashboard.html'));
    }
    res.sendFile(path.join(__dirname, 'client', 'index.html'));
});

// Client routes
app.get('/about', (req, res) => {
    res.sendFile(path.join(__dirname, 'client', 'about.html'));
});

app.get('/services', (req, res) => {
    res.sendFile(path.join(__dirname, 'client', 'services.html'));
});

app.get('/products', (req, res) => {
    res.sendFile(path.join(__dirname, 'client', 'products.html'));
});

app.get('/projects', (req, res) => {
    res.sendFile(path.join(__dirname, 'client', 'projects.html'));
});

app.get('/contact', (req, res) => {
    res.sendFile(path.join(__dirname, 'client', 'contact.html'));
});

app.get('/checkout', (req, res) => {
    res.sendFile(path.join(__dirname, 'client', 'checkout.html'));
});

// /admin path routes
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

app.get('/admin/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin', 'dashboard.html'));
});

// Catch all
app.get('*', (req, res) => {
    if (isAdminHost(req)) {
        return res.sendFile(path.join(__dirname, 'admin', 'index.html'));
    }
    if (req.path.startsWith('/admin')) {
        return res.sendFile(path.join(__dirname, 'admin', 'index.html'));
    }
    res.sendFile(path.join(__dirname, 'client', 'index.html'));
});

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`🚀 Power Flow Services Website running on http://localhost:${PORT}`);
        console.log(`📱 Client Website: http://localhost:${PORT}`);
        console.log(`🔐 Admin Portal: http://localhost:${PORT}/admin`);
    });
}

module.exports = app;
