import { Page } from 'playwright'
import { load } from 'cheerio'

import { MicrosoftRewardsBot } from '../index'


export default class BrowserUtil {
    private bot: MicrosoftRewardsBot

    constructor(bot: MicrosoftRewardsBot) {
        this.bot = bot
    }

    async tryDismissAllMessages(page: Page): Promise<boolean> {
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
            
            // Cookie rejection buttons (prioritized above acceptance)
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
            
            // Microsoft specific reject buttons
            { selector: '#bnp_btn_reject', label: 'Bing Cookie Reject Button' },
            { selector: '#cookie-banner-reject', label: 'MS Cookie Banner Reject' },
            { selector: '//button[contains(@aria-label, "Reject")]', label: 'MS Aria Reject Button' },
            
            // Fallback to existing cookie buttons (if rejection fails)
            { selector: '//div[@id="cookieConsentContainer"]//button[contains(text(), "Accept")]', label: 'Accept Cookie Consent Container' },
            { selector: '#bnp_btn_accept', label: 'Bing Cookie Banner' },
            { selector: '#reward_pivot_earn', label: 'Reward Coupon Accept' }
        ]

        // Try to handle common modal overlays first
        try {
            // Check if there's a dialog or modal with cookie content
            const cookieDialog = page.locator('dialog:visible, div[role="dialog"]:visible, div.cookie-banner:visible, div[id*="cookie"]:visible');
            if (await cookieDialog.count() > 0) {
                this.bot.log(this.bot.isMobile, 'DISMISS-COOKIES', 'Detected cookie dialog, attempting to find and click reject button');
                
                // Try to find buttons within the dialog that might reject cookies
                const rejectButton = cookieDialog.locator('button:has-text("Reject"), button:has-text("Decline"), button:has-text("No thanks")');
                if (await rejectButton.count() > 0) {
                    await rejectButton.first().click().catch(() => {});
                    this.bot.log(this.bot.isMobile, 'DISMISS-COOKIES', 'Clicked reject button in cookie dialog');
                    return true;
                }
            }
        } catch (error) {
            // Continue if modal handling fails
        }

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
        
        // Additional check for Microsoft cookie banners that might not be caught by selectors
        try {
            // Microsoft's cookie banner sometimes uses iframe
            const frames = page.frames();
            for (const frame of frames) {
                try {
                    const framePath = frame.url();
                    if (framePath.includes('cookie') || framePath.includes('consent')) {
                        const rejectButtons = await frame.$$('button:has-text("Reject"), button:has-text("Decline")');
                        if (rejectButtons.length > 0) {
                            if (rejectButtons?.[0]) {
                                await rejectButtons[0].click().catch(() => {});
                            }
                            this.bot.log(this.bot.isMobile, 'DISMISS-COOKIES', 'Clicked reject button in cookie iframe');
                            return true;
                        }
                    }
                } catch (frameError) {
                    // Continue to next frame if there's an error
                }
            }
        } catch (error) {
            // Continue if iframe handling fails
        }
        
        return results.some(result => result.status === 'fulfilled' && result.value === true)
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
            }

        } catch (error) {
            throw this.bot.log(this.bot.isMobile, 'RELOAD-BAD-PAGE', 'An error occurred:' + error, 'error')
        }
    }

}