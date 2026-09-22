// One-time import of the 52 real client logos into trusted_clients.
// Usage: node scripts/import-trusted-clients.js
require("dotenv").config();
const db = require("../src/db");

const groups = [
  {
    category: "Government / Education / Banks",
    categoryKm: "រដ្ឋាភិបាល / ការអប់រំ / ធនាគារ",
    prefix: "Government/Education Client",
    logos: Array.from({ length: 21 }, (_, i) => `/images/clients/gov/logo-${i + 1}.png`),
  },
  {
    category: "MSME AND SME",
    categoryKm: "សហគ្រាសខ្នាតតូច និងមធ្យម",
    prefix: "MSME/SME Client",
    logos: [
      "/images/clients/msme/logo-1.jpg",
      ...Array.from({ length: 10 }, (_, i) => `/images/clients/msme/logo-${i + 2}.png`),
      ...Array.from({ length: 5 }, (_, i) => `/images/clients/msme/logo-${i + 12}.jpg`),
    ],
  },
  {
    category: "Borey / Condo / Apartment / High-rise Building",
    categoryKm: "បុរី / កុងដូ / អាផាតមិន / អគារខ្ពស់",
    prefix: "Property Client",
    logos: Array.from({ length: 15 }, (_, i) => `/images/clients/borey/logo-${i + 1}.jpg`),
  },
];

async function main() {
  let total = 0;
  for (const group of groups) {
    for (let i = 0; i < group.logos.length; i++) {
      try {
        await db.query(
          `INSERT INTO trusted_clients (name, image_url, category, category_km, display_order)
           VALUES ($1, $2, $3, $4, $5)`,
          [`${group.prefix} ${i + 1}`, group.logos[i], group.category, group.categoryKm, i],
        );
        total++;
      } catch (err) {
        console.error(`Failed on ${group.logos[i]}:`, err.message);
      }
    }
    console.log(`✓ ${group.category}: ${group.logos.length} logos`);
  }
  console.log(`Done. Imported ${total} client logos total. Rename any of them via the admin panel whenever you have real client names.`);
  await db.pool.end();
}

main();