require('dotenv').config();
const fs = require('fs');
const puppeteer = require('puppeteer');
const fetch = require('node-fetch');

const WIDTH = 1920;
const HEIGHT = 1080;

const storageFile = 'previous_results.json';
const { CHAT_ID, BOT_API } = process.env;

const urls = [
    'https://www.funda.nl/en/zoeken/huur?selected_area=%5B%22utrecht,50km%22%5D&price=%22-1250%22&sort=%22date_down%22&object_type=%5B%22house%22,%22apartment%22%5D'
];

// Load previous results
let previousResults = [];
try {
    if (fs.existsSync(storageFile)) {
        const fileContent = fs.readFileSync(storageFile, 'utf8');
        previousResults = JSON.parse(fileContent);
    }
} catch (error) {
    console.error('Error loading previous results:', error);
}

const runTask = async () => {
    for (const url of urls) {
        await runPuppeteer(url);
    }
};

const runPuppeteer = async (url) => {
    console.log('Opening browser...');
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', `--window-size=${WIDTH},${HEIGHT}`],
        defaultViewport: { width: WIDTH, height: HEIGHT },
    });

    const page = await browser.newPage();
    await page.setUserAgent(
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/44.0.2403.157 Safari/537.36'
    );

    try {
        console.log('Navigating to Funda...');
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

        console.log('Extracting listings...');
        const newResults = await page.$$eval('div.flex.flex-col.gap-3.mt-4 > *', (items) => {
            return items.map((item) => {
                const anchor = item.querySelector('a');
                return {
                    content: item.innerText.trim(),
                    href: anchor ? anchor.getAttribute('href') : null,
                };
            }).filter((entry) => entry.href);
        });

        if (!newResults.length) {
            console.log('No listings found.');
        } else {
            const unseenResults = newResults.filter(
                (r) => !previousResults.some((p) => p.href === r.href)
            );

            if (unseenResults.length > 0) {
                for (let i = 0; i < unseenResults.length; i++) {
                    const result = unseenResults[i];
                    const message = `🏠 New listing ${i + 1}:\n${result.content}\n🔗 https://www.funda.nl${result.href}`;
                    await sendTelegramMessage(message);
                }

                previousResults = [...previousResults, ...unseenResults];
                fs.writeFileSync(storageFile, JSON.stringify(previousResults, null, 2), 'utf8');
                console.log(`${unseenResults.length} new listings sent.`);
            } else {
                console.log('No new listings found.');
            }
        }
    } catch (error) {
        console.error('Error while scraping:', error);
    } finally {
        await browser.close();
        console.log('Browser closed.');
    }
};

async function sendTelegramMessage(message) {
    const url = `https://api.telegram.org/bot${BOT_API}/sendMessage`;
    const data = {
        chat_id: CHAT_ID,
        text: message,
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            console.error(`Telegram error: ${response.status} ${response.statusText}`);
        } else {
            console.log('✅ Message sent to Telegram');
        }
    } catch (error) {
        console.error('Failed to send Telegram message:', error);
    }
}

if (CHAT_ID && BOT_API) {
    runTask();
} else {
    console.error('❌ Missing Telegram API keys! Please check your .env file.');
}
