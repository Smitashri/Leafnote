import React, { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import logoSvg from './leafnote-logo.svg';
import { supabase } from './supabaseClient';

const STORAGE_KEY = 'booktracker_v1';

function App() {
	const PUBLIC = process.env.PUBLIC_URL || '';
	const bgUrl = `${PUBLIC}/leafnote.jpg`;

	const [readBooks, setReadBooks] = useState([]);
	const [toReadBooks, setToReadBooks] = useState([]);

	// auth
	const [user, setUser] = useState(null);
	const [authEmail, setAuthEmail] = useState('');

	const [readTitle, setReadTitle] = useState('');
	const [readRating, setReadRating] = useState(0);
	const [toReadTitle, setToReadTitle] = useState('');

	const fileInputRef = useRef(null);

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
					await fetchAndMerge(session.user);
				}
			} catch (err) {
				console.error(err);
			}
		})();

		const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
			const u = session?.user ?? null;
			setUser(u);
			if (u) fetchAndMerge(u).catch(console.error);
		});

		return () => sub?.subscription?.unsubscribe();
	}, []);

	// fetch server rows and merge
	async function fetchAndMerge(supabaseUser) {
		if (!supabaseUser) return;
		const uid = supabaseUser.id;
		const { data, error } = await supabase.from('books').select('*').eq('user_id', uid).order('created_at', { ascending: false });
		if (error) { console.error(error); return; }

		const serverRead = (data || []).filter(r => r.status === 'read').map(r => ({ id: r.id, title: r.title, rating: r.rating, dateRead: r.date_read || r.created_at }));
		const serverToRead = (data || []).filter(r => r.status === 'to_read').map(r => ({ id: r.id, title: r.title, dateAdded: r.date_added || r.created_at }));

		if (serverRead.length || serverToRead.length) {
			setReadBooks(serverRead);
			setToReadBooks(serverToRead);
		} else {
			// push local items to server if server empty
			const toInsert = [];
			const now = new Date().toISOString();
			for (const b of readBooks) toInsert.push({ id: b.id, user_id: uid, title: b.title, rating: b.rating || null, status: 'read', date_read: b.dateRead || now });
			for (const b of toReadBooks) toInsert.push({ id: b.id, user_id: uid, title: b.title, status: 'to_read', date_added: b.dateAdded || now });
			if (toInsert.length) {
				const { error: insertErr } = await supabase.from('books').upsert(toInsert);
				if (insertErr) console.error(insertErr);
			}
		}
	}

	async function signIn(email) {
		if (!email) return alert('Enter your email');
		const { error } = await supabase.auth.signInWithOtp({ email });
		if (error) alert(error.message); else alert('Check your email for the magic link.');
	}

	async function signOut() {
		await supabase.auth.signOut();
		setUser(null);
	}

	function addReadBook() {
		const title = readTitle.trim();
		if (!title || readRating < 1) return;
		const newBook = { id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), title, rating: readRating, dateRead: new Date().toISOString() };
		setReadBooks(prev => [newBook, ...prev]);
		setReadTitle(''); setReadRating(0);
		(async () => {
			try {
				const sess = await supabase.auth.getSession();
				const uid = sess?.data?.session?.user?.id;
				if (uid) await supabase.from('books').upsert({ id: newBook.id, user_id: uid, title: newBook.title, rating: newBook.rating, status: 'read', date_read: newBook.dateRead });
			} catch (err) { console.error(err); }
		})();
	}

	function addToReadBook() {
		const title = toReadTitle.trim(); if (!title) return;
		const newBook = { id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), title, dateAdded: new Date().toISOString() };
		setToReadBooks(prev => [newBook, ...prev]);
		setToReadTitle('');
		(async () => {
			try {
				const sess = await supabase.auth.getSession();
				const uid = sess?.data?.session?.user?.id;
				if (uid) await supabase.from('books').upsert({ id: newBook.id, user_id: uid, title: newBook.title, status: 'to_read', date_added: newBook.dateAdded });
			} catch (err) { console.error(err); }
		})();
	}

	const topRated = useMemo(() => [...readBooks].sort((a,b)=> (b.rating - a.rating) || (new Date(b.dateRead) - new Date(a.dateRead))).slice(0,5), [readBooks]);
	const nextReads = useMemo(() => [...toReadBooks].sort((a,b)=> new Date(b.dateAdded)-new Date(a.dateAdded)).slice(0,3), [toReadBooks]);

	function exportData() {
		try {
			const payload = { readBooks, toReadBooks };
			const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
			const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `leafnote-data-${new Date().toISOString().replace(/[:.]/g,'-')}.json`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
		} catch (e) { console.error(e); alert('Export failed'); }
	}

	function triggerImport() { if (fileInputRef.current) fileInputRef.current.click(); }
	function handleImportFile(e) { const f = e.target.files && e.target.files[0]; if (!f) return; const reader = new FileReader(); reader.onload = () => { try { const parsed = JSON.parse(String(reader.result||'')); if (parsed && (Array.isArray(parsed.readBooks) || Array.isArray(parsed.toReadBooks))) { setReadBooks(Array.isArray(parsed.readBooks)? parsed.readBooks: []); setToReadBooks(Array.isArray(parsed.toReadBooks)? parsed.toReadBooks: []); alert('Data imported successfully.'); } else alert('Invalid file format.'); } catch(err){console.error(err); alert('Failed to parse JSON.'); } }; reader.readAsText(f); e.target.value = ''; }

	const logoCandidates = [ `${PUBLIC}/logo%20leafnote.jpg`, `${PUBLIC}/leafnote.jpg`, `${PUBLIC}/leafnote-logo.jpg`, `${PUBLIC}/leafnote-logo.png` ];

	return (
		<div className="App" style={{ backgroundImage: `linear-gradient(rgba(248,241,255,0.70), rgba(238,246,255,0.60)), url('${bgUrl}')`, backgroundSize:'cover', backgroundPosition:'center' }}>
			<div className="app-container">
				<header className="app-header">
					<div className="brand">
						<img src={logoCandidates[0]} alt="Leafnote logo" className="brand-logo" onError={(e)=>{ e.currentTarget.onerror=null; e.currentTarget.src=logoSvg; }} />
						<div className="brand-text"><h1>Leafnote</h1><div className="tagline">Leafnote: A quiet record of your reading</div></div>
					</div>
					<div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
						<div style={{ fontSize: 14, color: 'rgba(15,23,36,0.7)' }}>{readBooks.length} read • {toReadBooks.length} to-read</div>
						<div style={{ display: 'flex', gap: 8 }}>
							<button className="cta" onClick={exportData}>Export</button>
							<button className="cta" onClick={triggerImport}>Import</button>
							<input ref={fileInputRef} onChange={handleImportFile} style={{ display: 'none' }} type="file" accept="application/json" />
						</div>
						<div>
							{user ? (
								<div style={{ display:'flex', gap:8, alignItems:'center' }}>
									<div style={{ fontSize: 14 }}>{user.email}</div>
									<button className="cta" onClick={signOut}>Sign out</button>
								</div>
							) : (
								<div style={{ display:'flex', gap:8, alignItems:'center' }}>
									<input value={authEmail} onChange={(e)=>setAuthEmail(e.target.value)} placeholder="you@domain.com" style={{ padding:'6px 8px', borderRadius:6, border:'1px solid #ddd' }} />
									<button className="cta" onClick={()=>signIn(authEmail)}>Sign in</button>
								</div>
							)}
						</div>
					</div>
				</header>

				<aside className="sidebar">
					<section className="card">
						<h2 style={{marginTop:0}}>Add Read Book</h2>
						<label>Book Title<input type="text" value={readTitle} onChange={(e)=>setReadTitle(e.target.value)} placeholder="e.g., Atomic Habits" /></label>
						<div style={{ margin:'10px 0' }}>
							<div style={{ fontSize:14, marginBottom:6 }}>Rating</div>
							<div className="star-row">{[1,2,3,4,5].map(n=> (<button key={n} onClick={()=>setReadRating(n)} className="star-button">{n<=readRating ? '★':'☆'}</button>))}</div>
						</div>
						<div style={{ display:'flex', gap:8 }}><button className="cta" onClick={addReadBook} disabled={!readTitle.trim() || readRating<1}>Save as Read</button></div>
					</section>

					<section className="card" style={{ marginTop:12 }}>
						<h2 style={{marginTop:0}}>Add To-Read</h2>
						<label>Book Title<input type="text" value={toReadTitle} onChange={(e)=>setToReadTitle(e.target.value)} placeholder="e.g., Deep Work" /></label>
						<div style={{ marginTop:12 }}><button className="cta" onClick={addToReadBook} disabled={!toReadTitle.trim()}>Add to To-Read</button></div>
					</section>
				</aside>

				<main className="main">
					<section className="card">
						<h2 style={{marginTop:0}}>Books Read</h2>
						{readBooks.length===0 ? <p>No books yet.</p> : (
							<ul className="list">{readBooks.map(b=> (<li key={b.id}><div style={{ fontWeight:600 }}>{'★'.repeat(b.rating)} {b.title} <div style={{ color:'#666', fontSize:13 }}>{new Date(b.dateRead).toLocaleDateString()}</div></div></li>))}</ul>
						)}
					</section>

					<section className="card">
						<h2 style={{marginTop:0}}>To-Read</h2>
						{toReadBooks.length===0 ? <p>No books in your list yet.</p> : (
							<ul className="list">{toReadBooks.map(b=> (<li key={b.id}><div style={{ fontWeight:600 }}>{b.title}<div style={{ color:'#666', fontSize:13 }}>{new Date(b.dateAdded).toLocaleDateString()}</div></div></li>))}</ul>
						)}
					</section>

					<section className="card">
						<h2 style={{marginTop:0}}>Recommendations</h2>
						<div className="card-grid" style={{ marginTop:8 }}>
							<div className="mini-card"><strong>Top Rated</strong><div style={{ marginTop:8 }}>{topRated.length===0 ? <div style={{ color:'#666' }}>Add some rated books to see top picks.</div> : <ul style={{ margin:0, padding:0 }}>{topRated.map(b=>(<li key={b.id} style={{ listStyle:'none', marginBottom:6 }}>★{b.rating} {b.title}</li>))}</ul>}</div></div>
							<div className="mini-card"><strong>To Read Next</strong><div style={{ marginTop:8 }}>{nextReads.length===0 ? <div style={{ color:'#666' }}>Add items to your to-read list.</div> : <ul style={{ margin:0, padding:0 }}>{nextReads.map(b=>(<li key={b.id} style={{ listStyle:'none', marginBottom:6 }}>{b.title}</li>))}</ul>}</div></div>
						</div>
					</section>
				</main>
			</div>
		</div>
	);
}

export default App;

