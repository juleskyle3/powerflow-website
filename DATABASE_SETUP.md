# Power Flow Services - Database Setup & Run Guide

## 🚀 Quick Start

### 1. Start MongoDB
```bash
brew services start mongodb-community
```

### 2. Seed the Database
```bash
cd powerflow-backend
npm run seed
```

### 3. Start Backend API
```bash
cd powerflow-backend
npm start
```
Backend will run on: http://localhost:3001

### 4. Start Frontend (in new terminal)
```bash
cd powerflow-website-main
npm start
```
Frontend will run on: http://localhost:3000

## 📊 What Changed

### ✅ Database Integration
- All products now stored in MongoDB
- 21 products seeded across 3 categories (electronic, electrical, plumbing)
- Real-time data fetching from API

### ✅ Client Website (http://localhost:3000)
- Products page now fetches from API
- No hardcoded data
- Dynamic product rendering
- Real stock status

### ✅ Admin Portal (http://localhost:3000/admin)
- Products management uses real API
- Create, Read, Update, Delete operations
- Real-time database updates

## 🔧 API Endpoints

### Products
- GET `/api/products` - Get all products
- GET `/api/products/:id` - Get single product
- POST `/api/products` - Create product (admin)
- PUT `/api/products/:id` - Update product (admin)
- DELETE `/api/products/:id` - Delete product (admin)

## 📝 Database Schema

```javascript
{
  name: String,
  description: String,
  category: 'electronic' | 'electrical' | 'plumbing',
  price: Number,
  stock: Number,
  image: String,
  featured: Boolean,
  isActive: Boolean
}
```

## 🎯 Testing

1. Visit http://localhost:3000/products
2. Products should load from database
3. Visit http://localhost:3000/admin
4. Login: admin@powerflowservices.com / admin123
5. Manage products (add, edit, delete)
6. Changes reflect immediately on client site

## 🔄 Re-seed Database
```bash
cd powerflow-backend
npm run seed
```

## 🛑 Stop Services
```bash
# Stop frontend (Ctrl+C in terminal)
# Stop backend (Ctrl+C in terminal)
# Stop MongoDB
brew services stop mongodb-community
```