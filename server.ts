import express from 'express';
import { createServer as createViteServer } from 'vite';
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import admin from 'firebase-admin';
import firebaseConfig from './firebase-applet-config.json' assert { type: 'json' };

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
admin.initializeApp({
  projectId: firebaseConfig.projectId,
});

const app = express();
app.set('trust proxy', 1);
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(cookieParser());

// Auth Middleware (Disabled for no-auth mode)
const requireAuth = async (req: any, res: any, next: any) => {
  // In no-auth mode, we bypass token verification
  req.user = { uid: 'default-user', email: 'admin@pingenius.ai' };
  next();
};

// Pinterest OAuth Config
const PINTEREST_CLIENT_ID = process.env.PINTEREST_APP_ID || '1550825';
const PINTEREST_CLIENT_SECRET = process.env.PINTEREST_APP_SECRET || '9586e373e34a3bbcf4d873c348b0eb13a701bf4b';

const getRedirectUri = (req: express.Request) => {
  if (process.env.APP_URL) {
    return `${process.env.APP_URL}/auth/pinterest/callback`;
  }
  const host = req.headers.host || '';
  const protocol = req.headers['x-forwarded-proto'] || (host.includes('localhost') ? 'http' : 'https');
  return `${protocol}://${host}/auth/pinterest/callback`;
};

// 1. Get OAuth URL
app.get('/api/auth/pinterest/url', (req, res) => {
  const redirectUri = getRedirectUri(req);
  const scopes = 'boards:read,boards:write,pins:read,pins:write,user_accounts:read';
  const authUrl = `https://www.pinterest.com/oauth/?client_id=${PINTEREST_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scopes}`;
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
              if (window.opener) {
                window.opener.postMessage({ type: 'PINTEREST_AUTH_SUCCESS', data: userData }, '*');
              }
              authChannel.postMessage({ type: 'PINTEREST_AUTH_SUCCESS', data: userData });
              
              document.getElementById('status-icon').style.display = 'none';
              document.getElementById('status-text').innerText = 'Connected!';
              document.getElementById('sub-text').innerText = 'You can close this window now.';
              setTimeout(() => window.close(), 1000);
            }
            notifyApp();
            document.getElementById('close-btn').style.display = 'inline-block';
            document.getElementById('status-text').innerText = 'Connection Ready';
            document.getElementById('sub-text').innerText = 'Please return to the app.';
          </script>
        </body>
      </html>
    `);
  } catch (error: any) {
    const errorDetail = error.response?.data?.message || error.message;
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

// 3. Pinterest API Proxy
app.get('/api/pinterest/config', requireAuth, (req, res) => {
  res.json({
    useSandbox: process.env.PINTEREST_USE_SANDBOX === 'true'
  });
});

app.post('/api/pinterest/proxy', requireAuth, async (req, res) => {
  const { endpoint, method, data, token } = req.body;
  
  console.log(`[Pinterest Proxy] ${method || 'GET'} ${endpoint}`);

  if (method === 'POST') {
    if (data?.media_source?.source_type === 'image_base64' && typeof data.media_source.data === 'string') {
      // Clean base64 string
      data.media_source.data = data.media_source.data.replace(/[^a-zA-Z0-9+/=]/g, '');
    }
  }
  
  const useSandbox = process.env.PINTEREST_USE_SANDBOX === 'true';
  const baseUrl = useSandbox ? 'https://api-sandbox.pinterest.com/v5' : 'https://api.pinterest.com/v5';
  
  console.log(`[Pinterest Proxy] Using Base URL: ${baseUrl}`);

  if (data?.media_source?.data) {
    console.log(`[Pinterest Proxy] Payload size: ${Math.round(JSON.stringify(data).length / 1024)} KB`);
  }
  
  try {
    const response = await axios({
      url: `${baseUrl}${endpoint}`,
      method: method || 'GET',
      data: data,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'PinGenius/2.0 (https://pingenius.ai)',
        'Accept': 'application/json',
      },
      timeout: 60000, // 60 seconds timeout
    });
    res.json(response.data);
  } catch (error: any) {
    const status = error.response?.status || 500;
    const errorData = error.response?.data;
    
    let message = 'An error occurred while communicating with Pinterest.';
    
    if (status === 503) {
      message = 'Pinterest service is temporarily unavailable. Please try again in a few moments.';
    } else if (status === 403) {
      if (typeof errorData === 'object') {
        if (errorData?.message?.includes('Trial access')) {
          message = 'Your Pinterest App is in "Trial" mode and cannot publish to production. Please set PINTEREST_USE_SANDBOX=true in your environment variables to use the API Sandbox.';
        } else if (errorData?.message?.includes('scope')) {
          message = 'Insufficient permissions (Scope Error). Your Pinterest app may not have "pins:write" or "boards:read" permissions approved.';
        } else {
          message = errorData.message || (errorData.errors && errorData.errors[0]?.message) || 'Access Forbidden (403). Ensure your Pinterest account is added as a "Sandbox User" in the developer portal.';
        }
      } else if (typeof errorData === 'string' && errorData.includes('<html>')) {
        message = 'Pinterest returned a Forbidden (403) HTML error. This often happens if the request is blocked by a security filter or if the API token is invalid for this environment.';
      }
    } else if (errorData) {
      message = errorData.message || (errorData.errors && errorData.errors[0]?.message) || error.message;
    } else {
      message = error.message;
    }

    console.error(`Pinterest Proxy Error [${status}]:`, message);
    res.status(status).json({ message, details: errorData });
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
