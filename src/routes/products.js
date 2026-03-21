import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { supabase } from '../index.js';
import { requireAuth, requireSeller } from '../middleware/auth.js';

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.resolve(__dirname, '../../uploads/products');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new Error('Only image files are allowed'));
      return;
    }
    cb(null, true);
  },
});

/** Public URL for uploaded files (HTTPS + correct host behind proxies like Render). */
function getPublicBaseUrl(req) {
  const fromEnv = process.env.PUBLIC_BASE_URL?.trim().replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  const proto = req.get('x-forwarded-proto') || req.protocol;
  const host = req.get('x-forwarded-host') || req.get('host');
  return `${proto}://${host}`;
}

// Upload product image (seller only)
router.post('/upload-image', requireAuth, requireSeller, (req, res) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Image upload failed' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Image file is required' });
    }

    const baseUrl = getPublicBaseUrl(req);
    const imageUrl = `${baseUrl}/uploads/products/${req.file.filename}`;
    return res.status(201).json({ image_url: imageUrl });
  });
});

// Get all products (public - no auth needed)
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single product
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Product not found' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create product (seller only)
router.post('/', requireAuth, requireSeller, async (req, res) => {
  try {
    const { name, description, price, stock_quantity, image_url } = req.body;
    if (!name || price == null) {
      return res.status(400).json({ error: 'Name and price are required' });
    }

    const { data, error } = await req.supabase
      .from('products')
      .insert({
        seller_id: req.user.id,
        name,
        description: description || null,
        price: parseFloat(price),
        stock_quantity: parseInt(stock_quantity) || 0,
        image_url: image_url || null,
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update product (seller only)
router.patch('/:id', requireAuth, requireSeller, async (req, res) => {
  try {
    const { name, description, price, stock_quantity, image_url } = req.body;
    const updates = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (price !== undefined) updates.price = parseFloat(price);
    if (stock_quantity !== undefined) updates.stock_quantity = parseInt(stock_quantity);
    if (image_url !== undefined) updates.image_url = image_url;

    const { data, error } = await req.supabase
      .from('products')
      .update(updates)
      .eq('id', req.params.id)
      .eq('seller_id', req.user.id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Product not found' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete product (seller only)
router.delete('/:id', requireAuth, requireSeller, async (req, res) => {
  try {
    const { error } = await req.supabase
      .from('products')
      .delete()
      .eq('id', req.params.id)
      .eq('seller_id', req.user.id);

    if (error) throw error;
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
