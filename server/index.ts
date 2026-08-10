import "dotenv/config";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import {
  and,
  desc,
  eq,
  inArray,
  isNull,
  sql,
} from "drizzle-orm";
import { z } from "zod";
import { db, sqlClient } from "../db";
import {
  addresses,
  articles,
  auditLog,
  cartItems,
  carts,
  emailVerificationTokens,
  groveUpdates,
  orders,
  orderStatusHistory,
  payments,
  productImages,
  products,
  productTags,
  returnRequests,
  shipments,
  siteSettings,
  tags,
  users,
} from "../db/schema";
import {
  createUserSession,
  destroyUserSession,
  getCurrentUser,
  hashToken,
  requireAdmin,
  requireUser,
} from "./auth";
import {
  createOrder,
  createOrderInputSchema,
  OrderCreationError,
} from "./modules/orders/application/create-order";
import { StockConflictError } from "./modules/inventory/domain/stock-conflict.error";
import { listCatalogProducts } from "./modules/catalog/infrastructure/catalog-reader";
import { productBodySchema as catalogProductBodySchema } from "./modules/catalog/contracts/product.schemas";
import { getPublicContent } from "./modules/content/application/public-content";
import { runRetention, scheduleDailyRetention } from "./retention";
import { createApp } from "./app";

const app = await createApp();
const apiPort = Number(process.env.PORT || process.env.API_PORT || 4000);
const apiHost = process.env.API_HOST || "0.0.0.0";
const frontendOrigin = process.env.FRONTEND_ORIGIN || "http://localhost:3000";

/* app.setErrorHandler((error, _request, reply) => {
  if (error instanceof ZodError) {
    return reply.code(400).send({
      error: "Nieprawidłowe dane.",
      fields: error.flatten().fieldErrors,
    });
  }
  app.log.error(error);
  return reply.code(500).send({ error: "Wewnętrzny błąd serwera." });
});

*/

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function mapProduct(product: {
  id: number;
  slug: string;
  name: string;
  shortName: string;
  category: string;
  description: string;
  ingredients: string | null;
  allergens: string | null;
  origin: string;
  price: string;
  compareAtPrice: string | null;
  unit: string;
  stock: number;
  imageCrop: string;
  featured: boolean;
  softDeletedAt: Date | null;
  productTags?: { tag: { name: string } }[];
  images?: { url: string; alt: string; position: number }[];
}) {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    shortName: product.shortName,
    category: product.category,
    description: product.description,
    ingredients: product.ingredients,
    allergens: product.allergens,
    origin: product.origin,
    price: Number(product.price),
    compareAt: product.compareAtPrice
      ? Number(product.compareAtPrice)
      : undefined,
    unit: product.unit,
    stock: product.stock,
    crop: product.imageCrop,
    featured: product.featured,
    softDeleted: Boolean(product.softDeletedAt),
    tags: product.productTags?.map((entry) => entry.tag.name) || [],
    images:
      product.images
        ?.sort((a, b) => a.position - b.position)
        .map(({ url, alt }) => ({ url, alt })) || [],
  };
}

export async function loadProducts(includeDeleted = false) {
  const rows = await db.query.products.findMany({
    where: includeDeleted ? undefined : isNull(products.softDeletedAt),
    with: {
      images: true,
      productTags: {
        with: {
          tag: true,
        },
      },
    },
    orderBy: [products.id],
  });
  return rows.map(mapProduct);
}

export const productBodySchema = z.object({
  name: z.string().min(2).max(220),
  shortName: z.string().min(2).max(120),
  category: z.enum(["Oliwa", "Oliwki", "Miody", "Zioła"]),
  description: z.string().min(10),
  ingredients: z.string().optional().default(""),
  allergens: z.string().optional().default(""),
  origin: z.string().optional().default("Grecja"),
  price: z.coerce.number().positive(),
  compareAt: z.coerce.number().positive().optional(),
  unit: z.string().min(1).max(80),
  stock: z.coerce.number().int().min(0),
  crop: z.enum(["oil", "olives", "honey", "oregano"]),
  featured: z.boolean().optional().default(false),
  tags: z.array(z.string().min(1).max(120)).max(20).default([]),
  imageUrl: z.string().max(2_500_000).optional().default(""),
});

const articleBodySchema = z.object({
  title: z.string().min(3).max(240),
  category: z.string().min(2).max(80),
  excerpt: z.string().min(10),
  body: z.string().min(20),
  imageUrl: z.string().max(2_500_000).optional().default(""),
  crop: z.enum(["oil", "olives", "honey", "oregano"]).default("oil"),
  readingTimeMinutes: z.coerce.number().int().min(1).max(120).default(5),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
});

const orderStatuses = [
  "awaiting_payment",
  "paid",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "returned",
] as const;

const returnStatuses = [
  "submitted",
  "reviewing",
  "accepted",
  "rejected",
  "completed",
] as const;

const defaultSiteSettings = {
  groveTitle: "Historia zapisana w słojach",
  groveDescription:
    "Pierwsze drzewa posadził nasz dziadek Nikos. Nie marzył wtedy o sklepie internetowym. Chciał po prostu robić uczciwą oliwę dla rodziny i sąsiadów.",
  groveSecondaryDescription:
    "Dziś łączymy tę samą pracę z kontrolą każdej partii, transportem w stabilnej temperaturze i magazynem w Polsce.",
  contactPhone: "+48 500 600 700",
};

async function loadSiteSettings() {
  const rows = await db.select().from(siteSettings);
  return rows.reduce(
    (result, row) => ({ ...result, [row.key]: row.value }),
    { ...defaultSiteSettings },
  );
}

async function replaceProductTags(productId: number, tagNames: string[]) {
  await db.delete(productTags).where(eq(productTags.productId, productId));
  for (const tagName of tagNames) {
    const slug = slugify(tagName);
    const [tag] = await db
      .insert(tags)
      .values({ slug, name: tagName })
      .onConflictDoUpdate({
        target: tags.slug,
        set: { name: tagName },
      })
      .returning();
    await db
      .insert(productTags)
      .values({ productId, tagId: tag.id })
      .onConflictDoNothing();
  }
}

app.get("/health", async () => {
  const [result] = await sqlClient<{ now: Date }[]>`select now() as now`;
  return { status: "ok", database: "connected", time: result.now };
});

app.get("/products", async () => ({ products: await listCatalogProducts(false) }));

app.get("/content", async () => getPublicContent());

app.get("/content-legacy", async () => {
  const [articleRows, groveRows, settings] = await Promise.all([
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
    loadSiteSettings(),
  ]);
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
});

app.post("/auth/register", async (request, reply) => {
  const body = z
    .object({
      firstName: z.string().min(2).max(100),
      lastName: z.string().min(2).max(120),
      email: z.string().email().max(320),
      password: z.string().min(8).max(128),
    })
    .parse(request.body);
  const email = body.email.trim().toLowerCase();
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing.length) {
    return reply.code(409).send({ error: "Konto z tym adresem już istnieje." });
  }

  const [user] = await db
    .insert(users)
    .values({
      email,
      firstName: body.firstName.trim(),
      lastName: body.lastName.trim(),
      passwordHash: await bcrypt.hash(body.password, 12),
    })
    .returning();

  const verificationToken = randomBytes(32).toString("hex");
  await db.insert(emailVerificationTokens).values({
    userId: user.id,
    tokenHash: hashToken(verificationToken),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });

  return reply.code(201).send({
    message: "Konto utworzone. Potwierdź adres e-mail.",
    localVerificationUrl:
      "http://localhost:" +
      apiPort +
      "/auth/verify-email?token=" +
      verificationToken,
  });
});

app.get("/auth/verify-email", async (request, reply) => {
  const { token } = z.object({ token: z.string().min(32) }).parse(request.query);
  const rows = await db
    .select()
    .from(emailVerificationTokens)
    .where(
      and(
        eq(emailVerificationTokens.tokenHash, hashToken(token)),
        isNull(emailVerificationTokens.usedAt),
        sql`${emailVerificationTokens.expiresAt} > now()`,
      ),
    )
    .limit(1);
  if (!rows.length) {
    return reply.code(400).type("text/html").send(
      "<h1>Link jest nieprawidłowy lub wygasł.</h1>",
    );
  }

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ emailVerifiedAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, rows[0].userId));
    await tx
      .update(emailVerificationTokens)
      .set({ usedAt: new Date() })
      .where(eq(emailVerificationTokens.id, rows[0].id));
  });

  return reply
    .type("text/html")
    .send(
      "<!doctype html><html lang=\"pl\"><meta charset=\"utf-8\"><title>Adres potwierdzony</title><body style=\"font-family:Arial;padding:48px;color:#183027\"><h1>Adres e-mail został potwierdzony.</h1><p>Możesz wrócić do sklepu i się zalogować.</p><a href=\"" +
        frontendOrigin +
        "/#account\">Wróć do Greckiego Gaju</a></body></html>",
    );
});

app.post("/auth/login", async (request, reply) => {
  const body = z
    .object({
      email: z.string().email(),
      password: z.string().min(1),
    })
    .parse(request.body);
  const rows = await db
    .select()
    .from(users)
    .where(
      and(
        eq(users.email, body.email.trim().toLowerCase()),
        isNull(users.deletedAt),
      ),
    )
    .limit(1);
  const user = rows[0];
  if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
    return reply.code(401).send({ error: "Nieprawidłowy e-mail lub hasło." });
  }
  if (!user.emailVerifiedAt) {
    return reply.code(403).send({ error: "Najpierw potwierdź adres e-mail." });
  }
  await createUserSession(user.id, reply);
  return {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    },
  };
});

app.post("/auth/logout", async (request, reply) => {
  await destroyUserSession(request, reply);
  return { ok: true };
});

app.get("/auth/me", async (request, reply) => {
  const user = await getCurrentUser(request);
  if (!user) return reply.code(401).send({ user: null });
  const userAddresses = await db
    .select()
    .from(addresses)
    .where(eq(addresses.userId, user.id))
    .orderBy(desc(addresses.isDefault), desc(addresses.createdAt));
  return { user: { ...user, addresses: userAddresses } };
});

app.post("/addresses", async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const body = z
    .object({
      label: z.string().min(1).max(80),
      firstName: z.string().min(2),
      lastName: z.string().min(2),
      phone: z.string().optional(),
      street: z.string().min(3),
      postalCode: z.string().min(5).max(12),
      city: z.string().min(2),
      isDefault: z.boolean().optional().default(false),
    })
    .parse(request.body);
  if (body.isDefault) {
    await db
      .update(addresses)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(eq(addresses.userId, user.id));
  }
  const [address] = await db
    .insert(addresses)
    .values({ ...body, userId: user.id })
    .returning();
  return reply.code(201).send({ address });
});

app.get("/admin/products", async (request, reply) => {
  const admin = await requireAdmin(request, reply);
  if (!admin) return;
  return { products: await listCatalogProducts(true) };
});

app.post("/admin/products", async (request, reply) => {
  const admin = await requireAdmin(request, reply);
  if (!admin) return;
  const body = catalogProductBodySchema.parse(request.body);
  const baseSlug = slugify(body.shortName + "-" + body.unit);
  const slug = baseSlug + "-" + randomBytes(2).toString("hex");
  const [product] = await db
    .insert(products)
    .values({
      slug,
      name: body.name,
      shortName: body.shortName,
      category: body.category,
      description: body.description,
      ingredients: body.ingredients,
      allergens: body.allergens,
      origin: body.origin,
      price: body.price.toFixed(2),
      compareAtPrice: body.compareAt?.toFixed(2),
      unit: body.unit,
      stock: body.stock,
      imageCrop: body.crop,
      featured: body.featured,
    })
    .returning();
  await db.insert(productImages).values({
    productId: product.id,
    url: body.imageUrl || "/images/product-grid.png",
    alt: product.name,
  });
  await replaceProductTags(product.id, body.tags);
  await db.insert(auditLog).values({
    actorUserId: admin.id,
    action: "product.created",
    entityType: "product",
    entityId: String(product.id),
    payload: { name: product.name },
  });
  const allProducts = await listCatalogProducts(true);
  return reply
    .code(201)
    .send({ product: allProducts.find((item) => item.id === product.id) });
});

app.put("/admin/products/:id", async (request, reply) => {
  const admin = await requireAdmin(request, reply);
  if (!admin) return;
  const { id } = z.object({ id: z.coerce.number().int() }).parse(request.params);
  const body = catalogProductBodySchema.parse(request.body);
  const [updated] = await db
    .update(products)
    .set({
      name: body.name,
      shortName: body.shortName,
      category: body.category,
      description: body.description,
      ingredients: body.ingredients,
      allergens: body.allergens,
      origin: body.origin,
      price: body.price.toFixed(2),
      compareAtPrice: body.compareAt?.toFixed(2) || null,
      unit: body.unit,
      stock: body.stock,
      imageCrop: body.crop,
      featured: body.featured,
      updatedAt: new Date(),
    })
    .where(eq(products.id, id))
    .returning();
  if (!updated) return reply.code(404).send({ error: "Nie znaleziono produktu." });
  await replaceProductTags(id, body.tags);
  if (body.imageUrl) {
    await db.delete(productImages).where(eq(productImages.productId, id));
    await db.insert(productImages).values({
      productId: id,
      url: body.imageUrl,
      alt: body.name,
    });
  }
  await db.insert(auditLog).values({
    actorUserId: admin.id,
    action: "product.updated",
    entityType: "product",
    entityId: String(id),
    payload: { name: updated.name },
  });
  const allProducts = await listCatalogProducts(true);
  return { product: allProducts.find((item) => item.id === id) };
});

app.patch("/admin/products/:id/archive", async (request, reply) => {
  const admin = await requireAdmin(request, reply);
  if (!admin) return;
  const { id } = z.object({ id: z.coerce.number().int() }).parse(request.params);
  const { archived } = z.object({ archived: z.boolean() }).parse(request.body);
  const [updated] = await db
    .update(products)
    .set({
      softDeletedAt: archived ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(products.id, id))
    .returning();
  if (!updated) return reply.code(404).send({ error: "Nie znaleziono produktu." });
  await db.insert(auditLog).values({
    actorUserId: admin.id,
    action: archived ? "product.archived" : "product.restored",
    entityType: "product",
    entityId: String(id),
  });
  return { ok: true };
});

app.delete("/admin/products/:id", async (request, reply) => {
  const admin = await requireAdmin(request, reply);
  if (!admin) return;
  const { id } = z.object({ id: z.coerce.number().int() }).parse(request.params);
  const [deleted] = await db
    .delete(products)
    .where(eq(products.id, id))
    .returning({ id: products.id, name: products.name });
  if (!deleted) return reply.code(404).send({ error: "Nie znaleziono produktu." });
  await db.insert(auditLog).values({
    actorUserId: admin.id,
    action: "product.deleted",
    entityType: "product",
    entityId: String(id),
    payload: { name: deleted.name },
  });
  return reply.code(204).send();
});

app.post("/carts", async (request, reply) => {
  const user = await getCurrentUser(request);
  const [cart] = await db
    .insert(carts)
    .values({ userId: user?.id })
    .returning();
  return reply.code(201).send({ token: cart.token });
});

app.get("/carts/:token", async (request, reply) => {
  const { token } = z.object({ token: z.string().uuid() }).parse(request.params);
  const cart = await db.query.carts.findFirst({
    where: and(eq(carts.token, token), eq(carts.status, "active")),
    with: {
      items: {
        with: {
          product: true,
        },
      },
    },
  });
  if (!cart) return reply.code(404).send({ error: "Koszyk nie istnieje." });
  return {
    token: cart.token,
    items: cart.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
    })),
  };
});

app.put("/carts/:token", async (request, reply) => {
  const { token } = z.object({ token: z.string().uuid() }).parse(request.params);
  const { items } = z
    .object({
      items: z
        .array(
          z.object({
            productId: z.number().int().positive(),
            quantity: z.number().int().min(1).max(99),
          }),
        )
        .max(100),
    })
    .parse(request.body);
  const [cart] = await db
    .select()
    .from(carts)
    .where(and(eq(carts.token, token), eq(carts.status, "active")))
    .limit(1);
  if (!cart) return reply.code(404).send({ error: "Koszyk nie istnieje." });

  const productIds = items.map((item) => item.productId);
  const activeProducts = productIds.length
    ? await db
        .select({ id: products.id })
        .from(products)
        .where(
          and(
            inArray(products.id, productIds),
            isNull(products.softDeletedAt),
          ),
        )
    : [];
  if (activeProducts.length !== new Set(productIds).size) {
    return reply.code(400).send({ error: "Koszyk zawiera niedostępny produkt." });
  }

  const user = await getCurrentUser(request);
  await db.transaction(async (tx) => {
    await tx.delete(cartItems).where(eq(cartItems.cartId, cart.id));
    if (items.length) {
      await tx.insert(cartItems).values(
        items.map((item) => ({
          cartId: cart.id,
          productId: item.productId,
          quantity: item.quantity,
        })),
      );
    }
    await tx
      .update(carts)
      .set({
        userId: user?.id || cart.userId,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(),
      })
      .where(eq(carts.id, cart.id));
  });
  return { ok: true };
});

app.post("/orders", async (request, reply) => {
  const applicationInput = createOrderInputSchema.parse(request.body);
  const applicationUser = await getCurrentUser(request);
  try {
    const result = await createOrder(applicationInput, applicationUser?.id);
    return reply.code(201).send({
      order: {
        id: result.order.id,
        number: result.order.number,
        total: result.total,
        dueAt: result.dueAt,
        status: result.order.status,
      },
    });
  } catch (error) {
    if (error instanceof OrderCreationError) {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    if (error instanceof StockConflictError) {
      return reply.code(409).send({
        error:
          "Produkt " +
          error.productName +
          " nie jest juÅ¼ dostÄ™pny w wybranej iloÅ›ci.",
      });
    }
    throw error;
  }

  /* Legacy inline order implementation retained temporarily while the
   * application use case is verified against the existing client contract.
   */
  /*
  const body = z
    .object({
      cartToken: z.string().uuid(),
      customer: z.object({
        firstName: z.string().min(2),
        lastName: z.string().min(2),
        email: z.string().email(),
        phone: z.string().optional().default(""),
        street: z.string().min(3),
        zip: z.string().min(5),
        city: z.string().min(2),
      }),
      delivery: z.enum(["locker", "courier"]),
      lockerCode: z.string().optional(),
      lockerAddress: z.string().optional(),
    })
    .parse(request.body);
  const user = await getCurrentUser(request);
  const cart = await db.query.carts.findFirst({
    where: and(
      eq(carts.token, body.cartToken),
      eq(carts.status, "active"),
    ),
    with: { items: { with: { product: true } } },
  });
  if (!cart || !cart.items.length) {
    return reply.code(400).send({ error: "Koszyk jest pusty lub wygasł." });
  }
  if (
    body.delivery === "locker" &&
    (!body.lockerCode || !body.lockerAddress)
  ) {
    return reply.code(400).send({ error: "Wybierz Paczkomat." });
  }
  for (const item of cart.items) {
    if (item.product.softDeletedAt || item.product.stock < item.quantity) {
      return reply.code(409).send({
        error: "Produkt " + item.product.name + " nie jest już dostępny.",
      });
    }
  }

  const subtotal = money(
    cart.items.reduce(
      (sum, item) => sum + Number(item.product.price) * item.quantity,
      0,
    ),
  );
  const deliveryCost =
    subtotal >= 199 ? 0 : body.delivery === "locker" ? 12.99 : 16.99;
  const total = money(subtotal + deliveryCost);
  const now = new Date();
  const number =
    "GG/" +
    now.getFullYear() +
    "/" +
    String(now.getMonth() + 1).padStart(2, "0") +
    String(now.getDate()).padStart(2, "0") +
    "-" +
    randomBytes(2).toString("hex").toUpperCase();
  const dueAt = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  let result;
  try {
    result = await db.transaction(async (tx) => {
    const [order] = await tx
      .insert(orders)
      .values({
        number,
        userId: user?.id,
        cartId: cart.id,
        guestEmail: body.customer.email.toLowerCase(),
        firstName: body.customer.firstName,
        lastName: body.customer.lastName,
        phone: body.customer.phone,
        street: body.customer.street,
        postalCode: body.customer.zip,
        city: body.customer.city,
        status: "awaiting_payment",
        subtotal: subtotal.toFixed(2),
        deliveryCost: deliveryCost.toFixed(2),
        total: total.toFixed(2),
      })
      .returning();

    await tx.insert(orderItems).values(
      cart.items.map((item) => ({
        orderId: order.id,
        productId: item.productId,
        productName: item.product.name,
        productUnit: item.product.unit,
        unitPrice: item.product.price,
        quantity: item.quantity,
        lineTotal: money(
          Number(item.product.price) * item.quantity,
        ).toFixed(2),
      })),
    );
    await tx.insert(orderStatusHistory).values({
      orderId: order.id,
      status: "awaiting_payment",
      note: "Zamówienie zostało złożone.",
    });
    await tx.insert(payments).values({
      orderId: order.id,
      amount: total.toFixed(2),
      transferReference: number,
      dueAt,
    });
    await tx.insert(shipments).values({
      orderId: order.id,
      method: body.delivery,
      lockerCode: body.delivery === "locker" ? body.lockerCode : null,
      lockerAddress: body.delivery === "locker" ? body.lockerAddress : null,
    });
      for (const item of cart.items) {
        const [updatedProduct] = await tx
        .update(products)
        .set({
          stock: sql`${products.stock} - ${item.quantity}`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(products.id, item.productId),
            gte(products.stock, item.quantity),
            isNull(products.softDeletedAt),
          ),
        )
        .returning({ id: products.id });
        if (!updatedProduct) {
          throw new StockConflictError(item.product.name);
        }
      }
      await tx
        .update(carts)
        .set({ status: "converted", updatedAt: new Date() })
        .where(eq(carts.id, cart.id));
      return order;
    });
  } catch (error) {
    if (error instanceof StockConflictError) {
      return reply.code(409).send({
        error: "Produkt " + error.productName + " nie jest już dostępny w wybranej ilości.",
      });
    }
    throw error;
  }

  return reply.code(201).send({
    order: {
      id: result.id,
      number: result.number,
      total,
      dueAt,
      status: result.status,
    },
  });
  */
});

app.get("/orders", async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const rows = await db.query.orders.findMany({
    where: eq(orders.userId, user.id),
    with: {
      items: true,
      statusHistory: {
        orderBy: [desc(orderStatusHistory.createdAt)],
      },
      payment: true,
      shipment: true,
    },
    orderBy: [desc(orders.createdAt)],
  });
  return {
    orders: rows.map((order) => ({
      ...order,
      subtotal: Number(order.subtotal),
      deliveryCost: Number(order.deliveryCost),
      total: Number(order.total),
      items: order.items.map((item) => ({
        ...item,
        unitPrice: Number(item.unitPrice),
        lineTotal: Number(item.lineTotal),
      })),
      payment: order.payment
        ? { ...order.payment, amount: Number(order.payment.amount) }
        : null,
    })),
  };
});

app.post("/returns", async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const body = z
    .object({
      orderNumber: z.string().min(3),
      kind: z.string().min(3).max(80),
      description: z.string().min(10),
    })
    .parse(request.body);
  const [order] = await db
    .select()
    .from(orders)
    .where(
      and(eq(orders.number, body.orderNumber), eq(orders.userId, user.id)),
    )
    .limit(1);
  if (!order) {
    return reply.code(404).send({ error: "Nie znaleziono zamówienia." });
  }
  const [returnRequest] = await db
    .insert(returnRequests)
    .values({
      orderId: order.id,
      userId: user.id,
      email: user.email,
      kind: body.kind,
      description: body.description,
    })
    .returning();
  return reply.code(201).send({ returnRequest });
});

app.get("/admin/articles", async (request, reply) => {
  const admin = await requireAdmin(request, reply);
  if (!admin) return;
  const rows = await db.select().from(articles).orderBy(desc(articles.updatedAt));
  return {
    articles: rows.map((article) => ({
      ...article,
      publishedAt: article.publishedAt?.toISOString() || null,
      createdAt: article.createdAt.toISOString(),
      updatedAt: article.updatedAt.toISOString(),
    })),
  };
});

app.post("/admin/articles", async (request, reply) => {
  const admin = await requireAdmin(request, reply);
  if (!admin) return;
  const body = articleBodySchema.parse(request.body);
  const [article] = await db
    .insert(articles)
    .values({
      slug: slugify(body.title) + "-" + randomBytes(2).toString("hex"),
      title: body.title,
      category: body.category,
      excerpt: body.excerpt,
      body: body.body,
      imageUrl: body.imageUrl || null,
      imageCrop: body.crop,
      readingTimeMinutes: body.readingTimeMinutes,
      status: body.status,
      publishedAt: body.status === "published" ? new Date() : null,
    })
    .returning();
  await db.insert(auditLog).values({
    actorUserId: admin.id,
    action: "article.created",
    entityType: "article",
    entityId: String(article.id),
    payload: { title: article.title },
  });
  return reply.code(201).send({ article });
});

app.put("/admin/articles/:id", async (request, reply) => {
  const admin = await requireAdmin(request, reply);
  if (!admin) return;
  const { id } = z.object({ id: z.coerce.number().int() }).parse(request.params);
  const body = articleBodySchema.parse(request.body);
  const [existing] = await db.select().from(articles).where(eq(articles.id, id)).limit(1);
  if (!existing) return reply.code(404).send({ error: "Nie znaleziono artykułu." });
  const [article] = await db
    .update(articles)
    .set({
      title: body.title,
      category: body.category,
      excerpt: body.excerpt,
      body: body.body,
      imageUrl: body.imageUrl || null,
      imageCrop: body.crop,
      readingTimeMinutes: body.readingTimeMinutes,
      status: body.status,
      publishedAt:
        body.status === "published" ? existing.publishedAt || new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(articles.id, id))
    .returning();
  await db.insert(auditLog).values({
    actorUserId: admin.id,
    action: "article.updated",
    entityType: "article",
    entityId: String(id),
    payload: { title: article.title, status: article.status },
  });
  return { article };
});

app.delete("/admin/articles/:id", async (request, reply) => {
  const admin = await requireAdmin(request, reply);
  if (!admin) return;
  const { id } = z.object({ id: z.coerce.number().int() }).parse(request.params);
  const [deleted] = await db.delete(articles).where(eq(articles.id, id)).returning();
  if (!deleted) return reply.code(404).send({ error: "Nie znaleziono artykułu." });
  await db.insert(auditLog).values({
    actorUserId: admin.id,
    action: "article.deleted",
    entityType: "article",
    entityId: String(id),
    payload: { title: deleted.title },
  });
  return reply.code(204).send();
});

app.get("/admin/settings", async (request, reply) => {
  const admin = await requireAdmin(request, reply);
  if (!admin) return;
  return { settings: await loadSiteSettings() };
});

app.put("/admin/settings", async (request, reply) => {
  const admin = await requireAdmin(request, reply);
  if (!admin) return;
  const body = z
    .object({
      groveTitle: z.string().min(3).max(240),
      groveDescription: z.string().min(20),
      groveSecondaryDescription: z.string().min(20),
      contactPhone: z.string().min(7).max(30),
    })
    .parse(request.body);
  for (const [key, value] of Object.entries(body)) {
    await db
      .insert(siteSettings)
      .values({ key, value })
      .onConflictDoUpdate({
        target: siteSettings.key,
        set: { value, updatedAt: new Date() },
      });
  }
  await db.insert(auditLog).values({
    actorUserId: admin.id,
    action: "settings.updated",
    entityType: "site_settings",
    entityId: "public-content",
  });
  return { settings: await loadSiteSettings() };
});

app.get("/admin/orders", async (request, reply) => {
  const admin = await requireAdmin(request, reply);
  if (!admin) return;
  const rows = await db.query.orders.findMany({
    with: {
      user: true,
      items: true,
      payment: true,
      shipment: true,
      statusHistory: { orderBy: [desc(orderStatusHistory.createdAt)] },
    },
    orderBy: [desc(orders.createdAt)],
  });
  return {
    orders: rows.map((order) => ({
      ...order,
      subtotal: Number(order.subtotal),
      deliveryCost: Number(order.deliveryCost),
      total: Number(order.total),
      items: order.items.map((item) => ({
        ...item,
        unitPrice: Number(item.unitPrice),
        lineTotal: Number(item.lineTotal),
      })),
      payment: order.payment
        ? { ...order.payment, amount: Number(order.payment.amount) }
        : null,
    })),
  };
});

app.patch("/admin/orders/:id/status", async (request, reply) => {
  const admin = await requireAdmin(request, reply);
  if (!admin) return;
  const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
  const body = z
    .object({ status: z.enum(orderStatuses), note: z.string().max(500).optional() })
    .parse(request.body);
  const [order] = await db
    .update(orders)
    .set({ status: body.status, updatedAt: new Date() })
    .where(eq(orders.id, id))
    .returning();
  if (!order) return reply.code(404).send({ error: "Nie znaleziono zamówienia." });
  await db.insert(orderStatusHistory).values({
    orderId: id,
    status: body.status,
    note: body.note || "Status zmieniony przez administratora.",
  });
  if (body.status === "paid") {
    await db
      .update(payments)
      .set({ status: "paid", paidAt: new Date(), updatedAt: new Date() })
      .where(eq(payments.orderId, id));
  }
  if (body.status === "shipped") {
    await db
      .update(shipments)
      .set({ shippedAt: new Date(), updatedAt: new Date() })
      .where(eq(shipments.orderId, id));
  }
  if (body.status === "delivered") {
    await db
      .update(shipments)
      .set({ deliveredAt: new Date(), updatedAt: new Date() })
      .where(eq(shipments.orderId, id));
  }
  await db.insert(auditLog).values({
    actorUserId: admin.id,
    action: "order.status_changed",
    entityType: "order",
    entityId: id,
    payload: { number: order.number, status: body.status },
  });
  return { order: { ...order, total: Number(order.total) } };
});

app.get("/admin/returns", async (request, reply) => {
  const admin = await requireAdmin(request, reply);
  if (!admin) return;
  const rows = await db.query.returnRequests.findMany({
    with: { order: { with: { items: true } }, user: true },
    orderBy: [desc(returnRequests.createdAt)],
  });
  return {
    returns: rows.map((item) => ({
      ...item,
      order: {
        ...item.order,
        total: Number(item.order.total),
        items: item.order.items.map((orderItem) => ({
          ...orderItem,
          unitPrice: Number(orderItem.unitPrice),
          lineTotal: Number(orderItem.lineTotal),
        })),
      },
    })),
  };
});

app.patch("/admin/returns/:id/status", async (request, reply) => {
  const admin = await requireAdmin(request, reply);
  if (!admin) return;
  const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
  const body = z
    .object({
      status: z.enum(returnStatuses),
      resolution: z.string().max(2000).optional().default(""),
    })
    .parse(request.body);
  const [item] = await db
    .update(returnRequests)
    .set({
      status: body.status,
      resolution: body.resolution || null,
      updatedAt: new Date(),
    })
    .where(eq(returnRequests.id, id))
    .returning();
  if (!item) return reply.code(404).send({ error: "Nie znaleziono zgłoszenia." });
  await db.insert(auditLog).values({
    actorUserId: admin.id,
    action: "return.status_changed",
    entityType: "return_request",
    entityId: id,
    payload: { status: body.status },
  });
  return { returnRequest: item };
});

app.post("/admin/retention/run", async (request, reply) => {
  const admin = await requireAdmin(request, reply);
  if (!admin) return;
  return { result: await runRetention() };
});

app.get("/admin/database-stats", async (request, reply) => {
  const admin = await requireAdmin(request, reply);
  if (!admin) return;
  const [userCount, productCount, orderCount, returnCount] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(users),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(products)
      .where(isNull(products.softDeletedAt)),
    db.select({ count: sql<number>`count(*)::int` }).from(orders),
    db.select({ count: sql<number>`count(*)::int` }).from(returnRequests),
  ]);
  return {
    users: userCount[0].count,
    products: productCount[0].count,
    orders: orderCount[0].count,
    returns: returnCount[0].count,
  };
});

await sqlClient`select 1`;
scheduleDailyRetention();
await app.listen({ port: apiPort, host: apiHost });
