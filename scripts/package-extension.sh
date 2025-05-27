#!/bin/bash
# Script to package Chrome extension for Web Store
# Usage: ./package-extension.sh

set -e

EXT_NAME="betternexusmods"
PACKAGE_DIR="${EXT_NAME}-package"
VERSIONS_DIR="dist" # Changed from versions to dist
# ZIP_NAME will be defined after the version is read from manifest.json

# Read and increment version from manifest.json
MANIFEST_FILE="src/manifest.json" # Path updated to src/

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
# Ensure paths are correct for jq operation relative to script execution (project root)
tmp_manifest=$(mktemp)
jq --arg new_version "$NEW_VERSION" '.version = $new_version' "$MANIFEST_FILE" > "$tmp_manifest" && mv "$tmp_manifest" "$MANIFEST_FILE"

echo "Updated version in $MANIFEST_FILE to $NEW_VERSION"

ZIP_NAME="${EXT_NAME}-v${NEW_VERSION}.zip"

# Clean up any previous package, old unversioned zip, and ensure dist directory exists
rm -rf "$PACKAGE_DIR" # This temporary package dir is no longer strictly needed if zipping directly from src
rm -f "${EXT_NAME}.zip" # Remove old unversioned zip from root, if it exists
mkdir -p "$VERSIONS_DIR" # Ensure dist directory exists (VERSIONS_DIR is now 'dist')

# Create the zip file directly from the src directory
# The 'cd src' ensures paths in the zip are relative to src/
# Output path for zip is adjusted to be ../dist/
(cd src && zip -r "../$VERSIONS_DIR/$ZIP_NAME" . -x ".*" -x "__MACOSX" -x "*.DS_Store")

# Note: The explicit cp to PACKAGE_DIR and zipping from there has been removed.
# We now zip directly from the 'src' directory to ensure correct paths within the archive.
# Exclusions within the zip command should target files relative to the 'src' directory if needed.

echo "✅ Extension packaged as ${VERSIONS_DIR}/${ZIP_NAME}. Upload this zip to the Chrome Web Store."
