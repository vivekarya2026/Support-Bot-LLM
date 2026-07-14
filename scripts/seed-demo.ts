import fs from "node:fs";
import path from "node:path";
import { closeDb } from "../lib/db";
import { createBot, getBotBySlug } from "../lib/bots";
import { indexDocument, parseFileBuffer, resetKnowledgeBase } from "../lib/documents";

const DOCS_DIR = path.join(process.cwd(), "docs", "sample");

async function main() {
  let bot = getBotBySlug("demo");
  if (!bot) {
    bot = createBot({ name: "Demo Bot", templateId: "saas-support" });
    console.log(`Created demo workspace (slug: ${bot.slug}, key: ${bot.public_key})`);
  } else {
    console.log("Reusing existing demo workspace; resetting its knowledge base…");
    resetKnowledgeBase(bot.id);
  }

  if (!fs.existsSync(DOCS_DIR)) {
    console.error(`No sample docs folder at ${DOCS_DIR}`);
    process.exit(1);
  }
  const files = fs
    .readdirSync(DOCS_DIR)
    .filter((f) => /\.(md|markdown|txt)$/i.test(f))
    .map((f) => path.join(DOCS_DIR, f));

  if (files.length === 0) {
    console.error(`No markdown files found in ${DOCS_DIR}`);
    process.exit(1);
  }

  let total = 0;
  for (const file of files) {
    const name = path.basename(file);
    const buf = fs.readFileSync(file);
    const parsed = await parseFileBuffer(name, buf);
    const { chunkCount } = await indexDocument(bot.id, parsed);
    console.log(`  ${name}: ${chunkCount} chunks`);
    total += chunkCount;
  }

  console.log(`Indexed ${total} chunks across ${files.length} files into "${bot.slug}".`);
  console.log(`Try it: http://localhost:3000/chat/${bot.slug}`);
  closeDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
