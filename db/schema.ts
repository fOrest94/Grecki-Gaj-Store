import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["customer", "admin"]);
export const cartStatus = pgEnum("cart_status", [
  "active",
  "converted",
  "abandoned",
]);
export const orderStatus = pgEnum("order_status", [
  "awaiting_payment",
  "paid",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "returned",
]);
export const paymentStatus = pgEnum("payment_status", [
  "pending",
  "paid",
  "expired",
  "refunded",
]);
export const returnStatus = pgEnum("return_status", [
  "submitted",
  "reviewing",
  "accepted",
  "rejected",
  "completed",
]);
export const contentStatus = pgEnum("content_status", [
  "draft",
  "published",
  "archived",
]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
};

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 320 }).notNull(),
    firstName: varchar("first_name", { length: 100 }).notNull(),
    lastName: varchar("last_name", { length: 120 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    role: userRole("role").default("customer").notNull(),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email)],
);

export const emailVerificationTokens = pgTable(
  "email_verification_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("email_verification_token_unique").on(table.tokenHash),
    index("email_verification_user_idx").on(table.userId),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    tokenHash: varchar("token_hash", { length: 64 }).primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("sessions_user_idx").on(table.userId),
    index("sessions_expires_idx").on(table.expiresAt),
  ],
);

export const addresses = pgTable(
  "addresses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    label: varchar("label", { length: 80 }).default("Dom").notNull(),
    firstName: varchar("first_name", { length: 100 }).notNull(),
    lastName: varchar("last_name", { length: 120 }).notNull(),
    phone: varchar("phone", { length: 30 }),
    street: varchar("street", { length: 220 }).notNull(),
    postalCode: varchar("postal_code", { length: 12 }).notNull(),
    city: varchar("city", { length: 140 }).notNull(),
    countryCode: varchar("country_code", { length: 2 }).default("PL").notNull(),
    isDefault: boolean("is_default").default(false).notNull(),
    ...timestamps,
  },
  (table) => [index("addresses_user_idx").on(table.userId)],
);

export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    slug: varchar("slug", { length: 180 }).notNull(),
    name: varchar("name", { length: 220 }).notNull(),
    shortName: varchar("short_name", { length: 120 }).notNull(),
    category: varchar("category", { length: 80 }).notNull(),
    description: text("description").notNull(),
    ingredients: text("ingredients"),
    allergens: text("allergens"),
    origin: varchar("origin", { length: 160 }).default("Grecja").notNull(),
    price: numeric("price", { precision: 10, scale: 2 }).notNull(),
    compareAtPrice: numeric("compare_at_price", { precision: 10, scale: 2 }),
    unit: varchar("unit", { length: 80 }).notNull(),
    stock: integer("stock").default(0).notNull(),
    imageCrop: varchar("image_crop", { length: 40 }).default("oil").notNull(),
    featured: boolean("featured").default(false).notNull(),
    softDeletedAt: timestamp("soft_deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("products_slug_unique").on(table.slug),
    index("products_category_idx").on(table.category),
    index("products_active_idx")
      .on(table.softDeletedAt)
      .where(sql`${table.softDeletedAt} IS NULL`),
  ],
);

export const productImages = pgTable(
  "product_images",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    alt: varchar("alt", { length: 240 }).notNull(),
    position: integer("position").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("product_images_product_idx").on(table.productId),
    uniqueIndex("product_images_product_url_unique").on(
      table.productId,
      table.url,
    ),
  ],
);

export const tags = pgTable(
  "tags",
  {
    id: serial("id").primaryKey(),
    slug: varchar("slug", { length: 120 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
  },
  (table) => [uniqueIndex("tags_slug_unique").on(table.slug)],
);

export const productTags = pgTable(
  "product_tags",
  {
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.productId, table.tagId] }),
    index("product_tags_tag_idx").on(table.tagId),
  ],
);

export const carts = pgTable(
  "carts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    token: uuid("token").defaultRandom().notNull(),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    status: cartStatus("status").default("active").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true })
      .default(sql`now() + interval '30 days'`)
      .notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("carts_token_unique").on(table.token),
    index("carts_user_idx").on(table.userId),
    index("carts_status_expires_idx").on(table.status, table.expiresAt),
  ],
);

export const cartItems = pgTable(
  "cart_items",
  {
    cartId: uuid("cart_id")
      .notNull()
      .references(() => carts.id, { onDelete: "cascade" }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.cartId, table.productId] }),
    index("cart_items_product_idx").on(table.productId),
  ],
);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    number: varchar("number", { length: 40 }).notNull(),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    cartId: uuid("cart_id").references(() => carts.id, {
      onDelete: "set null",
    }),
    guestEmail: varchar("guest_email", { length: 320 }),
    firstName: varchar("first_name", { length: 100 }),
    lastName: varchar("last_name", { length: 120 }),
    phone: varchar("phone", { length: 30 }),
    street: varchar("street", { length: 220 }),
    postalCode: varchar("postal_code", { length: 12 }),
    city: varchar("city", { length: 140 }),
    countryCode: varchar("country_code", { length: 2 }).default("PL").notNull(),
    status: orderStatus("status").default("awaiting_payment").notNull(),
    subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
    deliveryCost: numeric("delivery_cost", {
      precision: 10,
      scale: 2,
    }).notNull(),
    total: numeric("total", { precision: 10, scale: 2 }).notNull(),
    anonymizedAt: timestamp("anonymized_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("orders_number_unique").on(table.number),
    index("orders_user_created_idx").on(table.userId, table.createdAt),
    index("orders_created_idx").on(table.createdAt),
    index("orders_status_idx").on(table.status),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: serial("id").primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: integer("product_id").references(() => products.id, {
      onDelete: "set null",
    }),
    productName: varchar("product_name", { length: 220 }).notNull(),
    productUnit: varchar("product_unit", { length: 80 }).notNull(),
    unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
    quantity: integer("quantity").notNull(),
    lineTotal: numeric("line_total", { precision: 10, scale: 2 }).notNull(),
  },
  (table) => [index("order_items_order_idx").on(table.orderId)],
);

export const orderStatusHistory = pgTable(
  "order_status_history",
  {
    id: serial("id").primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    status: orderStatus("status").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("order_status_history_order_idx").on(
      table.orderId,
      table.createdAt,
    ),
  ],
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    method: varchar("method", { length: 60 })
      .default("bank_transfer")
      .notNull(),
    status: paymentStatus("status").default("pending").notNull(),
    amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
    transferReference: varchar("transfer_reference", {
      length: 80,
    }).notNull(),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("payments_order_unique").on(table.orderId),
    index("payments_status_due_idx").on(table.status, table.dueAt),
  ],
);

export const shipments = pgTable(
  "shipments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 60 }).default("inpost").notNull(),
    method: varchar("method", { length: 40 }).notNull(),
    lockerCode: varchar("locker_code", { length: 30 }),
    lockerAddress: text("locker_address"),
    trackingNumber: varchar("tracking_number", { length: 100 }),
    shippedAt: timestamp("shipped_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [uniqueIndex("shipments_order_unique").on(table.orderId)],
);

export const returnRequests = pgTable(
  "return_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "restrict" }),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    email: varchar("email", { length: 320 }).notNull(),
    kind: varchar("kind", { length: 80 }).notNull(),
    description: text("description").notNull(),
    status: returnStatus("status").default("submitted").notNull(),
    resolution: text("resolution"),
    ...timestamps,
  },
  (table) => [
    index("returns_order_idx").on(table.orderId),
    index("returns_status_idx").on(table.status),
  ],
);

export const articles = pgTable(
  "articles",
  {
    id: serial("id").primaryKey(),
    slug: varchar("slug", { length: 180 }).notNull(),
    category: varchar("category", { length: 80 }).notNull(),
    title: varchar("title", { length: 240 }).notNull(),
    excerpt: text("excerpt").notNull(),
    body: text("body").notNull(),
    imageUrl: text("image_url"),
    imageCrop: varchar("image_crop", { length: 40 }),
    readingTimeMinutes: integer("reading_time_minutes").default(5).notNull(),
    status: contentStatus("status").default("draft").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("articles_slug_unique").on(table.slug),
    index("articles_status_published_idx").on(table.status, table.publishedAt),
  ],
);

export const groveUpdates = pgTable(
  "grove_updates",
  {
    id: serial("id").primaryKey(),
    slug: varchar("slug", { length: 180 }).notNull(),
    title: varchar("title", { length: 240 }).notNull(),
    summary: text("summary").notNull(),
    body: text("body"),
    imageUrl: text("image_url"),
    imageCrop: varchar("image_crop", { length: 40 }),
    status: contentStatus("status").default("draft").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("grove_updates_slug_unique").on(table.slug),
    index("grove_updates_status_published_idx").on(
      table.status,
      table.publishedAt,
    ),
  ],
);

export const siteSettings = pgTable("site_settings", {
  key: varchar("key", { length: 100 }).primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const accountingDocuments = pgTable(
  "accounting_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "restrict" }),
    documentType: varchar("document_type", { length: 60 }).notNull(),
    documentNumber: varchar("document_number", { length: 100 }).notNull(),
    storageUrl: text("storage_url"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull(),
    retainUntil: timestamp("retain_until", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("accounting_documents_number_unique").on(table.documentNumber),
    index("accounting_documents_retain_idx").on(table.retainUntil),
  ],
);

export const retentionRuns = pgTable("retention_runs", {
  id: serial("id").primaryKey(),
  startedAt: timestamp("started_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  anonymizedOrders: integer("anonymized_orders").default(0).notNull(),
  deletedSessions: integer("deleted_sessions").default(0).notNull(),
  deletedCarts: integer("deleted_carts").default(0).notNull(),
  status: varchar("status", { length: 30 }).default("running").notNull(),
  error: text("error"),
});

export const auditLog = pgTable(
  "audit_log",
  {
    id: serial("id").primaryKey(),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    action: varchar("action", { length: 120 }).notNull(),
    entityType: varchar("entity_type", { length: 80 }).notNull(),
    entityId: varchar("entity_id", { length: 100 }),
    payload: jsonb("payload").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("audit_log_entity_idx").on(table.entityType, table.entityId),
    index("audit_log_created_idx").on(table.createdAt),
  ],
);

export const usersRelations = relations(users, ({ many }) => ({
  addresses: many(addresses),
  orders: many(orders),
  sessions: many(sessions),
}));

export const addressesRelations = relations(addresses, ({ one }) => ({
  user: one(users, {
    fields: [addresses.userId],
    references: [users.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const productsRelations = relations(products, ({ many }) => ({
  images: many(productImages),
  productTags: many(productTags),
  cartItems: many(cartItems),
  orderItems: many(orderItems),
}));

export const productImagesRelations = relations(productImages, ({ one }) => ({
  product: one(products, {
    fields: [productImages.productId],
    references: [products.id],
  }),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  productTags: many(productTags),
}));

export const productTagsRelations = relations(productTags, ({ one }) => ({
  product: one(products, {
    fields: [productTags.productId],
    references: [products.id],
  }),
  tag: one(tags, {
    fields: [productTags.tagId],
    references: [tags.id],
  }),
}));

export const cartsRelations = relations(carts, ({ one, many }) => ({
  user: one(users, { fields: [carts.userId], references: [users.id] }),
  items: many(cartItems),
}));

export const cartItemsRelations = relations(cartItems, ({ one }) => ({
  cart: one(carts, {
    fields: [cartItems.cartId],
    references: [carts.id],
  }),
  product: one(products, {
    fields: [cartItems.productId],
    references: [products.id],
  }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, { fields: [orders.userId], references: [users.id] }),
  items: many(orderItems),
  statusHistory: many(orderStatusHistory),
  payment: one(payments),
  shipment: one(shipments),
  returns: many(returnRequests),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
}));

export const orderStatusHistoryRelations = relations(
  orderStatusHistory,
  ({ one }) => ({
    order: one(orders, {
      fields: [orderStatusHistory.orderId],
      references: [orders.id],
    }),
  }),
);

export const paymentsRelations = relations(payments, ({ one }) => ({
  order: one(orders, {
    fields: [payments.orderId],
    references: [orders.id],
  }),
}));

export const shipmentsRelations = relations(shipments, ({ one }) => ({
  order: one(orders, {
    fields: [shipments.orderId],
    references: [orders.id],
  }),
}));

export const returnRequestsRelations = relations(
  returnRequests,
  ({ one }) => ({
    order: one(orders, {
      fields: [returnRequests.orderId],
      references: [orders.id],
    }),
    user: one(users, {
      fields: [returnRequests.userId],
      references: [users.id],
    }),
  }),
);
