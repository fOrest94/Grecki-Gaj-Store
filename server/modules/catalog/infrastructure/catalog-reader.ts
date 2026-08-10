import { isNull } from "drizzle-orm";
import { db } from "../../../../db";
import { products } from "../../../../db/schema";

type ProductRow = {
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
};

export function mapCatalogProduct(product: ProductRow) {
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

export async function listCatalogProducts(includeDeleted = false) {
  const rows = await db.query.products.findMany({
    where: includeDeleted ? undefined : isNull(products.softDeletedAt),
    with: {
      images: true,
      productTags: { with: { tag: true } },
    },
    orderBy: [products.id],
  });
  return rows.map(mapCatalogProduct);
}
