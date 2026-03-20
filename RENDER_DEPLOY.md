## Render Deployment (Frontend + Backend)

This repo runs as two Node services:
- Frontend website/admin: `server.js` (repo root)
- Backend API: `powerflow-backend/server.js`

The frontend now calls the backend via same-origin `/api/*` and proxies to the backend service.

### 1) Create the Backend Service (Render Web Service)

1. In Render, create a **Web Service** from this repo.
2. Set **Root Directory**: `powerflow-backend`
3. Build Command: `npm install`
4. Start Command: `npm start`

**Recommended Render settings**
- Add a **Persistent Disk** (so OAuth tokens + invoices persist)
  - Mount path: `/var/data`

**Backend environment variables**
- `NODE_ENV=production`
- `MONGODB_URI` (MongoDB Atlas connection string)
- `FRONTEND_URL` (your Render frontend URL, e.g. `https://your-frontend.onrender.com`)
- `BACKEND_PUBLIC_URL` (your Render backend URL, e.g. `https://your-backend.onrender.com`)

**Invoice + uploads storage (recommended with a disk)**
- `INVOICE_DIR=/var/data/invoices`
- `UPLOAD_PATH=/var/data/uploads`
- `GOOGLE_TOKEN_PATH=/var/data/google-oauth-token.enc`
- `PRODUCT_UPLOAD_BASE_URL=https://your-backend.onrender.com` (recommended so image URLs always resolve even if the frontend proxy is bypassed)

**Gmail OAuth (if you want invoice emails to send)**
- `EMAIL_PROVIDER=gmail-oauth`
- `GOOGLE_CLIENT_ID=...` (no `credentials.json` file needed on Render)
- `GOOGLE_CLIENT_SECRET=...`
- `GOOGLE_OAUTH_REDIRECT_URI=https://your-backend.onrender.com/oauth2callback`
- `GOOGLE_OAUTH_SCOPES=https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/userinfo.email openid`
- `OAUTH_TOKEN_ENCRYPTION_KEY=...` (32+ chars)
- `GMAIL_SENDER_EMAIL=powerflowservicesltd@gmail.com`
- `FRONTEND_PUBLIC_URL=https://your-frontend.onrender.com` (so the invoice email link points to the website)

### 2) Create the Frontend Service (Render Web Service)

1. Create another **Web Service** from the same repo.
2. Set **Root Directory**: repo root (leave empty)
3. Build Command: `npm install`
4. Start Command: `npm start`

**Frontend environment variables**
- `NODE_ENV=production`
- `BACKEND_URL=https://your-backend.onrender.com`

### 3) Update Google OAuth Redirect URIs (Google Cloud Console)

In your OAuth Client credentials:
- Authorized redirect URI must include:
  - `https://your-backend.onrender.com/oauth2callback`

After deploying:
1. Open `https://your-backend.onrender.com/auth/google` once to authorize Gmail sending.
2. Place an order from the frontend (`https://your-frontend.onrender.com/checkout`).
