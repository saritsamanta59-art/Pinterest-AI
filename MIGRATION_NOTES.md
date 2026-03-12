# Authentication Migration to Supabase

## What Changed

The application has been migrated from a file-based authentication system (users.json) to a robust Supabase database backend.

## Database Schema

### Tables Created

1. **users**
   - `id` (uuid, primary key)
   - `name` (text)
   - `email` (text, unique)
   - `password` (text, hashed with bcrypt)
   - `gemini_api_key` (text, nullable)
   - `created_at` (timestamptz)
   - `updated_at` (timestamptz)

2. **pinterest_accounts**
   - `id` (uuid, primary key)
   - `user_id` (uuid, foreign key to users)
   - `access_token` (text)
   - `username` (text)
   - `profile_image` (text, nullable)
   - `boards` (jsonb)
   - `created_at` (timestamptz)
   - `updated_at` (timestamptz)

### Security

- Row Level Security (RLS) enabled on both tables
- Users can only access their own data
- Public signup allowed (INSERT only on users table)
- All other operations require authentication

## Files Modified

1. **server.ts**
   - Replaced file-based storage with Supabase queries
   - Added Supabase client initialization
   - Updated all auth routes to use database
   - Added error handling for database operations

2. **components/AuthContext.tsx**
   - Added data transformation for Pinterest accounts
   - Handles snake_case to camelCase conversion
   - Ensures compatibility with existing frontend code

3. **.env**
   - Added Supabase credentials
   - Kept existing Pinterest OAuth config

4. **package.json**
   - Added @supabase/supabase-js dependency

## Environment Variables Required

```
SUPABASE_URL=your-supabase-project-url
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Benefits

1. Production-ready database solution
2. Better security with Row Level Security
3. Scalable architecture
4. No more file system dependencies
5. Works reliably in cloud deployments
6. Automatic backups and replication

## Testing

To test the migration:

1. Clear browser storage/cookies
2. Sign up with a new account
3. Verify user is created in Supabase dashboard
4. Connect Pinterest account
5. Verify pinterest_accounts table is populated

## Rollback

If needed, the old users.json system can be restored by reverting the server.ts changes. However, the Supabase approach is recommended for production use.
