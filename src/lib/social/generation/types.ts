// src/lib/social/generation/types.ts
export type PostType = "doctor" | "educational" | "promo" | "engagement" | "trust"

export type Slide = {
  heading?: string   // Optional bold title; first slide always uses this.
  body: string       // Main slide text (numbered point, testimonial quote, etc.)
}

export type GeneratedContent = {
  post_type: PostType
  caption: string
  hashtags: string[]
  image_idea: string
  department?: string
  slides?: Slide[]     // Required when post_type === 'educational' | 'trust'
}

export type VisionContent = {
  post_type: "trust" | "promo"
  caption: string
  hashtags: string[]
  quote?: string
}

export class GenerationError extends Error {
  constructor(message: string, public raw?: string) { super(message) }
}
