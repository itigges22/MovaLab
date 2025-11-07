-- Check actual user permissions state
SELECT 
  id, 
  email, 
  name, 
  is_superadmin 
FROM user_profiles 
WHERE email IN ('jitigges@vt.edu', 'itigges22@gmail.com')
ORDER BY email;
