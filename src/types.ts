export interface Hotel {
  nameEn: string
  nameAm: string
  taglineEn: string
  taglineAm: string
  addressEn: string
  addressAm: string
  phone: string
  currency: string
}

export interface AdminHotel extends Hotel {
  publicUrl: string
  tables: number
}

export interface Category {
  id: string
  nameEn: string
  nameAm: string
  emoji: string
}

export interface MenuItem {
  id: string
  categoryId: string
  nameEn: string
  nameAm: string
  descriptionEn: string
  descriptionAm: string
  price: number
  image: string | null
  available: boolean
  spicy: boolean
  ingredientsEn?: string[]
  ingredientsAm?: string[]
}

export interface PublicCategory extends Category {
  items: MenuItem[]
}

export interface PublicMenu {
  hotel: Hotel
  categories: PublicCategory[]
  generatedAt: string
}

export interface AdminCategory extends Category {
  sortOrder: number
  items: MenuItem[]
}

export interface AdminData {
  hotel: AdminHotel
  categories: AdminCategory[]
}

export type Lang = 'en' | 'am'

export const pick = <T extends Record<string, string>>(o: T, lang: Lang): string => o[lang] || o.en