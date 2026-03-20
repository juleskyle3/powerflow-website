const mongoose = require('mongoose');
const Product = require('./models/Product');
require('dotenv').config();

const products = [
  // Electronic Equipment
  { name: 'Control panels & automation systems', description: 'Advanced control panels and automation systems for efficient operations.', category: 'electronic', price: 100000, stock: 15, image: 'assets/images/equipment/control-systems.jpg', featured: true, isActive: true },
  { name: 'Surveillance cameras (CCTV)', description: 'High-quality CCTV cameras for security monitoring.', category: 'electronic', price: 50000, stock: 25, image: 'assets/images/equipment/cctv-systems.jpg', featured: true, isActive: true },
  { name: 'Alarm systems', description: 'Reliable alarm systems for intrusion detection.', category: 'electronic', price: 50000, stock: 20, image: 'assets/images/equipment/alarm-systems.jpg', isActive: true },
  { name: 'HVAC control units', description: 'Control units for HVAC systems.', category: 'electronic', price: 50000, stock: 10, image: 'assets/images/equipment/hvac-controls.jpg', isActive: true },
  { name: 'Electronic system devices', description: 'Various electronic system devices.', category: 'electronic', price: 50000, stock: 30, image: 'assets/images/equipment/electronical-panel.jpg', isActive: true },
  { name: 'Software-controlled systems', description: 'Systems controlled by advanced software.', category: 'electronic', price: 50000, stock: 8, image: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22300%22%3E%3Crect fill=%22%231e3a8a%22 width=%22400%22 height=%22300%22/%3E%3Ctext fill=%22%23fff%22 font-size=%2224%22 x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22%3ESoftware Systems%3C/text%3E%3C/svg%3E', isActive: true },
  { name: 'TV units and remote controls', description: 'TV units and associated remote controls.', category: 'electronic', price: 50000, stock: 40, image: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22300%22%3E%3Crect fill=%22%231e3a8a%22 width=%22400%22 height=%22300%22/%3E%3Ctext fill=%22%23fff%22 font-size=%2224%22 x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22%3ETV Units%3C/text%3E%3C/svg%3E', isActive: true },
  { name: 'Internet & telephone connection systems', description: 'Systems for internet and telephone connections.', category: 'electronic', price: 50000, stock: 18, image: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22300%22%3E%3Crect fill=%22%231e3a8a%22 width=%22400%22 height=%22300%22/%3E%3Ctext fill=%22%23fff%22 font-size=%2218%22 x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22%3EInternet Systems%3C/text%3E%3C/svg%3E', isActive: true },
  { name: 'Room safes', description: 'Secure room safes for valuables.', category: 'electronic', price: 50000, stock: 12, image: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22300%22%3E%3Crect fill=%22%231e3a8a%22 width=%22400%22 height=%22300%22/%3E%3Ctext fill=%22%23fff%22 font-size=%2224%22 x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22%3ERoom Safes%3C/text%3E%3C/svg%3E', isActive: true },
  { name: 'Electronic sensors and controllers', description: 'Sensors and controllers for electronic systems.', category: 'electronic', price: 50000, stock: 35, image: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22300%22%3E%3Crect fill=%22%231e3a8a%22 width=%22400%22 height=%22300%22/%3E%3Ctext fill=%22%23fff%22 font-size=%2220%22 x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22%3ESensors%3C/text%3E%3C/svg%3E', isActive: true },
  
  // Electrical Equipment
  { name: 'Electrical wiring systems', description: 'Complete electrical wiring systems.', category: 'electrical', price: 50000, stock: 50, image: 'assets/images/equipment/wiring-cables.jpg', featured: true, isActive: true },
  { name: 'Lighting fixtures and bulbs', description: 'Various lighting fixtures and bulbs.', category: 'electrical', price: 50000, stock: 60, image: 'assets/images/equipment/lighting-systems.jpg', isActive: true },
  { name: 'Sockets and switches', description: 'Electrical sockets and switches.', category: 'electrical', price: 50000, stock: 100, image: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22300%22%3E%3Crect fill=%22%231e3a8a%22 width=%22400%22 height=%22300%22/%3E%3Ctext fill=%22%23fff%22 font-size=%2224%22 x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22%3ESockets%3C/text%3E%3C/svg%3E', isActive: true },
  { name: 'Fuse boxes / breaker panels', description: 'Fuse boxes and breaker panels.', category: 'electrical', price: 50000, stock: 20, image: 'assets/images/equipment/electrical-panel.jpg', isActive: true },
  { name: 'Generators and backup systems', description: 'Generators and backup power systems.', category: 'electrical', price: 50000, stock: 8, image: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22300%22%3E%3Crect fill=%22%231e3a8a%22 width=%22400%22 height=%22300%22/%3E%3Ctext fill=%22%23fff%22 font-size=%2224%22 x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22%3EGenerators%3C/text%3E%3C/svg%3E', isActive: true },
  { name: 'Emergency lights and exit signs', description: 'Emergency lighting and exit signage.', category: 'electrical', price: 50000, stock: 45, image: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22300%22%3E%3Crect fill=%22%231e3a8a%22 width=%22400%22 height=%22300%22/%3E%3Ctext fill=%22%23fff%22 font-size=%2220%22 x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22%3EEmergency Lights%3C/text%3E%3C/svg%3E', isActive: true },
  { name: 'Electrical panels', description: 'Electrical distribution panels.', category: 'electrical', price: 50000, stock: 15, image: 'assets/images/equipment/electrical-panel.jpg', isActive: true },
  { name: 'Power distribution equipment', description: 'Equipment for power distribution.', category: 'electrical', price: 50000, stock: 12, image: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22300%22%3E%3Crect fill=%22%231e3a8a%22 width=%22400%22 height=%22300%22/%3E%3Ctext fill=%22%23fff%22 font-size=%2220%22 x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22%3EPower Distribution%3C/text%3E%3C/svg%3E', isActive: true },
  
  // Plumbing Equipment
  { name: 'Pipes and fittings', description: 'Durable pipes and fittings.', category: 'plumbing', price: 50000, stock: 80, image: 'assets/images/equipment/pipes-fittings.jpg', featured: true, isActive: true },
  { name: 'Water heaters', description: 'Efficient water heating solutions.', category: 'plumbing', price: 50000, stock: 15, image: 'assets/images/equipment/water-heaters.jpg', isActive: true },
  { name: 'Water pumps', description: 'High-performance water pumps.', category: 'plumbing', price: 50000, stock: 18, image: 'assets/images/equipment/pumps-filtration.jpg', isActive: true }
];

async function seedProducts() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    await Product.deleteMany({});
    console.log('🗑️  Cleared existing products');
    
    const result = await Product.insertMany(products);
    console.log(`✅ Seeded ${result.length} products successfully`);
    
    const categories = await Product.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    console.log('\n📊 Products by category:');
    categories.forEach(cat => console.log(`   ${cat._id}: ${cat.count} products`));
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding products:', error);
    process.exit(1);
  }
}

seedProducts();