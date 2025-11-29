#!/bin/bash
# Bulk fix: Add authenticated supabase client to all hasPermission calls in API routes

echo "Fixing hasPermission calls in API routes..."
echo ""

fixed_files=0

# Find all TypeScript files in app/api
find app/api -name "*.ts" -type f | while read -r file; do
  # Check if file contains hasPermission calls without supabase parameter
  if grep -q "hasPermission(" "$file"; then
    # Create backup
    cp "$file" "$file.backup"

    # Pattern 1: hasPermission(userProfile, Permission.XXX) → hasPermission(userProfile, Permission.XXX, undefined, supabase)
    # Pattern 2: hasPermission(userProfile, Permission.XXX, { ... }) → hasPermission(userProfile, Permission.XXX, { ... }, supabase)
    # Pattern 3: hasPermission(userProfile, Permission.XXX, undefined) → hasPermission(userProfile, Permission.XXX, undefined, supabase)

    # Use perl for multi-line regex (sed has limitations)
    perl -i -pe 's/hasPermission\(([^,]+),\s*(Permission\.[A-Z_]+)\s*\)/hasPermission($1, $2, undefined, supabase)/g' "$file"
    perl -i -pe 's/hasPermission\(([^,]+),\s*(Permission\.[A-Z_]+),\s*(\{[^}]+\})\s*\)(?!\s*,\s*supabase)/hasPermission($1, $2, $3, supabase)/g' "$file"
    perl -i -pe 's/hasPermission\(([^,]+),\s*(Permission\.[A-Z_]+),\s*undefined\s*\)(?!\s*,\s*supabase)/hasPermission($1, $2, undefined, supabase)/g' "$file"

    # Check if file was modified
    if ! diff -q "$file" "$file.backup" > /dev/null 2>&1; then
      echo "✓ Fixed: $file"
      ((fixed_files++))
    fi

    # Remove backup
    rm "$file.backup"
  fi
done

echo ""
echo "========================================================"
echo "SUMMARY:"
echo "Files modified: $fixed_files"
echo "========================================================"
echo ""
echo "Next steps:"
echo "1. Review changes: git diff app/api"
echo "2. Test API routes"
echo "3. Commit if satisfied"
