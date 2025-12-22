#!/bin/bash

# Script to apply Phase 9 permission fix migration
# This fixes the issue where old permissions were removed but new ones weren't added

set -e

echo "==================================================================="
echo "Phase 9 RBAC Fix - Apply Missing Permissions"
echo "==================================================================="
echo ""
echo "This script will apply the corrective migration to add missing"
echo "consolidated permissions to your roles."
echo ""
echo "Migration file: supabase/migrations/20250121_phase9_fix_missing_permissions.sql"
echo ""

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "ERROR: Supabase CLI is not installed."
    echo "Install it with: npm install -g supabase"
    exit 1
fi

# Check if we're in the project root
if [ ! -f "supabase/migrations/20250121_phase9_fix_missing_permissions.sql" ]; then
    echo "ERROR: Migration file not found."
    echo "Please run this script from the project root directory."
    exit 1
fi

echo "Applying migration..."
echo ""

# Apply the migration
supabase db push

echo ""
echo "==================================================================="
echo "Migration applied successfully!"
echo "==================================================================="
echo ""
echo "Next steps:"
echo "1. Verify Superadmin has all permissions:"
echo "   Run: npm run debug:permissions"
echo ""
echo "2. Test permission checks in the application:"
echo "   - Try creating/editing roles"
echo "   - Try managing account users"
echo "   - Try viewing analytics"
echo ""
echo "3. Check the database directly (optional):"
echo "   Open Supabase Dashboard > SQL Editor and run:"
echo "   SELECT name, permissions FROM roles WHERE name = 'Superadmin';"
echo ""
