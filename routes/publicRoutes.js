const express = require('express');
const router = express.Router();
const Product = require('../models/product');

// ---- HOME PAGE ----
router.get('/', async (req, res) => {
  try {
    const featuredProducts = await Product.find({ featured: true, inStock: true }).limit(8);
    const newArrivals = await Product.find({ inStock: true }).sort({ createdAt: -1 }).limit(8);
    res.render('public/home', { featuredProducts, newArrivals });
  } catch (error) {
    res.render('public/home', { featuredProducts: [], newArrivals: [] });
  }
});pwd


// ---- SHOP PAGE (All Products) ----
router.get('/shop', async (req, res) => {
  try {
    const { category, sort, search } = req.query;
    let query = { inStock: true };
    let sortOption = { createdAt: -1 };

    if (category && category !== 'all') {
      query.category = category;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } }
      ];
    }

    if (sort === 'price-low') sortOption = { price: 1 };
    if (sort === 'price-high') sortOption = { price: -1 };
    if (sort === 'newest') sortOption = { createdAt: -1 };
    if (sort === 'name') sortOption = { name: 1 };

    const products = await Product.find(query).sort(sortOption);
    const categories = ['necklaces', 'earrings', 'bracelets', 'rings', 'anklets', 'hair-accessories', 'sets', 'other'];

    res.render('public/shop', { 
      products, 
      categories, 
      currentCategory: category || 'all',
      currentSort: sort || 'newest',
      searchTerm: search || ''
    });
  } catch (error) {
    res.render('public/shop', { 
      products: [], 
      categories: [], 
      currentCategory: 'all',
      currentSort: 'newest',
      searchTerm: ''
    });
  }
});

// ---- SINGLE PRODUCT PAGE ----
router.get('/product/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.redirect('/shop');
    
    // Get related products
    const relatedProducts = await Product.find({ 
      category: product.category, 
      _id: { $ne: product._id },
      inStock: true 
    }).limit(4);

    res.render('public/product', { product, relatedProducts });
  } catch (error) {
    res.redirect('/shop');
  }
});

// ---- ABOUT PAGE ----
router.get('/about', (req, res) => {
  res.render('public/about');
});

// ---- CONTACT PAGE ----
router.get('/contact', (req, res) => {
  res.render('public/contact');
});

module.exports = router;