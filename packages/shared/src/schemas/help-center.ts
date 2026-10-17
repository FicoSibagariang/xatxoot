import { z } from 'zod'

// ==========================================
// Phase 4: Help Center & Knowledge Base (Task 4.6)
// ==========================================

export const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

// 1. Portal Schemas
export const CreatePortalInputSchema = z.object({
  name: z.string().min(1, 'Nama portal wajib diisi').max(255),
  slug: z
    .string()
    .min(1, 'Slug portal wajib diisi')
    .max(255)
    .regex(SLUG_REGEX, 'Slug hanya boleh memuat huruf kecil, angka, dan tanda hubung (-)'),
  customDomain: z.string().max(255).nullable().optional(),
  headerText: z.string().nullable().optional(),
  logoUrl: z.string().url('URL logo tidak valid').nullable().optional(),
})
export type CreatePortalInput = z.infer<typeof CreatePortalInputSchema>

export const UpdatePortalInputSchema = CreatePortalInputSchema.partial()
export type UpdatePortalInput = z.infer<typeof UpdatePortalInputSchema>

export const PortalSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  customDomain: z.string().nullable().optional(),
  headerText: z.string().nullable().optional(),
  logoUrl: z.string().nullable().optional(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
})
export type Portal = z.infer<typeof PortalSchema>

// 2. Portal Category Schemas
export const CreatePortalCategoryInputSchema = z.object({
  portalId: z.string().uuid('Portal ID harus berformat UUID yang valid'),
  name: z.string().min(1, 'Nama kategori wajib diisi').max(255),
  slug: z
    .string()
    .min(1, 'Slug kategori wajib diisi')
    .max(255)
    .regex(SLUG_REGEX, 'Slug hanya boleh memuat huruf kecil, angka, dan tanda hubung (-)'),
  description: z.string().nullable().optional(),
  position: z.number().int().nonnegative().default(0),
})
export type CreatePortalCategoryInput = z.infer<typeof CreatePortalCategoryInputSchema>

export const UpdatePortalCategoryInputSchema = CreatePortalCategoryInputSchema.partial().omit({
  portalId: true,
})
export type UpdatePortalCategoryInput = z.infer<typeof UpdatePortalCategoryInputSchema>

export const PortalCategorySchema = z.object({
  id: z.string().uuid(),
  portalId: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable().optional(),
  position: z.number().int(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
})
export type PortalCategory = z.infer<typeof PortalCategorySchema>

// Category Schema Aliases
export const CreateCategoryInputSchema = CreatePortalCategoryInputSchema
export type CreateCategoryInput = CreatePortalCategoryInput
export const UpdateCategoryInputSchema = UpdatePortalCategoryInputSchema
export type UpdateCategoryInput = UpdatePortalCategoryInput
export const CategorySchema = PortalCategorySchema
export type Category = PortalCategory

// 3. Portal Article Schemas
export const ArticleStatusSchema = z.enum(['draft', 'published', 'archived'])
export type ArticleStatus = z.infer<typeof ArticleStatusSchema>

export const CreatePortalArticleInputSchema = z.object({
  categoryId: z.string().uuid('Category ID harus berformat UUID yang valid'),
  authorId: z.string().uuid('Author ID harus berformat UUID yang valid').nullable().optional(),
  title: z.string().min(1, 'Judul artikel wajib diisi').max(255),
  slug: z
    .string()
    .min(1, 'Slug artikel wajib diisi')
    .max(255)
    .regex(SLUG_REGEX, 'Slug hanya boleh memuat huruf kecil, angka, dan tanda hubung (-)'),
  contentMarkdown: z.string().default(''),
  status: ArticleStatusSchema.default('draft'),
})
export type CreatePortalArticleInput = z.infer<typeof CreatePortalArticleInputSchema>

export const UpdatePortalArticleInputSchema = z.object({
  categoryId: z.string().uuid('Category ID harus berformat UUID yang valid').optional(),
  authorId: z.string().uuid('Author ID harus berformat UUID yang valid').nullable().optional(),
  title: z.string().min(1, 'Judul artikel wajib diisi').max(255).optional(),
  slug: z
    .string()
    .min(1, 'Slug artikel wajib diisi')
    .max(255)
    .regex(SLUG_REGEX, 'Slug hanya boleh memuat huruf kecil, angka, dan tanda hubung (-)')
    .optional(),
  contentMarkdown: z.string().optional(),
  status: ArticleStatusSchema.optional(),
})
export type UpdatePortalArticleInput = z.infer<typeof UpdatePortalArticleInputSchema>

export const PortalArticleSchema = z.object({
  id: z.string().uuid(),
  categoryId: z.string().uuid(),
  authorId: z.string().uuid().nullable().optional(),
  title: z.string(),
  slug: z.string(),
  contentMarkdown: z.string(),
  status: ArticleStatusSchema,
  viewsCount: z.number().int().nonnegative().default(0),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
})
export type PortalArticle = z.infer<typeof PortalArticleSchema>

// Article Schema Aliases
export const CreateArticleInputSchema = CreatePortalArticleInputSchema
export type CreateArticleInput = CreatePortalArticleInput
export const UpdateArticleInputSchema = UpdatePortalArticleInputSchema
export type UpdateArticleInput = UpdatePortalArticleInput
export const ArticleSchema = PortalArticleSchema
export type Article = PortalArticle
