#!/bin/bash

echo "🚀 Setting up Power Flow Services Website..."

# Install main dependencies
echo "📦 Installing main dependencies..."
npm install

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd powerflow-backend && npm install && cd ..

echo "✅ Setup complete!"
echo ""
echo "🎯 Quick Start Commands:"
echo "  npm start          - Run frontend (client + admin)"
echo "  npm run backend    - Run backend API"
echo "  npm run dev        - Run frontend with auto-reload"
echo ""
echo "🌐 Access URLs:"
echo "  Client Website: http://localhost:3000"
echo "  Admin Portal:   http://localhost:3000/admin"
echo "  Backend API:    http://localhost:3001"
echo ""
echo "🔐 Admin Login:"
echo "  Email: admin@powerflowservices.com"
echo "  Password: admin123"