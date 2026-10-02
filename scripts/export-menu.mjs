import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const db = JSON.parse(fs.readFileSync(path.join(root, 'data', 'db.json'), 'utf8'))

const sortedCategories = [...db.categories].sort(
  (a, b) => a.sortOrder - b.sortOrder || a.nameEn.localeCompare(b.nameEn),
)

const sortedItems = (categoryId) =>
  db.items
    .filter((item) => item.categoryId === categoryId && item.available)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.nameEn.localeCompare(b.nameEn))

const h = db.hotel
const payload = {
  hotel: {
    nameEn: h.nameEn,
    nameAm: h.nameAm,
    taglineEn: h.taglineEn,
    taglineAm: h.taglineAm,
    addressEn: h.addressEn,
    addressAm: h.addressAm,
    phone: h.phone,
    currency: h.currency,
  },
  categories: sortedCategories.map((category) => ({
    id: category.id,
    nameEn: category.nameEn,
    nameAm: category.nameAm,
    emoji: category.emoji,
    items: sortedItems(category.id),
  })),
  generatedAt: new Date().toISOString(),
}

const outDir = path.join(root, 'public')
fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(path.join(outDir, 'menu.json'), JSON.stringify(payload, null, 2))

const count = payload.categories.reduce((sum, c) => sum + c.items.length, 0)
console.log(`public/menu.json written — ${payload.categories.length} categories, ${count} items`)
