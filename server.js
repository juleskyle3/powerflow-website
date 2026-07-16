const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS
app.use(cors());

// Serve static files - client website at root
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

// Catch all other routes
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
    });
}

module.exports = app;
