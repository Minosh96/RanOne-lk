const express = require('express');
const router = express.Router();
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Product = require('../models/Product');
const Admin = require('../models/Admin');
const { requireAdmin } = require('../middleware/auth');

// ============================================
// CLOUDINARY SETUP (cloud image storage)
// ============================================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'glitterlk',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    transformation: [{ width: 800, height: 800, crop: 'limit', quality: 'auto' }]
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }
});

// ---- CREATE DEFAULT ADMIN ----
async function createDefaultAdmin() {
  try {
    const count = await Admin.countDocuments();
    if (count === 0) {
      const admin = new Admin({
        email: process.env.ADMIN_EMAIL,
        password: process.env.ADMIN_PASSWORD
      });
      await admin.save();
      console.log('New admin created!');
      console.log('Email:', process.env.ADMIN_EMAIL);
      console.log('Password:', process.env.ADMIN_PASSWORD);
    } else {
      console.log('Admin account exists');
    }
  } catch (err) {
    console.log('Admin setup error:', err.message);
  }
}
createDefaultAdmin();

// ---- /admin REDIRECT ----
router.get('/', function(req, res) {
  res.redirect('/admin/login');
});

// ---- LOGIN PAGE ----
router.get('/login', function(req, res) {
  res.render('admin/login', { error: null });
});

// ---- LOGIN ACTION ----
router.post('/login', async function(req, res) {
  try {
    const { email, password } = req.body;
    const admin = await Admin.findOne({ email: email });
    
    if (!admin) {
      return res.render('admin/login', { error: 'Wrong email or password!' });
    }

    const isMatch = await admin.comparePassword(password);
    
    if (!isMatch) {
      return res.render('admin/login', { error: 'Wrong email or password!' });
    }

    const token = jwt.sign(
      { id: admin._id, email: admin.email }, 
      process.env.JWT_SECRET, 
      { expiresIn: '24h' }
    );

    res.cookie('token', token, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 });
    res.redirect('/admin/dashboard');
  } catch (error) {
    console.log('Login error:', error.message);
    res.render('admin/login', { error: 'Something went wrong!' });
  }
});

// ---- LOGOUT ----
router.get('/logout', function(req, res) {
  res.clearCookie('token');
  res.redirect('/admin/login');
});

// ---- DASHBOARD ----
router.get('/dashboard', requireAdmin, async function(req, res) {
  try {
    const totalProducts = await Product.countDocuments();
    const inStockProducts = await Product.countDocuments({ inStock: true });
    const featuredProducts = await Product.countDocuments({ featured: true });
    const recentProducts = await Product.find().sort({ createdAt: -1 }).limit(5);

    res.render('admin/dashboard', {
      totalProducts,
      inStockProducts,
      featuredProducts,
      recentProducts
    });
  } catch (error) {
    res.render('admin/dashboard', {
      totalProducts: 0,
      inStockProducts: 0,
      featuredProducts: 0,
      recentProducts: []
    });
  }
});

// ---- ALL PRODUCTS PAGE ----
router.get('/products', requireAdmin, async function(req, res) {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.render('admin/products', { products });
  } catch (error) {
    res.render('admin/products', { products: [] });
  }
});

// ---- ADD PRODUCT PAGE ----
router.get('/products/add', requireAdmin, function(req, res) {
  res.render('admin/addProduct', { error: null, success: null });
});

// ---- ADD PRODUCT ACTION ----
router.post('/products/add', requireAdmin, upload.array('images', 5), async function(req, res) {
  try {
    const { name, description, price, salePrice, category, quantity, tags, featured, inStock } = req.body;
    
    // Cloudinary gives us URLs directly
    const images = req.files ? req.files.map(file => file.path) : [];

    const product = new Product({
      name,
      description,
      price: parseFloat(price),
      salePrice: salePrice ? parseFloat(salePrice) : null,
      category,
      quantity: parseInt(quantity) || 0,
      images,
      tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
      featured: featured === 'on',
      inStock: inStock === 'on'
    });

    await product.save();
    res.render('admin/addProduct', { error: null, success: 'Product added successfully!' });
  } catch (error) {
    console.log('Add product error:', error.message);
    res.render('admin/addProduct', { error: 'Failed to add product: ' + error.message, success: null });
  }
});

// ---- EDIT PRODUCT PAGE ----
router.get('/products/edit/:id', requireAdmin, async function(req, res) {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.redirect('/admin/products');
    res.render('admin/editProduct', { product, error: null, success: null });
  } catch (error) {
    res.redirect('/admin/products');
  }
});

// ---- EDIT PRODUCT ACTION ----
router.post('/products/edit/:id', requireAdmin, upload.array('images', 5), async function(req, res) {
  try {
    const { name, description, price, salePrice, category, quantity, tags, featured, inStock } = req.body;
    
    const updateData = {
      name,
      description,
      price: parseFloat(price),
      salePrice: salePrice ? parseFloat(salePrice) : null,
      category,
      quantity: parseInt(quantity) || 0,
      tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
      featured: featured === 'on',
      inStock: inStock === 'on'
    };

    if (req.files && req.files.length > 0) {
      const newImages = req.files.map(file => file.path);
      const existingProduct = await Product.findById(req.params.id);
      updateData.images = [...(existingProduct.images || []), ...newImages];
    }

    const product = await Product.findByIdAndUpdate(req.params.id, updateData, { new: true });
    res.render('admin/editProduct', { product, error: null, success: 'Product updated!' });
  } catch (error) {
    const product = await Product.findById(req.params.id);
    res.render('admin/editProduct', { product, error: 'Update failed: ' + error.message, success: null });
  }
});

// ---- DELETE PRODUCT ----
router.post('/products/delete/:id', requireAdmin, async function(req, res) {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.redirect('/admin/products');
  } catch (error) {
    res.redirect('/admin/products');
  }
});

// ---- DELETE SINGLE IMAGE ----
router.post('/products/delete-image/:id', requireAdmin, async function(req, res) {
  try {
    const { imageUrl } = req.body;
    await Product.findByIdAndUpdate(req.params.id, {
      $pull: { images: imageUrl }
    });
    res.redirect('/admin/products/edit/' + req.params.id);
  } catch (error) {
    res.redirect('/admin/products');
  }
});

module.exports = router;