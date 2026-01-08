# Voice Composer - Development Setup

## Quick Reference

```bash
# Use correct Node version
nvm use

# Install dependencies
npm install

# iOS development
npm run pod-install       # Install CocoaPods dependencies
npm run xcode             # Open in Xcode
npm start                 # Start Metro bundler (separate terminal)
npm run ios               # Build and run on simulator

# Web development
npm run dev               # Start Vite dev server → http://localhost:5176/tidal/

# Cleanup commands
npm run ios:clean         # Clean Xcode build artifacts
npm run pod-clean         # Reinstall all CocoaPods dependencies
```

## Initial Setup

### 1. Node.js via NVM

```bash
# Install Node 20.19.4+ (or use current .nvmrc version)
nvm install 20.19.4
nvm use 20.19.4

# Verify
node --version  # Should be 20.19.4 or higher
```

### 2. iOS Development Tools

```bash
# Install Xcode from App Store (required)
# Install Xcode Command Line Tools
xcode-select --install

# Install CocoaPods
sudo gem install cocoapods

# Verify
pod --version
```

### 3. Project Dependencies

```bash
# Install npm packages
npm install

# Install iOS native dependencies
npm run pod-install
```

## Development Workflows

### iOS Development (Recommended: Use Xcode)

```bash
# Terminal 1: Start Metro bundler
npm start

# Terminal 2: Open Xcode
npm run xcode

# In Xcode:
# 1. Select simulator (e.g., iPhone 16 Pro)
# 2. Press ⌘R to build and run
```

### iOS Development (CLI)

```bash
# Terminal 1: Start Metro bundler
npm start

# Terminal 2: Build and run
npm run ios                              # Default simulator
npm run ios:simulator                    # iPhone 16 Pro
npm run ios:device                       # Physical device
```

### Web Development

```bash
npm run dev

# Visit: http://localhost:5176/tidal/
```

## Troubleshooting

### Metro Bundler Connection Error

```bash
# Make sure Metro is running
npm start

# In Xcode, rebuild: ⌘⇧K (clean) then ⌘R (run)
```

### CocoaPods Issues

```bash
# Reinstall all pods
npm run pod-clean

# Update pods
npm run pod-update
```

### Xcode Build Errors

```bash
# Clean build artifacts
npm run ios:clean

# Clean Xcode (in Xcode): ⌘⇧K
# Then rebuild: ⌘R
```

### Node Version Mismatch

```bash
# Use the correct Node version
nvm use

# Or install the required version
nvm install 20.19.4
nvm use 20.19.4
```

### "Cannot find module" Errors

```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
npm run pod-install
```

## Project Structure

```
sing2midi/
├── src/                    # React components and logic
│   ├── components/        # UI components
│   │   ├── NoteVisualizer.jsx  # Piano roll (web: canvas, iOS: react-native-canvas)
│   │   └── ...
│   ├── config.js          # Platform-specific configuration
│   └── App.jsx            # Main app component
├── ios/                   # iOS native project
│   ├── sing2midi.xcworkspace  # Open this in Xcode (NOT .xcodeproj)
│   ├── Podfile            # CocoaPods dependencies
│   ├── .xcode.env.local   # Local Xcode environment (gitignored)
│   └── sing2midi/         # iOS app files
├── public/                # Web static assets
├── index.js               # React Native entry point
├── index.html             # Web entry point
├── vite.config.js         # Web build configuration
├── metro.config.js        # React Native bundler config
├── babel.config.js        # Babel configuration
└── package.json           # Dependencies and scripts
```

## Important Files

### Configuration Files
- **`.nvmrc`** - Node version specification
- **`ios/.xcode.env.local`** - Local Xcode environment (gitignored, contains node path)
- **`ios/Podfile`** - CocoaPods dependencies
- **`metro.config.js`** - React Native Metro bundler configuration
- **`vite.config.js`** - Web build configuration

### Platform-Specific Code
- **`src/config.js`** - Platform detection and base path configuration
- **`src/components/NoteVisualizer.jsx`** - Uses `Platform.OS` checks for canvas rendering

## App Information

- **App Name (User-Facing)**: Voice Composer
- **Code Name**: sing2midi
- **Bundle ID**: io.sfpl.sing2midi
- **Platforms**: iOS, Web (GitHub Pages)

## Deployment

### Web (GitHub Pages)

```bash
npm run build

# Built files are in dist/
# Deploy to GitHub Pages at /tidal/ path
```

### iOS (App Store)

1. Open in Xcode: `npm run xcode`
2. Select "Any iOS Device" as target
3. Product > Archive
4. Follow App Store submission process

## npm Scripts Reference

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Vite dev server for web |
| `npm run build` | Build web version for production |
| `npm start` | Start Metro bundler for React Native |
| `npm run ios` | Build and run on iOS simulator |
| `npm run ios:simulator` | Run on specific simulator (iPhone 16 Pro) |
| `npm run ios:device` | Run on connected physical device |
| `npm run ios:clean` | Clean iOS build artifacts |
| `npm run pod-install` | Install CocoaPods dependencies |
| `npm run pod-update` | Update CocoaPods dependencies |
| `npm run pod-clean` | Clean reinstall all pods |
| `npm run xcode` | Open Xcode workspace |
| `npm test` | Run Playwright tests |

## Environment Variables

None currently required. All configuration is in code or config files.

## Known Issues

- **Node Version**: React Native 0.83.1 requires Node >= 20.19.4, but works with 20.15.0 (with warnings)
- **Audio Recording**: Not yet implemented on iOS (works on web)
- **ML Inference**: Not yet implemented on iOS (works on web via TensorFlow.js)

See `REACT_NATIVE_MIGRATION.md` for details on pending iOS features.
