# Microsoft Rewards Script - Fixes

This document details the fixes applied to [TheNetsky's Microsoft Rewards Script](https://github.com/TheNetsky/Microsoft-Rewards-Script) to resolve issues with Microsoft's new authentication interface and improve cookie handling.

## Overview

The original script stopped working correctly due to Microsoft's authentication interface changes, which resulted in:
1. Blank pages during login
2. Failure to enter email addresses in desktop mode
3. Multiple browser windows opening simultaneously

These fixes address these specific issues while maintaining compatibility with the original codebase.

## Fixed Files

### 1. Browser Configuration Fix (`src/browser/Browser.ts`)

**Issue:** The script was opening multiple browser windows and failing to properly configure viewports.

**Fix:** Corrected the viewport configuration in the `createBrowser` method:

```typescript
// BEFORE:
const context = await newInjectedContext(browser as any, { 
    fingerprint: fingerprint,
    // Additional settings for the new interface
    viewport: this.bot.isMobile ? { width: 390, height: 844 } : { width: 1280, height: 720 }
})

// AFTER:
const context = await newInjectedContext(browser as any, { 
    fingerprint: fingerprint,
    newContextOptions: {
        viewport: this.bot.isMobile ? { width: 390, height: 844 } : { width: 1280, height: 720 }
    }
})
```

The fix moves the viewport settings into the `newContextOptions` object, as required by the `fingerprint-injector` library.

### 2. Email Input Enhancement (`src/functions/Login.ts`)

**Issue:** The script couldn't enter email addresses in the new Microsoft interface.

**Fix:** Enhanced the `enterEmail` method to handle Microsoft's new authentication interface:

```typescript
private async enterEmail(page: Page, email: string) {
    try {
        // Check if email is already prefilled by Microsoft
        const emailPrefilled = await page.waitForSelector('#userDisplayName', { timeout: 2_000 }).catch(() => null)
        if (emailPrefilled) {
            this.bot.log(this.bot.isMobile, 'LOGIN', 'Email already prefilled by Microsoft')
            await page.click('#idSIButton9').catch(() => {})
            return
        }

        // Wait for the input field to be ready - longer timeout for the new interface
        await page.waitForSelector('#i0116', { state: 'visible', timeout: 5000 })
        
        // Clear any existing value first
        await page.click('#i0116')
        await page.fill('#i0116', '')
        await this.bot.utils.wait(500)
        
        // Type email character by character to better handle the new interface
        for (const char of email) {
            await page.type('#i0116', char, { delay: 50 })
            await this.bot.utils.wait(30)
        }
        
        await this.bot.utils.wait(1000)
        
        // Click the Next button
        const nextButton = await page.waitForSelector('#idSIButton9', { state: 'visible', timeout: 5000 })
        if (nextButton) {
            await nextButton.click()
            await this.bot.utils.wait(2000)
            this.bot.log(this.bot.isMobile, 'LOGIN', 'Email entered successfully')
        } else {
            this.bot.log(this.bot.isMobile, 'LOGIN', 'Next button not found after email entry')
        }
    } catch (error) {
        // Fallback to alternative method if primary approach fails
        this.bot.log(this.bot.isMobile, 'LOGIN', `Email entry failed: ${error}`, 'warn')
        try {
            await page.fill('input[type="email"]', email)
            await this.bot.utils.wait(1000)
            await page.click('input[type="submit"]')
            this.bot.log(this.bot.isMobile, 'LOGIN', 'Email entered using alternative method')
        } catch (alternativeError) {
            this.bot.log(this.bot.isMobile, 'LOGIN', `Alternative email entry failed: ${alternativeError}`, 'error')
        }
    }
}
```

The key improvements include:
- Character-by-character typing with delays
- Increased timeout values for selectors
- Better error handling
- Alternative selector method as fallback

### 3. Enhanced Cookie Handling (`src/browser/BrowserUtil.ts`)

**Issue:** Cookie pop-ups would interfere with the automation process.

**Fix:** Enhanced the `tryDismissAllMessages` method to prioritize rejecting cookie pop-ups:

```typescript
async tryDismissAllMessages(page: Page): Promise<boolean> {
    const buttons = [
        // Original UI interaction buttons
        // ...existing code...
        
        // Added numerous cookie rejection selectors
        { selector: '//button[contains(text(), "Reject")]', label: 'Generic Reject Button' },
        { selector: '//button[contains(text(), "Decline")]', label: 'Generic Decline Button' },
        // ...additional cookie rejection selectors...
        
        // Microsoft specific reject buttons
        { selector: '#bnp_btn_reject', label: 'Bing Cookie Reject Button' },
        { selector: '#cookie-banner-reject', label: 'MS Cookie Banner Reject' },
        { selector: '//button[contains(@aria-label, "Reject")]', label: 'MS Aria Reject Button' },
        
        // Fallback to existing cookie buttons (if rejection fails)
        // ...existing cookie acceptance selectors...
    ]

    // Added modal/dialog cookie notice handling
    try {
        const cookieDialog = page.locator('dialog:visible, div[role="dialog"]:visible, div.cookie-banner:visible, div[id*="cookie"]:visible');
        // ...cookie dialog handling logic...
    } catch (error) {
        // Continue if modal handling fails
    }

    // Original button handling logic
    const dismissTasks = buttons.map(async (button) => {
        // ...existing code...
    })

    const results = await Promise.allSettled(dismissTasks)
    
    // Added iframe cookie banner detection
    try {
        const frames = page.frames();
        // ...iframe cookie handling logic...
    } catch (error) {
        // Continue if iframe handling fails
    }
    
    return results.some(result => result.status === 'fulfilled' && result.value === true)
}
```

The improvements include:
- Prioritization of cookie rejection buttons
- Special handling for modal/dialog cookie notices
- Detection of cookie banners in iframes
- More comprehensive selectors for various cookie consent patterns

## Convenience Scripts

Added simple launcher scripts to make running the bot easier:

1. `start-rewards.bat` - Windows launcher
2. `start-rewards.sh` - Linux/Mac launcher

These scripts check for prerequisites, build the project if needed, and launch the Microsoft Rewards Script.

## How to Apply These Fixes

1. Clone the original repository: 
   ```
   git clone https://github.com/TheNetsky/Microsoft-Rewards-Script.git
   ```

2. Replace the following files with the fixed versions:
   - `src/browser/Browser.ts`
   - `src/functions/Login.ts`
   - `src/browser/BrowserUtil.ts`

3. Add the convenience scripts:
   - `start-rewards.bat`
   - `start-rewards.sh`

4. Make the shell script executable (Linux/Mac only):
   ```
   chmod +x start-rewards.sh
   ```

5. Build and start the script:
   - Windows: Double-click `start-rewards.bat`
   - Linux/Mac: Run `./start-rewards.sh`

## Important Notes

- These are unofficial fixes and not part of the original repository.
- The official repository remains at: https://github.com/TheNetsky/Microsoft-Rewards-Script
- These fixes were created to address specific issues with Microsoft's new authentication interface as of April 2025.

## Compatibility

- Tested on Windows 10/11
- Works with both mobile and desktop emulation modes
- Compatible with the original script's configuration system