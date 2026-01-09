# Deployment Configuration

This document explains how to configure the base path for different deployment scenarios.

## Overview

The app uses the `PUBLIC_URL` environment variable to configure the base path for web deployments. This allows deploying to:
- GitHub Pages subdirectories
- Custom domains
- Different hosting providers with custom paths

## Configuration Files

### 1. **src/config.js**
- Reads `process.env.PUBLIC_URL` at build time
- Falls back to `/tidal/` if not set
- Used by asset loader (`getAssetSource()`) to construct correct asset paths

### 2. **craco.config.js**
- Create React App (CRA) automatically respects `PUBLIC_URL`
- Sets correct base path in generated `index.html`
- Configures webpack public path

### 3. **.github/workflows/deploy-sing2midi.yml**
- Sets `PUBLIC_URL` environment variable during build
- Configured for GitHub Pages at `/tidal/` by default

## Deployment Scenarios

### GitHub Pages (Current Setup)

**URL**: `https://dioptre.github.io/tidal/`

```bash
PUBLIC_URL=/tidal/ npm run build
```

The workflow is already configured with this default.

### Custom Domain (Root Path)

**URL**: `https://yourdomain.com/`

Update the workflow:
```yaml
- name: Build
  env:
    PUBLIC_URL: /
  run: npm run build
```

Or build locally:
```bash
PUBLIC_URL=/ npm run build
```

### Different Subdirectory

**URL**: `https://yourdomain.com/my-app/`

Update the workflow:
```yaml
- name: Build
  env:
    PUBLIC_URL: /my-app/
  run: npm run build
```

Or build locally:
```bash
PUBLIC_URL=/my-app/ npm run build
```

## Local Development

For local development, the app works at `http://localhost:3000/tidal/`:

```bash
npm run dev
# Visit: http://localhost:3000/tidal/
```

To test with a different base path:
```bash
PUBLIC_URL=/my-path/ npm run dev
```

## Asset Paths

### Web Assets
Located in `public/assets/img/`:
- `mic-vocal.png` - Voice mode icon
- `list-music.png` - List icon
- `keyboard-music.png` - MIDI icon
- `guitar.png` - Guitar icon
- `strudel-icon.png` - Strudel logo
- `tidal-logo.svg` - TidalCycles logo

**Web path**: `${PUBLIC_URL}assets/img/filename.png`

### Native Assets (iOS/Android)
Same files are bundled via Metro using `require()`:
- Located in `public/assets/img/`
- Automatically bundled into the native app
- No path configuration needed

## Build Output

- **Directory**: `build/` (via craco/CRA)
- **GitHub Actions**: Uploads `./sing2midi/build`
- Assets are copied with correct base path prefix

## Testing a Build Locally

After building, you can test with a local server:

```bash
# Build with specific PUBLIC_URL
PUBLIC_URL=/tidal/ npm run build

# Serve the build folder
npx serve -s build -l 3000

# Visit: http://localhost:3000/tidal/
```

## Troubleshooting

### Assets not loading
- Check browser network tab for 404s
- Verify `PUBLIC_URL` matches your deployment path
- Ensure trailing slash in `PUBLIC_URL` (e.g., `/tidal/` not `/tidal`)

### Wrong base path in URLs
- Clear build folder: `rm -rf build`
- Rebuild with correct `PUBLIC_URL`
- Check `config.js` is using `process.env.PUBLIC_URL`

### iOS app broken after changes
- Native app ignores `PUBLIC_URL`
- Assets are loaded via `require()` in `config.js`
- Test iOS build: `npm run ios`
