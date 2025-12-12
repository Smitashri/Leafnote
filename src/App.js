import { useEffect, useMemo, useState } from "react";
import "./App.css";
import logoSvg from "./leafnote-logo.svg";
// Now implement the BookTracker logic.
// - Keep two arrays in state: readBooks and toReadBooks.
// - Load initial values from localStorage key "booktracker_v1" on first render.
// - Persist to localStorage whenever either array changes.
// - Implement handlers:
//   - addReadBook(title, rating): adds {id, title, rating, dateRead: new Date().toISOString()}
//   - addToReadBook(title): adds {id, title, dateAdded: new Date().toISOString()}
// - Render basic inputs for title and rating (clickable stars) and buttons.
// - Render lists for Books Read and To-Read.
// - Recommendations:
//   - Top Rated Books = sort by rating desc, then dateRead desc, top 5.
//   - Books To Read Next = sort by dateAdded desc, top 3.



// BookTracker MVP - single page React app.
// Requirements:
// - Use React state and browser localStorage (key: "booktracker_v1").
// - Data types:
//   - ReadBook: { id, title, rating (1-5), dateRead (string) }
//   - ToReadBook: { id, title, dateAdded (string) }
// - Sections on the page:
//   1) "Add Read Book": input for title, 5 clickable stars for rating, "Save as Read" button.
//   2) "Add To-Read": input for title, "Add to To-Read" button.
//   3) "Books Read" list: show stars, title, dateRead.
//   4) "To-Read" list: show title and dateAdded.
//   5) "Recommendations": 
//      - Top Rated Books = read books sorted by rating desc then dateRead desc (top 5).
//      - Books To Read Next = to-read books sorted by dateAdded desc (top 3).
// - On every change, save updated arrays into localStorage so refreshing the page keeps the data.
// - Keep the layout simple and readable, no fancy styling needed now.

function App() {
    const STORAGE_KEY = "booktracker_v1";
  const PUBLIC = process.env.PUBLIC_URL || '';
  const bgUrl = `${PUBLIC}/leafnote.jpg`;

  const [readBooks, setReadBooks] = useState([]);
  const [toReadBooks, setToReadBooks] = useState([]);

  const [readTitle, setReadTitle] = useState("");
  const [readRating, setReadRating] = useState(0);

  const [toReadTitle, setToReadTitle] = useState("");

  // Load from localStorage once
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setReadBooks(Array.isArray(parsed.readBooks) ? parsed.readBooks : []);
      setToReadBooks(Array.isArray(parsed.toReadBooks) ? parsed.toReadBooks : []);
    } catch (e) {
      // If localStorage is corrupted, start fresh
      setReadBooks([]);
      setToReadBooks([]);
    }
  }, []);

  // Save to localStorage whenever data changes
  useEffect(() => {
    const payload = { readBooks, toReadBooks };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [readBooks, toReadBooks]);

    function addReadBook() {
    const title = readTitle.trim();
    if (!title || readRating < 1) return;

    const newBook = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      title,
      rating: readRating,
      dateRead: new Date().toISOString(),
    };

    setReadBooks((prev) => [newBook, ...prev]);
    setReadTitle("");
    setReadRating(0);
  }

  function addToReadBook() {
    const title = toReadTitle.trim();
    if (!title) return;

    const newBook = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      title,
      dateAdded: new Date().toISOString(),
    };

    setToReadBooks((prev) => [newBook, ...prev]);
    setToReadTitle("");
  }

  const topRated = useMemo(() => {
    return [...readBooks]
      .sort((a, b) => (b.rating - a.rating) || (new Date(b.dateRead) - new Date(a.dateRead)))
      .slice(0, 5);
  }, [readBooks]);

  const nextReads = useMemo(() => {
    return [...toReadBooks]
      .sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded))
      .slice(0, 3);
  }, [toReadBooks]);

  const logoCandidates = [
    `${PUBLIC}/logo%20leafnote.jpg`, // uploaded filename with space
    `${PUBLIC}/leafnote.jpg`,
    `${PUBLIC}/leafnote-logo.jpg`,
    `${PUBLIC}/leafnote-logo.png`,
  ];


  return (
    <div className="App" style={{
      backgroundImage: `linear-gradient(rgba(248,241,255,0.70), rgba(238,246,255,0.60)), url('${bgUrl}')`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      backgroundAttachment: 'fixed'
    }}>
      <div className="app-container">
        <header className="app-header">
          <div className="brand">
            <img
              src={logoCandidates[0]}
              data-index={0}
              onError={(e) => {
                try {
                  const idx = Number(e.currentTarget.getAttribute('data-index') || 0);
                  const nextIdx = idx + 1;
                  if (nextIdx < logoCandidates.length) {
                    e.currentTarget.setAttribute('data-index', nextIdx);
                    e.currentTarget.src = logoCandidates[nextIdx];
                  } else {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = logoSvg;
                  }
                } catch (err) {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = logoSvg;
                }
              }}
              alt="Leafnote logo"
              className="brand-logo"
            />
            <div className="brand-text">
              <h1>Leafnote</h1>
              <div className="tagline">Leafnote: A quiet record of your reading</div>
            </div>
          </div>
          <div style={{ fontSize: 14, color: 'rgba(15,23,36,0.7)' }}>
            {readBooks.length} read • {toReadBooks.length} to-read
          </div>
        </header>

        <aside className="sidebar">
          <section className="card">
            <h2 style={{marginTop:0}}>Add Read Book</h2>
            <label>
              Book Title
              <input
                type="text"
                value={readTitle}
                onChange={(e) => setReadTitle(e.target.value)}
                placeholder="e.g., Atomic Habits"
              />
            </label>

            <div style={{ margin: '10px 0' }}>
              <div style={{ fontSize: 14, marginBottom: 6 }}>Rating</div>
              <div className="star-row">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setReadRating(n)}
                    aria-label={`Rate ${n} stars`}
                    className="star-button"
                  >
                    {n <= readRating ? '★' : '☆'}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="cta" onClick={addReadBook} disabled={!readTitle.trim() || readRating < 1}>
                Save as Read
              </button>
            </div>
          </section>

          <section className="card" style={{ marginTop: 12 }}>
            <h2 style={{marginTop:0}}>Add To-Read</h2>
            <label>
              Book Title
              <input
                type="text"
                value={toReadTitle}
                onChange={(e) => setToReadTitle(e.target.value)}
                placeholder="e.g., Deep Work"
              />
            </label>
            <div style={{ marginTop: 12 }}>
              <button className="cta" onClick={addToReadBook} disabled={!toReadTitle.trim()}>
                Add to To-Read
              </button>
            </div>
          </section>
        </aside>

        <main className="main">
          <section className="card">
            <h2 style={{marginTop:0}}>Books Read</h2>
            {readBooks.length === 0 ? (
              <p>No books yet.</p>
            ) : (
              <ul className="list">
                {readBooks.map((b) => (
                  <li key={b.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 14, marginBottom: 4 }}>
                          {"★".repeat(b.rating)}{" "}{"☆".repeat(5 - b.rating)}
                        </div>
                        <div style={{ fontWeight: 600 }}>{b.title}</div>
                        <div style={{ color: '#666', fontSize: 13 }}>
                          {new Date(b.dateRead).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card">
            <h2 style={{marginTop:0}}>To-Read</h2>
            {toReadBooks.length === 0 ? (
              <p>No books in your list yet.</p>
            ) : (
              <ul className="list">
                {toReadBooks.map((b) => (
                  <li key={b.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontWeight: 600 }}>{b.title}</div>
                      <div style={{ color: '#666', fontSize: 13 }}>
                        {new Date(b.dateAdded).toLocaleDateString()}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card">
            <h2 style={{marginTop:0}}>Recommendations</h2>
            <div className="card-grid" style={{ marginTop: 8 }}>
              <div className="mini-card">
                <strong>Top Rated</strong>
                <div style={{ marginTop: 8 }}>
                  {topRated.length === 0 ? (
                    <div style={{ color: '#666' }}>Add some rated books to see top picks.</div>
                  ) : (
                    <ul style={{ margin: 0, padding: 0 }}>
                      {topRated.map((b) => (
                        <li key={b.id} style={{ listStyle: 'none', marginBottom: 6 }}>{"★".repeat(b.rating)} {b.title}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="mini-card">
                <strong>To Read Next</strong>
                <div style={{ marginTop: 8 }}>
                  {nextReads.length === 0 ? (
                    <div style={{ color: '#666' }}>Add items to your to-read list.</div>
                  ) : (
                    <ul style={{ margin: 0, padding: 0 }}>
                      {nextReads.map((b) => (
                        <li key={b.id} style={{ listStyle: 'none', marginBottom: 6 }}>{b.title}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

export default App;