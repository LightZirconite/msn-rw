import { Page } from 'rebrowser-playwright'
import * as fs from 'fs'
import path from 'path'

import { Workers } from '../Workers'

import { MorePromotion, PromotionalItem } from '../../interface/DashboardData'


export class SearchOnBing extends Workers {

    async doSearchOnBing(page: Page, activity: MorePromotion | PromotionalItem) {
        this.bot.log(this.bot.isMobile, 'SEARCH-ON-BING', 'Trying to complete SearchOnBing')

        try {
            await this.bot.utils.wait(5000)

            // First handle any standard message dismissals
            await this.bot.browser.utils.tryDismissAllMessages(page)
            
            // Then specifically handle the search overlay that might be blocking input
            await this.bot.browser.utils.handleSearchOverlay(page)
            
            // Get the search query
            const query = await this.getSearchQuery(activity.title)
            
            // Wait longer for the search bar and handle overlay if it reappears
            const searchBar = '#sb_form_q'
            
            // Multiple attempts to interact with the search bar
            for (let attempt = 0; attempt < 3; attempt++) {
                try {
                    // Check for overlay again before each attempt
                    await this.bot.browser.utils.handleSearchOverlay(page)
                    
                    // Wait for the search bar with increased timeout
                    await page.waitForSelector(searchBar, { state: 'visible', timeout: 10000 })
                    
                    // Try a JavaScript approach first if we've had issues before
                    if (attempt > 0) {
                        await page.evaluate(() => {
                            const input = document.querySelector('#sb_form_q') as HTMLTextAreaElement;
                            if (input) {
                                input.focus();
                                input.value = '';
                            }
                        });
                        await this.bot.utils.wait(500);
                    }
                    
                    // Standard approach - click the search bar
                    await page.click(searchBar, { timeout: 5000 }).catch(async () => {
                        // If direct click fails, try an alternative approach
                        await page.evaluate(() => {
                            // Force focus and click via JavaScript
                            const input = document.querySelector('#sb_form_q') as HTMLTextAreaElement;
                            if (input) {
                                input.focus();
                                // Create and dispatch a click event
                                const clickEvent = new MouseEvent('click', {
                                    bubbles: true,
                                    cancelable: true,
                                    view: window
                                });
                                input.dispatchEvent(clickEvent);
                            }
                        });
                    });
                    
                    await this.bot.utils.wait(500);
                    
                    // Type the query
                    await page.keyboard.type(query);
                    await this.bot.utils.wait(300);
                    await page.keyboard.press('Enter');
                    
                    // Successfully interacted with the search bar
                    this.bot.log(this.bot.isMobile, 'SEARCH-ON-BING', `Successfully searched for: ${query}`);
                    break;
                    
                } catch (attemptError) {
                    if (attempt === 2) throw attemptError; // Re-throw on last attempt
                    this.bot.log(this.bot.isMobile, 'SEARCH-ON-BING', `Attempt ${attempt + 1}/3 failed, retrying...`, 'warn');
                    await this.bot.utils.wait(2000);
                }
            }
            
            await this.bot.utils.wait(3000);
            await page.close();

            this.bot.log(this.bot.isMobile, 'SEARCH-ON-BING', 'Completed the SearchOnBing successfully');
            
        } catch (error) {
            await page.close();
            this.bot.log(this.bot.isMobile, 'SEARCH-ON-BING', 'An error occurred:' + error, 'error');
        }
    }

    private async getSearchQuery(title: string): Promise<string> {
        interface Queries {
            title: string;
            queries: string[]
        }

        let queries: Queries[] = []

        try {
            if (this.bot.config.searchOnBingLocalQueries) {
                const data = fs.readFileSync(path.join(__dirname, '../queries.json'), 'utf8')
                queries = JSON.parse(data)
            } else {
                // Fetch from the repo directly so the user doesn't need to redownload the script for the new activities
                const response = await this.bot.axios.request({
                    method: 'GET',
                    url: 'https://raw.githubusercontent.com/TheNetsky/Microsoft-Rewards-Script/refs/heads/main/src/functions/queries.json'
                })
                queries = response.data
            }

            const answers = queries.find(x => this.normalizeString(x.title) === this.normalizeString(title))
            const answer = answers ? this.bot.utils.shuffleArray(answers?.queries)[0] as string : title

            this.bot.log(this.bot.isMobile, 'SEARCH-ON-BING-QUERY', `Fetched answer: ${answer} | question: ${title}`)
            return answer

        } catch (error) {
            this.bot.log(this.bot.isMobile, 'SEARCH-ON-BING-QUERY', 'An error occurred:' + error, 'error')
            return title
        }
    }

    private normalizeString(string: string): string {
        return string.normalize('NFD').trim().toLowerCase().replace(/[^\x20-\x7E]/g, '').replace(/[?!]/g, '')
    }
}