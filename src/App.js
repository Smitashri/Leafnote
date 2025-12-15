import React, { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import logoSvg from './leafnote-logo.svg';
import { supabase, supabaseConfigOk, supabaseConfig } from './supabaseClient';
import Login from './Login';
import Consent from './Consent';
import { trackEvent } from './analytics';

const STORAGE_KEY = 'booktracker_v1';

function App() {
	const PUBLIC = process.env.PUBLIC_URL || '';
	const bgUrl = `${PUBLIC}/leafnote.jpg`;

	// If you have a short display URL (Bitly) you want Supabase to redirect through,
	// set it here as a fallback when `REACT_APP_SUPABASE_REDIRECT_TO` is not provided at build time.
	// You already created: https://bit.ly/Leafnote
	const FALLBACK_SHORT_REDIRECT = 'https://bit.ly/Leafnote';


	const [readBooks, setReadBooks] = useState([]);
	const [toReadBooks, setToReadBooks] = useState([]);

	// auth
	const [user, setUser] = useState(null);
	const [authEmail, setAuthEmail] = useState('');
	const [usePassword, setUsePassword] = useState(false);
	const [authPassword, setAuthPassword] = useState('');
	const [signInDebug, setSignInDebug] = useState(null);
	const [authMessage, setAuthMessage] = useState(null);
	const [authError, setAuthError] = useState(null);
    const [forgotCooldown, setForgotCooldown] = useState(0);

	const [readTitle, setReadTitle] = useState('');
	const [readRating, setReadRating] = useState(0);
	const [toReadTitle, setToReadTitle] = useState('');
	const [feedbackText, setFeedbackText] = useState('');
	const [feedbackSending, setFeedbackSending] = useState(false);

	const fileInputRef = useRef(null);

	// Google Books recommendations state & cache
	const [gbLoading, setGbLoading] = useState(false);
	const [gbRecos, setGbRecos] = useState([]);
	const GB_CACHE_KEY = 'booktracker_recos_v1';
	const GB_CACHE_TTL = 24 * 60 * 60 * 1000; // 24h

	// load local
	useEffect(() => {
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (!raw) return;
			const parsed = JSON.parse(raw);
			setReadBooks(Array.isArray(parsed.readBooks) ? parsed.readBooks : []);
			setToReadBooks(Array.isArray(parsed.toReadBooks) ? parsed.toReadBooks : []);
		} catch (e) {
			setReadBooks([]);
			setToReadBooks([]);
		}

		// Track app open
		trackEvent('app_open');
	}, []);

	// persist local
	useEffect(() => {
		localStorage.setItem(STORAGE_KEY, JSON.stringify({ readBooks, toReadBooks }));
	}, [readBooks, toReadBooks]);

	// auth init & listener
	useEffect(() => {
		let mounted = true;
		(async () => {
			try {
				const { data } = await supabase.auth.getSession();
				const session = data?.session;
				if (mounted && session?.user) {
					setUser(session.user);
					try { const key = `leafnote_magic_sent_${String(session.user.email||'').toLowerCase()}`; localStorage.removeItem(key); } catch(e){}
					await fetchAndMerge(session.user);
				}
			} catch (err) {
				console.error(err);
			}
		})();

		const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
			const u = session?.user ?? null;
			setUser(u);
			if (u) {
				try { const key = `leafnote_magic_sent_${String(u.email||'').toLowerCase()}`; localStorage.removeItem(key); } catch(e){}
				fetchAndMerge(u).catch(console.error);
			}
		});

		return () => sub?.subscription?.unsubscribe();
	}, []);

	// fetch server rows and merge
	async function fetchAndMerge(supabaseUser) {
		if (!supabaseUser) return;
		const uid = supabaseUser.id;
		const { data, error } = await supabase.from('books').select('*').eq('user_id', uid).order('created_at', { ascending: false });
		if (error) { console.error(error); return; }

		const serverRead = (data || []).filter(r => r.status === 'read').map(r => ({ id: r.id, title: r.title, rating: r.rating, dateRead: r.date_read || r.created_at, author: r.author || '', shortDescription: r.short_description || '' }));
		const serverToRead = (data || []).filter(r => r.status === 'to_read').map(r => ({ id: r.id, title: r.title, dateAdded: r.date_added || r.created_at, author: r.author || '', shortDescription: r.short_description || '' }));

		// If server has rows for this user, use them. If not, do NOT auto-upsert
		// local (previously anonymous) data into the new user's account —
		// that leaks other users' entries when multiple users share a browser.
		if (serverRead.length || serverToRead.length) {
			setReadBooks(serverRead);
			setToReadBooks(serverToRead);
		} else {
			// Ensure a fresh, empty view for new users signing in on shared browsers.
			setReadBooks([]);
			setToReadBooks([]);
		}
	}

	// Footer share link copy
	const SHARE_LINK = 'https://bit.ly/Leafnote';
	const [linkCopied, setLinkCopied] = useState(false);

	async function copyShareLink() {
		try {
			await navigator.clipboard.writeText(SHARE_LINK);
			setLinkCopied(true);
			setTimeout(() => setLinkCopied(false), 2000);
		} catch (e) {
			console.error('copy failed', e);
			alert('Copy failed — please select and copy the link manually.');
		}
	}

	async function signIn(email) {
	 	if (!email) return alert('Enter your email');
	 	try {
	 		const key = `leafnote_magic_sent_${String(email||'').toLowerCase()}`;
	 		if (localStorage.getItem(key)) {
	 			alert('A magic link was already sent to this email — check your inbox.');
	 			return;
	 		}
	 		// Prefer explicit env var, then prefer your short Bitly URL, then fall back to current origin
	 		const redirectTo = process.env.REACT_APP_SUPABASE_REDIRECT_TO || FALLBACK_SHORT_REDIRECT || `${window.location.origin}${process.env.PUBLIC_URL || ''}`;
	 		// pass both option names to be compatible with different SDK/server behaviors
	 		const resp = await supabase.auth.signInWithOtp({ email }, { emailRedirectTo: redirectTo, redirectTo });
	 		setSignInDebug({ redirectTo, resp });
	 		console.log('leafnote: signIn response', { redirectTo, resp });
	 		try{ window.__leafnote_last_signin = { redirectTo, resp }; }catch(e){}
	 		if (resp?.error) {
	 			alert(resp.error.message || 'Sign-in error');
	 		} else {
	 			localStorage.setItem(key, String(Date.now()));
	 			alert('Check your email for the magic link.');
	 		}
	 	} catch (err) {
	 		console.error(err);
	 		alert('Failed to request magic link.');
	 	}
	}

	async function signUpWithPassword(email, password) {
		setAuthError(null); setAuthMessage(null);
		if (!email || !password) { setAuthError('Enter email and password'); return; }
		// basic validation
		if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(email))) { setAuthError('Please enter a valid email address'); return; }
		if (String(password).length < 6) { setAuthError('Password must be at least 6 characters'); return; }
		try {
			const { data, error } = await supabase.auth.signUp({ email, password });
			setSignInDebug({ method: 'signUp', resp: data, error });
			console.log('leafnote: signUp response', { data, error });
			if (error) {
				if (/(already registered|already exists|duplicate|user exists)/i.test(error.message || '')) {
					setAuthError('Account already exists. Please sign in or use Forgot password.');
				} else {
					setAuthError(error.message || 'Sign-up error');
				}
			} else {
				// If signUp succeeds, attempt immediate sign-in (in case confirmation is not required)
				try {
					const { data: signData, error: signErr } = await supabase.auth.signInWithPassword({ email, password });
					if (signErr) {
						// likely requires email confirmation or invalid credentials
						setAuthMessage('Account created. Please check your email to confirm your account before signing in.');
						setSignInDebug({ method: 'signUp->signInAttempt', resp: signData, error: signErr });
					trackEvent('signup_success');
					} else {
						setAuthMessage('Account created and signed in.');
						if (signData?.session?.user) setUser(signData.session.user);
					trackEvent('signup_success');
					}
				} catch (e) {
					console.error('sign-in-after-signup failed', e);
				trackEvent('signup_success');
					setAuthMessage('Account created. Please sign in.');
				}
				// do not auto-sign-in; user should sign in with their credentials
			}
		} catch (err) {
			console.error(err);
			setAuthError('Failed to sign up.');
		}
	}

	async function signInWithPassword(email, password) {
		setAuthError(null); setAuthMessage(null);
		if (!email || !password) { setAuthError('Enter email and password'); return; }
		try {
			const { data, error } = await supabase.auth.signInWithPassword({ email, password });
			setSignInDebug({ method: 'signInPassword', resp: data, error });
			console.log('leafnote: signInWithPassword response', { data, error });
			try{ window.__leafnote_last_signin = { method: 'signInPassword', data, error }; }catch(e){}
			if (error) {
				// Provide clearer guidance for common invalid credentials / unconfirmed accounts
				if (error?.code === 'invalid_credentials' || error?.status === 400) {
					setAuthError('Invalid email or password. If you recently signed up, check your email to confirm your account. Use Forgot password to reset your password.');
				} else {
					setAuthError(error.message || 'Sign-in error');
				}
			} else {
				setAuthMessage('Signed in successfully');
				if (data?.session?.user) setUser(data.session.user);
				trackEvent('login_success');
			}
		} catch (err) {
			console.error(err);
			setAuthError('Failed to sign in.');
		}
	}

	async function resetPassword(email) {
		setAuthError(null); setAuthMessage(null);
		if (!email) { setAuthError('Enter your email'); return; }
		try {
			const { data, error } = await supabase.auth.resetPasswordForEmail(email);
			console.log('leafnote: resetPassword response', { data, error });
			if (error) setAuthError(error.message || 'Password reset error');
			else setAuthMessage('Password reset email sent. If you do not receive it, ensure SMTP is configured in your Supabase project (Dashboard → Settings → Email).');
		} catch (err) {
			console.error(err);
			setAuthError('Failed to send password reset email.');
		}
		// Start a cooldown to avoid rate-limit when users click repeatedly
		setForgotCooldown(60);
		const iv = setInterval(() => {
			setForgotCooldown(s => {
				if (s <= 1) { clearInterval(iv); return 0; }
				return s - 1;
			});
		}, 1000);
	}


	async function signOut() {
			try {
				await supabase.auth.signOut();
			} catch (e) { console.error('signOut failed', e); }
			// clear local user state and any sign-in debug traces shown on the login page
			setUser(null);
			setSignInDebug(null);
			setAuthMessage(null);
			setAuthError(null);
			// Clear local lists and persisted storage so next user starts fresh
			setReadBooks([]);
			setToReadBooks([]);
			try { localStorage.removeItem(STORAGE_KEY); } catch(e) {}
			try { delete window.__leafnote_last_signin; } catch (e) {}
	}

	function addReadBook(titleArg, ratingArg) {
		const title = (typeof titleArg === 'string' ? titleArg : readTitle).trim();
		const rating = typeof ratingArg === 'number' ? ratingArg : readRating;
		if (!title || rating < 1) return;
		(async () => {
			const meta = await fetchBookMeta(title);
			const author = meta.author || '';

			// Track click event
			trackEvent('add_read_click', {
				book_title: title,
				book_author: author,
				book_rating: rating,
				book_status: 'read'
			});

			const newBook = { id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), title, rating, dateRead: new Date().toISOString(), author, shortDescription: meta.shortDescription || '' };
			setReadBooks(prev => [newBook, ...prev]);
			setReadTitle(''); setReadRating(0);

			(async () => {
				try {
					const sess = await supabase.auth.getSession();
					const uid = sess?.data?.session?.user?.id;
					if (uid) {
						// Try upserting with metadata; if DB lacks fields this may error, so catch and retry without extras
						const payload = { id: newBook.id, user_id: uid, title: newBook.title, rating: newBook.rating, status: 'read', date_read: newBook.dateRead, author: newBook.author, short_description: newBook.shortDescription };
						const { error: insertErr } = await supabase.from('books').upsert(payload);
						if (insertErr) {
							console.warn('Upsert with metadata failed, retrying without extra fields', insertErr.message);
							const { error: insertErr2 } = await supabase.from('books').upsert({ id: newBook.id, user_id: uid, title: newBook.title, rating: newBook.rating, status: 'read', date_read: newBook.dateRead });
							if (insertErr2) {
								console.error(insertErr2);
							} else {
								trackEvent('add_read_success', { book_title: title, book_author: author, book_rating: rating, book_status: 'read' });
							}
						} else {
							trackEvent('add_read_success', { book_title: title, book_author: author, book_rating: rating, book_status: 'read' });
						}
					} else {
						// Local-only add (not logged in)
						trackEvent('add_read_success', { book_title: title, book_author: author, book_rating: rating, book_status: 'read' });
					}
				} catch (err) { console.error(err); }
			})();
		})();
	}

	function addToReadBook(titleArg) {
		const title = typeof titleArg === 'string' ? titleArg : toReadTitle.trim(); if (!title) return;
		(async () => {
			const meta = await fetchBookMeta(title);
			const author = meta.author || '';

			// Track click event
			trackEvent('add_toread_click', {
				book_title: title,
				book_author: author,
				book_status: 'toread'
			});

			const newBook = { id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), title, dateAdded: new Date().toISOString(), author, shortDescription: meta.shortDescription || '' };
			setToReadBooks(prev => [newBook, ...prev]);
			setToReadTitle('');
			(async () => {
				try {
					const sess = await supabase.auth.getSession();
					const uid = sess?.data?.session?.user?.id;
					if (uid) {
						const payload = { id: newBook.id, user_id: uid, title: newBook.title, status: 'to_read', date_added: newBook.dateAdded, author: newBook.author, short_description: newBook.shortDescription };
						const { error: insertErr } = await supabase.from('books').upsert(payload);
						if (insertErr) {
							console.warn('Upsert with metadata failed, retrying without extra fields', insertErr.message);
							const { error: insertErr2 } = await supabase.from('books').upsert({ id: newBook.id, user_id: uid, title: newBook.title, status: 'to_read', date_added: newBook.dateAdded });
							if (insertErr2) {
								console.error(insertErr2);
							} else {
								trackEvent('add_toread_success', { book_title: title, book_author: author, book_status: 'toread' });
							}
						} else {
							trackEvent('add_toread_success', { book_title: title, book_author: author, book_status: 'toread' });
						}
					} else {
						// Local-only add (not logged in)
						trackEvent('add_toread_success', { book_title: title, book_author: author, book_status: 'toread' });
					}
				} catch (err) { console.error(err); }
			})();
		})();
	}

	async function sendFeedback() {
		const text = String(feedbackText || '').trim();
		if (!text) return alert('Please enter feedback before sending.');
		setFeedbackSending(true);
		try {
			const payload = {
				feedback: text,
				userEmail: user?.email || null,
				readCount: Array.isArray(readBooks) ? readBooks.length : 0,
				toReadCount: Array.isArray(toReadBooks) ? toReadBooks.length : 0,
				timestamp: new Date().toISOString()
			};
			const endpoint = process.env.REACT_APP_FEEDBACK_ENDPOINT || 'https://formspree.io/f/xzznopad';
			if (endpoint) {
				// POST to configured endpoint (e.g., Form endpoint or server webhook)
				const res = await fetch(endpoint, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload)
				});
				if (!res.ok) throw new Error('Feedback endpoint returned ' + res.status);
				alert('Thanks — your feedback was submitted.');
			} else {
				// Fallback: open user's email client with prefilled message to smita.kulkarni89@gmail.com
				const to = 'smita.kulkarni89@gmail.com';
				const subject = encodeURIComponent('Leafnote feedback');
				const body = encodeURIComponent(`Feedback:\n${text}\n\nUser email: ${user?.email || 'anonymous'}\nRead count: ${payload.readCount}\nTo-read count: ${payload.toReadCount}\nTimestamp: ${payload.timestamp}`);
				window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
				alert('No feedback endpoint configured — opening your email client to send feedback.');
			}
			setFeedbackText('');
		} catch (err) {
			console.error('sendFeedback failed', err);
			alert('Failed to send feedback.');
		} finally {
			setFeedbackSending(false);
		}
	}

	// Fetch metadata for a title from Google Books API; returns { author, shortDescription }
	async function fetchBookMeta(title) {
		if (!title) return { author: '', shortDescription: '' };
		try {
			const q = encodeURIComponent(`intitle:${title}`);
			const url = `https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=1`;
			const res = await fetch(url);
			if (!res.ok) return generateFallbackMeta(title);
			const json = await res.json();
			const item = (json.items && json.items[0]) || null;
			if (!item) return generateFallbackMeta(title);
			const info = item.volumeInfo || {};
			const author = Array.isArray(info.authors) && info.authors.length ? info.authors[0] : '';
			let desc = info.description || info.subtitle || '';
			if (desc) {
				// strip HTML tags and summarize to two sentences
				desc = desc.replace(/<[^>]*>/g, '');
				return { author, shortDescription: summarizeToTwoSentences(desc) };
			} else {
				return generateFallbackMeta(title, author);
			}
		} catch (err) {
			console.error('fetchBookMeta failed', err);
			return generateFallbackMeta(title);
		}
	}

	function truncateText(text, maxChars) {
		// Keep for backward compatibility but prefer full descriptions.
		if (!text) return '';
		if (text.length <= maxChars) return text;
		let truncated = text.slice(0, maxChars);
		const lastSpace = truncated.lastIndexOf(' ');
		if (lastSpace > Math.floor(maxChars * 0.6)) truncated = truncated.slice(0, lastSpace);
		return truncated.replace(/\s+$/, '') + '...';
	}

	function summarizeToTwoSentences(text) {
		if (!text) return '';
		const cleaned = String(text).replace(/\s+/g, ' ').trim();
		// Split on sentence boundaries (keep delimiters)
		const sentences = cleaned.split(/(?<=[.?!])\s+/);
		const picked = [];
		for (const s of sentences) {
			const t = s.trim();
			if (t) picked.push(t);
			if (picked.length === 2) break;
		}
		if (picked.length === 2) return picked.join(' ');
		if (picked.length === 1) {
			// Try splitting by semicolon or comma to form a second short sentence
			const parts = picked[0].split(/;|,/).map(p => p.trim()).filter(Boolean);
			if (parts.length >= 2) {
				// join first two parts into two short sentences
				const first = parts[0].endsWith('.') ? parts[0] : parts[0] + '.';
				const second = parts[1].endsWith('.') ? parts[1] : parts[1] + '.';
				return `${first} ${second}`;
			}
			// Fallback: truncate to a reasonable length
			return truncateText(picked[0], 300);
		}
		// No clear sentence boundaries: truncate safely
		return truncateText(cleaned, 300);
	}

	function generateFallbackMeta(title, author) {
		const cleanedTitle = title || 'this book';
		const by = author ? ` by ${author}` : '';
		const desc = `${cleanedTitle}${by} offers a concise, approachable introduction to its subject, presenting key ideas and practical insights in a clear, reader-friendly way.`;
		return { author: author || '', shortDescription: summarizeToTwoSentences(desc) };
	}

	// --- Recommendation helpers (pure, deterministic, no backend) ---
	function normalizeTitle(t) {
		if (!t) return '';
		return String(t).toLowerCase().trim().replace(/[^\w\s]|_/g, '').replace(/\s+/g, ' ');
	}

	function uniqByTitle(items) {
		const seen = new Set();
		const out = [];
		for (const it of items) {
			const n = normalizeTitle(it.title || it);
			if (!n) continue;
			if (seen.has(n)) continue;
			seen.add(n);
			out.push(it);
		}
		return out;
	}

	function getRecommendations(readBooks, toReadBooks, max = 8) {
		const result = [];
		const seen = new Set();

		const norm = t => normalizeTitle(t || '');
		const mark = t => seen.add(norm(t));
		const isSeen = t => seen.has(norm(t));

		// A) Prioritize existing to-read (most recent first) - up to 3
		const sortedToRead = [...(toReadBooks || [])].sort((a,b) => new Date(b.dateAdded) - new Date(a.dateAdded));
		for (const b of sortedToRead) {
			if (result.length >= max) break;
			if (isSeen(b.title)) continue;
			result.push({ title: b.title, reason: 'Already on your list — added recently', source: 'toRead', author: b.author });
			mark(b.title);
			if (result.length >= 3) break; // limit to 3 from toRead
		}

		// B) Revisit winners from readBooks (rating >=4), sort by rating desc then dateRead desc - up to 3
		const rated = (readBooks || []).filter(b => Number(b.rating) >= 4);
		rated.sort((a,b) => (b.rating - a.rating) || (new Date(b.dateRead) - new Date(a.dateRead)));
		let addedTop = 0;
		for (const b of rated) {
			if (result.length >= max) break;
			if (addedTop >= 3) break;
			if (isSeen(b.title)) continue;
			// skip if already present in toReadBooks
			const alreadyInToRead = (toReadBooks || []).some(t => normalizeTitle(t.title) === normalizeTitle(b.title));
			if (alreadyInToRead) continue;
			result.push({ title: b.title, reason: 'You rated this highly — consider rereading or exploring similar books', source: 'fromTopRated', author: b.author });
			mark(b.title);
			addedTop++;
		}

		// C) Similar genre suggestions (optional)
		// collect categories from high-rated read books
		const catCounts = {};
		for (const b of rated) {
			const cats = Array.isArray(b.categories) ? b.categories : (b.categories ? [b.categories] : []);
			for (const c of cats) {
				const key = String(c).toLowerCase().trim();
				if (!key) continue;
				catCounts[key] = (catCounts[key] || 0) + 1;
			}
		}
		const catsOrdered = Object.keys(catCounts).sort((a,b) => catCounts[b] - catCounts[a]).slice(0,2);
		for (const cat of catsOrdered) {
			if (result.length >= max) break;
			// try to bubble up toReadBooks that match this category
			const match = (toReadBooks || []).find(t => {
				const cats = Array.isArray(t.categories) ? t.categories : (t.categories ? [t.categories] : []);
				return cats.map(x => String(x).toLowerCase().trim()).includes(cat) && !isSeen(t.title);
			});
			if (match) {
				result.push({ title: match.title, reason: `Matches your interest in ${cat}`, source: 'fromSimilarGenre', author: match.author });
				mark(match.title);
				continue;
			}
			// else add a placeholder suggestion
			const label = `Explore more ${cat}`;
			if (!isSeen(label)) {
				result.push({ title: label, reason: 'You seem to enjoy this genre', source: 'fromSimilarGenre' });
				mark(label);
			}
		}

		// D) Fallback if not enough
		if (result.length < Math.min(max, 1)) {
			result.push({ title: 'Add a few books you loved', reason: 'Recommendations improve as you rate more books', source: 'fallback' });
		}

		// Fill up to max with gentle fallback placeholders if still short
		while (result.length < max) {
			// Avoid adding duplicates
			const candidate = { title: 'Discover new reads', reason: 'Expand your list to get better suggestions', source: 'fallback' };
			if (!isSeen(candidate.title)) {
				result.push(candidate);
				mark(candidate.title);
			} else break;
		}

		return result.slice(0, max).map(uniq => uniq);
	}

	const topRated = useMemo(() => [...readBooks].sort((a,b)=> (b.rating - a.rating) || (new Date(b.dateRead) - new Date(a.dateRead))).slice(0,5), [readBooks]);
	const nextReads = useMemo(() => [...toReadBooks].sort((a,b)=> new Date(b.dateAdded)-new Date(a.dateAdded)).slice(0,3), [toReadBooks]);
	const recommendations = useMemo(() => getRecommendations(readBooks, toReadBooks, 8), [readBooks, toReadBooks]);

	// Combine GB recos and local recommendations into a single deduped list (up to 5)
	const combinedRecos = useMemo(() => {
		const max = 5;
		const out = [];
		const seenTitles = new Set();
		const seenIds = new Set();
		const pushIfNew = (r) => {
			const id = r.googleVolumeId ? String(r.googleVolumeId) : null;
			const n = normalizeTitle(r.title || '');
			if (id && seenIds.has(id)) return false;
			if (n && seenTitles.has(n)) return false;
			out.push(r);
			if (id) seenIds.add(id);
			if (n) seenTitles.add(n);
			return true;
		};
		// add Google Books recos first
		if (Array.isArray(gbRecos)) {
			for (const r of gbRecos) {
				if (out.length >= max) break;
				pushIfNew(r);
			}
		}
		// then add local recommendations
		for (const r of recommendations) {
			if (out.length >= max) break;
			pushIfNew(r);
		}
		return out.slice(0, max);
	}, [gbRecos, recommendations]);

	// --- Google Books new recommendations (async, cached) ---

	function loadCachedGbRecos() {
		try {
			const raw = localStorage.getItem(GB_CACHE_KEY);
			if (!raw) return null;
			const parsed = JSON.parse(raw);
			if (!parsed || !parsed.ts || !Array.isArray(parsed.results)) return null;
			if (Date.now() - parsed.ts > GB_CACHE_TTL) return null;
			return parsed.results;
		} catch (e) { return null; }
	}

	function saveCachedGbRecos(results) {
		try { localStorage.setItem(GB_CACHE_KEY, JSON.stringify({ ts: Date.now(), results })); } catch (e) { }
	}

	function shortDescFromText(text) {
		if (!text) return '';
		const cleaned = String(text).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
		if (cleaned.length <= 220) return cleaned;
		// try to cut at sentence boundary before 220
		const before = cleaned.slice(0, 220);
		const lastSent = before.lastIndexOf('. ');
		if (lastSent > 100) return cleaned.slice(0, lastSent+1).trim();
		// else cut at last space after 180
		const lastSpace = before.lastIndexOf(' ');
		if (lastSpace > 180) return before.slice(0, lastSpace).trim() + '...';
		return before.trim() + '...';
	}


	async function fetchNewRecommendations(readBooksInput, toReadBooksInput, max = 8) {
			const read = Array.isArray(readBooksInput) ? readBooksInput : [];
			const toRead = Array.isArray(toReadBooksInput) ? toReadBooksInput : [];
			// build existing sets
			const existingIds = new Set();
			const existingTitles = new Set();
			for (const b of [...read, ...toRead]) {
				if (b.googleVolumeId) existingIds.add(String(b.googleVolumeId));
				const n = normalizeTitle(b.title || ''); if (n) existingTitles.add(n);
			}

			// seeds: top rated read books (>=4) sorted, up to 3
			const seeds = (read.filter(b => Number(b.rating) >= 4) || []).slice();
			seeds.sort((a,b) => (b.rating - a.rating) || (new Date(b.dateRead) - new Date(a.dateRead)));
			const takeSeeds = seeds.slice(0,3);
			if (!takeSeeds.length) return { results: [], reason: 'no-seeds' };

			const bannedPhrases = [
				'study guide','sparknotes','cliffsnotes','workbook','summary','analysis',
				'lesson','teacher','unauthorized','guide','companion','notes','illustrated edition',
				'stenciled edges','boxed set','special edition'
			];

			const stopTokens = new Set(['book','volume','vol','part','series','edition','second','third','fourth','fifth','sixth','seventh','harry','potter']);

			// helper to test banned words in title/subtitle
			const isBanned = (title, subtitle) => {
				const txt = ((title || '') + ' ' + (subtitle || '')).toLowerCase();
				for (const p of bannedPhrases) if (txt.includes(p)) return true;
				return false;
			};

			// fetch per-seed results (but don't accept duplicates yet)
			const perSeedResults = [];

			for (const seed of takeSeeds) {
				const seedNorm = normalizeTitle(seed.title || '');
				const seedTokens = seedNorm.split(' ').filter(Boolean);

				let q = '';
				// Prefer author + subject when available
				if (seed.author && String(seed.author).trim()) {
					q = `inauthor:"${String(seed.author).replace(/"/g,'')}"`;
					// if seed has categories/genres, append top category
					if (seed.categories && seed.categories.length) {
						const topCat = Array.isArray(seed.categories) ? seed.categories[0] : seed.categories;
						if (topCat) q += `+subject:"${String(topCat).replace(/"/g,'')}"`;
					}
				} else {
					// derive keywords from title but remove series words and numbers
					const toks = seedTokens.filter(t => t.length > 2 && !/^\d+$/.test(t) && !/^[ivxlcdm]+$/i.test(t) && !stopTokens.has(t));
					const take = toks.slice(0,6);
					if (take.length) {
						// build a loose intitle query using keywords
						q = take.map(t => `intitle:"${t}"`).join('+');
					} else {
						// fallback to author search if nothing useful
						q = `intitle:"${String(seed.title).replace(/"/g,'')}"`;
					}
				}

				// API params: printType=books, maxResults=20, langRestrict=en, orderBy=relevance
				const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&printType=books&maxResults=20&langRestrict=en&orderBy=relevance`;
				const seedCollected = [];
				try {
					const res = await fetch(url);
					if (!res.ok) { perSeedResults.push(seedCollected); continue; }
					const json = await res.json();
					const items = Array.isArray(json.items) ? json.items : [];
					for (const item of items) {
						const vid = item.id;
						const info = item.volumeInfo || {};
						// filter non-English editions
						if (info.language && info.language !== 'en') continue;
						const title = info.title || '';
						const subtitle = info.subtitle || '';
						// remove banned phrases like study guides/companion editions
						if (isBanned(title, subtitle)) continue;
						const author = Array.isArray(info.authors) && info.authors.length ? info.authors[0] : '';
						const desc = shortDescFromText(info.description || '');
						const ntitle = normalizeTitle(title || '');
						// exclude near-duplicates of the seed title
						if (seedNorm && ntitle) {
							if (ntitle === seedNorm) continue;
							// token overlap threshold
							const resTokens = ntitle.split(' ').filter(Boolean);
							if (seedTokens.length && resTokens.length) {
								const seedSet = new Set(seedTokens);
								let shared = 0;
								for (const t of resTokens) if (seedSet.has(t)) shared++;
								const overlap = shared / Math.max(1, seedTokens.length);
								if (overlap > 0.7) continue;
							}
						}
						// exclude if user already has it
						if (vid && existingIds.has(String(vid))) continue;
						if (ntitle && existingTitles.has(ntitle)) continue;
						// accept
						seedCollected.push({ googleVolumeId: vid, title, author, shortDescription: desc });
						// keep collecting more to allow diversity/interleaving
						if (seedCollected.length >= Math.max(max, 10)) break;
					}
				} catch (e) { console.error('GB fetch error', e); }
				perSeedResults.push(seedCollected);
			}

			// Interleave results from different seeds for diversity
			const final = [];
			const seenIds = new Set();
			const seenTitles = new Set(existingTitles);
			let idx = 0;
			while (final.length < max) {
				let addedThisRound = false;
				for (let s = 0; s < perSeedResults.length; s++) {
					const list = perSeedResults[s] || [];
					if (idx >= list.length) continue;
					const cand = list[idx];
					if (!cand) continue;
					const id = cand.googleVolumeId ? String(cand.googleVolumeId) : null;
					const n = normalizeTitle(cand.title || '');
					if (id && seenIds.has(id)) continue;
					if (n && seenTitles.has(n)) continue;
					final.push(cand);
					if (id) seenIds.add(id);
					if (n) seenTitles.add(n);
					addedThisRound = true;
					if (final.length >= max) break;
				}
				if (!addedThisRound) break;
				idx++;
			}

			return { results: final.slice(0, max), reason: 'ok' };
		}

	async function loadOrRefreshGbRecos(force = false) {
		if (!force) {
			const cached = loadCachedGbRecos();
			if (cached) { setGbRecos(cached); return; }
		}
		setGbLoading(true);
		try {
			const { results, reason } = await fetchNewRecommendations(readBooks, toReadBooks, 5);
			let finalResults = results && Array.isArray(results) ? results.slice() : [];
			// If user explicitly requested a refresh, shuffle results to add variety
			if (force && finalResults.length) {
				function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a}
				finalResults = shuffle(finalResults);
			}
			if (finalResults && finalResults.length) {
				setGbRecos(finalResults);
				saveCachedGbRecos(finalResults);
			} else {
				setGbRecos([]);
			}
		} catch (e) { console.error(e); setGbRecos([]); }
		setGbLoading(false);
	}

	// Load cached recos on mount
	useEffect(() => { loadOrRefreshGbRecos(false); // eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	function removeBook(id, from='read') {
		if (from === 'read') setReadBooks(prev => prev.filter(b=>b.id !== id));
		else setToReadBooks(prev => prev.filter(b=>b.id !== id));
	}

	function moveBook(id, from='read') {
		if (from === 'read') {
			const b = readBooks.find(x=>x.id===id);
			if (!b) return;
			// create to-read entry
			const to = { id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), title: b.title, author: b.author || '', shortDescription: b.shortDescription || '', dateAdded: new Date().toISOString() };
			setToReadBooks(prev => [to, ...prev]);
			setReadBooks(prev => prev.filter(x=>x.id!==id));
		} else {
			const b = toReadBooks.find(x=>x.id===id);
			if (!b) return;
			const read = { id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), title: b.title, author: b.author || '', shortDescription: b.shortDescription || '', rating: 4, dateRead: new Date().toISOString() };
			setReadBooks(prev => [read, ...prev]);
			setToReadBooks(prev => prev.filter(x=>x.id!==id));
		}
	}






	// Account menu component (defined in component scope)
	function AccountMenu() {
			const [open, setOpen] = useState(false);
			const ref = useRef(null);

			useEffect(() => {
				function onDoc(e) {
					if (!ref.current) return;
					if (!ref.current.contains(e.target)) setOpen(false);
				}
            
				document.addEventListener('click', onDoc);
				return () => document.removeEventListener('click', onDoc);
			}, []);

			const initials = user?.email ? user.email.slice(0,2).toUpperCase() : 'U';
			return (
				<div ref={ref} style={{ position:'relative' }}>
					<button className="account-btn" onClick={() => setOpen(s => !s)} aria-haspopup="menu" aria-expanded={open} aria-label="Account menu">
						<span className="avatar">{initials}</span>
						<span style={{ marginLeft:8 }} aria-hidden>▾</span>
					</button>
					{open ? (
						<div className="account-dropdown" role="menu">
								<div style={{ padding:8, fontSize:13, color:'#444' }}>{user?.email}</div>
								<div style={{ padding:'0 8px 8px 8px', fontSize:13, color:'#444' }}>{(readBooks || []).length} read • {(toReadBooks || []).length} to-read</div>
							<button className="account-item" onClick={() => { exportData(); setOpen(false); }}>Export data</button>
							<button className="account-item" onClick={() => { triggerImport(); setOpen(false); }}>Import data</button>
							<button className="account-item" onClick={() => { signOut(); setOpen(false); }}>Sign out</button>
						</div>
					) : null}
				</div>
			);
		}

	function exportData() {
		// Export as CSV: status,id,title,rating,date
		try {
			const rows = [];
			rows.push('status,id,title,rating,date');
			for (const b of readBooks) {
				const title = String(b.title || '').replace(/"/g, '""');
				rows.push(`read,${b.id},"${title}",${b.rating || ''},${b.dateRead || ''}`);
			}
			for (const b of toReadBooks) {
				const title = String(b.title || '').replace(/"/g, '""');
				rows.push(`to_read,${b.id},"${title}",,${b.dateAdded || ''}`);
			}
			const csv = rows.join('\n');
			const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `leafnote-data-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
			document.body.appendChild(a);
			a.click();
			a.remove();
			URL.revokeObjectURL(url);
		} catch (e) { console.error(e); alert('Export failed'); }
	}

	function triggerImport() { if (fileInputRef.current) fileInputRef.current.click(); }

	function parseCsv(text) {
		const lines = text.split(/\r?\n/);
		if (!lines.length) return { readArr: [], toReadArr: [] };
		const header = lines[0].split(/,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/).map(h => h.trim().replace(/^\"|\"$/g, ''));
		const idx = {}; header.forEach((h, i) => idx[h] = i);
		const readArr = []; const toReadArr = [];
		for (let i = 1; i < lines.length; i++) {
			const line = lines[i];
			if (!line || !line.trim()) continue;
			const cols = line.split(/,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/);
			const get = (name) => {
				const v = cols[idx[name]] || '';
				return String(v).trim().replace(/^\"|\"$/g, '').replace(/\"\"/g, '"');
			};
			const status = get('status') || 'to_read';
			const id = get('id') || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + '-' + i);
			const title = get('title') || '';
			const rating = get('rating') ? Number(get('rating')) : 0;
			const date = get('date') || new Date().toISOString();
			if (status === 'read') readArr.push({ id, title, rating, dateRead: date }); else toReadArr.push({ id, title, dateAdded: date });
		}
		return { readArr, toReadArr };
	}

	function handleImportFile(e) {
		const f = e.target.files && e.target.files[0];
		if (!f) return;
		const reader = new FileReader();
		reader.onload = () => {
			try {
				const txt = String(reader.result || '');
				// if JSON fallback provided, try parse
				if (f.name.toLowerCase().endsWith('.json') || f.type === 'application/json') {
					const parsed = JSON.parse(txt);
					if (parsed && (Array.isArray(parsed.readBooks) || Array.isArray(parsed.toReadBooks))) {
						setReadBooks(Array.isArray(parsed.readBooks) ? parsed.readBooks : []);
						setToReadBooks(Array.isArray(parsed.toReadBooks) ? parsed.toReadBooks : []);
						alert('Data imported successfully (JSON).');
						return;
					}
				}
				// Otherwise treat as CSV
				const { readArr, toReadArr } = parseCsv(txt);
				if (readArr.length || toReadArr.length) {
					setReadBooks(readArr);
					setToReadBooks(toReadArr);
					alert('Data imported successfully (CSV).');
				} else {
					alert('No valid rows found in CSV.');
				}
			} catch (err) { console.error(err); alert('Failed to parse file.'); }
		};
		reader.readAsText(f);
		e.target.value = '';
	}

	const logoCandidates = [ `${PUBLIC}/logo%20leafnote.jpg`, `${PUBLIC}/leafnote.jpg`, `${PUBLIC}/leafnote-logo.jpg`, `${PUBLIC}/leafnote-logo.png` ];

	// show separate login page when not authenticated
	// Simple route detection for OAuth consent preview path — run after hooks
	const pathname = typeof window !== 'undefined' ? window.location.pathname.replace(/\/\/+/g, '/') : '';
	if (pathname && pathname.toLowerCase().includes('/oauth/consent')) {
		return <Consent />;
	}
	if (!user) {
		return (
			<Login
				onSignIn={async (email, password) => {
					if (password) {
						await signInWithPassword(email, password);
					} else {
						await signIn(email);
					}
				}}
				onSignUp={async (email, password) => {
					await signUpWithPassword(email, password);
				}}
				onForgotPassword={async (email) => { await resetPassword(email); }}
				forgotCooldown={forgotCooldown}
				authMessage={authMessage}
				authError={authError}
				signInDebug={signInDebug}
			/>
		);
	}

	return (
		<div className="App" style={{ backgroundImage: `linear-gradient(rgba(248,241,255,0.25), rgba(238,246,255,0.20)), url('${bgUrl}')`, backgroundSize:'cover', backgroundPosition:'center' }}>
			{!supabaseConfigOk && (
				<div style={{ background:'#ffecec', color:'#611', padding:'8px 12px', textAlign:'center' }}>
					<strong>Auth disabled:</strong> Supabase keys are missing in this build. Check console or environment variables.
					<div style={{ fontSize:12, marginTop:6 }}>
						Configured URL: {supabaseConfig.url || '—'} — ANON key: {supabaseConfig.anonKey ? (String(supabaseConfig.anonKey).slice(0,8) + '...') : '—'}
					</div>
				</div>
			)}
			<div className="app-container">
				<header className="app-header">
					<div className="brand">
												<div className="brand-logo-wrap">
													<img src={logoCandidates[0]} alt="Leafnote logo" className="brand-logo" onError={(e)=>{ e.currentTarget.onerror=null; e.currentTarget.src=logoSvg; }} />
												</div>
						<div className="brand-text"><h1>Leafnote</h1><div className="tagline">A quiet record of your reading</div></div>
					</div>
					<div style={{ display:'flex', alignItems:'center', gap:12, width:'100%', justifyContent:'space-between' }}>
						<div style={{ textAlign:'center', flex:1 }}></div>
						<div style={{ display:'flex', gap:8, alignItems:'center' }}>
							<AccountMenu />
						</div>
					</div>
				</header>
                

				<aside className="sidebar">
					<section className="card">
						<h3 style={{ marginTop:0 }}>Add Read Book</h3>
						<label>Book Title<input type="text" value={readTitle} onChange={e=>setReadTitle(e.target.value)} placeholder="e.g., Atomic Habits" /></label>
						<div style={{ margin:'10px 0' }}>
							<div style={{ fontSize:14, marginBottom:6 }}>Your Rating</div>
							<div className="star-row">{[1,2,3,4,5].map(n=> (<button key={n} onClick={()=>setReadRating(n)} className="star-button">{n<=readRating ? '★':'☆'}</button>))}</div>
						</div>
						<div className="card-actions">
							<button className="cta" onClick={() => addReadBook(readTitle, readRating)} disabled={!readTitle.trim() || readRating<1}>Save as Read</button>
						</div>
					</section>

					<section className="card" style={{ marginTop:14 }}>
						<h3 style={{ marginTop:0 }}>Add To-Read</h3>
						<label>Book Title<input type="text" value={toReadTitle} onChange={e=>setToReadTitle(e.target.value)} placeholder="e.g., Deep Work" /></label>
						<div className="card-actions">
							<button className="cta" onClick={() => addToReadBook(toReadTitle)} disabled={!toReadTitle.trim()}>Add to To-Read</button>
						</div>
					</section>

					<section className="card" style={{ marginTop:12 }}>
						<h3 style={{ marginTop:0 }}>Feedback</h3>
						<div style={{ fontSize:14, marginBottom:8 }}>What would make Leafnote indispensable for you?</div>
						<textarea className="feedback-textarea" value={feedbackText} onChange={e=>setFeedbackText(e.target.value)} placeholder="Tell me what features, workflows or improvements would make Leafnote indispensable to your reading life." />
						<div className="card-actions">
							<button className="cta" onClick={sendFeedback} disabled={feedbackSending || !feedbackText.trim()}>{feedbackSending ? 'Sending...' : 'Send Feedback'}</button>
						</div>
					</section>

		

					{/* Decorative image under the To-Read card to fill the blank sidebar space */}
					<section className="card sidebar-art" style={{ marginTop:12 }}>
						<img src={`${PUBLIC}/leafnote.jpg`} alt="Leafnote artwork" className="sidebar-image" onError={(e)=>{ e.currentTarget.onerror=null; e.currentTarget.src=logoSvg; }} />
					</section>

					<input ref={fileInputRef} onChange={handleImportFile} style={{ display: 'none' }} type="file" accept=".csv,text/csv,application/csv,application/json" />
				</aside>

				<main className="main">
					<section className="card">
						<h2 style={{marginTop:0}}>Books Read</h2>
						{readBooks.length===0 ? <p>No books yet.</p> : (
								<ul className="list">{readBooks.map((b, idx)=> (
									<li key={b.id}>
										<div style={{ fontWeight:600 }}>{idx+1}. {'★'.repeat(b.rating)} {b.title}</div>
										{b.author ? <div style={{ color:'#444', fontSize:13, marginTop:4 }}>by {b.author}</div> : null}
										{b.shortDescription ? <div style={{ color:'#666', fontSize:13, marginTop:6 }}>{b.shortDescription}</div> : null}
										<div style={{ color:'#666', fontSize:12, marginTop:6 }}>{new Date(b.dateRead).toLocaleDateString()}</div>
									</li>
								))}</ul>
							)}
					</section>

					<section className="card">
						<h2 style={{marginTop:0}}>To-Read</h2>
						{toReadBooks.length===0 ? <p>No books in your list yet.</p> : (
							<ul className="list">{toReadBooks.map((b, idx)=> (
								<li key={b.id}>
									<div style={{ fontWeight:600 }}>{idx+1}. {b.title}</div>
									{b.author ? <div style={{ color:'#444', fontSize:13, marginTop:4 }}>by {b.author}</div> : null}
									{b.shortDescription ? <div style={{ color:'#666', fontSize:13, marginTop:6 }}>{b.shortDescription}</div> : null}
									<div style={{ color:'#666', fontSize:12, marginTop:6 }}>{new Date(b.dateAdded).toLocaleDateString()}</div>
								</li>
							))}</ul>
						)}
					</section>

					<section className="card">
						<h2 style={{marginTop:0}}>Recommendations</h2>
						{readBooks.length === 0 && toReadBooks.length === 0 ? (
							<div style={{ color:'#666' }}>Add some books to your lists and rate them to get personalized recommendations.</div>
						) : (
							<>
								<div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
									<strong>New from Google Books</strong>
									<div style={{ display:'flex', gap:8, alignItems:'center' }}>
										<button className="cta" onClick={() => loadOrRefreshGbRecos(true)} disabled={gbLoading}>{gbLoading ? 'Loading...' : 'Refresh recommendations'}</button>
									</div>
								</div>
								<div style={{ marginTop:8 }}>
									{gbLoading ? <div style={{ color:'#666' }}>Loading...</div> : null}
									{(!gbLoading && (!combinedRecos || combinedRecos.length === 0)) ? (
										<div style={{ color:'#666' }}>Rate a few books (4★+) to get recommendations.</div>
									) : null}
									{(!gbLoading && combinedRecos && combinedRecos.length > 0) ? (
										<div className="card-grid" style={{ marginTop:8 }}>
											{combinedRecos.map(r => (
												<div key={r.googleVolumeId || normalizeTitle(r.title)} className="mini-card">
													<div style={{ fontWeight:600 }}>{r.title}</div>
													{r.author ? <div style={{ color:'#444', fontSize:13, marginTop:4 }}>by {r.author}</div> : null}
													{r.shortDescription ? <div style={{ color:'#666', fontSize:13, marginTop:6 }}>{r.shortDescription}</div> : null}
													{r.reason ? <div style={{ color:'#666', fontSize:13, marginTop:6 }}>{r.reason}</div> : null}
												</div>
											))}
										</div>
									) : null}
								</div>
							</>
						)}
					</section>
				</main>
			</div>
		
				{/* Footer: calm, centered, small */}
				<footer className="app-footer" role="contentinfo">
					<div className="footer-inner">
						<div className="footer-text">Leafnote is a quiet place for your reading life — not a social network.
						If it’s been helpful, consider sharing it with someone who loves books too.</div>
						<div className="footer-share">
							<input aria-label="Leafnote public link" readOnly value={SHARE_LINK} />
							<button className="cta" onClick={copyShareLink} aria-label="Copy link to clipboard">Copy link</button>
							<span className="copy-confirm" aria-live="polite">{linkCopied ? 'Link copied' : ''}</span>
						</div>
					</div>
				</footer>
		</div>
	);
}

export default App;

