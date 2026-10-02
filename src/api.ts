import type { AdminData, MenuItem, PublicMenu } from './types'

const TOKEN_KEY = 'harar-admin-token'

export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (t: string) => localStorage.setItem(TOKEN_KEY, t)
export const clearToken = () => localStorage.removeItem(TOKEN_KEY)

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(url, { ...options, headers })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed (${res.status})`)
  }
  return data as T
}

export interface CategoryInput {
  nameEn: string
  nameAm: string
  emoji: string
}

export interface ItemInput {
  categoryId: string
  nameEn: string
  nameAm: string
  descriptionEn: string
  descriptionAm: string
  price: number
  image: string | null
  available: boolean
  spicy: boolean
  ingredientsEn: string[]
  ingredientsAm: string[]
}

export type HotelInput = Omit<AdminData['hotel'], 'currency' | 'tables' | 'publicUrl'> & {
  currency: string
  tables: number
  publicUrl: string
}

export const api = {
  fetchMenu: async () => {
    try {
      return await request<PublicMenu>('/api/menu')
    } catch {
      return await request<PublicMenu>('/menu.json')
    }
  },

  login: (password: string) => request<{ token: string }>('/api/admin/login', {
    method: 'POST',
    body: JSON.stringify({ password }),
  }),

  fetchAdminData: () => request<AdminData>('/api/admin/data'),

  updateHotel: (hotel: AdminData['hotel']) => request<{ ok: boolean }>('/api/admin/hotel', {
    method: 'PUT',
    body: JSON.stringify(hotel),
  }),

  createCategory: (input: CategoryInput) => request<{ ok: boolean }>('/api/admin/categories', {
    method: 'POST',
    body: JSON.stringify(input),
  }),

  updateCategory: (id: string, input: CategoryInput) => request<{ ok: boolean }>(`/api/admin/categories/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  }),

  deleteCategory: (id: string) => request<{ ok: boolean }>(`/api/admin/categories/${id}`, {
    method: 'DELETE',
  }),

  createItem: (input: ItemInput) => request<{ ok: boolean }>('/api/admin/items', {
    method: 'POST',
    body: JSON.stringify(input),
  }),

  updateItem: (id: string, input: ItemInput) => request<{ ok: boolean }>(`/api/admin/items/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  }),

  deleteItem: (id: string) => request<{ ok: boolean }>(`/api/admin/items/${id}`, {
    method: 'DELETE',
  }),

  upload: async (file: File) => {
    const form = new FormData()
    form.append('file', file)
    const headers: Record<string, string> = {}
    const token = getToken()
    if (token) headers.Authorization = `Bearer ${token}`
    const res = await fetch('/api/upload', { method: 'POST', body: form, headers })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error((data as { error?: string }).error || 'Upload failed')
    return data as { url: string }
  },
}

export function sortItems(items: MenuItem[]): MenuItem[] {
  return [...items].sort((a, b) => a.nameEn.localeCompare(b.nameEn))
}

export function formatPrice(price: number, currency: string): string {
  const value = price % 1 === 0 ? price.toFixed(0) : price.toFixed(2)
  return `${value} ${currency}`
}