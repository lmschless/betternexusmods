#!/bin/bash
# Script to package Chrome extension for Web Store
# Usage: ./package-extension.sh

set -e

EXT_NAME="betternexusmods"
PACKAGE_DIR="${EXT_NAME}-package"
VERSIONS_DIR="versions"
# ZIP_NAME will be defined after the version is read from manifest.json

# Read and increment version from manifest.json
MANIFEST_FILE="manifest.json"

if ! command -v jq &> /dev/null
then
    echo "jq could not be found. Please install jq to use this script."
    echo "On macOS, you can install it with: brew install jq"
    exit 1
fi

if [ ! -f "$MANIFEST_FILE" ]; then
    echo "Error: $MANIFEST_FILE not found!"
    exit 1
fi

CURRENT_VERSION=$(jq -r '.version' "$MANIFEST_FILE")
if [ -z "$CURRENT_VERSION" ] || [ "$CURRENT_VERSION" == "null" ]; then
    echo "Error: Could not read version from $MANIFEST_FILE"
    exit 1
fi

IFS='.' read -r major minor patch <<< "$CURRENT_VERSION"

# Increment patch version
new_patch=$((patch + 1))
NEW_VERSION="${major}.${minor}.${new_patch}"

# Update manifest.json with the new version
# Create a temporary file for jq output to avoid issues with in-place editing on some systems
tmp_manifest=$(mktemp)
jq --arg new_version "$NEW_VERSION" '.version = $new_version' "$MANIFEST_FILE" > "$tmp_manifest" && mv "$tmp_manifest" "$MANIFEST_FILE"

echo "Updated version in $MANIFEST_FILE to $NEW_VERSION"

ZIP_NAME="${EXT_NAME}-v${NEW_VERSION}.zip"

# Clean up any previous package, old unversioned zip, and ensure versions directory exists
rm -rf "$PACKAGE_DIR"
rm -f "${EXT_NAME}.zip" # Remove old unversioned zip from root, if it exists
mkdir -p "$VERSIONS_DIR" # Ensure versions directory exists
rm -f "${VERSIONS_DIR}/${ZIP_NAME}" # Remove new versioned zip from versions/ if it exists from a previous run

# Create package directory
mkdir "$PACKAGE_DIR"

# Copy extension files (excluding .git, .DS_Store, and this script)
shopt -s extglob
cp -r !(package-extension.sh|.git|.gitignore|.DS_Store|${PACKAGE_DIR}|${ZIP_NAME}) "$PACKAGE_DIR"/

# Remove any .DS_Store files from package
find "$PACKAGE_DIR" -name '.DS_Store' -type f -delete

# Zip the package into the versions directory
cd "$PACKAGE_DIR"
zip -r "../${VERSIONS_DIR}/${ZIP_NAME}" .
cd ..

# Cleanup package directory
rm -rf "$PACKAGE_DIR"

echo "✅ Extension packaged as ${VERSIONS_DIR}/${ZIP_NAME}. Upload this zip to the Chrome Web Store."
