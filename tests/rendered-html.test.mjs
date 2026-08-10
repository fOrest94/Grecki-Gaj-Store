import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", String(process.pid) + "-" + Date.now());
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Grecki Gaj storefront", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="pl">/i);
  assert.match(html, /<title>Grecki Gaj \| Oliwa i greckie produkty<\/title>/i);
  assert.match(html, /Oliwa z rodzinnego gaju/);
  assert.match(html, /Oliwa extra virgin Koroneiki/);
  assert.match(html, /Paczkomat lub kurier/);
  assert.match(html, /Polityka prywatności/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/);
});

test("keeps local store assets and interactions in the project", async () => {
  const [page, storefront, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/Storefront.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    access(new URL("../public/images/hero-grove.png", import.meta.url)),
    access(new URL("../public/images/product-grid.png", import.meta.url)),
    access(new URL("../public/og.png", import.meta.url)),
  ]);

  assert.match(page, /<Storefront \/>/);
  assert.match(storefront, /Zamawiam z obowiązkiem zapłaty/);
  assert.match(storefront, /grecki-gaj-cart/);
  assert.match(storefront, /hardDeleteProduct/);
  assert.match(packageJson, /"lucide-react"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});
