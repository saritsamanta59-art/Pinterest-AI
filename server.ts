import express from 'express';
import { createServer as createViteServer } from 'vite';
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

app.use(express.json({ limit: '50mb' }));
app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET || 'pingenius-secret-key-123',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000
  }
}));

const requireAuth = (req: any, res: any, next: any) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  next();
};

// Auth Routes
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existing) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const { data: newUser, error } = await supabase
      .from('users')
      .insert([{ name, email, password: hashedPassword }])
      .select()
      .single();

    if (error) throw error;

    (req.session as any).userId = newUser.id;

    const { data: accounts } = await supabase
      .from('pinterest_accounts')
      .select('*')
      .eq('user_id', newUser.id);

    res.json({
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        geminiApiKey: newUser.gemini_api_key,
        pinterestAccounts: accounts || []
      }
    });
  } catch (error: any) {
    console.error('Signup error:', error);
    res.status(500).json({ message: error.message || 'Signup failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (error || !user || !(await bcrypt.compare(password, user.password))) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    (req.session as any).userId = user.id;

    const { data: accounts } = await supabase
      .from('pinterest_accounts')
      .select('*')
      .eq('user_id', user.id);

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        geminiApiKey: user.gemini_api_key,
        pinterestAccounts: accounts || []
      }
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ message: error.message || 'Login failed' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ message: 'Logged out' });
  });
});

app.get('/api/auth/me', async (req, res) => {
  try {
    if (!(req.session as any).userId) {
      return res.status(401).json({ message: 'Not logged in' });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', (req.session as any).userId)
      .maybeSingle();

    if (error || !user) {
      return res.status(401).json({ message: 'User not found' });
    }

    const { data: accounts } = await supabase
      .from('pinterest_accounts')
      .select('*')
      .eq('user_id', user.id);

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        geminiApiKey: user.gemini_api_key,
        pinterestAccounts: accounts || []
      }
    });
  } catch (error: any) {
    console.error('Auth check error:', error);
    res.status(500).json({ message: error.message || 'Auth check failed' });
  }
});

app.put('/api/user/profile', requireAuth, async (req, res) => {
  try {
    const { name, email, geminiApiKey } = req.body;
    const userId = (req.session as any).userId;

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (geminiApiKey !== undefined) updateData.gemini_api_key = geminiApiKey;
    updateData.updated_at = new Date().toISOString();

    const { data: updatedUser, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;

    const { data: accounts } = await supabase
      .from('pinterest_accounts')
      .select('*')
      .eq('user_id', userId);

    res.json({
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        geminiApiKey: updatedUser.gemini_api_key,
        pinterestAccounts: accounts || []
      }
    });
  } catch (error: any) {
    console.error('Profile update error:', error);
    res.status(500).json({ message: error.message || 'Update failed' });
  }
});

app.delete('/api/user/account', requireAuth, async (req, res) => {
  try {
    const userId = (req.session as any).userId;

    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', userId);

    if (error) throw error;

    req.session.destroy(() => {
      res.json({ message: 'Account deleted' });
    });
  } catch (error: any) {
    console.error('Account deletion error:', error);
    res.status(500).json({ message: error.message || 'Deletion failed' });
  }
});

app.post('/api/user/pinterest-accounts', requireAuth, async (req, res) => {
  try {
    const { account } = req.body;
    if (!account) {
      return res.status(400).json({ message: 'Account data required' });
    }

    const userId = (req.session as any).userId;

    const { data: existing } = await supabase
      .from('pinterest_accounts')
      .select('id')
      .eq('user_id', userId)
      .eq('username', account.username)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from('pinterest_accounts')
        .update({
          access_token: account.accessToken,
          profile_image: account.profileImage,
          boards: account.boards || [],
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);

      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('pinterest_accounts')
        .insert([{
          user_id: userId,
          access_token: account.accessToken,
          username: account.username,
          profile_image: account.profileImage,
          boards: account.boards || []
        }]);

      if (error) throw error;
    }

    const { data: accounts } = await supabase
      .from('pinterest_accounts')
      .select('*')
      .eq('user_id', userId);

    res.json({ message: 'Account saved', accounts: accounts || [] });
  } catch (error: any) {
    console.error('Pinterest account save error:', error);
    res.status(500).json({ message: error.message || 'Failed to save account' });
  }
});

// Pinterest OAuth Config
const PINTEREST_CLIENT_ID = process.env.PINTEREST_APP_ID || '1550825';
const PINTEREST_CLIENT_SECRET = process.env.PINTEREST_APP_SECRET || '9586e373e34a3bbcf4d873c348b0eb13a701bf4b';

const getRedirectUri = (req: express.Request) => {
  if (process.env.APP_URL) {
    return `${process.env.APP_URL}/auth/pinterest/callback`;
  }
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers.host;
  return `${protocol}://${host}/auth/pinterest/callback`;
};

// 1. Get OAuth URL
app.get('/api/auth/pinterest/url', (req, res) => {
  console.log('Generating Pinterest OAuth URL...');
  const redirectUri = getRedirectUri(req);
  console.log('Redirect URI:', redirectUri);
  const scopes = 'boards:read,boards:write,pins:read,pins:write,user_accounts:read';
  const authUrl = `https://www.pinterest.com/oauth/?client_id=${PINTEREST_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scopes}`;
  console.log('Auth URL:', authUrl);
  res.json({ url: authUrl });
});

// 2. Callback handler
app.get('/auth/pinterest/callback', async (req, res) => {
  const { code } = req.query;
  const redirectUri = getRedirectUri(req);

  if (!code) {
    return res.send(`
      <script>
        window.opener.postMessage({ type: 'PINTEREST_AUTH_ERROR', error: 'No code provided' }, '*');
        window.close();
      </script>
    `);
  }

  try {
    // Exchange code for token
    const authHeader = Buffer.from(`${PINTEREST_CLIENT_ID}:${PINTEREST_CLIENT_SECRET}`).toString('base64');
    const response = await axios.post('https://api.pinterest.com/v5/oauth/token', 
      new URLSearchParams({
        grant_type: 'authorization_code',
        code: code as string,
        redirect_uri: redirectUri,
      }).toString(),
      {
        headers: {
          'Authorization': `Basic ${authHeader}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const { access_token } = response.data;

    // Get user info
    const userResponse = await axios.get('https://api.pinterest.com/v5/user_account', {
      headers: { 'Authorization': `Bearer ${access_token}` }
    });

    const userData = {
      accessToken: access_token,
      username: userResponse.data.username,
      profileImage: userResponse.data.profile_image,
    };

    res.send(`
      <html>
        <head>
          <title>Pinterest Authentication</title>
          <style>
            body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f8fafc; color: #1e293b; }
            .card { background: white; padding: 2rem; rounded: 1rem; shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); border-radius: 12px; text-align: center; max-width: 400px; }
            .spinner { border: 3px solid #f3f3f3; border-top: 3px solid #e60023; border-radius: 50%; width: 24px; height: 24px; animation: spin 1s linear infinite; margin: 10px auto; }
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            .btn { background: #e60023; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; cursor: pointer; margin-top: 15px; }
          </style>
        </head>
        <body>
          <div class="card">
            <div id="status-icon" class="spinner"></div>
            <h2 id="status-text">Completing Connection...</h2>
            <p id="sub-text">Please wait while we sync your Pinterest account.</p>
            <button id="close-btn" class="btn" style="display:none;" onclick="window.close()">Close Window</button>
          </div>
          <script>
            const userData = ${JSON.stringify(userData)};
            const authChannel = new BroadcastChannel('pinterest_auth');
            
            function notifyApp() {
              // 1. Try postMessage (traditional)
              if (window.opener) {
                window.opener.postMessage({ type: 'PINTEREST_AUTH_SUCCESS', data: userData }, '*');
              }
              
              // 2. Try BroadcastChannel (robust fallback for same-origin)
              authChannel.postMessage({ type: 'PINTEREST_AUTH_SUCCESS', data: userData });
              
              document.getElementById('status-icon').style.display = 'none';
              document.getElementById('status-text').innerText = 'Connected!';
              document.getElementById('sub-text').innerText = 'You can close this window now.';
              setTimeout(() => window.close(), 1000);
            }

            // Execute notification
            notifyApp();

            // Fallback UI if window doesn't close
            document.getElementById('close-btn').style.display = 'inline-block';
            document.getElementById('status-text').innerText = 'Connection Ready';
            document.getElementById('sub-text').innerText = 'Please return to the app.';
          </script>
        </body>
      </html>
    `);
  } catch (error: any) {
    const errorDetail = error.response?.data?.message || error.message;
    console.error('Pinterest OAuth Error:', errorDetail);
    res.send(`
      <html>
        <head>
          <title>Authentication Error</title>
          <style>
            body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #fef2f2; }
            .card { background: white; padding: 2rem; border-radius: 12px; text-align: center; border: 1px solid #fee2e2; }
            .error-text { color: #dc2626; font-weight: bold; }
            .btn { background: #475569; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; margin-top: 15px; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2 class="error-text">Connection Failed</h2>
            <p>${errorDetail}</p>
            <button class="btn" onclick="window.close()">Close and Try Again</button>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'PINTEREST_AUTH_ERROR', error: '${errorDetail}' }, '*');
              }
            </script>
          </div>
        </body>
      </html>
    `);
  }
});

// 3. Pinterest API Proxy (to handle CORS and keep tokens safer)
app.post('/api/pinterest/proxy', async (req, res) => {
  const { endpoint, method, data, token } = req.body;
  
  console.log(`Pinterest Proxy Request: ${method || 'GET'} ${endpoint}`);
  if (method === 'POST') {
    // Clean base64 data if present to avoid validation errors
    if (data?.media_source?.source_type === 'image_base64' && typeof data.media_source.data === 'string') {
      // Aggressively remove ANY character that isn't valid base64 (no spaces, no newlines, no prefixes)
      data.media_source.data = data.media_source.data.replace(/[^a-zA-Z0-9+/=]/g, '');
    }

    // Log a truncated version of the data to avoid flooding logs with base64
    const logData = { ...data };
    if (logData.media_source?.data) {
      logData.media_source.data = logData.media_source.data.substring(0, 50) + '...';
    }
    console.log('Request Data:', JSON.stringify(logData));
  }
  
  try {
    const response = await axios({
      url: `https://api.pinterest.com/v5${endpoint}`,
      method: method || 'GET',
      data: data,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    });
    console.log(`Pinterest Proxy Success: ${endpoint}`);
    res.json(response.data);
  } catch (error: any) {
    const errorData = error.response?.data;
    const status = error.response?.status || 500;
    
    console.error('--- PINTEREST PROXY ERROR ---');
    console.error(`Status: ${status}`);
    console.error(`Endpoint: ${endpoint}`);
    console.error(`Error Data:`, JSON.stringify(errorData, null, 2));
    console.error(`Message: ${error.message}`);
    console.error('-----------------------------');
    
    // Extract the most useful message
    let message = 'Internal Server Error';
    if (errorData) {
      message = errorData.message || (errorData.errors && errorData.errors[0]?.message) || JSON.stringify(errorData);
    } else {
      message = error.message;
    }
    
    res.status(status).json({ 
      message, 
      details: errorData 
    });
  }
});

// Vite middleware for development
if (process.env.NODE_ENV !== 'production') {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.join(__dirname, 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
