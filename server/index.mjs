import express from 'express'
import multer from 'multer'
import cors from 'cors'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const APP_ROOT = path.resolve(__dirname, '..')
const DATA_DIR = process.env.HARAR_DATA_DIR || path.join(APP_ROOT, 'data')
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads')
const DB_FILE = path.join(DATA_DIR, 'db.json')
const DIST_DIR = path.join(APP_ROOT, 'dist')
const PORT = process.env.PORT || 4000
const ADMIN_PASSWORD = process.env.HARAR_ADMIN_PASSWORD || 'admin123'

fs.mkdirSync(UPLOAD_DIR, { recursive: true })

let db = { hotel: null, categories: [], items: [] }
let writeQueue = Promise.resolve()

function emptyDb() {
  return {
    hotel: {
      nameEn: 'Harar Hotel',
      nameAm: 'የሐረር ሆቴል',
      taglineEn: 'Taste the heart of the walled city',
      taglineAm: 'የክበብ ከተማን ልብ ይቅመሱ',
      addressEn: 'Main Street / City Center, Harar, Ethiopia',
      addressAm: 'ሐረር፣ ኢትዮጵያ',
      phone: '',
      currency: 'ETB',
      publicUrl: 'http://localhost:3000',
      tables: 10,
    },
    categories: [],
    items: [],
  }
}

function loadDb() {
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8')
    db = JSON.parse(raw)
  } catch {
    db = emptyDb()
    saveDb()
  }
  if (!db.hotel) db.hotel = emptyDb().hotel
  if (!Array.isArray(db.categories)) db.categories = []
  if (!Array.isArray(db.items)) db.items = []
}

function saveDb() {
  const data = JSON.stringify(db, null, 2)
  writeQueue = writeQueue.then(() => fs.promises.writeFile(DB_FILE, data))
  return writeQueue.catch((error) => console.error('Failed to save db:', error))
}

loadDb()

const token = (bytes = 8) => crypto.randomBytes(bytes).toString('hex')
const clean = (value, max = 1000) =>
  typeof value === 'string' ? value.trim().slice(0, max) : ''
const num = (value, fallback = 0) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}
const textOrNull = (value, max = 1000) => {
  const t = clean(value, max)
  return t === '' ? null : t
}
const ingredientList = (value) => {
  const arr = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[,\n]/) : []
  return arr.map((v) => clean(v, 80)).filter(Boolean).slice(0, 24)
}

const sessions = new Map()
const SESSION_TTL = 24 * 60 * 60 * 1000

function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const match = /^Bearer (.+)$/.exec(header)
  const token = match ? match[1] : null
  if (!token || !sessions.has(token)) return res.status(401).json({ error: 'Not authorized' })
  next()
}

const app = express()
app.use(cors())
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d' }))
app.use(express.json({ limit: '1mb' }))

/* ---------- uploads ---------- */

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' }

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
      const ext = EXT[file.mimetype] || '.jpg'
      cb(null, `${Date.now()}-${crypto.randomBytes(3).toString('hex')}${ext}`)
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED.includes(file.mimetype)) cb(null, true)
    else cb(new Error('Only images (jpg, png, webp, gif) are allowed'))
  },
})

app.post('/api/upload', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
  res.json({ url: `/uploads/${req.file.filename}` })
})

/* ---------- public menu ---------- */

function publicHotel(h) {
  return {
    nameEn: h.nameEn,
    nameAm: h.nameAm,
    taglineEn: h.taglineEn,
    taglineAm: h.taglineAm,
    addressEn: h.addressEn,
    addressAm: h.addressAm,
    phone: h.phone,
    currency: h.currency,
  }
}

function sortedCategories() {
  return [...db.categories].sort((a, b) => a.sortOrder - b.sortOrder || a.nameEn.localeCompare(b.nameEn))
}

function sortedItems(categoryId, includeHidden = false) {
  return db.items
    .filter((i) => i.categoryId === categoryId && (includeHidden || i.available))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.nameEn.localeCompare(b.nameEn))
}

app.get('/api/menu', (req, res) => {
  const categories = sortedCategories().map((c) => ({
    id: c.id,
    nameEn: c.nameEn,
    nameAm: c.nameAm,
    emoji: c.emoji,
    items: sortedItems(c.id),
  }))
  res.json({ hotel: publicHotel(db.hotel), categories, generatedAt: new Date().toISOString() })
})

/* ---------- admin auth ---------- */

app.post('/api/admin/login', (req, res) => {
  if (!req.body || req.body.password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Incorrect password' })
  }
  const t = token(16)
  sessions.set(t, Date.now())
  res.json({ token: t })
})

/* ---------- admin data ---------- */

app.get('/api/admin/data', requireAuth, (req, res) => {
  res.json({
    hotel: db.hotel,
    categories: sortedCategories().map((c) => ({
      id: c.id,
      nameEn: c.nameEn,
      nameAm: c.nameAm,
      emoji: c.emoji,
      sortOrder: c.sortOrder,
      items: sortedItems(c.id, true),
    })),
  })
})

app.put('/api/admin/hotel', requireAuth, (req, res) => {
  const b = req.body || {}
  const hotel = db.hotel
  hotel.nameEn = clean(b.nameEn, 100) || hotel.nameEn
  hotel.nameAm = clean(b.nameAm, 100) || hotel.nameAm
  hotel.taglineEn = clean(b.taglineEn, 200)
  hotel.taglineAm = clean(b.taglineAm, 200)
  hotel.addressEn = clean(b.addressEn, 200)
  hotel.addressAm = clean(b.addressAm, 200)
  hotel.phone = clean(b.phone, 40)
  hotel.currency = clean(b.currency, 10) || 'ETB'
  hotel.publicUrl = clean(b.publicUrl, 200) || hotel.publicUrl
  hotel.tables = Math.max(1, Math.min(200, Math.floor(num(b.tables, hotel.tables))))
  saveDb()
  res.json({ ok: true, hotel })
})

app.post('/api/admin/categories', requireAuth, (req, res) => {
  const b = req.body || {}
  const nameEn = clean(b.nameEn, 80)
  const nameAm = clean(b.nameAm, 80)
  if (!nameEn) return res.status(400).json({ error: 'nameEn is required' })
  const sortOrder = num(b.sortOrder, Date.now() % 100000)
  const category = {
    id: token(6),
    nameEn,
    nameAm: nameAm || nameEn,
    emoji: clean(b.emoji, 8) || '🍽️',
    sortOrder,
  }
  db.categories.push(category)
  saveDb()
  res.status(201).json({ ok: true, category })
})

app.put('/api/admin/categories/:id', requireAuth, (req, res) => {
  const category = db.categories.find((c) => c.id === req.params.id)
  if (!category) return res.status(404).json({ error: 'Category not found' })
  const b = req.body || {}
  if (clean(b.nameEn, 80)) category.nameEn = clean(b.nameEn, 80)
  if (clean(b.nameAm, 80)) category.nameAm = clean(b.nameAm, 80)
  if (clean(b.emoji, 8)) category.emoji = clean(b.emoji, 8)
  if (b.sortOrder !== undefined) category.sortOrder = num(b.sortOrder, category.sortOrder)
  saveDb()
  res.json({ ok: true, category })
})

app.delete('/api/admin/categories/:id', requireAuth, (req, res) => {
  const id = req.params.id
  const idx = db.categories.findIndex((c) => c.id === id)
  if (idx === -1) return res.status(404).json({ error: 'Category not found' })
  db.categories.splice(idx, 1)
  db.items = db.items.filter((i) => i.categoryId !== id)
  saveDb()
  res.json({ ok: true })
})

app.post('/api/admin/items', requireAuth, (req, res) => {
  const b = req.body || {}
  const nameEn = clean(b.nameEn, 120)
  const categoryId = clean(b.categoryId, 40)
  if (!nameEn) return res.status(400).json({ error: 'nameEn is required' })
  if (!db.categories.some((c) => c.id === categoryId)) {
    return res.status(400).json({ error: 'Unknown category' })
  }
  const item = {
    id: token(6),
    categoryId,
    nameEn,
    nameAm: clean(b.nameAm, 120) || nameEn,
    descriptionEn: clean(b.descriptionEn, 600),
    descriptionAm: clean(b.descriptionAm, 600),
    price: Math.round(num(b.price, 0) * 100) / 100,
    image: textOrNull(b.image, 300),
    available: b.available !== false,
    spicy: b.spicy === true,
    ingredientsEn: ingredientList(b.ingredientsEn),
    ingredientsAm: ingredientList(b.ingredientsAm),
    sortOrder: b.sortOrder !== undefined ? num(b.sortOrder, 0) : db.items.filter((i) => i.categoryId === categoryId).length,
  }
  db.items.push(item)
  saveDb()
  res.status(201).json({ ok: true, item })
})

app.put('/api/admin/items/:id', requireAuth, (req, res) => {
  const item = db.items.find((i) => i.id === req.params.id)
  if (!item) return res.status(404).json({ error: 'Item not found' })
  const b = req.body || {}
  if (clean(b.nameEn, 120)) item.nameEn = clean(b.nameEn, 120)
  if (clean(b.nameAm, 120)) item.nameAm = clean(b.nameAm, 120)
  item.descriptionEn = clean(b.descriptionEn, 600)
  item.descriptionAm = clean(b.descriptionAm, 600)
  item.price = Math.round(num(b.price, item.price) * 100) / 100
  item.image = textOrNull(b.image, 300) === null ? null : textOrNull(b.image, 300)
  item.available = b.available === true
  item.spicy = b.spicy === true
  if (b.ingredientsEn !== undefined) item.ingredientsEn = ingredientList(b.ingredientsEn)
  if (b.ingredientsAm !== undefined) item.ingredientsAm = ingredientList(b.ingredientsAm)
  if (b.categoryId && db.categories.some((c) => c.id === b.categoryId)) item.categoryId = b.categoryId
  if (b.sortOrder !== undefined) item.sortOrder = num(b.sortOrder, item.sortOrder)
  saveDb()
  res.json({ ok: true, item })
})

app.delete('/api/admin/items/:id', requireAuth, (req, res) => {
  const idx = db.items.findIndex((i) => i.id === req.params.id)
  if (idx === -1) return res.status(404).json({ error: 'Item not found' })
  const [removed] = db.items.splice(idx, 1)
  if (removed.image && removed.image.startsWith('/uploads/')) {
    fs.promises.unlink(path.join(UPLOAD_DIR, path.basename(removed.image))).catch(() => {})
  }
  saveDb()
  res.json({ ok: true })
})

/* ---------- static frontend ---------- */

const indexHtml = path.join(DIST_DIR, 'index.html')
app.use(express.static(DIST_DIR))
app.use((req, res, next) => {
  if (req.method !== 'GET') return next()
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next()
  if (!fs.existsSync(indexHtml)) {
    return res.status(200).send('Frontend not built yet. Run: npm run build (or npm run dev)')
  }
  res.sendFile(indexHtml)
})

/* ---------- errors ---------- */

app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    const msg = error.code === 'LIMIT_FILE_SIZE' ? 'File is too large (max 5MB)' : error.message
    return res.status(400).json({ error: msg })
  }
  if (error instanceof Error && /image/i.test(error.message)) {
    return res.status(400).json({ error: error.message })
  }
  if (error instanceof SyntaxError && error.status === 400) {
    return res.status(400).json({ error: 'Invalid request body' })
  }
  console.error(error)
  res.status(500).json({ error: 'Something went wrong' })
})

app.listen(PORT, () => {
  console.log(`Harar Hotel Menu server running on http://localhost:${PORT}`)
  console.log(`Admin login: /admin  (default password: ${ADMIN_PASSWORD === 'admin123' ? 'admin123' : '<env HARAR_ADMIN_PASSWORD>'})`)
})