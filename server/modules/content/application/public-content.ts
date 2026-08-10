import { desc, eq } from "drizzle-orm";
import { db } from "../../../../db";
import { articles, groveUpdates, siteSettings } from "../../../../db/schema";

const defaultSiteSettings = {
  groveTitle: "Historia zapisana w sÅ‚ojach",
  groveDescription:
    "Pierwsze drzewa posadziÅ‚ nasz dziadek Nikos. Nie marzyÅ‚ wtedy o sklepie internetowym. ChciaÅ‚ po prostu robiÄ‡ uczciwÄ… oliwÄ™ dla rodziny i sÄ…siadÃ³w.",
  groveSecondaryDescription:
    "DziÅ› Å‚Ä…czymy tÄ™ samÄ… pracÄ™ z kontrolÄ… kaÅ¼dej partii, transportem w stabilnej temperaturze i magazynem w Polsce.",
  contactPhone: "+48 500 600 700",
};

export async function getPublicContent() {
  const [articleRows, groveRows, settingsRows] = await Promise.all([
    db
      .select()
      .from(articles)
      .where(eq(articles.status, "published"))
      .orderBy(desc(articles.publishedAt)),
    db
      .select()
      .from(groveUpdates)
      .where(eq(groveUpdates.status, "published"))
      .orderBy(desc(groveUpdates.publishedAt)),
    db.select().from(siteSettings),
  ]);

  const settings = settingsRows.reduce(
    (result, row) => ({ ...result, [row.key]: row.value }),
    { ...defaultSiteSettings },
  );

  return {
    articles: articleRows.map((article) => ({
      id: article.id,
      category: article.category,
      date: article.publishedAt?.toISOString(),
      title: article.title,
      excerpt: article.excerpt,
      body: article.body,
      imageUrl: article.imageUrl,
      crop: article.imageCrop,
      time: article.readingTimeMinutes + " min",
    })),
    groveUpdates: groveRows.map((update) => ({
      id: update.id,
      date: update.publishedAt?.toISOString(),
      title: update.title,
      text: update.summary,
      crop: update.imageCrop,
    })),
    settings,
  };
}
