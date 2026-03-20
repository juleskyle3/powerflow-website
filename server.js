const express = require('express');
const path = require('path');
const cors = require('cors');
const http = require('http');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

// Enable CORS
app.use(cors());

function proxyToBackend(req, res) {
    let target;
    try {
        target = new URL(BACKEND_URL);
    } catch (_) {
        res.status(500).send('Invalid BACKEND_URL configuration.');
        return;
    }

    const isHttps = target.protocol === 'https:';
    const client = isHttps ? https : http;

    const headers = { ...req.headers };
    headers.host = target.host;
    // The backend already allows requests with no Origin.
    // Dropping Origin avoids CORS headaches when proxying on Render.
    delete headers.origin;
    headers['x-forwarded-host'] = req.headers.host || '';
    headers['x-forwarded-proto'] = headers['x-forwarded-proto'] || (req.socket.encrypted ? 'https' : 'http');
    headers['x-forwarded-for'] = headers['x-forwarded-for'] || req.socket.remoteAddress || '';

    const requestOptions = {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || (isHttps ? 443 : 80),
        method: req.method,
        path: req.originalUrl,
        headers,
    };

    const upstreamReq = client.request(requestOptions, (upstreamRes) => {
        res.status(upstreamRes.statusCode || 502);
        Object.entries(upstreamRes.headers || {}).forEach(([key, value]) => {
            if (value !== undefined) res.setHeader(key, value);
        });
        upstreamRes.pipe(res);
    });

    upstreamReq.on('error', (error) => {
        console.error('Proxy error:', error.message);
        if (!res.headersSent) {
            res.status(502).send('Bad gateway.');
        } else {
            res.end();
        }
    });

    req.pipe(upstreamReq);
}

// Proxy backend routes so the browser can call same-origin `/api/*`.
app.use((req, res, next) => {
    const p = req.path || '';
    const shouldProxy =
        p === '/auth/google'
        || p === '/oauth2callback'
        || p === '/api'
        || p.startsWith('/api/')
        || p === '/uploads'
        || p.startsWith('/uploads/')
        || p === '/invoices'
        || p.startsWith('/invoices/');

    if (!shouldProxy) return next();
    return proxyToBackend(req, res);
});

// Serve static files
// Serve client website at root
app.use('/', express.static(path.join(__dirname, 'client')));

// Serve admin portal
app.use('/admin', express.static(path.join(__dirname, 'admin')));

// Routes for client pages
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'client', 'index.html'));
});

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

// Admin routes
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

app.get('/admin/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin', 'dashboard.html'));
});

// Catch all other routes and redirect appropriately
app.get('*', (req, res) => {
    if (req.path.startsWith('/admin')) {
        res.sendFile(path.join(__dirname, 'admin', 'index.html'));
    } else {
        res.sendFile(path.join(__dirname, 'client', 'index.html'));
    }
});

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`🚀 Power Flow Services Website running on http://localhost:${PORT}`);
        console.log(`📱 Client Website: http://localhost:${PORT}`);
        console.log(`🔐 Admin Portal: http://localhost:${PORT}/admin`);
        console.log(`📊 Dashboard: http://localhost:${PORT}/admin/dashboard`);
        console.log(`🔁 Proxying /api to ${BACKEND_URL}`);
    });
}

module.exports = app;
