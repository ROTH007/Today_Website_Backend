// One-time import of the 2 real existing testimonials into the database.
// Usage: node scripts/import-testimonials.js
require("dotenv").config();
const db = require("../src/db");

const testimonials = [
  {
    name: "Ly Kamthong",
    avatar: "/images/testimonials/lk1.png",
    title: "CEO of CheckinMe",
    titleKm: "នាយកប្រតិបត្តិ CheckinMe",
    rating: 5,
    quote:
      "As a CEO of CheckinMe, I've relied on TODAY's internet services since 2022 to keep our business running smoothly. The consistency and reliability of their connection have been essential for our operations, and their support team is always quick to respond when we need them.",
    quoteKm:
      "ក្នុងនាមជានាយកប្រតិបត្តិនៃ CheckinMe ខ្ញុំបានប្រើប្រាស់សេវាអ៊ីនធឺណិតរបស់ TODAY តាំងពីឆ្នាំ 2022 ដើម្បីរក្សាការប្រតិបត្តិការអាជីវកម្មឱ្យរលូន។ ភាពជាប់លាប់ និងភាពគួរឱ្យទុកចិត្តនៃការតភ្ជាប់ គឺចាំបាច់ខ្លាំងសម្រាប់ប្រតិបត្តិការរបស់យើង ហើយក្រុមជំនួយរបស់ពួកគេឆ្លើយតបយ៉ាងរហ័សជានិច្ច។",
    date: "April-10-2023",
    dateKm: "មេសា-10-2023",
  },
  {
    name: "Khiev Sopheaktra",
    avatar: "/images/testimonials/ks.png",
    title: "Deputy Head of the IT Center at RUPP",
    titleKm: "អនុប្រធានមជ្ឈមណ្ឌលព័ត៌មានវិទ្យា សាកលវិទ្យាល័យភូមិន្ទភ្នំពេញ",
    rating: 5,
    quote:
      "On behalf of the Deputy Head of the IT Center in charge of technical solutions in university network, I would like to express our appreciation for the reliable and stable internet connection provided by Today Internet Service Provider company for the last 3 years. Your consistent service has greatly supported our operations.",
    quoteKm:
      "ក្នុងនាមអនុប្រធានមជ្ឈមណ្ឌលព័ត៌មានវិទ្យា ទទួលបន្ទុកដំណោះស្រាយបច្ចេកទេសបណ្តាញសាកលវិទ្យាល័យ ខ្ញុំសូមថ្លែងអំណរគុណចំពោះការតភ្ជាប់អ៊ីនធឺណិតដ៏ជាប់លាប់ និងគួរឱ្យទុកចិត្ត ដែលផ្តល់ដោយ TODAY Internet Service Provider អស់រយៈពេល 3 ឆ្នាំកន្លងមក។ សេវាកម្មដ៏ស្មើភាពរបស់អ្នកបានគាំទ្រយ៉ាងខ្លាំងដល់ប្រតិបត្តិការរបស់យើង។",
    date: "April-10-2023",
    dateKm: "មេសា-10-2023",
  },
];

async function main() {
  for (let i = 0; i < testimonials.length; i++) {
    const t = testimonials[i];
    try {
      const result = await db.query(
        `INSERT INTO testimonials (name, role_en, role_km, quote_en, quote_km, avatar_url, rating, date_en, date_km, display_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id, name`,
        [t.name, t.title, t.titleKm, t.quote, t.quoteKm, t.avatar, t.rating, t.date, t.dateKm, i],
      );
      console.log(`✓ Imported: ${result.rows[0].name} (id ${result.rows[0].id})`);
    } catch (err) {
      console.error(`✗ Failed on ${t.name}:`, err.message);
    }
  }
  console.log("Done. Both existing testimonials keep their real avatar images from public/images/testimonials/ — no re-upload needed.");
  await db.pool.end();
}

main();