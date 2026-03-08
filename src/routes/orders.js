import { Router } from 'express';
import { supabase } from '../index.js';
import { requireAuth, requireSeller, requireBuyer } from '../middleware/auth.js';

const router = Router();

// Get orders - buyer sees own, seller sees all
router.get('/', requireAuth, async (req, res) => {
  try {
    const { data: profile } = await req.supabase
      .from('profiles')
      .select('role')
      .eq('id', req.user.id)
      .single();

    let query = req.supabase
      .from('orders')
      .select(`
        *,
        address:addresses(*),
        order_items(
          *,
          product:products(*)
        )
      `)
      .order('created_at', { ascending: false });

    if (profile?.role === 'buyer') {
      query = query.eq('buyer_id', req.user.id);
    }
    // Seller sees all orders

    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single order
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { data, error } = await req.supabase
      .from('orders')
      .select(`
        *,
        address:addresses(*),
        order_items(
          *,
          product:products(*)
        )
      `)
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Order not found' });

    const { data: profile } = await req.supabase
      .from('profiles')
      .select('role')
      .eq('id', req.user.id)
      .single();

    if (profile?.role === 'buyer' && data.buyer_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create order from cart (buyer only)
router.post('/', requireAuth, requireBuyer, async (req, res) => {
  try {
    const { address_id, notes } = req.body;
    if (!address_id) {
      return res.status(400).json({ error: 'Address is required' });
    }

    // Get cart items
    const { data: cartItems, error: cartError } = await req.supabase
      .from('cart_items')
      .select(`
        product_id,
        quantity,
        products(price, stock_quantity, name)
      `)
      .eq('user_id', req.user.id);

    if (cartError) throw cartError;
    if (!cartItems?.length) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    // Verify address belongs to user
    const { data: address, error: addrError } = await req.supabase
      .from('addresses')
      .select('*')
      .eq('id', address_id)
      .eq('user_id', req.user.id)
      .single();

    if (addrError || !address) {
      return res.status(400).json({ error: 'Invalid address' });
    }

    let totalAmount = 0;
    const orderItemsData = [];

    for (const item of cartItems) {
      const product = item.products;
      if (!product) continue;
      const qty = item.quantity;
      const price = parseFloat(product.price);
      if (qty > product.stock_quantity) {
        return res.status(400).json({
          error: `Insufficient stock for ${product.name}. Available: ${product.stock_quantity}`,
        });
      }
      totalAmount += price * qty;
      orderItemsData.push({
        product_id: item.product_id,
        quantity: qty,
        price_at_order: price,
      });
    }

    // Create order and order items in transaction
    const { data: order, error: orderError } = await req.supabase
      .from('orders')
      .insert({
        buyer_id: req.user.id,
        address_id,
        total_amount: totalAmount,
        notes: notes || null,
        status: 'pending',
      })
      .select()
      .single();

    if (orderError) throw orderError;

    for (const oi of orderItemsData) {
      await req.supabase.from('order_items').insert({
        order_id: order.id,
        product_id: oi.product_id,
        quantity: oi.quantity,
        price_at_order: oi.price_at_order,
      });
    }

    // Decrease stock (use service role to bypass RLS - buyer cannot update products)
    for (const oi of orderItemsData) {
      const { data: prod } = await supabase
        .from('products')
        .select('stock_quantity')
        .eq('id', oi.product_id)
        .single();
      if (prod) {
        await supabase
          .from('products')
          .update({ stock_quantity: prod.stock_quantity - oi.quantity })
          .eq('id', oi.product_id);
      }
    }

    // Clear cart
    await req.supabase.from('cart_items').delete().eq('user_id', req.user.id);

    const { data: fullOrder } = await req.supabase
      .from('orders')
      .select(`
        *,
        address:addresses(*),
        order_items(*, product:products(*))
      `)
      .eq('id', order.id)
      .single();

    res.status(201).json(fullOrder || order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update order status (seller only)
router.patch('/:id/status', requireAuth, requireSeller, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Valid status required' });
    }

    const { data, error } = await req.supabase
      .from('orders')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Order not found' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
