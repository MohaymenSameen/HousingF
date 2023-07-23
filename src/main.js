require('dotenv').config();
const { writeFileSync, readFileSync } = require('fs');
const puppeteer = require('puppeteer');
const jsdom = require('jsdom');
const nodeFetch = require('node-fetch');
const { Console } = require('console');

const WIDTH = 1920;
const HEIGHT = 1080;

const data = readFileSync('db.json', { encoding: 'utf8', flag: 'r' });
const pastResults = new Set(JSON.parse(data) || []);
console.log('pastResults:', pastResults);
const newResults = new Set();
const houses = [];
const { CHAT_ID, BOT_API } = process.env;

const urls = [
    'https://www.funda.nl/zoeken/huur?selected_area=%5B%22utrecht,15km%22%5D&publication_date=%223%22'
];

const runTask = async () => {
    for (const url of urls) {
        await runPuppeteer(url);
    }
}

const runPuppeteer = async (url) => {
    console.log('opening headless browser');
    const browser = await puppeteer.launch({
        headless: true,
        args: [`--window-size=${WIDTH},${HEIGHT}`],
        defaultViewport: {
            width: WIDTH,
            height: HEIGHT,
        },
    });

    const page = await browser.newPage();
    // https://stackoverflow.com/a/51732046/4307769 https://stackoverflow.com/a/68780400/4307769
    await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/44.0.2403.157 Safari/537.36');

    console.log('going to funda');
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    const htmlString = await page.content();
    const dom = new jsdom.JSDOM(htmlString);


    console.log('parsing funda.nl data');
    const result = dom.window.document.querySelectorAll('[data-test-id="search-result-item"]');

    if (result.length > 0) {
        console.log(`Found ${result.length} search result items:`);
        result.forEach((item, index) => {
            // Get the text content of the search result item
            const content = item.textContent;

            // Get the href value of the anchor tag inside the search result item
            const anchorElement = item.querySelector('a'); // Assuming the anchor is a direct child
            const href = anchorElement ? anchorElement.getAttribute('href') : 'No href found';

            console.log(`Search result ${index + 1}: ${content}, Href: ${href}`);
            // Perform any additional actions you want with each search result item


            nodeFetch(`https://api.telegram.org/bot${BOT_API}/sendMessage`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    href,
                    chat_id: CHAT_ID,
                    parse_mode: 'markdown',
                }),
            });
        });
    } else {
        // No results found, handle this case accordingly.
        console.log('No search result items found.');
    }


    console.log('closing browser');
    await browser.close();
};

if (CHAT_ID && BOT_API) {
    runTask();
} else {
    console.log('Missing Telegram API keys!');
}
