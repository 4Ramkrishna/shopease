import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath, override: true });

if (!process.env.SUPABASE_URL || process.env.SUPABASE_URL.includes('your-project')) {
  console.error('ERROR: Set SUPABASE_URL in backend/.env to your Supabase project URL (e.g. https://xxx.supabase.co)');
  process.exit(1);
}

import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import authRoutes from './routes/auth.js';
import productsRoutes from './routes/products.js';
import ordersRoutes from './routes/orders.js';
import cartRoutes from './routes/cart.js';
import addressesRoutes from './routes/addresses.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Supabase client (service role for admin operations)
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/addresses', addressesRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'ShopEase API is running' });
});

app.listen(PORT, () => {
  console.log(`ShopEase API running on http://localhost:${PORT}`);
});
