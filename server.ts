import express from 'express';
import { createServer as createViteServer } from 'vite';
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import fs from 'fs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(cookieParser());
app.use(session({
  secret: 'pingenius-secret-key-123',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  }
}));

// Mock Database
const USERS_FILE = path.join(__dirname, 'users.json');
const getUsers = () => {
  if (!fs.existsSync(USERS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
  } catch (e) {
    return [];
  }
};
const saveUsers = (users: any[]) => {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
};

// Auth Middleware
const requireAuth = (req: any, res: any, next: any) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  next();
};

// Auth Routes
app.post('/api/auth/signup', async (req, res) => {
  const { name, email, password } = req.body;
  const users = getUsers();
  if (users.find((u: any) => u.email === email)) {
    return res.status(400).json({ message: 'User already exists' });
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = {
    id: Math.random().toString(36).substr(2, 9),
    name,
    email,
    password: hashedPassword,
    geminiApiKey: '',
    pinterestAccounts: []
  };
  users.push(newUser);
  saveUsers(users);
  (req.session as any).userId = newUser.id;
  const { password: _, ...userWithoutPassword } = newUser;
  res.json({ user: userWithoutPassword });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const users = getUsers();
  const user = users.find((u: any) => u.email === email);
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(400).json({ message: 'Invalid credentials' });
  }
  (req.session as any).userId = user.id;
  const { password: _, ...userWithoutPassword } = user;
  res.json({ user: userWithoutPassword });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ message: 'Logged out' });
  });
});

app.get('/api/auth/me', (req, res) => {
  if (!(req.session as any).userId) return res.status(401).json({ message: 'Not logged in' });
  const users = getUsers();
  const user = users.find((u: any) => u.id === (req.session as any).userId);
  if (!user) return res.status(401).json({ message: 'User not found' });
  const { password: _, ...userWithoutPassword } = user;
  res.json({ user: userWithoutPassword });
});

app.put('/api/user/profile', requireAuth, async (req, res) => {
  const { name, email, geminiApiKey, pinterestAccounts } = req.body;
  const users = getUsers();
  const index = users.findIndex((u: any) => u.id === (req.session as any).userId);
  if (index === -1) return res.status(404).json({ message: 'User not found' });
  
  users[index] = { 
    ...users[index], 
    name: name || users[index].name, 
    email: email || users[index].email, 
    geminiApiKey: geminiApiKey !== undefined ? geminiApiKey : users[index].geminiApiKey,
    pinterestAccounts: pinterestAccounts !== undefined ? pinterestAccounts : users[index].pinterestAccounts
  };
  saveUsers(users);
  
  const { password: _, ...userWithoutPassword } = users[index];
  res.json({ user: userWithoutPassword });
});

app.delete('/api/user/account', requireAuth, async (req, res) => {
  const users = getUsers();
  const index = users.findIndex((u: any) => u.id === (req.session as any).userId);
  if (index === -1) return res.status(404).json({ message: 'User not found' });
  
  users.splice(index, 1);
  saveUsers(users);
  
  req.session.destroy(() => {
    res.json({ message: 'Account deleted' });
  });
});

app.post('/api/user/pinterest-accounts', requireAuth, async (req, res) => {
  const { account } = req.body;
  if (!account) return res.status(400).json({ message: 'Account data required' });

  const users = getUsers();
  const index = users.findIndex((u: any) => u.id === (req.session as any).userId);
  if (index === -1) return res.status(404).json({ message: 'User not found' });

  const currentAccounts = users[index].pinterestAccounts || [];
  const existingIndex = currentAccounts.findIndex((a: any) => a.username === account.username);
  
  if (existingIndex > -1) {
    currentAccounts[existingIndex] = account;
  } else {
    currentAccounts.push(account);
  }

  users[index].pinterestAccounts = currentAccounts;
  saveUsers(users);

  res.json({ message: 'Account saved', accounts: currentAccounts });
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
