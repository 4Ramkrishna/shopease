import { Router } from 'express';
import { supabase } from '../index.js';
import { requireAuth, requireSeller } from '../middleware/auth.js';

const router = Router();

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
