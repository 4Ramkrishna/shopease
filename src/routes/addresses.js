import { Router } from 'express';
import { requireAuth, requireBuyer } from '../middleware/auth.js';

const router = Router();

// Get user addresses
router.get('/', requireAuth, requireBuyer, async (req, res) => {
  try {
    const { data, error } = await req.supabase
      .from('addresses')
      .select('*')
      .eq('user_id', req.user.id)
      .order('is_default', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add address
router.post('/', requireAuth, requireBuyer, async (req, res) => {
  try {
    const { label, full_address, city, state, pincode, phone, is_default } = req.body;
    if (!full_address || !city || !pincode || !phone) {
      return res.status(400).json({
        error: 'full_address, city, pincode, and phone are required',
      });
    }

    if (is_default) {
      await req.supabase
        .from('addresses')
        .update({ is_default: false })
        .eq('user_id', req.user.id);
    }

    const { data, error } = await req.supabase
      .from('addresses')
      .insert({
        user_id: req.user.id,
        label: label || null,
        full_address,
        city,
        state: state || null,
        pincode,
        phone,
        is_default: is_default || false,
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update address
router.patch('/:id', requireAuth, requireBuyer, async (req, res) => {
  try {
    const { label, full_address, city, state, pincode, phone, is_default } = req.body;
    const updates = { updated_at: new Date().toISOString() };
    if (label !== undefined) updates.label = label;
    if (full_address !== undefined) updates.full_address = full_address;
    if (city !== undefined) updates.city = city;
    if (state !== undefined) updates.state = state;
    if (pincode !== undefined) updates.pincode = pincode;
    if (phone !== undefined) updates.phone = phone;
    if (is_default !== undefined) {
      updates.is_default = is_default;
      if (is_default) {
        await req.supabase
          .from('addresses')
          .update({ is_default: false })
          .eq('user_id', req.user.id);
      }
    }

    const { data, error } = await req.supabase
      .from('addresses')
      .update(updates)
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Address not found' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete address
router.delete('/:id', requireAuth, requireBuyer, async (req, res) => {
  try {
    const { error } = await req.supabase
      .from('addresses')
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
