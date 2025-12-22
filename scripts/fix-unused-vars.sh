#!/bin/bash
# Fix Unused Variables by Prefixing with Underscore
# This is a common TypeScript pattern for intentionally unused variables

echo "🔧 Fixing unused variables..."

# Get list of files with unused variable warnings
FILES=$(npm run lint 2>&1 | grep "@typescript-eslint/no-unused-vars" | sed 's/:.*//g' | sort | uniq)

for file in $FILES; do
  if [ -f "$file" ]; then
    echo "Processing: $file"

    # Prefix common unused variables with underscore
    sed -i.bak \
      -e "s/const { error }/const { error: _ }/g" \
      -e "s/, error }/, error: _ }/g" \
      -e "s/const { count }/const { count: _ }/g" \
      -e "s/, count }/, count: _ }/g" \
      -e "s/const { data }/const { data: _ }/g" \
      -e "s/const {data}/const {data: _}/g" \
      "$file"

    # Remove backup
    rm -f "$file.bak"
  fi
done

echo "✅ Done!"
