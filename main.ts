// deno-lint-ignore-file no-unused-vars
import puppeteer from "https://deno.land/x/puppeteer@16.2.0/mod.ts";
import { parse } from "https://deno.land/std@0.177.0/flags/mod.ts";
import { exists } from "https://deno.land/std@0.177.0/fs/exists.ts";
import { config } from "https://deno.land/x/dotenv@v3.2.2/mod.ts";

// Load environment variables
const env = await config();

const WEBHOOK_URL = env.WEBHOOK_URL;
if (!WEBHOOK_URL) {
  console.error("WEBHOOK_URL is not set in the .env file");
  Deno.exit(1);
}

const SEARCH_HISTORY_FILE = "search_history.json";
const MONITORED_URLS_FILE = "monitored_urls.json";
const CHECK_INTERVAL = 1 * 60 * 1000; // 1 minute

interface Product {
  title: string;
  price: number;
  available: boolean;
  url: string;
}

const userAgents = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36",
];

function getRandomUserAgent(): string {
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}

async function sendWebhookMessage(
  title: string,
  description: string,
  url: string
) {
  const embed = {
    title: title,
    description: description,
    url: url,
    color: 3447003,
    fields: [
      {
        name: "Click here!",
        value: `[Go to Amazon](${url})`,
      },
    ],
  };

  await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ embeds: [embed] }),
  });
}

async function scrapeAmazon(keyword: string): Promise<Product[]> {
  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.setUserAgent(getRandomUserAgent());
  const url = `https://www.amazon.co.jp/s?k=${encodeURIComponent(
    keyword
  )}&s=price-asc-rank`;

  try {
    await page.goto(url, {
      waitUntil: "networkidle0",
      timeout: 60000, // Increase timeout to 60 seconds
    });
  } catch (error) {
    console.error("Navigation timed out. Proceeding with partial page load.");
  }

  // Wait for the product grid to load
  await page.waitForSelector(".s-result-item", { timeout: 10000 }).catch(() => {
    console.warn(
      "Product grid selector not found. Page might not have loaded completely."
    );
  });

  const products = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll(".s-result-item"));
    return items
      .map((item): Product => {
        const titleElement = item.querySelector("h2 a span");
        const priceElement = item.querySelector(".a-price-whole");
        const availabilityElement = item.querySelector(".a-availability");
        const linkElement = item.querySelector("a.a-link-normal");

        let available = true;
        if (availabilityElement) {
          const availabilityText =
            availabilityElement.textContent?.toLowerCase() || "";
          available =
            !availabilityText.includes("在庫切れ") &&
            !availabilityText.includes("currently unavailable") &&
            !availabilityText.includes("out of stock");
        }

        return {
          title: titleElement?.textContent?.trim() || "",
          price: priceElement
            ? parseFloat(
                priceElement.textContent?.replace(/[^\d.-]/g, "") || "Infinity"
              )
            : Infinity,
          available: available,
          url: linkElement instanceof HTMLAnchorElement ? linkElement.href : "",
        };
      })
      .filter(
        (product): product is Product =>
          product.title !== "" && product.price !== Infinity
      );
  });

  await browser.close();
  return products;
}

async function scrapeAmazonProduct(url: string): Promise<Product | null> {
  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.setUserAgent(getRandomUserAgent());

  try {
    await page.goto(url, {
      waitUntil: "networkidle0",
      timeout: 60000,
    });
  } catch (error) {
    console.error("Navigation timed out. Proceeding with partial page load.");
  }

  const product = await page.evaluate(() => {
    const titleElement = document.querySelector("#productTitle");
    const priceElement = document.querySelector(".a-price .a-offscreen");
    const availabilityElement = document.querySelector("#availability");

    let available = true;
    if (availabilityElement) {
      const availabilityText =
        availabilityElement.textContent?.toLowerCase() || "";
      available =
        !availabilityText.includes("在庫切れ") &&
        !availabilityText.includes("currently unavailable") &&
        !availabilityText.includes("out of stock");
    }

    return {
      title: titleElement?.textContent?.trim() || "",
      price: priceElement
        ? parseFloat(
            priceElement.textContent?.replace(/[^\d.-]/g, "") || "Infinity"
          )
        : Infinity,
      available: available,
      url: window.location.href,
    };
  });

  await browser.close();
  return product.title !== "" && product.price !== Infinity ? product : null;
}

async function saveSearchHistory(keyword: string) {
  let history: string[] = [];
  if (await exists(SEARCH_HISTORY_FILE)) {
    const fileContent = await Deno.readTextFile(SEARCH_HISTORY_FILE);
    history = JSON.parse(fileContent);
  }
  if (!history.includes(keyword)) {
    history.push(keyword);
    await Deno.writeTextFile(SEARCH_HISTORY_FILE, JSON.stringify(history));
  }
}

async function loadSearchHistory(): Promise<string[]> {
  if (await exists(SEARCH_HISTORY_FILE)) {
    const fileContent = await Deno.readTextFile(SEARCH_HISTORY_FILE);
    return JSON.parse(fileContent);
  }
  return [];
}

async function saveMonitoredUrls(urls: string[]) {
  await Deno.writeTextFile(MONITORED_URLS_FILE, JSON.stringify(urls));
}

async function loadMonitoredUrls(): Promise<string[]> {
  if (await exists(MONITORED_URLS_FILE)) {
    const fileContent = await Deno.readTextFile(MONITORED_URLS_FILE);
    return JSON.parse(fileContent);
  }
  return [];
}

async function monitorProducts(keyword: string) {
  console.log(`Monitoring products for "${keyword}"...`);
  let previousProducts = await scrapeAmazon(keyword);
  let cheapestProduct = previousProducts.reduce((min, p) =>
    p.price < min.price ? p : min
  );

  await sendWebhookMessage(
    "Cheapest Product",
    `${cheapestProduct.title} - ¥${cheapestProduct.price}`,
    cheapestProduct.url
  );

  setInterval(async () => {
    try {
      const currentProducts = await scrapeAmazon(keyword);

      const newlyAvailable = currentProducts.filter(
        (cur) =>
          cur.available &&
          !previousProducts.some(
            (prev) => prev.title === cur.title && prev.available
          )
      );

      for (const product of newlyAvailable) {
        await sendWebhookMessage(
          "New Stock Available",
          `${product.title} - ¥${product.price}`,
          product.url
        );
      }

      const newCheapestProduct = currentProducts.reduce((min, p) =>
        p.price < min.price ? p : min
      );
      if (newCheapestProduct.price < cheapestProduct.price) {
        cheapestProduct = newCheapestProduct;
        await sendWebhookMessage(
          "New Cheapest Product",
          `${cheapestProduct.title} - ¥${cheapestProduct.price}`,
          cheapestProduct.url
        );
      }

      previousProducts = currentProducts;
    } catch (error) {
      console.error("An error occurred during product monitoring:", error);
    }
  }, CHECK_INTERVAL);
}

async function monitorSpecificUrls() {
  const monitoredUrls = await loadMonitoredUrls();
  console.log(`Monitoring ${monitoredUrls.length} specific URLs...`);

  let previousProducts: (Product | null)[] = await Promise.all(
    monitoredUrls.map((url) => scrapeAmazonProduct(url))
  );

  setInterval(async () => {
    try {
      const currentProducts = await Promise.all(
        monitoredUrls.map((url) => scrapeAmazonProduct(url))
      );

      for (let i = 0; i < currentProducts.length; i++) {
        const current = currentProducts[i];
        const previous = previousProducts[i];

        if (current && previous) {
          if (!previous.available && current.available) {
            await sendWebhookMessage(
              "Product Now Available",
              `${current.title} - ¥${current.price}`,
              current.url
            );
          }
        }
      }

      previousProducts = currentProducts;
    } catch (error) {
      console.error("An error occurred during specific URL monitoring:", error);
    }
  }, CHECK_INTERVAL);
}

async function main() {
  const args = parse(Deno.args);
  let keyword = args._[0] as string | undefined;

  if (!keyword) {
    const history = await loadSearchHistory();
    console.log("Search history:", history);
    keyword = prompt("Enter search keyword: ") || undefined;
  }

  if (keyword) {
    await saveSearchHistory(keyword);
    await monitorProducts(keyword);
  } else {
    console.log("No keyword provided. Monitoring specific URLs only.");
  }

  // Ask for URLs to monitor
  const monitoredUrls = await loadMonitoredUrls();
  console.log("Currently monitored URLs:", monitoredUrls);

  const newUrl = prompt(
    "Enter a new URL to monitor (or press Enter to skip): "
  );
  if (newUrl && newUrl.trim() !== "") {
    monitoredUrls.push(newUrl.trim());
    await saveMonitoredUrls(monitoredUrls);
  }

  // Start monitoring specific URLs
  await monitorSpecificUrls();
}

main();

