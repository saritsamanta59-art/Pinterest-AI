/*
  # Allow Public User Signup

  1. Changes
    - Add policy to allow anyone to insert new users during signup
    - This is required because signup happens before authentication

  2. Security
    - Only INSERT is allowed publicly
    - All other operations (SELECT, UPDATE, DELETE) remain restricted to authenticated users
    - This is a standard pattern for user registration systems
*/

-- Allow public user registration (insert only)
CREATE POLICY "Anyone can create an account"
  ON users
  FOR INSERT
  TO anon
  WITH CHECK (true);