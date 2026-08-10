import { z } from "zod";

export const productBodySchema = z.object({
  name: z.string().min(2).max(220),
  shortName: z.string().min(2).max(120),
  category: z.enum(["Oliwa", "Oliwki", "Miody", "ZioÅ‚a"]),
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

export type ProductInput = z.infer<typeof productBodySchema>;
