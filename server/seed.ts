import "dotenv/config";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { closeDatabase, db } from "../db";
import {
  addresses,
  articles as articleTable,
  groveUpdates as groveUpdateTable,
  orderItems,
  orders,
  orderStatusHistory,
  payments,
  productImages,
  products,
  productTags,
  shipments,
  siteSettings,
  tags,
  users,
} from "../db/schema";
import {
  articles as articleSeed,
  groveUpdates as groveSeed,
  initialProducts,
} from "../app/data";

const isProduction = process.env.NODE_ENV === "production";

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function seedUsers() {
  const adminEmail =
    process.env.SEED_ADMIN_EMAIL ||
    (isProduction ? "" : "admin@greckigaj.local");
  const adminPassword =
    process.env.SEED_ADMIN_PASSWORD || (isProduction ? "" : "Admin123!");

  if (!adminEmail || !adminPassword) {
    throw new Error(
      "Production seed requires SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD.",
    );
  }

  const adminPasswordHash = await bcrypt.hash(adminPassword, 12);
  const customerPasswordHash = await bcrypt.hash("Klient123!", 12);
  const now = new Date();

  const [admin] = await db
    .insert(users)
    .values({
      email: adminEmail,
      firstName: "Administrator",
      lastName: "Greckiego Gaju",
      passwordHash: adminPasswordHash,
      role: "admin",
      emailVerifiedAt: now,
    })
    .onConflictDoUpdate({
      target: users.email,
      set: {
        passwordHash: adminPasswordHash,
        role: "admin",
        emailVerifiedAt: now,
        updatedAt: now,
      },
    })
    .returning();

  if (isProduction) return { admin, customer: null };

  const [customer] = await db
    .insert(users)
    .values({
      email: "anna@greckigaj.local",
      firstName: "Anna",
      lastName: "Nowak",
      passwordHash: customerPasswordHash,
      role: "customer",
      emailVerifiedAt: now,
    })
    .onConflictDoUpdate({
      target: users.email,
      set: {
        passwordHash: customerPasswordHash,
        emailVerifiedAt: now,
        updatedAt: now,
      },
    })
    .returning();

  const existingAddresses = await db
    .select({ id: addresses.id })
    .from(addresses)
    .where(eq(addresses.userId, customer.id))
    .limit(1);

  if (!existingAddresses.length) {
    await db.insert(addresses).values({
      userId: customer.id,
      label: "Dom",
      firstName: "Anna",
      lastName: "Nowak",
      phone: "+48 500 600 700",
      street: "ul. Dobra 12/4",
      postalCode: "00-384",
      city: "Warszawa",
      isDefault: true,
    });
  }

  return { admin, customer };
}

async function seedProducts() {
  const seeded = [];

  for (const product of initialProducts) {
    const slug =
      slugify(product.shortName) +
      (product.unit === "500 ml" ? "-500-ml" : "-" + slugify(product.unit));
    const [saved] = await db
      .insert(products)
      .values({
        slug,
        name: product.name,
        shortName: product.shortName,
        category: product.category,
        description: product.description,
        ingredients:
          product.category === "Oliwa"
            ? "100% oliwa z oliwek najwyższej kategorii"
            : "100% naturalnych składników",
        allergens: "Brak zadeklarowanych alergenów",
        origin: "Grecja",
        price: product.price.toFixed(2),
        compareAtPrice: product.compareAt?.toFixed(2),
        unit: product.unit,
        stock: product.stock,
        imageCrop: product.crop,
        featured: Boolean(product.featured),
        softDeletedAt: null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: products.slug,
        set: {
          name: product.name,
          shortName: product.shortName,
          category: product.category,
          description: product.description,
          price: product.price.toFixed(2),
          compareAtPrice: product.compareAt?.toFixed(2),
          unit: product.unit,
          stock: product.stock,
          imageCrop: product.crop,
          featured: Boolean(product.featured),
          updatedAt: new Date(),
        },
      })
      .returning();

    await db
      .insert(productImages)
      .values({
        productId: saved.id,
        url: "/images/product-grid.png",
        alt: product.name,
        position: 0,
      })
      .onConflictDoNothing();

    for (const tagName of product.tags) {
      const tagSlug = slugify(tagName);
      const [tag] = await db
        .insert(tags)
        .values({ slug: tagSlug, name: tagName })
        .onConflictDoUpdate({
          target: tags.slug,
          set: { name: tagName },
        })
        .returning();
      await db
        .insert(productTags)
        .values({ productId: saved.id, tagId: tag.id })
        .onConflictDoNothing();
    }

    seeded.push(saved);
  }

  return seeded;
}

async function seedContent() {
  for (const article of articleSeed) {
    const publishedAt = new Date(
      article.id === 1 ? "2026-07-28" : article.id === 2 ? "2026-07-16" : "2026-07-02",
    );
    await db
      .insert(articleTable)
      .values({
        slug: slugify(article.title),
        category: article.category,
        title: article.title,
        excerpt: article.excerpt,
        body: article.excerpt + "\n\nPełna treść artykułu będzie rozwijana w panelu redakcyjnym.",
        imageUrl: "/images/product-grid.png",
        imageCrop: article.crop,
        readingTimeMinutes: Number.parseInt(article.time, 10),
        status: "published",
        publishedAt,
      })
      .onConflictDoUpdate({
        target: articleTable.slug,
        set: {
          category: article.category,
          title: article.title,
          excerpt: article.excerpt,
          imageCrop: article.crop,
          status: "published",
          publishedAt,
          updatedAt: new Date(),
        },
      });
  }

  for (const [index, update] of groveSeed.entries()) {
    const month = ["2026-07-01", "2026-05-01", "2026-02-01", "2025-11-01"][
      index
    ];
    await db
      .insert(groveUpdateTable)
      .values({
        slug: slugify(update.title),
        title: update.title,
        summary: update.text,
        body: update.text,
        imageUrl: "/images/product-grid.png",
        imageCrop: index % 2 ? "oregano" : "olives",
        status: "published",
        publishedAt: new Date(month),
      })
      .onConflictDoUpdate({
        target: groveUpdateTable.slug,
        set: {
          title: update.title,
          summary: update.text,
          status: "published",
          publishedAt: new Date(month),
          updatedAt: new Date(),
        },
      });
  }
}

async function seedSiteSettings() {
  const defaults = {
    groveTitle: "Historia zapisana w słojach",
    groveDescription:
      "Pierwsze drzewa posadził nasz dziadek Nikos. Nie marzył wtedy o sklepie internetowym. Chciał po prostu robić uczciwą oliwę dla rodziny i sąsiadów.",
    groveSecondaryDescription:
      "Dziś łączymy tę samą pracę z kontrolą każdej partii, transportem w stabilnej temperaturze i magazynem w Polsce.",
    contactPhone: "+48 500 600 700",
  };

  for (const [key, value] of Object.entries(defaults)) {
    await db
      .insert(siteSettings)
      .values({ key, value })
      .onConflictDoNothing({ target: siteSettings.key });
  }
}

async function seedDemoOrder(
  customerId: string,
  seededProducts: (typeof products.$inferSelect)[],
) {
  const existing = await db
    .select({ id: orders.id })
    .from(orders)
    .where(eq(orders.number, "GG/DEMO/0001"))
    .limit(1);
  if (existing.length || seededProducts.length < 2) return;

  const first = seededProducts[0];
  const second = seededProducts[2] || seededProducts[1];
  const subtotal = Number(first.price) + Number(second.price);
  const total = subtotal + 12.99;

  const [order] = await db
    .insert(orders)
    .values({
      number: "GG/DEMO/0001",
      userId: customerId,
      guestEmail: "anna@greckigaj.local",
      firstName: "Anna",
      lastName: "Nowak",
      phone: "+48 500 600 700",
      street: "ul. Dobra 12/4",
      postalCode: "00-384",
      city: "Warszawa",
      status: "delivered",
      subtotal: subtotal.toFixed(2),
      deliveryCost: "12.99",
      total: total.toFixed(2),
      createdAt: new Date("2026-07-19T10:15:00Z"),
      updatedAt: new Date("2026-07-21T12:30:00Z"),
    })
    .returning();

  await db.insert(orderItems).values([
    {
      orderId: order.id,
      productId: first.id,
      productName: first.name,
      productUnit: first.unit,
      unitPrice: first.price,
      quantity: 1,
      lineTotal: first.price,
    },
    {
      orderId: order.id,
      productId: second.id,
      productName: second.name,
      productUnit: second.unit,
      unitPrice: second.price,
      quantity: 1,
      lineTotal: second.price,
    },
  ]);

  await db.insert(orderStatusHistory).values([
    {
      orderId: order.id,
      status: "awaiting_payment",
      note: "Zamówienie złożone",
      createdAt: new Date("2026-07-19T10:15:00Z"),
    },
    {
      orderId: order.id,
      status: "paid",
      note: "Wpłata zaksięgowana",
      createdAt: new Date("2026-07-19T15:20:00Z"),
    },
    {
      orderId: order.id,
      status: "delivered",
      note: "Przesyłka doręczona",
      createdAt: new Date("2026-07-21T12:30:00Z"),
    },
  ]);

  await db.insert(payments).values({
    orderId: order.id,
    status: "paid",
    amount: total.toFixed(2),
    transferReference: order.number,
    dueAt: new Date("2026-07-22T23:59:59Z"),
    paidAt: new Date("2026-07-19T15:20:00Z"),
  });

  await db.insert(shipments).values({
    orderId: order.id,
    method: "locker",
    lockerCode: "WAW01M",
    lockerAddress: "ul. Świętokrzyska 14, Warszawa",
    trackingNumber: "DEMO0000000001",
    shippedAt: new Date("2026-07-20T08:00:00Z"),
    deliveredAt: new Date("2026-07-21T12:30:00Z"),
  });
}

try {
  const { admin, customer } = await seedUsers();
  const seededProducts = await seedProducts();
  await seedContent();
  await seedSiteSettings();
  if (customer) await seedDemoOrder(customer.id, seededProducts);
  console.log("Dane demonstracyjne Greckiego Gaju zostały zapisane.");
  console.log(`Administrator: ${admin.email}`);
  if (customer) console.log("Klient: anna@greckigaj.local / Klient123!");
} finally {
  await closeDatabase();
}
