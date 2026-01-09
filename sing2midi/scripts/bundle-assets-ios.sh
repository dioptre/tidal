#!/bin/bash

# Bundle assets for iOS to avoid slow network downloads on boot
# This script downloads the Basic Pitch ONNX model and Skia WASM files
# and bundles them into the iOS app

set -e

echo "📦 Bundling assets for iOS..."

# Create assets directory in iOS project
ASSETS_DIR="ios/sing2midi/Assets"
mkdir -p "$ASSETS_DIR"

# 1. Download Basic Pitch model files
echo ""
echo "1️⃣  Downloading Basic Pitch ONNX model..."
MODEL_DIR="$ASSETS_DIR/basic-pitch-model"
mkdir -p "$MODEL_DIR"

# Download model.json
echo "   Downloading model.json..."
curl -L "https://cdn.jsdelivr.net/npm/@spotify/basic-pitch@1.0.1/model/model.json" \
  -o "$MODEL_DIR/model.json" \
  --progress-bar

# Parse model.json to get the weight file names
echo "   Parsing model.json for weight files..."
WEIGHT_FILES=$(node -e "
  const fs = require('fs');
  const model = JSON.parse(fs.readFileSync('$MODEL_DIR/model.json', 'utf8'));
  const weights = model.weightsManifest[0].paths;
  console.log(weights.join(' '));
")

# Download weight files
for file in $WEIGHT_FILES; do
  echo "   Downloading $file..."
  curl -L "https://cdn.jsdelivr.net/npm/@spotify/basic-pitch@1.0.1/model/$file" \
    -o "$MODEL_DIR/$file" \
    --progress-bar
done

echo "   ✅ Basic Pitch model downloaded"

# 2. Check Skia files (they should already be in node_modules)
echo ""
echo "2️⃣  Checking Skia WASM files..."
SKIA_SOURCE="node_modules/@shopify/react-native-skia/libs/ios"
SKIA_DEST="$ASSETS_DIR/skia"

if [ -d "$SKIA_SOURCE" ]; then
  echo "   Skia iOS binaries found in node_modules"
  echo "   ℹ️  Skia will be bundled via CocoaPods automatically"
else
  echo "   ⚠️  Skia source not found at $SKIA_SOURCE"
  echo "   Run 'npm install' first"
fi

# 3. Summary
echo ""
echo "📊 Bundle Summary:"
echo "   Model files: $MODEL_DIR/"
ls -lh "$MODEL_DIR" | tail -n +2 | awk '{print "     -", $9, "(" $5 ")"}'

TOTAL_SIZE=$(du -sh "$MODEL_DIR" | awk '{print $1}')
echo ""
echo "   Total bundled size: $TOTAL_SIZE"

# 4. Instructions
echo ""
echo "✅ Assets bundled successfully!"
echo ""
echo "Next steps:"
echo "  1. Add Assets folder to Xcode:"
echo "     - Open ios/sing2midi.xcworkspace in Xcode"
echo "     - Drag ios/sing2midi/Assets folder into the project"
echo "     - Make sure 'Copy items if needed' is checked"
echo "     - Select 'Create folder references' (blue folder, not yellow)"
echo "     - Add to target: sing2midi"
echo ""
echo "  2. Update PitchDetector.jsx to use bundled model (see comments in file)"
echo ""
echo "  3. Build for iOS:"
echo "     npm run ios"
echo ""
