import { useEffect, useState } from 'react'
import { api, formatPrice } from '../api'
import type { Lang, MenuItem, PublicCategory, PublicMenu } from '../types'

const LANG_KEY = 'harar-lang'

export default function CustomerMenu() {
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem(LANG_KEY) as Lang) || 'en')
  const [menu, setMenu] = useState<PublicMenu | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [catId, setCatId] = useState<string | null>(() => new URLSearchParams(window.location.search).get('cat'))
  const [itemId, setItemId] = useState<string | null>(() => new URLSearchParams(window.location.search).get('item'))
  const [query, setQuery] = useState('')
  const [table] = useState(() => {
    const value = Number(new URLSearchParams(window.location.search).get('table'))
    return Number.isInteger(value) && value > 0 ? value : null
  })
  const [viewer, setViewer] = useState<{ items: MenuItem[]; index: number } | null>(null)

  useEffect(() => {
    if (!viewer) return
    const total = viewer.items.length
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setViewer(null)
      if (total > 1 && event.key === 'ArrowRight') {
        setViewer((v) => (v ? { ...v, index: (v.index + 1) % total } : v))
      }
      if (total > 1 && event.key === 'ArrowLeft') {
        setViewer((v) => (v ? { ...v, index: (v.index - 1 + total) % total } : v))
      }
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [viewer])

  const openViewer = (items: MenuItem[], index: number) => {
    if (items.length === 0) return
    setViewer({ items, index })
  }

  useEffect(() => {
    localStorage.setItem(LANG_KEY, lang)
  }, [lang])

  useEffect(() => {
    document.body.classList.add('is-menu')
    document.documentElement.classList.add('is-menu')
    return () => {
      document.body.classList.remove('is-menu')
      document.documentElement.classList.remove('is-menu')
    }
  }, [])

  useEffect(() => {
    let alive = true
    api
      .fetchMenu()
      .then((m) => {
        if (alive) setMenu(m)
      })
      .catch((err) => {
        if (alive) setError(err.message)
      })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    const onPop = () => {
      const params = new URLSearchParams(window.location.search)
      setCatId(params.get('cat'))
      setItemId(params.get('item'))
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const pushParams = (params: Record<string, string | null>) => {
    const url = new URL(window.location.href)
    url.hash = ''
    for (const [key, value] of Object.entries(params)) {
      if (value === null) url.searchParams.delete(key)
      else url.searchParams.set(key, value)
    }
    window.history.pushState({}, '', url)
    window.scrollTo(0, 0)
  }

  const openCategory = (id: string) => {
    setCatId(id)
    setItemId(null)
    pushParams({ cat: id, item: null })
  }

  const closeAll = () => {
    setCatId(null)
    setItemId(null)
    pushParams({ cat: null, item: null })
  }

  const openItem = (id: string) => {
    setItemId(id)
    pushParams({ cat: catId, item: id })
  }

  const closeItem = () => {
    setItemId(null)
    pushParams({ cat: catId, item: null })
  }

  if (error) {
    return (
      <div className="menu menu--center">
        <div className="empty">
          <p className="empty__emoji">😕</p>
          <p>We couldn&apos;t load the menu.</p>
          <p className="empty__hint">{error}</p>
          <button className="btn btn--primary" onClick={() => window.location.reload()}>
            Try again
          </button>
        </div>
      </div>
    )
  }

  if (!menu) {
    return (
      <div className="menu menu--center">
        <div className="empty">
          <div className="spinner" />
          <p>Loading menu…</p>
        </div>
      </div>
    )
  }

  const activeCat = menu.categories.find((c) => c.id === catId) ?? null
  const currency = menu.hotel.currency

  const page = itemId ? (
    <ItemPage
      menu={menu}
      lang={lang}
      setLang={setLang}
      table={table}
      itemId={itemId}
      backCategory={activeCat}
      onBack={closeItem}
      onOpen={openItem}
      onZoom={openViewer}
    />
  ) : activeCat ? (
    <CategoryPage
      menu={menu}
      lang={lang}
      setLang={setLang}
      category={activeCat}
      table={table}
      onBack={closeAll}
      onOpen={openItem}
      onSwitchCat={openCategory}
      onZoom={openViewer}
      query={query}
      onQueryChange={setQuery}
    />
  ) : (
    <HomePage
      menu={menu}
      lang={lang}
      setLang={setLang}
      table={table}
      onOpen={openItem}
      onOpenCat={openCategory}
      query={query}
      onQueryChange={setQuery}
    />
  )

  const shown = viewer ? viewer.items[viewer.index] : null

  return (
    <>
      {page}

      {viewer && shown && (
        <div
          className="viewer"
          role="dialog"
          aria-modal="true"
          aria-label={itemLabel(shown, lang)}
          onClick={() => setViewer(null)}
        >
          <img className="viewer__img" src={shown.image ?? ''} alt={itemLabel(shown, lang)} />
          <div className="viewer__bar" onClick={(e) => e.stopPropagation()}>
            <span className="viewer__caption">
              {itemLabel(shown, lang)} · {formatPrice(shown.price, currency)}
            </span>
            {viewer.items.length > 1 && (
              <span className="viewer__count">
                {viewer.index + 1} / {viewer.items.length}
              </span>
            )}
          </div>
          {viewer.items.length > 1 && (
            <>
              <button
                className="viewer__nav viewer__nav--prev"
                onClick={(e) => {
                  e.stopPropagation()
                  setViewer((v) =>
                    v ? { ...v, index: (v.index - 1 + v.items.length) % v.items.length } : v,
                  )
                }}
                type="button"
                aria-label="Previous"
              >
                ‹
              </button>
              <button
                className="viewer__nav viewer__nav--next"
                onClick={(e) => {
                  e.stopPropagation()
                  setViewer((v) => (v ? { ...v, index: (v.index + 1) % v.items.length } : v))
                }}
                type="button"
                aria-label="Next"
              >
                ›
              </button>
            </>
          )}
          <button
            className="viewer__close"
            onClick={(e) => {
              e.stopPropagation()
              setViewer(null)
            }}
            type="button"
            aria-label="Close"
          >
            ×
          </button>
        </div>
      )}
    </>
  )
}

function LangToggle({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  return (
    <div className="hero__toggle" role="group" aria-label="Language">
      <button
        className={`hero__toggle-btn ${lang === 'en' ? 'is-active' : ''}`}
        onClick={() => setLang('en')}
        type="button"
      >
        English
      </button>
      <button
        className={`hero__toggle-btn ${lang === 'am' ? 'is-active' : ''}`}
        onClick={() => setLang('am')}
        type="button"
      >
        አማርኛ
      </button>
    </div>
  )
}

function itemLabel(item: { nameEn: string; nameAm: string }, lang: Lang): string {
  return lang === 'am' ? item.nameAm || item.nameEn : item.nameEn
}

function catLabel(cat: { nameEn: string; nameAm: string }, lang: Lang): string {
  return lang === 'am' ? cat.nameAm || cat.nameEn : cat.nameEn
}

function matchFood(item: MenuItem, q: string) {
  const term = q.trim().toLowerCase()
  if (!term) return true

  const haystack = [
    item.nameEn,
    item.nameAm,
    item.descriptionEn,
    item.descriptionAm,
    item.categoryId,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return haystack.includes(term)
}

function SearchBar({
  value,
  onChange,
  lang,
}: {
  value: string
  onChange: (value: string) => void
  lang: Lang
}) {
  return (
    <div className="home-search">
      <input
        className="search"
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={lang === 'am' ? 'ምግብ ፈልግ…' : 'Search food…'}
        aria-label={lang === 'am' ? 'ምግብ ፈልግ' : 'Search food'}
      />
    </div>
  )
}

function MenuItems({
  category,
  lang,
  currency,
  onOpen,
  onZoom,
}: {
  category: PublicCategory
  lang: Lang
  currency: string
  onOpen: (id: string) => void
  onZoom?: (items: MenuItem[], index: number) => void
}) {
  const gallery = category.items.filter((i): i is MenuItem => Boolean(i.image))

  return (
    <ul className="items">
      {category.items.map((item) => (
        <li key={item.id} className="item-wrap">
          <button className="item" onClick={() => onOpen(item.id)} type="button">
            <div className="item__body">
              <div className="item__top">
                <h4 className="item__name">
                  {itemLabel(item, lang)}
                  {item.spicy && (
                    <span className="item__spicy" title="Spicy">
                      🌶
                    </span>
                  )}
                </h4>
                <span className="item__dots" aria-hidden="true"></span>
                <span className="item__price">{formatPrice(item.price, currency)}</span>
              </div>
              {(lang === 'en' ? item.descriptionEn : item.descriptionAm) && (
                <p className="item__desc">{lang === 'en' ? item.descriptionEn : item.descriptionAm}</p>
              )}
            </div>
            {item.image ? (
              <img className="item__img" src={item.image} alt={itemLabel(item, lang)} loading="lazy" />
            ) : (
              <span className="item__img item__img--placeholder" aria-hidden="true">
                {category.emoji}
              </span>
            )}
            <span className="item__open" aria-hidden="true">
              ›
            </span>
          </button>
          {item.image && onZoom && (
            <button
              className="item__zoom"
              onClick={() => onZoom(gallery, Math.max(0, gallery.findIndex((g) => g.id === item.id)))}
              type="button"
              aria-label={lang === 'am' ? 'ምስል ይመልከቱ' : 'View photo'}
            >
              <span aria-hidden="true">⤢</span>
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}

/* ============================================================
   HOME — cover: title + sections
   ============================================================ */
function HomePage({
  menu,
  lang,
  setLang,
  table,
  onOpen,
  onOpenCat,
  query,
  onQueryChange,
}: {
  menu: PublicMenu
  lang: Lang
  setLang: (l: Lang) => void
  table: number | null
  onOpen: (id: string) => void
  onOpenCat: (id: string) => void
  query: string
  onQueryChange: (value: string) => void
}) {
  const hotel = menu.hotel
  const t = (en: string, am: string) => (lang === 'am' ? am : en)
  const photoItems = menu.categories.flatMap((c) => c.items).filter((i) => Boolean(i.image))
  const heroItem = photoItems[2] ?? photoItems[0] ?? null
  const strip = [1, 6, 11]
    .map((n) => photoItems[n])
    .filter((i): i is MenuItem => i !== undefined && Boolean(i.image))
  const matchingItems = query.trim()
    ? menu.categories.flatMap((category) => category.items.filter((item) => matchFood(item, query)))
    : []

  return (
    <div className="poster">
      <div className="poster__panel poster__panel--cover">
        <div className="poster__top">
          <svg className="poster__crown" viewBox="0 0 64 44" aria-hidden="true">
            <defs>
              <linearGradient id="crownGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#f0425e" />
                <stop offset="100%" stopColor="#5cb8ff" />
              </linearGradient>
            </defs>
            <path d="M5 33V11l13 12L32 5l14 18 13-12v22z" fill="url(#crownGrad)" />
            <rect x="5" y="36" width="54" height="5" rx="2.5" fill="#f5f2f7" />
          </svg>
          <div className="poster__brand">
            <span className="poster__logo">{lang === 'am' ? hotel.nameAm : hotel.nameEn}</span>
            <span className="poster__logo-sub">
              {lang === 'am' ? hotel.taglineAm || hotel.taglineEn : hotel.taglineEn}
            </span>
          </div>
        </div>

        <div className="cover">
          <div className="cover__lead">
            <h1 className="poster__title">
              <span>Food</span>
              <span>Menu</span>
            </h1>

            <p className="cover__hint">
              {lang === 'am'
                ? 'ክፍሉን ይምረጡ እና ምግቦችን ይመልከቱ።'
                : 'Choose a section to see its dishes.'}
            </p>

            <SearchBar value={query} onChange={onQueryChange} lang={lang} />

            {query.trim() ? (
              <div className="home-results">
                {matchingItems.length > 0 ? (
                  <MenuItems
                    category={{
                      id: 'search-results',
                      nameEn: 'Search results',
                      nameAm: 'የፍለጋ ውጤቶች',
                      emoji: '🔎',
                      items: matchingItems,
                    }}
                    lang={lang}
                    currency={hotel.currency}
                    onOpen={onOpen}
                  />
                ) : (
                  <div className="empty">
                    <p className="empty__emoji">🔎</p>
                    <p>{lang === 'am' ? 'እንደዚህ ምግብ አልተገኘም።' : 'No matching food found.'}</p>
                  </div>
                )}
              </div>
            ) : (
              <nav className="cover__cats">
                {menu.categories.map((cat) => (
                  <button
                    key={cat.id}
                    className="cover__cat"
                    onClick={() => onOpenCat(cat.id)}
                    type="button"
                  >
                    <span className="cover__cat-emoji" aria-hidden="true">
                      {cat.emoji}
                    </span>
                    <span className="cover__cat-text">
                      <strong>{catLabel(cat, lang)}</strong>
                      <small>
                        {lang === 'am'
                          ? `${cat.items.length} እቃዎች`
                          : `${cat.items.length} items`}
                      </small>
                    </span>
                    <span className="cover__cat-go" aria-hidden="true">
                      ›
                    </span>
                  </button>
                ))}
              </nav>
            )}

            {strip.length > 0 && (
              <div className="cover__strip">
                {strip.map((item) =>
                  item.image ? (
                    <button
                      key={item.id}
                      className="cover__strip-img"
                      onClick={() => onOpen(item.id)}
                      type="button"
                      aria-label={itemLabel(item, lang)}
                    >
                      <img src={item.image} alt="" loading="lazy" />
                    </button>
                  ) : null
                )}
              </div>
            )}
          </div>

          <aside className="cover__aside">
            {heroItem && heroItem.image && (
              <figure className="poster__hero">
                <img src={heroItem.image} alt={itemLabel(heroItem, lang)} />
                <figcaption>{itemLabel(heroItem, lang)}</figcaption>
              </figure>
            )}

            <div className="poster__order">
              <span className="poster__order-label">{t('Delivery Order:', 'ማዘዝ በስልክ:')}</span>
              {hotel.phone && (
                <a className="poster__phone" href={`tel:${hotel.phone.replace(/\\s/g, '')}`}>
                  {hotel.phone}
                </a>
              )}
            </div>

            <div className="poster__meta">
              <LangToggle lang={lang} setLang={setLang} />
              {table !== null && (
                <span className="hero__table poster__table">
                  {t(`Table ${table}`, `ጠረጴዛ ${table}`)}
                </span>
              )}
            </div>
          </aside>
        </div>

        <footer className="poster__foot">
          <span>{lang === 'am' ? hotel.addressAm || hotel.addressEn : hotel.addressEn}</span>
          <span>
            {lang === 'am' ? `ዋጃዎች በ${hotel.currency} ናቸው።` : `All prices in ${hotel.currency}`}
          </span>
          <a className="poster__admin" href="/admin">
            Admin
          </a>
        </footer>
      </div>
    </div>
  )
}



/* ============================================================
   CATEGORY PAGE
   ============================================================ */

function CategoryPage({
  menu,
  lang,
  setLang,
  category,
  table,
  onBack,
  onOpen,
  onSwitchCat,
  onZoom,
  query,
  onQueryChange,
}: {
  menu: PublicMenu
  lang: Lang
  setLang: (l: Lang) => void
  category: PublicCategory
  table: number | null
  onBack: () => void
  onOpen: (id: string) => void
  onSwitchCat: (id: string) => void
  onZoom: (items: MenuItem[], index: number) => void
  query: string
  onQueryChange: (value: string) => void
}) {
  const hotel = menu.hotel
  const others = menu.categories.filter((c) => c.id !== category.id)
  const t = (en: string, am: string) => (lang === 'am' ? am : en)
  const name = catLabel(category, lang)
  const filteredItems = category.items.filter((item) => matchFood(item, query))
  const visibleItems = query.trim() ? filteredItems : category.items

  return (
    <div className="detail">
      <div className="detail__panel">
      <header className="detail__bar">
        <button className="detail__back" onClick={onBack} type="button">
          <span aria-hidden="true">←</span> {t('Menu', 'ምናሌ')}
        </button>
        <LangToggle lang={lang} setLang={setLang} />
      </header>

      <main className="detail__body">
        <div className="cat-hero">
          <span className="cat-hero__emoji" aria-hidden="true">
            {category.emoji}
          </span>
          <h1 className="cat-hero__name">{name}</h1>
          <div className="cat-hero__meta">
            <span className="cat-hero__count">
              {category.items.length} {t('items', 'እቃዎች')}
            </span>
            {table !== null && (
              <span className="hero__table detail__table">{t(`Table ${table}`, `ጠረጴዛ ${table}`)}</span>
            )}
          </div>
        </div>

        <SearchBar value={query} onChange={onQueryChange} lang={lang} />

        <div className={`detail__content cat-scroll${visibleItems.length > 7 ? ' is-many' : ''}`}>
          {visibleItems.length === 0 ? (
            <div className="empty">
              <p className="empty__emoji">🍽️</p>
              <p>{query.trim() ? t('No items match your search.', 'ከፍለጋዎ ጋር የሚስማማ እቃ የለም።') : t('No items here yet.', 'አሁን ምንም እቃ የለም።')}</p>
            </div>
          ) : (
            <MenuItems
              category={{ ...category, items: visibleItems }}
              lang={lang}
              currency={hotel.currency}
              onOpen={onOpen}
              onZoom={onZoom}
            />
          )}

          {others.length > 0 && (
            <div className="detail__more">
              <div className="detail__more-label">{t('Other categories', 'ሌሎች ምድቦች')}</div>
              <div className="cat-switch">
                {others.map((c) => (
                  <button key={c.id} className="cat-chip" onClick={() => onSwitchCat(c.id)} type="button">
                    <span aria-hidden="true">{c.emoji}</span>
                    {catLabel(c, lang)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button className="btn btn--primary btn--block detail__back-btn" onClick={onBack} type="button">
            ← {t('Back to menu', 'ወደ ምናሌ ተመለስ')}
          </button>
        </div>
      </main>
      </div>
    </div>
  )
}

/* ============================================================
   ITEM PAGE
   ============================================================ */

function ItemPage({
  menu,
  lang,
  setLang,
  table,
  itemId,
  backCategory,
  onBack,
  onOpen,
  onZoom,
}: {
  menu: PublicMenu
  lang: Lang
  setLang: (l: Lang) => void
  table: number | null
  itemId: string
  backCategory: PublicCategory | null
  onBack: () => void
  onOpen: (id: string) => void
  onZoom: (items: MenuItem[], index: number) => void
}) {
  const hotel = menu.hotel
  const category = menu.categories.find((c) => c.items.some((i) => i.id === itemId)) ?? null
  const item = category?.items.find((i) => i.id === itemId) ?? null
  const t = (en: string, am: string) => (lang === 'am' ? am : en)

  if (!item || !category) {
    return (
      <div className="detail">
      <div className="detail__panel">
        <header className="detail__bar">
          <button className="btn btn--ghost btn--sm" onClick={onBack} type="button">
            ← {t('Menu', 'ምናሌ')}
          </button>
        </header>
<main className="detail__body detail__body--cat">
          <div className="empty">
            <p className="empty__emoji">🍽️</p>
            <p>{t('Dish not found.', 'ዲሽ አልተገኘም።')}</p>
            <button className="btn btn--primary" onClick={onBack} type="button">
              {t('Back to menu', 'ወደ ምናሌ ተመለስ')}
            </button>
          </div>
        </main>
      </div>
    </div>
    )
  }

  const name = itemLabel(item, lang)
  const desc = lang === 'am' ? item.descriptionAm || item.descriptionEn : item.descriptionEn
  const backLabel = backCategory ? catLabel(backCategory, lang) : t('Menu', 'ምናሌ')
  const others = category.items.filter((i) => i.id !== item.id)
  const gallery: MenuItem[] = [item, ...others].filter((i): i is MenuItem => Boolean(i.image))

  return (
    <div className="detail">
      <div className="detail__panel">
      <header className="detail__bar">
        <button className="detail__back" onClick={onBack} type="button">
          <span aria-hidden="true">←</span> {backLabel}
        </button>
        <LangToggle lang={lang} setLang={setLang} />
      </header>

      <main className="detail__body">
        {item.image ? (
          <button
            className="detail__img-btn"
            onClick={() => onZoom(gallery, Math.max(0, gallery.findIndex((g) => g.id === itemId)))}
            type="button"
          >
            <img className="detail__img" src={item.image} alt={name} />
            <span className="detail__zoom">
              <span aria-hidden="true">⤢</span> {t('Tap to enlarge', 'ለማጽምጽ ይጫኑ')}
            </span>
          </button>
        ) : (
          <div className="detail__img detail__img--placeholder">
            <span aria-hidden="true">{category.emoji}</span>
          </div>
        )}

        <div className="detail__content">
          <div className="detail__kicker">
            <span className="chip-inline">{category.emoji}</span> {catLabel(category, lang)}
            {table !== null && (
              <span className="hero__table detail__table">{t(`Table ${table}`, `ጠረጴዛ ${table}`)}</span>
            )}
          </div>

          <h1 className="detail__name">{name}</h1>

          <div className="detail__price-row">
            <span className="detail__price">{formatPrice(item.price, hotel.currency)}</span>
            {item.spicy && <span className="badge badge--spicy">{t('Spicy 🌶', 'ቅመም 🌶')}</span>}
          </div>

          {desc && <p className="detail__desc">{desc}</p>}

          {((lang === 'am' ? item.ingredientsAm : item.ingredientsEn) ?? []).length > 0 && (
            <div className="detail__ing">
              <div className="detail__ing-title">
                {lang === 'am' ? 'ግብዎች' : 'Ingredients'}
              </div>
              <ul className="detail__ing-list">
                {((lang === 'am' ? item.ingredientsAm : item.ingredientsEn) ?? []).map((ing) => (
                  <li key={ing} className="detail__ing-item">
                    {ing}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="detail__order">
            <div className="detail__order-title">{lang === 'am' ? '📣 ለማዘዝ' : '📣 To order'}</div>
            <p>
              {lang === 'am'
                ? `ለሰራተኛዎ ይንገሩ፦ «${item.nameAm || item.nameEn}»${table ? ` ለጠረጴዛ ${table}` : ''}`
                : `Tell your server — "${item.nameEn}"${table ? ` for table ${table}` : ''}.`}
            </p>
          </div>

          {others.length > 0 && (
            <div className="detail__more">
              <div className="detail__more-label">{t(`More ${catLabel(category, lang)}`, 'በዚህ ምድብ ውስጥ ሌሎች')}</div>
              <div className="detail__more-list">
                {others.map((o) => (
                  <button key={o.id} className="more-chip" onClick={() => onOpen(o.id)} type="button">
                    {o.image && <img src={o.image} alt="" loading="lazy" />}
                    <span>{itemLabel(o, lang)}</span>
                    <em>{formatPrice(o.price, hotel.currency)}</em>
                  </button>
                ))}
              </div>
            </div>
          )}

          <button className="btn btn--primary btn--block detail__back-btn" onClick={onBack} type="button">
            ← {backLabel}
          </button>
        </div>
      </main>
      </div>

    </div>
  )
}