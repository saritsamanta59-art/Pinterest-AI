<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# PinGenius AI - Pinterest Pin Creator

Create viral Pinterest pins with AI-generated text and images using Gemini.

## Features

- AI-powered pin content generation with Gemini
- Pinterest OAuth integration for direct publishing
- Real-time pin preview with customization options
- User authentication with Supabase
- Schedule pins for future publishing

## Prerequisites

- Node.js 18+
- Supabase account
- Pinterest Developer account
- Gemini API key

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and configure:
   ```bash
   cp .env.example .env
   ```

3. Update `.env` with your credentials:
   ```
   SUPABASE_URL=your-supabase-url
   SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   PINTEREST_APP_ID=your-pinterest-app-id
   PINTEREST_APP_SECRET=your-pinterest-app-secret
   APP_URL=your-app-url
   ```

4. Run database migrations:
   - Tables are automatically created via Supabase migrations
   - Tables: `users`, `pinterest_accounts`

5. Run the app:
   ```bash
   npm run dev
   ```

## Deployment

Build for production:
```bash
npm run build
```

The app uses Supabase for database and authentication, ensuring reliable operation in production environments.
