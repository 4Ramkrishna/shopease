import { createClient } from '@supabase/supabase-js';

export const createAuthClient = (req) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace('Bearer ', '');
  
  if (!token) return null;
  
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
};

export const requireAuth = async (req, res, next) => {
  const supabase = createAuthClient(req);
  if (!supabase) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  req.user = user;
  req.supabase = supabase;
  next();
};

export const requireSeller = async (req, res, next) => {
  const { data: profile } = await req.supabase
    .from('profiles')
    .select('role')
    .eq('id', req.user.id)
    .single();

  if (!profile || profile.role !== 'seller') {
    return res.status(403).json({ error: 'Seller access required' });
  }
  next();
};

export const requireBuyer = async (req, res, next) => {
  const { data: profile } = await req.supabase
    .from('profiles')
    .select('role')
    .eq('id', req.user.id)
    .single();

  if (!profile || profile.role !== 'buyer') {
    return res.status(403).json({ error: 'Buyer access required' });
  }
  next();
};
