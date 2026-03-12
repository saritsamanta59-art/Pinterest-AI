/*
  # Create Users and Pinterest Accounts Tables

  1. New Tables
    - `users`
      - `id` (uuid, primary key) - Unique user identifier
      - `name` (text) - User's full name
      - `email` (text, unique) - User's email address
      - `password` (text) - Hashed password
      - `gemini_api_key` (text, nullable) - User's Gemini API key (encrypted)
      - `created_at` (timestamptz) - Account creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp
    
    - `pinterest_accounts`
      - `id` (uuid, primary key) - Unique account identifier
      - `user_id` (uuid, foreign key) - Reference to users table
      - `access_token` (text) - Pinterest OAuth access token (encrypted)
      - `username` (text) - Pinterest username
      - `profile_image` (text, nullable) - Pinterest profile image URL
      - `boards` (jsonb, nullable) - Cached board data
      - `created_at` (timestamptz) - Connection timestamp
      - `updated_at` (timestamptz) - Last update timestamp

  2. Security
    - Enable RLS on both tables
    - Users can only access their own data
    - Users can only access Pinterest accounts linked to their user ID
    - All policies check authentication and ownership
*/

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  password text NOT NULL,
  gemini_api_key text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create pinterest_accounts table
CREATE TABLE IF NOT EXISTS pinterest_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  username text NOT NULL,
  profile_image text,
  boards jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, username)
);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE pinterest_accounts ENABLE ROW LEVEL SECURITY;

-- Users table policies
CREATE POLICY "Users can read own data"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own data"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Pinterest accounts policies
CREATE POLICY "Users can read own pinterest accounts"
  ON pinterest_accounts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = pinterest_accounts.user_id
      AND auth.uid() = users.id
    )
  );

CREATE POLICY "Users can insert own pinterest accounts"
  ON pinterest_accounts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = pinterest_accounts.user_id
      AND auth.uid() = users.id
    )
  );

CREATE POLICY "Users can update own pinterest accounts"
  ON pinterest_accounts
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = pinterest_accounts.user_id
      AND auth.uid() = users.id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = pinterest_accounts.user_id
      AND auth.uid() = users.id
    )
  );

CREATE POLICY "Users can delete own pinterest accounts"
  ON pinterest_accounts
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = pinterest_accounts.user_id
      AND auth.uid() = users.id
    )
  );

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_pinterest_accounts_user_id ON pinterest_accounts(user_id);