# Microsoft Rewards Script - Enhanced

This project is an enhanced version of [TheNetsky's Microsoft Rewards Script](https://github.com/TheNetsky/Microsoft-Rewards-Script) that automates the collection of Microsoft Rewards points.

## Overview of Improvements

The original script encountered issues following changes to Microsoft's authentication interface and new cookie banners. These modifications caused:
1. Blank pages during login
2. Failed email address entry in desktop mode
3. Multiple browser windows opening simultaneously
4. Cookie banners blocking interactions

These fixes address these issues while maintaining compatibility with the original codebase.

## Features

- **Full Automation**: Automatically collects Microsoft Rewards points
- **Mobile and Desktop Compatible**: Emulates both device types to maximize points
- **Smart Cookie Management**: Automatically rejects consent banners
- **Multi-account**: Management of multiple Microsoft Rewards accounts
- **Launcher Scripts**: Easy startup with `.bat` (Windows) and `.sh` (Linux/Mac) scripts

## Installation

1. Clone this repository:
   ```
   git clone https://github.com/your-name/Microsoft-Rewards-Script.git
   cd Microsoft-Rewards-Script
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Configure your accounts in the `src/accounts.json` file:
   ```json
   [
     {
       "username": "your-email@example.com",
       "password": "your-password",
       "proxy": {
         "url": "",
         "port": "",
         "username": "",
         "password": ""
       }
     }
   ]
   ```

4. Make the shell script executable (Linux/Mac only):
   ```
   chmod +x start-rewards.sh
   ```

## Usage

### Quick Launch
- **Windows**: Double-click on `start-rewards.bat`
- **Linux/Mac**: Run `./start-rewards.sh`

### Command Line
```
npm run pre-build  # Install dependencies and prepare
npm run build      # Build the project
npm run start      # Launch the script
```

### Development Mode
```
npm run ts-start   # Direct execution via ts-node
npm run dev        # Execution in development mode
```

## Major Fixes

### 1. Browser Configuration (`src/browser/Browser.ts`)

Viewport parameter correction to prevent multiple window openings:

```typescript
const context = await newInjectedContext(browser as any, { 
    fingerprint: fingerprint,
    newContextOptions: {
        viewport: this.bot.isMobile ? { width: 390, height: 844 } : { width: 1280, height: 720 }
    }
})
```

### 2. Email Input Enhancement (`src/functions/Login.ts`)

Improved input for Microsoft's authentication interface with:
- Character-by-character typing with delays
- Increased timeout values
- Better error handling
- Alternative methods in case of failure

### 3. Advanced Cookie Management (`src/browser/BrowserUtil.ts`)

Added automatic cookie rejection features with:
- Detection of Bing/Microsoft-specific banners
- Multilingual support (French, English, etc.)
- Cascading three-approach system (direct click, DOM manipulation, JavaScript interaction)
- Support for banners in iframes

### 4. Search Overlay Management

Solution for banners that block search interactions:
- Dedicated `handleSearchOverlay()` function
- Targets the `.bnp_overlay_wrapper` element blocking interactions
- Multiple workaround methods if direct click fails

## Advanced Configuration

You can modify the `src/config.json` file to customize:

- Search settings
- Delays between actions
- Proxy configuration
- Webhook options for notifications
- And more!

## Compatibility

- Tested on Windows 10/11
- Works with Chrome/Chromium
- Compatible with both emulation modes (mobile and desktop)
- Compatible with the original script's configuration structure

## Important Notes

- This script is an improved and unofficial version
- The official repository remains: https://github.com/TheNetsky/Microsoft-Rewards-Script
- These fixes were created to address specific issues with Microsoft's authentication interface as of April 2025

## License

This project is under the ISC license - see the original repository for more details