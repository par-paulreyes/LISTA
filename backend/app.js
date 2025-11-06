const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('./db');
const authRoutes = require('./routes/authRoutes');
const companyRoutes = require('./routes/companyRoutes');
const itemRoutes = require('./routes/itemRoutes');
const maintenanceLogRoutes = require('./routes/maintenanceLogRoutes');
const diagnosticRoutes = require('./routes/diagnosticRoutes');
const userRoutes = require('./routes/userRoutes');
const chatRoutes = require('./routes/chatRoutes');

// Load environment variables
dotenv.config();

const app = express();

// Configure CORS to allow all origins
app.use(cors({
  origin: '*', // Allow all origins
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configure multer for handling multipart/form-data
const upload = multer({ dest: 'uploads/' });
app.use(upload.any()); // Handle any multipart/form-data

// Test database connection
db.getConnection((err, connection) => {
  if (err) {
    console.error('MySQL connection error:', err);
    process.exit(1);
  }
  console.log('Connected to MySQL database');
  connection.release();
});

app.get('/', (req, res) => {
  res.send('Inventory Management System API');
});

app.use('/api/auth', authRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/logs', maintenanceLogRoutes);
app.use('/api/diagnostics', diagnosticRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chat', chatRoutes);

// Add a test endpoint for Supabase image upload
app.post('/test-supabase-upload', (req, res) => {
  const { image_url } = req.body;
  if (!image_url || typeof image_url !== 'string') {
    return res.status(400).json({ success: false, message: 'No image_url provided' });
  }
  // Basic validation for Supabase public URL
  if (image_url.startsWith('https://') && image_url.includes('supabase.co/storage/v1/object/public/')) {
    return res.json({ success: true, message: 'Supabase image URL is valid and accepted', image_url });
  } else {
    return res.status(400).json({ success: false, message: 'Invalid Supabase public image URL' });
  }
});

const PORT = process.env.PORT || 5000;

// Listen on all interfaces for Render compatibility
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  if (!process.env.GEMINI_API_KEY) {
    console.warn('Gemini disabled: set GEMINI_API_KEY to enable AI guidance.');
  }
}); 