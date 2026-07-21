// ===========================
// SeriesBox — Supabase Client
// ===========================

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.RENDERER_VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.RENDERER_VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ── Auth Helpers ──
export async function signUp(email, password, username) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username }
    }
  })
  if (error) throw error

  // The DB trigger auto-creates the profile.
  // But as a fallback, also try to create it here.
  if (data.user) {
    await ensureProfile(data.user.id, username)
  }

  return data
}

// Ensure a profile exists for the given user (create if missing)
export async function ensureProfile(userId, username) {
  const { data } = await supabase.from('profiles').select('id').eq('id', userId).single()

  if (!data) {
    const { error } = await supabase.from('profiles').upsert(
      {
        id: userId,
        username: username || 'Utilisateur',
        avatar_url: null,
        top_four: []
      },
      { onConflict: 'id' }
    )
    if (error) console.error('Profile ensure error:', error)
  }
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })
  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session
}

export async function getUser() {
  const { data, error } = await supabase.auth.getUser()
  if (error) return null
  return data.user
}

// ── Profile ──
export async function getProfile(userId) {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
  if (error) throw error
  return data
}

export async function updateProfile(userId, updates) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single()
  if (error) throw error
  return data
}

// ── Diary Entries ──
export async function addDiaryEntry(entry) {
  const { data, error } = await supabase.from('diary_entries').insert(entry).select().single()
  if (error) throw error
  return data
}

export async function getDiaryEntries(userId, options = {}) {
  let query = supabase
    .from('diary_entries')
    .select('*')
    .eq('user_id', userId)
    .order('watched_date', { ascending: false })

  if (options.limit) query = query.limit(options.limit)
  if (options.offset)
    query = query.range(options.offset, options.offset + (options.limit || 20) - 1)

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function deleteDiaryEntry(id) {
  const { error } = await supabase.from('diary_entries').delete().eq('id', id)
  if (error) throw error
}

export async function updateDiaryEntry(id, updates) {
  const { data, error } = await supabase
    .from('diary_entries')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getDiaryEntriesForSeries(userId, tmdbId) {
  const { data, error } = await supabase
    .from('diary_entries')
    .select('*')
    .eq('user_id', userId)
    .eq('tmdb_id', tmdbId)
    .order('watched_date', { ascending: false })
  if (error) throw error
  return data
}

// ── Ratings ──
export async function setRating(userId, tmdbId, rating) {
  const { data, error } = await supabase
    .from('ratings')
    .upsert(
      {
        user_id: userId,
        tmdb_id: tmdbId,
        rating,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'user_id,tmdb_id' }
    )
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getRating(userId, tmdbId) {
  const { data, error } = await supabase
    .from('ratings')
    .select('rating')
    .eq('user_id', userId)
    .eq('tmdb_id', tmdbId)
    .single()
  if (error && error.code !== 'PGRST116') throw error
  return data ? data.rating : null
}

export async function getAllRatings(userId) {
  const { data, error } = await supabase.from('ratings').select('*').eq('user_id', userId)
  if (error) throw error
  return data
}

// ── Watchlist ──
export async function addToWatchlist(userId, series) {
  const { data, error } = await supabase
    .from('watchlist')
    .insert({
      user_id: userId,
      tmdb_id: series.id,
      series_name: series.name,
      poster_path: series.poster_path
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function removeFromWatchlist(userId, tmdbId) {
  const { error } = await supabase
    .from('watchlist')
    .delete()
    .eq('user_id', userId)
    .eq('tmdb_id', tmdbId)
  if (error) throw error
}

export async function getWatchlist(userId) {
  const { data, error } = await supabase
    .from('watchlist')
    .select('*')
    .eq('user_id', userId)
    .order('added_at', { ascending: false })
  if (error) throw error
  return data
}

export async function isInWatchlist(userId, tmdbId) {
  const { data, error } = await supabase
    .from('watchlist')
    .select('id')
    .eq('user_id', userId)
    .eq('tmdb_id', tmdbId)
    .single()
  if (error && error.code !== 'PGRST116') throw error
  return !!data
}

// ── Lists ──
export async function createList(userId, title, description = '') {
  const { data, error } = await supabase
    .from('lists')
    .insert({
      user_id: userId,
      title,
      description
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getLists(userId) {
  const { data, error } = await supabase
    .from('lists')
    .select(
      `
      *,
      list_items (
        id, tmdb_id, series_name, poster_path, position
      )
    `
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function getList(listId) {
  const { data, error } = await supabase
    .from('lists')
    .select(
      `
      *,
      list_items (
        id, tmdb_id, series_name, poster_path, position, notes
      )
    `
    )
    .eq('id', listId)
    .single()
  if (error) throw error
  // Sort items by position
  if (data.list_items) {
    data.list_items.sort((a, b) => a.position - b.position)
  }
  return data
}

export async function updateList(listId, updates) {
  const { data, error } = await supabase
    .from('lists')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', listId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteList(listId) {
  const { error } = await supabase.from('lists').delete().eq('id', listId)
  if (error) throw error
}

export async function addToList(listId, series, position) {
  const { data, error } = await supabase
    .from('list_items')
    .insert({
      list_id: listId,
      tmdb_id: series.id || series.tmdb_id,
      series_name: series.name || series.series_name,
      poster_path: series.poster_path,
      position
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function removeFromList(itemId) {
  const { error } = await supabase.from('list_items').delete().eq('id', itemId)
  if (error) throw error
}

// ── Statistics Helpers ──
export async function getStats(userId) {
  const [diary, ratings, watchlist, lists] = await Promise.all([
    getDiaryEntries(userId, { limit: 1000 }),
    getAllRatings(userId),
    getWatchlist(userId),
    getLists(userId)
  ])

  const totalSeries = new Set(diary.map((e) => e.tmdb_id)).size
  const totalEntries = diary.length
  const avgRating =
    ratings.length > 0
      ? (ratings.reduce((sum, r) => sum + Number(r.rating), 0) / ratings.length).toFixed(1)
      : 0

  return {
    diary,
    ratings,
    watchlist,
    lists,
    totalSeries,
    totalEntries,
    totalWatchlist: watchlist.length,
    totalLists: lists.length,
    avgRating
  }
}

// ── Auth state change listener ──
export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange(callback)
}
