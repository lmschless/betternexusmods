#!/bin/bash
# Script to package Chrome extension for Web Store
# Usage: ./package-extension.sh

set -e

EXT_NAME="betternexusmods"
PACKAGE_DIR="${EXT_NAME}-package"
ZIP_NAME="${EXT_NAME}.zip"

# Clean up any previous package
rm -rf "$PACKAGE_DIR" "$ZIP_NAME"

# Create package directory
mkdir "$PACKAGE_DIR"

# Copy extension files (excluding .git, .DS_Store, and this script)
shopt -s extglob
cp -r !(package-extension.sh|.git|.gitignore|.DS_Store|${PACKAGE_DIR}|${ZIP_NAME}) "$PACKAGE_DIR"/

# Remove any .DS_Store files from package
find "$PACKAGE_DIR" -name '.DS_Store' -type f -delete

# Zip the package
cd "$PACKAGE_DIR"
zip -r "../$ZIP_NAME" .
cd ..

# Cleanup
rm -rf "$PACKAGE_DIR"

echo "✅ Extension packaged as $ZIP_NAME. Upload this zip to the Chrome Web Store."
