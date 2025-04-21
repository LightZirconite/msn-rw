import { Page } from 'playwright'
import { load } from 'cheerio'

import { MicrosoftRewardsBot } from '../index'


export default class BrowserUtil {
    private bot: MicrosoftRewardsBot

    constructor(bot: MicrosoftRewardsBot) {
        this.bot = bot
    }

    async tryDismissAllMessages(page: Page): Promise<boolean> {
        // First try to handle cookie banners specifically
        const cookieRejected = await this.rejectCookies(page);
        if (cookieRejected) return true;
        
        const buttons = [
            // Existing buttons
            { selector: '#acceptButton', label: 'AcceptButton' },
            { selector: '.ext-secondary.ext-button', label: '"Skip for now" Button' },
            { selector: '#iLandingViewAction', label: 'iLandingViewAction' },
            { selector: '#iShowSkip', label: 'iShowSkip' },
            { selector: '#iNext', label: 'iNext' },
            { selector: '#iLooksGood', label: 'iLooksGood' },
            { selector: '#idSIButton9', label: 'idSIButton9' },
            { selector: '.ms-Button.ms-Button--primary', label: 'Primary Button' },
            { selector: '.c-glyph.glyph-cancel', label: 'Mobile Welcome Button' },
            { selector: '.maybe-later', label: 'Mobile Rewards App Banner' },
            // Fallback to existing cookie buttons (if rejection fails)
            { selector: '//div[@id="cookieConsentContainer"]//button[contains(text(), "Accept")]', label: 'Accept Cookie Consent Container' },
            { selector: '#bnp_btn_accept', label: 'Bing Cookie Banner' },
            { selector: '#reward_pivot_earn', label: 'Reward Coupon Accept' }
        ]

        const dismissTasks = buttons.map(async (button) => {
            try {
                const element = page.locator(button.selector)
                if (await element.first().isVisible({ timeout: 1000 })) {
                    await element.first().click({ timeout: 1000 })
                    this.bot.log(this.bot.isMobile, 'DISMISS-ALL-MESSAGES', `Dismissed: ${button.label}`)
                    return true
                }
            } catch (error) {
                // Ignore errors and continue
            }
            return false
        })

        const results = await Promise.allSettled(dismissTasks)
        
        return results.some(result => result.status === 'fulfilled' && result.value === true)
    }

    /**
     * Specialized function to detect and reject cookie consent popups
     * This function focuses specifically on cookie banners and provides more thorough handling
     * @param page The Playwright page object
     * @returns boolean True if cookies were rejected, false otherwise
     */
    async rejectCookies(page: Page): Promise<boolean> {
        this.bot.log(this.bot.isMobile, 'COOKIES', 'Checking for cookie consent banners...')
        
        // Wait a moment for cookie banners to appear
        await this.bot.utils.wait(500);
        
        let cookieRejected = false;

        // 0. Check specifically for Bing's French cookie banner (highest priority)
        try {
            // Try the direct approach for Bing's French consent banner
            const frenchRejectButtonSelectors = [
                { selector: '//button[contains(text(), "Refuser")]', label: 'French Refuse Button' },
                { selector: '#bnp_btn_refuse', label: 'Bing French Refuse Button' },
                { selector: '#bnp_btn_reject', label: 'Bing Reject Button' },
                { selector: '#bnp_btn_decline', label: 'Bing Decline Button' },
                { selector: '#bnp_hfly_cta2', label: 'Bing Cookie Banner Button 2' },
                { selector: '//button[@id="bnp_btn_reject" or @id="bnp_btn_refuse" or contains(@id, "reject") or contains(@id, "refuse")]', label: 'Combined Bing Reject Button' },
                { selector: '//button[text()="Refuser"]', label: 'Exact French Refuse Button' },
            ];

            for (const {selector, label} of frenchRejectButtonSelectors) {
                try {
                    const element = page.locator(selector);
                    if (await element.count() > 0) {
                        const isVisible = await element.first().isVisible().catch(() => false);
                        if (isVisible) {
                            // Force click with JavaScript as a fallback if normal click fails
                            try {
                                await element.first().click({timeout: 2000, force: true});
                            } catch (clickError) {
                                // Try JavaScript click as fallback
                                await page.evaluate((sel) => {
                                    const elements = document.evaluate(sel, document, null, XPathResult.ANY_TYPE, null);
                                    const button = elements.iterateNext();
                                    if (button) {
                                        (button as HTMLElement).click();
                                    }
                                }, selector).catch(() => {});
                            }
                            this.bot.log(this.bot.isMobile, 'COOKIES', `Rejected French Bing cookies using: ${label}`);
                            cookieRejected = true;
                            break;
                        }
                    }
                } catch (error) {
                    // Continue to next selector
                }
            }

            // If direct approach failed, try to locate from the specific banner text
            if (!cookieRejected) {
                // Look for text elements that might identify the French banner
                const bannerTextXPath = '//p[contains(text(), "Microsoft et ses fournisseurs") or contains(text(), "personnaliser les annonces")]';
                const bannerText = page.locator(bannerTextXPath);
                
                if (await bannerText.count() > 0) {
                    this.bot.log(this.bot.isMobile, 'COOKIES', 'Detected French Microsoft cookie banner');
                    
                    // Find the closest "Refuser" button
                    const refuserButtonXPath = '//button[contains(text(), "Refuser")]';
                    const refuserButton = page.locator(refuserButtonXPath);
                    
                    if (await refuserButton.count() > 0) {
                        await refuserButton.click({timeout: 2000, force: true}).catch(async () => {
                            // Try JavaScript approach if direct click fails
                            await page.evaluate(() => {
                                const buttons = Array.from(document.querySelectorAll('button'));
                                const refuserBtn = buttons.find(b => b.textContent?.includes('Refuser'));
                                if (refuserBtn) refuserBtn.click();
                            });
                        });
                        this.bot.log(this.bot.isMobile, 'COOKIES', `Rejected French Microsoft cookies via text detection`);
                        cookieRejected = true;
                    }
                }
            }
        } catch (frenchError) {
            this.bot.log(this.bot.isMobile, 'COOKIES', `Error handling French cookie banner: ${frenchError}`, 'warn');
            // Continue with standard approaches
        }
        
        // If French-specific approach didn't succeed, continue with standard cookie rejection
        if (!cookieRejected) {
            // List of cookie rejection button selectors, ordered by priority
            const cookieSelectors = [
                // Microsoft & Bing specific selectors
                { selector: '#bnp_btn_reject', label: 'Bing Cookie Reject Button' },
                { selector: '#cookie-banner-reject', label: 'MS Cookie Banner Reject' },
                { selector: '[data-bi-id="reject"]', label: 'MS Data-bi-id Reject' },
                { selector: 'button[id*="reject"]', label: 'Button ID Contains Reject' },
                { selector: 'button[id*="decline"]', label: 'Button ID Contains Decline' },
                { selector: '.reject-cookies', label: 'Reject Cookies Class' },
                { selector: '.optanon-allow-all-reject', label: 'Optanon Reject' },
                { selector: '.js-reject-cookies', label: 'JS Reject Cookies' },
                
                // Multilingual variations for cookie rejection
                { selector: '//button[contains(text(), "Refuser")]', label: 'French Reject Button' },
                { selector: '//button[contains(text(), "Ablehnen")]', label: 'German Reject Button' },
                { selector: '//button[contains(text(), "Rechazar")]', label: 'Spanish Reject Button' },
                { selector: '//button[contains(text(), "Rifiuta")]', label: 'Italian Reject Button' },
                
                // Common cookie button patterns
                { selector: '//button[contains(text(), "Reject")]', label: 'Generic Reject Button' },
                { selector: '//button[contains(text(), "Decline")]', label: 'Generic Decline Button' },
                { selector: '//button[contains(text(), "No")]', label: 'Generic No Button' },
                { selector: '//button[contains(text(), "Refuse")]', label: 'Generic Refuse Button' },
                { selector: '//button[contains(text(), "Reject All")]', label: 'Reject All Button' },
                { selector: '//button[contains(text(), "Decline All")]', label: 'Decline All Button' },
                { selector: '#reject-all', label: 'Reject All ID' },
                { selector: '.reject-all', label: 'Reject All Class' },
                { selector: '[data-action="reject"]', label: 'Data Action Reject' },
                { selector: '//a[contains(text(), "Reject all")]', label: 'Reject All Link' },
                { selector: '#onetrust-reject-all-handler', label: 'OneTrust Reject All' },
                { selector: '.coppa-decline', label: 'COPPA Decline' },
                { selector: '#declineButton', label: 'Decline Button ID' },
                { selector: '//button[contains(@aria-label, "Reject")]', label: 'MS Aria Reject Button' },
            ];
            
            // Rest of the existing cookie rejection logic
            // 1. Try to detect common cookie dialogs/modals
            try {
                const cookieBannerSelectors = [
                    'div#cookie-banner',
                    'div.cookie-banner',
                    'div.cookie-consent',
                    'div.consent-banner',
                    'div[aria-label*="cookie"]',
                    'div[id*="cookie"]',
                    'div[class*="cookie"]',
                    'div[id*="consent"]',
                    'div[class*="consent"]',
                    'div[id*="gdpr"]',
                    'div[class*="gdpr"]',
                    'div.optanon-alert-box-wrapper',
                    '[aria-describedby*="cookie"]',
                    'dialog:visible',
                    'div[role="dialog"]:visible'
                ];
                
                for (const bannerSelector of cookieBannerSelectors) {
                    const cookieBanner = page.locator(bannerSelector);
                    if (await cookieBanner.count() > 0) {
                        this.bot.log(this.bot.isMobile, 'COOKIES', `Detected cookie banner: ${bannerSelector}`);
                        
                        for (const {selector, label} of cookieSelectors) {
                            try {
                                // Try to find the reject button within this specific banner
                                const rejectButton = cookieBanner.locator(selector);
                                if (await rejectButton.count() > 0 && await rejectButton.first().isVisible()) {
                                    await rejectButton.first().click().catch(() => {});
                                    this.bot.log(this.bot.isMobile, 'COOKIES', `Rejected cookies using: ${label}`);
                                    cookieRejected = true;
                                    break;
                                }
                            } catch (error) {
                                // Continue to next selector
                            }
                        }
                        
                        if (cookieRejected) break;
                    }
                }
            } catch (error) {
                // Continue if banner detection fails
            }
            
            // 2. If no cookie banner was detected or rejected, try direct button selectors
            if (!cookieRejected) {
                for (const {selector, label} of cookieSelectors) {
                    try {
                        const element = page.locator(selector);
                        if (await element.count() > 0 && await element.first().isVisible()) {
                            await element.first().click().catch(() => {});
                            this.bot.log(this.bot.isMobile, 'COOKIES', `Rejected cookies using: ${label}`);
                            cookieRejected = true;
                            break;
                        }
                    } catch (error) {
                        // Continue to next selector
                    }
                }
            }
            
            // 3. Check for iframes that might contain cookie consent
            if (!cookieRejected) {
                try {
                    const frames = page.frames();
                    for (const frame of frames) {
                        try {
                            const framePath = frame.url();
                            if (framePath.includes('cookie') || framePath.includes('consent') || framePath.includes('privacy')) {
                                this.bot.log(this.bot.isMobile, 'COOKIES', `Checking cookie iframe: ${framePath}`);
                                
                                for (const {selector, label} of cookieSelectors) {
                                    try {
                                        const frameButtons = await frame.$$(selector);
                                        if (frameButtons.length > 0) {
                                            if (frameButtons[0]) {
                                                await frameButtons[0].click().catch(() => {});
                                            }
                                            this.bot.log(this.bot.isMobile, 'COOKIES', `Rejected cookies in iframe using: ${label}`);
                                            cookieRejected = true;
                                            break;
                                        }
                                    } catch (selectorError) {
                                        // Continue to next selector
                                    }
                                }
                                
                                if (cookieRejected) break;
                            }
                        } catch (frameError) {
                            // Continue to next frame
                        }
                    }
                } catch (framesError) {
                    // Continue if frame handling fails
                }
            }
        }
        
        // Last resort: try to directly inject cookie preferences if Bing
        if (!cookieRejected && page.url().includes('bing.com')) {
            try {
                this.bot.log(this.bot.isMobile, 'COOKIES', 'Attempting to bypass cookie banner by setting cookies directly');
                
                // Try to set the rejection cookie preferences directly
                await page.evaluate(() => {
                    try {
                        // Set Microsoft/Bing cookie preferences directly
                        localStorage.setItem('_EDGE_V', '1');
                        localStorage.setItem('MSCC', 'cid=necessary');
                        localStorage.setItem('MC1', 'GUID=1&HASH=1&LV=202104&V=4&LU=1618585904995');
                        localStorage.setItem('MUID', 'preference:rejected');
                        
                        // Some sites use document.cookie
                        document.cookie = "MS-CV=rejected; domain=.bing.com; path=/; secure; samesite=none";
                        document.cookie = "MUID=preference:rejected; domain=.bing.com; path=/; secure; samesite=none";
                        document.cookie = "_EDGE_V=1; domain=.bing.com; path=/; secure; samesite=none";
                        
                        // Hide known banner containers
                        const bannerElements = document.querySelectorAll('#bnp_container, #cookie-banner, .cookie-banner');
                        bannerElements.forEach(el => {
                            if (el instanceof HTMLElement) {
                                el.style.display = 'none';
                            }
                        });
                        
                        return true;
                    } catch (e) {
                        return false;
                    }
                }).then(result => {
                    if (result) {
                        this.bot.log(this.bot.isMobile, 'COOKIES', 'Successfully applied direct cookie preferences');
                        cookieRejected = true;
                    }
                }).catch(() => {});
            } catch (error) {
                this.bot.log(this.bot.isMobile, 'COOKIES', `Error in direct cookie injection: ${error}`, 'warn');
            }
        }
        
        return cookieRejected;
    }

    /**
     * Handles cookie consent and page verification after navigation
     * This should be called after page navigation to ensure cookies are rejected
     * @param page The Playwright page to process
     */
    async handlePageNavigation(page: Page): Promise<void> {
        try {
            // Wait for the page to settle
            await page.waitForLoadState('domcontentloaded').catch(() => {});
            
            // First check if the page loaded correctly
            await this.reloadBadPage(page);
            let cookieRejected = false;
            do {
                cookieRejected = await this.rejectCookies(page);
            } while (cookieRejected);
            // Then reject any cookie banners
            await this.rejectCookies(page);
            
            // Finally dismiss any other messages
            await this.tryDismissAllMessages(page);
            
        } catch (error) {
            this.bot.log(this.bot.isMobile, 'PAGE-NAV', `Error handling page navigation: ${error}`, 'error');
        }
    }

    /**
     * Specialized function to handle the Bing search overlay that blocks interactions
     * This targets the specific overlay element that appears on search pages
     * @param page The Playwright page object
     * @returns boolean True if overlay was removed, false otherwise
     */
    async handleSearchOverlay(page: Page): Promise<boolean> {
        try {
            // First detect if we're on a search page and if the overlay is present
            const overlayExists = await page.evaluate(() => {
                // Try to identify the overlay element that's blocking interactions
                const overlays = [
                    // bnp overlay wrapper - primary target based on error logs
                    document.querySelector('.bnp_overlay_wrapper'),
                    document.querySelector('[id^="bnp.nid"]'),
                    document.querySelector('[data-viewname="OverlayBanner_NoTitleRejectBtn"]'),
                    // Other potential overlay selectors
                    document.querySelector('#cookie-banner'),
                    document.querySelector('.cookie_prompt'),
                    document.querySelector('[aria-label*="cookie"]')
                ];
                
                return overlays.some(el => el !== null);
            });
            
            if (!overlayExists) {
                return false;
            }
            
            this.bot.log(this.bot.isMobile, 'SEARCH-OVERLAY', 'Detected search page overlay, attempting to remove it');
            
            // First try: Click the reject button directly if it exists
            try {
                // Try various selectors for the reject button within the overlay
                const rejectButtonSelectors = [
                    '.bnp_btn_reject',
                    '#bnp_btn_reject',
                    '.bnp_hfly_cta2',
                    '#bnp_hfly_cta2',
                    '[aria-label*="Reject"]',
                    '[aria-label*="Refuse"]',
                    '[aria-label*="Decline"]',
                    'button:has-text("Refuser")',
                    'button:has-text("Reject")',
                    'button:has-text("Decline")'
                ];
                
                for (const selector of rejectButtonSelectors) {
                    const buttonExists = await page.$(selector);
                    if (buttonExists) {
                        await page.click(selector, { force: true, timeout: 2000 }).catch(() => {});
                        this.bot.log(this.bot.isMobile, 'SEARCH-OVERLAY', `Clicked reject button using selector: ${selector}`);
                        await this.bot.utils.wait(500);
                        return true;
                    }
                }
            } catch (clickError) {
                this.bot.log(this.bot.isMobile, 'SEARCH-OVERLAY', `Direct click approach failed: ${clickError}`, 'warn');
            }
            
            // Second try: JavaScript approach to remove the overlay
            const removed = await page.evaluate(() => {
                try {
                    // Target the specific overlay elements
                    const overlaySelectors = [
                        '.bnp_overlay_wrapper',
                        '[id^="bnp.nid"]',
                        '[data-viewname="OverlayBanner_NoTitleRejectBtn"]',
                        '#cookie-banner',
                        '.cookie_prompt',
                        '[aria-label*="cookie"]'
                    ];
                    
                    let removed = false;
                    
                    // Try to find and remove each possible overlay
                    for (const selector of overlaySelectors) {
                        const elements = document.querySelectorAll(selector);
                        if (elements.length > 0) {
                            elements.forEach(el => {
                                if (el instanceof HTMLElement) {
                                    el.style.display = 'none';
                                    el.style.visibility = 'hidden';
                                    el.style.opacity = '0';
                                    el.style.pointerEvents = 'none';
                                    el.setAttribute('aria-hidden', 'true');
                                    
                                    // If element has a parent, try to remove it as well
                                    if (el.parentElement) {
                                        el.parentElement.removeChild(el);
                                    }
                                    
                                    removed = true;
                                }
                            });
                        }
                    }
                    
                    // Set cookies to prevent the banner from appearing again
                    const cookieNames = [
                        'SRCHHPGUSR',
                        'SRCHUID',
                        'BCP',
                        '_EDGE_V',
                        'MUID',
                        'MC1',
                        'MSCC'
                    ];
                    
                    for (const name of cookieNames) {
                        document.cookie = `${name}=1; domain=.bing.com; path=/; max-age=31536000; SameSite=None; Secure`;
                    }
                    
                    // Specifically target cookie preferences
                    localStorage.setItem('SRCHHPGUSR', 'SRCHLANG=en&BRW=XW&BRH=S&CW=1420&CH=333&SCW=1420&SCH=333&DPR=1.0&UTC=60&DM=0&WTS=63848700397&HV=1719081120&PRVCW=1420&PRVCH=333&THEME=1');
                    localStorage.setItem('_EDGE_V', '1');
                    localStorage.setItem('MSCC', 'cid=necessary');
                    
                    return removed;
                } catch (e) {
                    return false;
                }
            });
            
            if (removed) {
                this.bot.log(this.bot.isMobile, 'SEARCH-OVERLAY', 'Successfully removed search overlay via JavaScript');
                return true;
            }
            
            // Third try: Force evaluation of JavaScript to bypass the overlay
            await page.evaluate(() => {
                // Create a new mousedown event that will bypass the overlay
                const searchInput = document.querySelector('#sb_form_q');
                if (searchInput instanceof HTMLElement) {
                    // Focus and click using JavaScript directly
                    searchInput.focus();
                    searchInput.click();
                }
            });
            
            this.bot.log(this.bot.isMobile, 'SEARCH-OVERLAY', 'Attempted JavaScript focus/click as fallback');
            
            return false;
        } catch (error) {
            this.bot.log(this.bot.isMobile, 'SEARCH-OVERLAY', `Error handling search overlay: ${error}`, 'error');
            return false;
        }
    }

    async getLatestTab(page: Page): Promise<Page> {
        try {
            await this.bot.utils.wait(1000)

            const browser = page.context()
            const pages = browser.pages()
            const newTab = pages[pages.length - 1]

            if (newTab) {
                return newTab
            }

            throw this.bot.log(this.bot.isMobile, 'GET-NEW-TAB', 'Unable to get latest tab', 'error')
        } catch (error) {
            throw this.bot.log(this.bot.isMobile, 'GET-NEW-TAB', 'An error occurred:' + error, 'error')
        }
    }

    async getTabs(page: Page) {
        try {
            const browser = page.context()
            const pages = browser.pages()

            const homeTab = pages[1]
            let homeTabURL: URL

            if (!homeTab) {
                throw this.bot.log(this.bot.isMobile, 'GET-TABS', 'Home tab could not be found!', 'error')

            } else {
                homeTabURL = new URL(homeTab.url())

                if (homeTabURL.hostname !== 'rewards.bing.com') {
                    throw this.bot.log(this.bot.isMobile, 'GET-TABS', 'Reward page hostname is invalid: ' + homeTabURL.host, 'error')
                }
            }

            const workerTab = pages[2]
            if (!workerTab) {
                throw this.bot.log(this.bot.isMobile, 'GET-TABS', 'Worker tab could not be found!', 'error')
            }

            return {
                homeTab: homeTab,
                workerTab: workerTab
            }

        } catch (error) {
            throw this.bot.log(this.bot.isMobile, 'GET-TABS', 'An error occurred:' + error, 'error')
        }
    }

    async reloadBadPage(page: Page): Promise<void> {
        try {
            const html = await page.content().catch(() => '')
            const $ = load(html)

            const isNetworkError = $('body.neterror').length

            if (isNetworkError) {
                this.bot.log(this.bot.isMobile, 'RELOAD-BAD-PAGE', 'Bad page detected, reloading!')
                await page.reload()
                // After reload, reject cookies
                await this.bot.utils.wait(1000)
                await this.rejectCookies(page)
            }

        } catch (error) {
            throw this.bot.log(this.bot.isMobile, 'RELOAD-BAD-PAGE', 'An error occurred:' + error, 'error')
        }
    }

}