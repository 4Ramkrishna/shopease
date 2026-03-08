import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '../index.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Supabase client with anon key for auth operations (signin/signup)
const getAuthClient = () =>
  createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// Sign in
router.post('/signin', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const { data, error } = await getAuthClient().auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      return res.status(401).json({ error: error.message });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    res.json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
      user: {
        id: data.user.id,
        email: data.user.email,
      },
      profile: profile || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Sign up
router.post('/signup', async (req, res) => {
  try {
    const { email, password, full_name, role = 'buyer' } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const { data, error } = await getAuthClient().auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: full_name || '',
          role: role === 'seller' ? 'seller' : 'buyer',
        },
      },
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    if (!data.session) {
      return res.status(201).json({
        message: 'Account created. Please check your email to confirm.',
        user: { id: data.user.id, email: data.user.email },
      });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    res.status(201).json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
      user: {
        id: data.user.id,
        email: data.user.email,
      },
      profile: profile || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Refresh token
router.post('/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }

    const { data, error } = await getAuthClient().auth.refreshSession({
      refresh_token,
    });

    if (error) {
      return res.status(401).json({ error: error.message });
    }

    res.json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get current user profile (requires auth)
router.get('/me', requireAuth, async (req, res) => {
  try {
    const { data, error } = await req.supabase
      .from('profiles')
      .select('*')
      .eq('id', req.user.id)
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update profile
router.patch('/me', requireAuth, async (req, res) => {
  try {
    const { full_name } = req.body;
    const { data, error } = await req.supabase
      .from('profiles')
      .update({ full_name, updated_at: new Date().toISOString() })
      .eq('id', req.user.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
