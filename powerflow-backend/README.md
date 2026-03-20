# Power Flow Services Backend

A comprehensive Node.js backend API for Power Flow Services Ltd, providing technical maintenance services and equipment supply.

## Features

### 🏢 **Core Business Features**
- **Product Management**: CRUD operations for electrical, electronic, and plumbing products
- **Order Management**: Complete order lifecycle from creation to delivery
- **User Management**: Client and admin authentication with role-based access control
- **Invoice Generation**: Automatic PDF invoice generation for orders
- **Inventory Management**: Real-time stock tracking and management
- **Product Reviews**: Client reviews and ratings system
- **Analytics**: Sales statistics and reporting

### 🔐 **Security Features**
- JWT authentication with refresh tokens
- Password hashing using bcrypt
- Role-based access control (Admin/Client)
- Input validation with express-validator
- CORS configuration
- Rate limiting
- Helmet security middleware

### 📦 **Data Models**
- **Users**: Client and admin accounts with profile management
- **Products**: Detailed product catalog with specifications and stock
- **Orders**: Complete order management with status tracking
- **Reviews**: Product reviews and ratings

## Tech Stack

### Backend
- **Node.js** - JavaScript runtime
- **Express.js** - Web framework
- **MongoDB** - NoSQL database
- **Mongoose** - ODM for MongoDB

### Security & Authentication
- **bcryptjs** - Password hashing
- **jsonwebtoken** - JWT authentication
- **express-validator** - Input validation
- **helmet** - Security headers
- **cors** - Cross-origin resource sharing

### Utilities
- **pdfkit** - PDF generation
- **moment** - Date manipulation
- **multer** - File uploads
- **dotenv** - Environment variables

### Development
- **nodemon** - Auto-reloading
- **jest** - Testing framework
- **supertest** - API testing

## Installation

### Prerequisites
- Node.js (v16 or higher)
- MongoDB (local or cloud instance)
- npm or yarn

### Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd powerflow-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` file with your configuration:
   ```env
   # Database
   MONGODB_URI=mongodb://localhost:27017/powerflow
   
   # Server
   PORT=5001
   NODE_ENV=development
   
   # JWT
   JWT_SECRET=your_jwt_secret_here
   
   # CORS
   FRONTEND_URL=http://localhost:3000
   
   # Security
   API_KEY=your_api_key_here
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Production build**
   ```bash
   npm start
   ```

## API Documentation

### Base URL
All API endpoints are prefixed with `/api`

### Authentication
Endpoints that require authentication will return `401 Unauthorized` if not authenticated. Include JWT token in:
- HTTP header: `Authorization: Bearer <token>`
- or in cookies (automatically handled with fetch/axios)

### Response Format
All responses follow this format:
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": { /* response data */ },
  "error": { /* error details */ }
}
```

### Endpoints

#### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/update-profile` - Update user profile
- `PUT /api/auth/change-password` - Change password

#### Products
- `GET /api/products` - Get all products with filters
- `GET /api/products/:id` - Get single product
- `GET /api/products/category/:category` - Get products by category
- `GET /api/products/search/:query` - Search products
- `POST /api/products` - Create product (Admin)
- `PUT /api/products/:id` - Update product (Admin)
- `DELETE /api/products/:id` - Delete product (Admin)
- `GET /api/products/stats` - Get product stats (Admin)
- `POST /api/products/:id/reviews` - Add product review
- `PUT /api/products/:id/reviews` - Update product review
- `DELETE /api/products/:id/reviews` - Delete product review

#### Orders
- `POST /api/orders` - Create new order
- `GET /api/orders` - Get orders (Admin/Client)
- `GET /api/orders/:id` - Get single order
- `PUT /api/orders/:id` - Update order status (Admin)
- `DELETE /api/orders/:id` - Delete order (Admin)
- `GET /api/orders/stats` - Get order stats (Admin)
- `GET /api/orders/:id/invoice` - Download invoice

## Database Structure

### Users Collection
```javascript
{
  _id: ObjectId,
  name: String,
  email: String,
  passwordHash: String,
  role: String, // 'admin' or 'client'
  phone: String,
  address: String,
  avatar: String,
  isActive: Boolean,
  lastLoginAt: Date,
  loginCount: Number,
  createdAt: Date,
  updatedAt: Date
}
```

### Products Collection
```javascript
{
  _id: ObjectId,
  name: String,
  description: String,
  category: String,
  price: Number,
  stock: Number,
  image: String,
  images: [String],
  brand: String,
  sku: String,
  featured: Boolean,
  isActive: Boolean,
  specifications: [
    { name: String, value: String }
  ],
  tags: [String],
  weight: Number,
  dimensions: { length: Number, width: Number, height: Number },
  warranty: String,
  reviews: [
    {
      userId: ObjectId,
      rating: Number,
      comment: String,
      createdAt: Date
    }
  ],
  createdAt: Date,
  updatedAt: Date
}
```

### Orders Collection
```javascript
{
  _id: ObjectId,
  customerName: String,
  customerEmail: String,
  customerPhone: String,
  customerAddress: String,
  items: [
    {
      productId: ObjectId,
      productName: String,
      quantity: Number,
      price: Number
    }
  ],
  subtotal: Number,
  tax: Number,
  totalAmount: Number,
  invoiceNumber: String,
  status: String, // Pending/Processing/Shipped/Delivered/Cancelled/Refunded
  paymentStatus: String, // Unpaid/Paid/Partially Paid/Refunded
  paymentMethod: String,
  shippingMethod: String,
  shippingCost: Number,
  trackingNumber: String,
  notes: String,
  user: ObjectId,
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

## Error Handling

The API follows standard HTTP status codes:
- `200` - OK
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `500` - Internal Server Error

## Development

### Running Tests
```bash
npm test
```

### Code Quality
```bash
# Run linting
npm run lint

# Fix linting issues
npm run lint:fix
```

### Environment Variables
For development, use `.env` file with proper configuration. For production, set environment variables directly in the hosting platform.

## Production Deployment

### Recommended Hosting
- **Backend**: Vercel, Railway, DigitalOcean, or AWS
- **Database**: MongoDB Atlas (cloud)
- **Frontend**: Vercel or Netlify

### Deployment Steps
1. Set up production MongoDB instance
2. Configure environment variables
3. Deploy code to hosting platform
4. Test API endpoints
5. Set up monitoring and logging

## Security Best Practices

- Always use HTTPS
- Keep dependencies updated
- Regularly back up the database
- Implement monitoring and alerting
- Restrict API access with rate limiting
- Use environment variables for sensitive information

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License

## Contact

Power Flow Services Ltd
- Email: powerflowservicesltd@gmail.com
- Phone: +250 781 393 649
- Address: Kigali - Gasabo - Kimihurura
