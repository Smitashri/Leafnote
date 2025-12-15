import { supabase } from './supabaseClient';

// Generate and persist anonymous ID
function getAnonId() {
  const key = 'leafnote_anon_id';
  let anonId = localStorage.getItem(key);
  if (!anonId) {
    anonId = crypto.randomUUID ? crypto.randomUUID() : `anon_${Date.now()}_${Math.random()}`;
    localStorage.setItem(key, anonId);
  }
  return anonId;
}

// Get current user ID if logged in
async function getUserId() {
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session?.user?.id || null;
  } catch (e) {
    console.error('Failed to get user session:', e);
    return null;
  }
}

/**
 * Track an event to the leafnote_events table
 * @param {string} eventName - Event name (e.g., "app_open", "signup_success", etc.)
 * @param {object} payload - Optional payload with book details
 * @param {string} payload.book_title
 * @param {string} payload.book_author
 * @param {number} payload.book_rating
 * @param {string} payload.book_status - "read" or "toread"
 * @param {object} payload.metadata - Additional metadata as JSONB
 */
export async function trackEvent(eventName, payload = {}) {
  try {
    const anonId = getAnonId();
    const userId = await getUserId();

    const eventData = {
      anon_id: anonId,
      user_id: userId,
      event_name: eventName,
      book_title: payload.book_title || null,
      book_author: payload.book_author || null,
      book_rating: payload.book_rating || null,
      book_status: payload.book_status || null,
      metadata: payload.metadata || null,
    };

    const { error } = await supabase.from('leafnote_events').insert(eventData);

    if (error) {
      console.error('Analytics tracking error:', error);
    }
  } catch (e) {
    // Fail silently - don't disrupt user experience
    console.error('Failed to track event:', e);
  }
}
