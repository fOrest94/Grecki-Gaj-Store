import type { Product } from "./data";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export type ApiUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "customer" | "admin";
  emailVerifiedAt?: string | null;
  addresses?: Array<{
    id: string;
    label: string;
    firstName: string;
    lastName: string;
    phone?: string | null;
    street: string;
    postalCode: string;
    city: string;
    isDefault: boolean;
  }>;
};

export type ApiOrder = {
  id: string;
  number: string;
  status: string;
  total: number;
  createdAt: string;
  items: Array<{
    id: number;
    productId: number | null;
    productName: string;
    productUnit: string;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
  }>;
};

export type SiteSettings = {
  groveTitle: string;
  groveDescription: string;
  groveSecondaryDescription: string;
  contactPhone: string;
};

export type AdminArticle = {
  id: number;
  title: string;
  category: string;
  excerpt: string;
  body: string;
  imageUrl?: string | null;
  imageCrop: Product["crop"] | null;
  readingTimeMinutes: number;
  status: "draft" | "published" | "archived";
  publishedAt?: string | null;
  updatedAt: string;
};

export type AdminOrder = ApiOrder & {
  firstName?: string | null;
  lastName?: string | null;
  guestEmail?: string | null;
  phone?: string | null;
  street?: string | null;
  postalCode?: string | null;
  city?: string | null;
  subtotal: number;
  deliveryCost: number;
  payment?: { status: string; method: string; amount: number; dueAt: string } | null;
  shipment?: {
    method: string;
    lockerCode?: string | null;
    lockerAddress?: string | null;
    trackingNumber?: string | null;
  } | null;
  statusHistory: Array<{ id: number; status: string; note?: string | null; createdAt: string }>;
  user?: { email: string; firstName: string; lastName: string } | null;
};

export type AdminReturn = {
  id: string;
  email: string;
  kind: string;
  description: string;
  status: "submitted" | "reviewing" | "accepted" | "rejected" | "completed";
  resolution?: string | null;
  createdAt: string;
  order: {
    id: string;
    number: string;
    total: number;
    firstName?: string | null;
    lastName?: string | null;
    items: ApiOrder["items"];
  };
  user?: { email: string; firstName: string; lastName: string } | null;
};

export type ArticlePayload = {
  title: string;
  category: string;
  excerpt: string;
  body: string;
  imageUrl?: string;
  crop: Product["crop"];
  readingTimeMinutes: number;
  status: AdminArticle["status"];
};

type ProductPayload = {
  name: string;
  shortName: string;
  category: Product["category"];
  description: string;
  ingredients?: string;
  allergens?: string;
  origin?: string;
  price: number;
  compareAt?: number;
  unit: string;
  stock: number;
  crop: Product["crop"];
  featured: boolean;
  tags: string[];
  imageUrl?: string;
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(API_URL + path, {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nieznany błąd sieci.";
    throw new Error(`Nie można połączyć z API (${API_URL}${path}): ${message}`);
  }

  if (!response.ok) {
    const body = await response
      .json()
      .catch(() => ({ error: "Nie udało się połączyć z serwerem." }));
    throw new Error(body.error || "Żądanie nie powiodło się.");
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const storeApi = {
  health: () =>
    request<{ status: string; database: string; time: string }>("/health"),

  products: () => request<{ products: Product[] }>("/products"),

  adminProducts: () =>
    request<{ products: Product[] }>("/admin/products"),

  content: () =>
    request<{
      articles: Array<{
        id: number;
        category: string;
        date: string;
        title: string;
        excerpt: string;
        body: string;
        imageUrl?: string | null;
        crop: Product["crop"];
        time: string;
      }>;
      groveUpdates: Array<{
        id: number;
        date: string;
        title: string;
        text: string;
        crop: Product["crop"];
      }>;
      settings: SiteSettings;
    }>("/content"),

  me: () => request<{ user: ApiUser }>("/auth/me"),

  login: (email: string, password: string) =>
    request<{ user: ApiUser }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  register: (data: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
  }) =>
    request<{ message: string; localVerificationUrl: string }>(
      "/auth/register",
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    ),

  logout: () =>
    request<{ ok: true }>("/auth/logout", {
      method: "POST",
      body: JSON.stringify({}),
    }),

  createCart: () =>
    request<{ token: string }>("/carts", {
      method: "POST",
      body: JSON.stringify({}),
    }),

  cart: (token: string) =>
    request<{
      token: string;
      items: Array<{ productId: number; quantity: number }>;
    }>("/carts/" + token),

  syncCart: (
    token: string,
    items: Array<{ productId: number; quantity: number }>,
  ) =>
    request<{ ok: true }>("/carts/" + token, {
      method: "PUT",
      body: JSON.stringify({ items }),
    }),

  createOrder: (data: {
    cartToken: string;
    customer: {
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      street: string;
      zip: string;
      city: string;
    };
    delivery: "locker" | "courier";
    lockerCode?: string;
    lockerAddress?: string;
  }) =>
    request<{
      order: {
        id: string;
        number: string;
        total: number;
        dueAt: string;
        status: string;
      };
    }>("/orders", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  orders: () => request<{ orders: ApiOrder[] }>("/orders"),

  createReturn: (data: {
    orderNumber: string;
    kind: string;
    description: string;
  }) =>
    request<{ returnRequest: { id: string } }>("/returns", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  createProduct: (data: ProductPayload) =>
    request<{ product: Product }>("/admin/products", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateProduct: (id: number, data: ProductPayload) =>
    request<{ product: Product }>("/admin/products/" + id, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  archiveProduct: (id: number, archived: boolean) =>
    request<{ ok: true }>("/admin/products/" + id + "/archive", {
      method: "PATCH",
      body: JSON.stringify({ archived }),
    }),

  deleteProduct: (id: number) =>
    request<void>("/admin/products/" + id, { method: "DELETE" }),

  adminArticles: () =>
    request<{ articles: AdminArticle[] }>("/admin/articles"),

  createArticle: (data: ArticlePayload) =>
    request<{ article: AdminArticle }>("/admin/articles", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateArticle: (id: number, data: ArticlePayload) =>
    request<{ article: AdminArticle }>("/admin/articles/" + id, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteArticle: (id: number) =>
    request<void>("/admin/articles/" + id, { method: "DELETE" }),

  adminSettings: () =>
    request<{ settings: SiteSettings }>("/admin/settings"),

  updateSettings: (settings: SiteSettings) =>
    request<{ settings: SiteSettings }>("/admin/settings", {
      method: "PUT",
      body: JSON.stringify(settings),
    }),

  adminOrders: () =>
    request<{ orders: AdminOrder[] }>("/admin/orders"),

  updateOrderStatus: (id: string, status: string, note = "") =>
    request<{ order: AdminOrder }>("/admin/orders/" + id + "/status", {
      method: "PATCH",
      body: JSON.stringify({ status, note }),
    }),

  adminReturns: () =>
    request<{ returns: AdminReturn[] }>("/admin/returns"),

  updateReturnStatus: (id: string, status: string, resolution = "") =>
    request<{ returnRequest: AdminReturn }>("/admin/returns/" + id + "/status", {
      method: "PATCH",
      body: JSON.stringify({ status, resolution }),
    }),
};
