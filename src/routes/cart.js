import { Router } from 'express';
import { requireAuth, requireBuyer } from '../middleware/auth.js';

const router = Router();

// Get cart
router.get('/', requireAuth, requireBuyer, async (req, res) => {
  try {
    const { data, error } = await req.supabase
      .from('cart_items')
      .select(`
        *,
        product:products(*)
      `)
      .eq('user_id', req.user.id);

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add to cart
router.post('/', requireAuth, requireBuyer, async (req, res) => {
  try {
    const { product_id, quantity = 1 } = req.body;
    if (!product_id) {
      return res.status(400).json({ error: 'Product ID is required' });
    }

    const qty = Math.max(1, parseInt(quantity));

    // Check product exists and has stock
    const { data: product, error: prodError } = await req.supabase
      .from('products')
      .select('id, stock_quantity')
      .eq('id', product_id)
      .single();

    if (prodError || !product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    if (product.stock_quantity < qty) {
      return res.status(400).json({ error: 'Insufficient stock' });
    }

    const { data, error } = await req.supabase
      .from('cart_items')
      .upsert(
        {
          user_id: req.user.id,
          product_id,
          quantity: qty,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,product_id' }
      )
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update cart item quantity
router.patch('/:id', requireAuth, requireBuyer, async (req, res) => {
  try {
    const { quantity } = req.body;
    if (quantity == null || quantity < 1) {
      return res.status(400).json({ error: 'Quantity must be at least 1' });
    }

    const { data: cartItem } = await req.supabase
      .from('cart_items')
      .select('*, product:products(stock_quantity)')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (!cartItem) return res.status(404).json({ error: 'Cart item not found' });
    if (cartItem.product?.stock_quantity < quantity) {
      return res.status(400).json({ error: 'Insufficient stock' });
    }

    const { data, error } = await req.supabase
      .from('cart_items')
      .update({ quantity, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remove from cart
router.delete('/:id', requireAuth, requireBuyer, async (req, res) => {
  try {
    const { error } = await req.supabase
      .from('cart_items')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);

    if (error) throw error;
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
