import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { api, clearToken, formatPrice, getToken, setToken } from '../api'
import type { AdminCategory, AdminData, AdminHotel, MenuItem } from '../types'

type Tab = 'menu' | 'hotel' | 'tables'

const EMOJIS = ['🍛', '☕', '🍹', '🍺', '🎉', '🍽️', '🥗', '🍗', '🥩', '🍕', '🍔', '🥑', '🍜', '🍰', '🍵', '🥤', '🍾', '🍮']

export default function Admin() {
  const [booted, setBooted] = useState(() => Boolean(getToken()))
  return booted ? <Dashboard onLoggedOut={() => { clearToken(); setBooted(false) }} /> : <Login onAuthed={() => setBooted(true)} />
}

function Login({ onAuthed }: { onAuthed: () => void }) {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const { token } = await api.login(password)
      setToken(token)
      onAuthed()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="admin">
      <div className="login-card">
        <div className="login-card__brand">
          <span className="login-card__emoji">🍽️</span>
          <h1>Menu Admin</h1>
          <p>Sign in to manage your hotel menu.</p>
        </div>
        <form className="login-card__form" onSubmit={submit}>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              placeholder="Enter admin password"
            />
          </label>
          {error && <p className="form-error">{error}</p>}
          <button className="btn btn--primary btn--block" disabled={busy || !password} type="submit">
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <a className="login-card__back" href="/">
          ← Back to menu
        </a>
      </div>
    </div>
  )
}

function Dashboard({ onLoggedOut }: { onLoggedOut: () => void }) {
  const [data, setData] = useState<AdminData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState<Tab>('menu')
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const refresh = async (silent = false) => {
    if (!silent) setBusy(true)
    setError(null)
    try {
      const d = await api.fetchAdminData()
      setData(d)
      setSelectedCatId((prev) => (prev && d.categories.some((c) => c.id === prev) ? prev : d.categories[0]?.id ?? null))
    } catch (err) {
      const message = (err as Error).message
      if (message === 'Not authorized') {
        onLoggedOut()
        return
      }
      setError(message)
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    refresh(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const flash = (message: string) => {
    setNotice(message)
    window.setTimeout(() => setNotice(null), 2500)
  }

  if (!data) {
    return (
      <div className="admin">
        <div className="empty">
          {error ? (
            <>
              <p className="empty__emoji">😕</p>
              <p>{error}</p>
              <button className="btn btn--primary" onClick={() => refresh()}>
                Retry
              </button>
            </>
          ) : (
            <>
              <div className="spinner" />
              <p>Loading…</p>
            </>
          )}
        </div>
      </div>
    )
  }

return (
    <div className="admin">
      <header className="admin__bar">
        <div className="admin__bar-inner">
          <div className="admin__title">
            <span aria-hidden="true">🍽️</span>
            <div>
              <strong>Menu Admin</strong>
              <small>{data.hotel.nameEn}</small>
            </div>
          </div>
          <nav className="admin__tabs" role="tablist">
            <button className={tab === 'menu' ? 'is-active' : ''} onClick={() => setTab('menu')} type="button">
              Menu
            </button>
            <button className={tab === 'hotel' ? 'is-active' : ''} onClick={() => setTab('hotel')} type="button">
              Hotel
            </button>
            <button className={tab === 'tables' ? 'is-active' : ''} onClick={() => setTab('tables')} type="button">
              QR Tables
            </button>
          </nav>
          <div className="admin__actions">
            <a className="btn btn--ghost btn--sm" href="/">
              View menu ↗
            </a>
            <button className="btn btn--ghost btn--sm" onClick={onLoggedOut} type="button">
              Log out
            </button>
          </div>
        </div>
      </header>

      {notice && <div className="notice">{notice}</div>}
      {error && <div className="notice notice--error">{error}</div>}

      <main className="admin__main">
        {tab === 'menu' && (
          <MenuTab
            data={data}
            selectedCatId={selectedCatId}
            onSelectCat={setSelectedCatId}
            onChanged={() => refresh(true)}
            flash={flash}
          />
        )}
        {tab === 'hotel' && <HotelTab hotel={data.hotel} busy={busy} onSaved={() => refresh(true)} flash={flash} />}
        {tab === 'tables' && <TablesTab hotel={data.hotel} />}
      </main>
    </div>
  )
}

/* ---------- Menu tab ---------- */

interface MenuTabProps {
  data: AdminData
  selectedCatId: string | null
  onSelectCat: (id: string) => void
  onChanged: () => void
  flash: (message: string) => void
}

function MenuTab({ data, selectedCatId, onSelectCat, onChanged, flash }: MenuTabProps) {
  const [editingCat, setEditingCat] = useState<AdminCategory | null>(null)
  const [creatingCat, setCreatingCat] = useState(false)
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null)
  const [creatingItem, setCreatingItem] = useState(false)

  const selectedCat = data.categories.find((c) => c.id === selectedCatId) ?? null

  const handleDeleteCat = async (cat: AdminCategory) => {
    if (!window.confirm(`Delete "${cat.nameEn}" and all its items?`)) return
    try {
      await api.deleteCategory(cat.id)
      flash(`Deleted "${cat.nameEn}"`)
      onChanged()
    } catch (err) {
      flash(`Failed: ${(err as Error).message}`)
    }
  }

  const handleDeleteItem = async (item: MenuItem) => {
    if (!window.confirm(`Delete "${item.nameEn}"?`)) return
    try {
      await api.deleteItem(item.id)
      flash(`Deleted "${item.nameEn}"`)
      onChanged()
    } catch (err) {
      flash(`Failed: ${(err as Error).message}`)
    }
  }

  return (
    <div className="menu-tab">
      <aside className="cat-list">
        <div className="cat-list__head">
          <span>Categories</span>
          <button className="btn btn--ghost btn--sm" onClick={() => setCreatingCat(true)} type="button">
            + New
          </button>
        </div>
        {data.categories.map((cat) => (
          <div key={cat.id} className={`cat-row ${cat.id === selectedCatId ? 'is-active' : ''}`}>
            <button className="cat-row__main" onClick={() => onSelectCat(cat.id)} type="button">
              <span className="cat-row__emoji" aria-hidden="true">
                {cat.emoji}
              </span>
              <span className="cat-row__name">
                <strong>{cat.nameEn}</strong>
                <small>{cat.nameAm}</small>
              </span>
              <span className="cat-row__count">{cat.items.length}</span>
            </button>
            <div className="cat-row__actions">
              <button
                className="icon-btn"
                onClick={() => setEditingCat(cat)}
                title="Edit category"
                aria-label="Edit category"
                type="button"
              >
                ✏️
              </button>
              <button
                className="icon-btn icon-btn--danger"
                onClick={() => handleDeleteCat(cat)}
                title="Delete category"
                aria-label="Delete category"
                type="button"
              >
                🗑️
              </button>
            </div>
          </div>
        ))}
        {data.categories.length === 0 && <p className="cat-list__empty">No categories yet.</p>}
      </aside>

      <section className="cat-detail">
        {selectedCat ? (
          <>
            <div className="cat-detail__head">
              <h2>
                <span aria-hidden="true" style={{ marginRight: 8 }}>
                  {selectedCat.emoji}
                </span>
                {selectedCat.nameEn}
              </h2>
              <button className="btn btn--primary" onClick={() => setCreatingItem(true)} type="button">
                + Add item
              </button>
            </div>
            {selectedCat.items.length === 0 ? (
              <div className="empty empty--small">
                <p>No items in this category yet.</p>
              </div>
            ) : (
              <ul className="manage-items">
                {selectedCat.items.map((item) => (
                  <li key={item.id} className={`manage-item ${item.available ? '' : 'manage-item--hidden'}`}>
                    {item.image && <img className="manage-item__img" src={item.image} alt={item.nameEn} />}
                    <div className="manage-item__body">
                      <div className="manage-item__top">
                        <strong>
                          {item.nameEn}
                          {item.spicy && <span title="Spicy"> 🌶</span>}
                        </strong>
                        <span className="manage-item__price">{formatPrice(item.price, data.hotel.currency)}</span>
                      </div>
                      <div className="manage-item__meta">
                        {!item.available && <span className="badge">Hidden</span>}
                        <small>{item.nameAm}</small>
                      </div>
                    </div>
                    <div className="manage-item__actions">
                      <button className="icon-btn" onClick={() => setEditingItem(item)} title="Edit" aria-label="Edit item" type="button">
                        ✏️
                      </button>
                      <button
                        className="icon-btn icon-btn--danger"
                        onClick={() => handleDeleteItem(item)}
                        title="Delete"
                        aria-label="Delete item"
                        type="button"
                      >
                        🗑️
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <div className="empty empty--small">
            <p>Select a category to manage its items.</p>
          </div>
        )}
      </section>

      {creatingCat && (
        <CategoryModal category={null} onClose={() => setCreatingCat(false)} onSaved={() => { setCreatingCat(false); flash('Category added'); onChanged() }} />
      )}
      {editingCat && (
        <CategoryModal
          category={editingCat}
          onClose={() => setEditingCat(null)}
          onSaved={() => { setEditingCat(null); flash('Category updated'); onChanged() }}
        />
      )}
      {creatingItem && selectedCat && (
        <ItemModal
          categoryId={selectedCat.id}
          currency={data.hotel.currency}
          item={null}
          categories={data.categories}
          onClose={() => setCreatingItem(false)}
          onSaved={() => { setCreatingItem(false); flash('Item added'); onChanged() }}
        />
      )}
      {editingItem && (
        <ItemModal
          categoryId={editingItem.categoryId}
          currency={data.hotel.currency}
          item={editingItem}
          categories={data.categories}
          onClose={() => setEditingItem(null)}
          onSaved={() => { setEditingItem(null); flash('Item updated'); onChanged() }}
        />
      )}
    </div>
  )
}

/* ---------- Category modal ---------- */

function CategoryModal({
  category,
  onClose,
  onSaved,
}: {
  category: AdminCategory | null
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState(() => ({
    nameEn: category?.nameEn ?? '',
    nameAm: category?.nameAm ?? '',
    emoji: category?.emoji ?? '🍽️',
  }))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nameEn.trim()) return
    setBusy(true)
    setError(null)
    try {
      if (category) await api.updateCategory(category.id, form)
      else await api.createCategory(form)
      onSaved()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={category ? 'Edit category' : 'New category'} onClose={onClose}>
      <form onSubmit={save}>
        <label>
          Name (English)
          <input value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} placeholder="e.g. Food" autoFocus />
        </label>
        <label>
          Name (አማርኛ)
          <input value={form.nameAm} onChange={(e) => setForm({ ...form, nameAm: e.target.value })} placeholder="e.g. ምግብ" />
        </label>
        <label>
          Emoji
          <div className="emoji-pick">
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className={`emoji-pick__btn ${form.emoji === emoji ? 'is-active' : ''}`}
                onClick={() => setForm({ ...form, emoji })}
              >
                {emoji}
              </button>
            ))}
          </div>
        </label>
        {error && <p className="form-error">{error}</p>}
        <div className="modal__actions">
          <button className="btn btn--ghost" onClick={onClose} type="button">
            Cancel
          </button>
          <button className="btn btn--primary" disabled={busy || !form.nameEn.trim()} type="submit">
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/* ---------- Item modal ---------- */

interface ItemForm {
  categoryId: string
  nameEn: string
  nameAm: string
  descriptionEn: string
  descriptionAm: string
  ingredientsEn: string
  ingredientsAm: string
  price: string
  image: string | null
  available: boolean
  spicy: boolean
}

function ItemModal({
  categoryId,
  currency,
  item,
  categories,
  onClose,
  onSaved,
}: {
  categoryId: string
  currency: string
  item: MenuItem | null
  categories: AdminData['categories']
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<ItemForm>(() => ({
    categoryId: item?.categoryId ?? categoryId,
    nameEn: item?.nameEn ?? '',
    nameAm: item?.nameAm ?? '',
    descriptionEn: item?.descriptionEn ?? '',
    descriptionAm: item?.descriptionAm ?? '',
    ingredientsEn: (item?.ingredientsEn ?? []).join(', '),
    ingredientsAm: (item?.ingredientsAm ?? []).join(', '),
    price: item ? String(item.price) : '',
    image: item?.image ?? null,
    available: item?.available ?? true,
    spicy: item?.spicy ?? false,
  }))
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nameEn.trim()) return
    setBusy(true)
    setError(null)
    const payload = {
      categoryId: form.categoryId,
      nameEn: form.nameEn,
      nameAm: form.nameAm,
      descriptionEn: form.descriptionEn,
      descriptionAm: form.descriptionAm,
      ingredientsEn: form.ingredientsEn
        .split(/[,\n]/)
        .map((v) => v.trim())
        .filter(Boolean),
      ingredientsAm: form.ingredientsAm
        .split(/[,\n]/)
        .map((v) => v.trim())
        .filter(Boolean),
      price: Number(form.price) || 0,
      image: form.image,
      available: form.available,
      spicy: form.spicy,
    }
    try {
      if (item) await api.updateItem(item.id, payload)
      else await api.createItem(payload)
      onSaved()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const uploadFile = async (file: File) => {
    setUploading(true)
    setError(null)
    try {
      const { url } = await api.upload(file)
      setForm((f) => ({ ...f, image: url }))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <Modal title={item ? 'Edit item' : 'New item'} onClose={onClose}>
      <form onSubmit={save}>
        <div className="form-grid">
          <label>
            Category
            <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emoji} {c.nameEn}
                </option>
              ))}
            </select>
          </label>
          <label>
            Price ({currency})
            <input
              type="number"
              min="0"
              step="0.5"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              placeholder="0"
            />
          </label>
        </div>
        <label>
          Name (English) *
          <input value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} placeholder="e.g. Kitfo" autoFocus />
        </label>
        <label>
          Name (አማርኛ)
          <input value={form.nameAm} onChange={(e) => setForm({ ...form, nameAm: e.target.value })} placeholder="e.g. ክትፎ" />
        </label>
        <label>
          Description (English)
          <textarea
            rows={3}
            value={form.descriptionEn}
            onChange={(e) => setForm({ ...form, descriptionEn: e.target.value })}
            placeholder="Short description"
          />
        </label>
        <label>
          Description (አማርኛ)
          <textarea
            rows={3}
            value={form.descriptionAm}
            onChange={(e) => setForm({ ...form, descriptionAm: e.target.value })}
            placeholder="አጭር መግለጫ"
          />
        </label>

        <label>
          Ingredients (English) — comma separated
          <textarea
            rows={2}
            value={form.ingredientsEn}
            onChange={(e) => setForm({ ...form, ingredientsEn: e.target.value })}
            placeholder="beef, mitmita, niter kibbeh, ayib cheese"
          />
        </label>
        <label>
          ግብዎች (አማርኛ) — በኮማ ይለያሉ
          <textarea
            rows={2}
            value={form.ingredientsAm}
            onChange={(e) => setForm({ ...form, ingredientsAm: e.target.value })}
            placeholder="በርገር፣ ሚጥሚጣ፣ ንጥር ቅቤ፣ አይብ"
          />
        </label>

        <div className="field">
          <span className="field__label">Photo</span>
          {form.image ? (
            <div className="img-upload">
              <img src={form.image} alt="Item preview" />
              <div className="img-upload__actions">
                <button className="btn btn--ghost btn--sm" onClick={() => setForm({ ...form, image: null })} type="button">
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <label className="img-upload--picker">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) uploadFile(file)
                }}
              />
              {uploading ? 'Uploading…' : 'Upload photo'}
            </label>
          )}
        </div>

        <div className="form-row form-row--checks">
          <label className="check">
            <input type="checkbox" checked={form.available} onChange={(e) => setForm({ ...form, available: e.target.checked })} />
            Available
          </label>
          <label className="check">
            <input type="checkbox" checked={form.spicy} onChange={(e) => setForm({ ...form, spicy: e.target.checked })} />
            Spicy 🌶
          </label>
        </div>

        {error && <p className="form-error">{error}</p>}
        <div className="modal__actions">
          <button className="btn btn--ghost" onClick={onClose} type="button">
            Cancel
          </button>
          <button className="btn btn--primary" disabled={busy || !form.nameEn.trim()} type="submit">
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close" type="button">
            ✕
          </button>
        </div>
        <div className="modal__body">{children}</div>
      </div>
    </div>
  )
}

/* ---------- Hotel tab ---------- */

function HotelTab({ hotel, busy, onSaved, flash }: { hotel: AdminHotel; busy: boolean; onSaved: () => void; flash: (m: string) => void }) {
  const [draft, setDraft] = useState<AdminHotel | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setDraft({ ...hotel })
  }, [hotel])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!draft) return
    setSaving(true)
    setError(null)
    try {
      await api.updateHotel(draft)
      flash('Hotel settings saved')
      onSaved()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (!draft) return null

  const set = (patch: Partial<AdminHotel>) => setDraft({ ...draft, ...patch })

  return (
    <form className="hotel-form" onSubmit={save}>
      <div className="panel">
        <h2>Name & tagline</h2>
        <div className="form-grid">
          <label>
            Name (English)
            <input value={draft.nameEn} onChange={(e) => set({ nameEn: e.target.value })} />
          </label>
          <label>
            Name (አማርኛ)
            <input value={draft.nameAm} onChange={(e) => set({ nameAm: e.target.value })} />
          </label>
          <label>
            Tagline (English)
            <input value={draft.taglineEn} onChange={(e) => set({ taglineEn: e.target.value })} />
          </label>
          <label>
            Tagline (አማርኛ)
            <input value={draft.taglineAm} onChange={(e) => set({ taglineAm: e.target.value })} />
          </label>
        </div>
      </div>

      <div className="panel">
        <h2>Contact & currency</h2>
        <div className="form-grid">
          <label>
            Address (English)
            <input value={draft.addressEn} onChange={(e) => set({ addressEn: e.target.value })} />
          </label>
          <label>
            Address (አማርኛ)
            <input value={draft.addressAm} onChange={(e) => set({ addressAm: e.target.value })} />
          </label>
          <label>
            Phone
            <input value={draft.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="+251 …" />
          </label>
          <label>
            Currency
            <input value={draft.currency} onChange={(e) => set({ currency: e.target.value })} placeholder="ETB" />
          </label>
        </div>
      </div>

      <div className="panel">
        <h2>Public menu & tables</h2>
        <div className="form-grid">
          <label className="wide">
            Public URL (used for QR codes — the address customers use to open this app)
            <input value={draft.publicUrl} onChange={(e) => set({ publicUrl: e.target.value })} placeholder="https://menu.myhotel.com" />
          </label>
          <label>
            Number of tables
            <input
              type="number"
              min="1"
              max="200"
              value={draft.tables}
              onChange={(e) => set({ tables: Math.max(1, Math.min(200, Number(e.target.value) || 1)) })}
            />
          </label>
        </div>
        <p className="hint">Point the QR codes at the Public URL above so guests land on your menu.</p>
      </div>

      {error && <p className="form-error">{error}</p>}
      <div className="hotel-form__actions">
        <button className="btn btn--primary" disabled={saving || busy} type="submit">
          {saving ? 'Saving…' : 'Save settings'}
        </button>
      </div>
    </form>
  )
}

/* ---------- Tables / QR tab ---------- */

function TablesTab({ hotel }: { hotel: AdminHotel }) {
  const [qr, setQr] = useState<Record<number, string>>({})
  const tables = hotel.tables
  const base = hotel.publicUrl.replace(/\/+$/, '')

  useEffect(() => {
    let alive = true
    const jobs = Array.from({ length: tables }, (_, i) => i + 1).map((n) =>
      QRCode.toDataURL(`${base}?table=${n}`, {
        width: 320,
        margin: 2,
        color: { dark: '#23272b', light: '#ffffff' },
      })
        .then((url) => [n, url] as const)
        .catch(() => [n, ''] as const),
    )
    Promise.all(jobs).then((rows) => {
      if (alive) setQr(Object.fromEntries(rows))
    })
    return () => {
      alive = false
    }
  }, [tables, base])

  return (
    <div className="tables-tab">
      <div className="tables-tab__intro">
        <h2>Print-ready QR codes</h2>
        <p>
          Each code opens your menu and shows the table number to your staff. Download one QR per table, or print the whole
          sheet and cut them out. Save the QR codes as PNGs and share them with your printing shop.
        </p>
        <div className="tables-tab__actions">
          <a className="btn btn--primary" href="#print-area" onClick={() => window.print()}>
            🖨 Print all {tables} tables
          </a>
        </div>
      </div>

      <div id="print-area" className="qr-grid print-sheet">
        <div className="print-head">
          <strong>{hotel.nameEn}</strong> · Table QR codes · {new Date().toLocaleDateString()}
        </div>
        {Array.from({ length: tables }, (_, i) => i + 1).map((n) => (
          <div key={n} className="qr-card">
            <div className="qr-card__num">Table {n}</div>
            {qr[n] ? (
              <>
                <img className="qr-card__img" src={qr[n]} alt={`QR code for table ${n}`} />
                <div className="qr-card__meta">
                  <span className="qr-card__url">{`${base}?table=${n}`}</span>
                  <a href={qr[n]} download={`table-${n}-qr.png`} className="btn btn--ghost btn--sm">
                    Download
                  </a>
                </div>
              </>
            ) : (
              <div className="qr-card__img qr-card__img--loading">
                <div className="spinner" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}