/* =========================================
   STATE MANAGEMENT — Contexts & Hooks
   ========================================= */
import { html, useState, useEffect, useRef, useCallback, useContext, createContext } from './lib.js';
import { auth, db } from './firebase.js';

/* ─── Theme Context ────────────────────────── */
const ThemeContext = createContext();

export function ThemeProvider({ children }) {
   const [theme, setTheme] = useState(() => localStorage.getItem('theme-preference') || 'system');

   useEffect(() => {
      localStorage.setItem('theme-preference', theme);
      applyTheme(theme);
   }, [theme]);

   useEffect(() => {
      if (theme !== 'system') return;
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => applyTheme('system');
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
   }, [theme]);

   return html`<${ThemeContext.Provider} value=${{ theme, setTheme }}>${children}<//>`;
}

function applyTheme(theme) {
   const root = document.documentElement;
   if (theme === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.setAttribute('data-theme', isDark ? 'dark' : 'light');
   } else {
      root.setAttribute('data-theme', theme);
   }
}

export function useTheme() {
   return useContext(ThemeContext);
}

/* ─── Auth Context ─────────────────────────── */
const AuthContext = createContext();

export function AuthProvider({ children }) {
   const [user, setUser] = useState(null);
   const [authLoading, setAuthLoading] = useState(true);

   useEffect(() => {
      const unsub = auth.onAuthStateChanged(u => {
         setUser(u);
         setAuthLoading(false);
      });
      return unsub;
   }, []);

   const login = useCallback(async (email, password) => {
      return auth.signInWithEmailAndPassword(email, password);
   }, []);

   const logout = useCallback(() => auth.signOut(), []);

   return html`<${AuthContext.Provider} value=${{ user, authLoading, login, logout }}>${children}<//>`;
}

export function useAuth() {
   return useContext(AuthContext);
}

/* ─── App State Context ────────────────────── */
const AppStateContext = createContext();

const defaultState = {
   categories: [],
   tags: [
      { id: 't1', name: 'Favorite', color: '#fbbf24' },
      { id: 't2', name: 'New', color: '#34d399' }
   ],
   settings: {
      searchTemplates: [
         { name: "Google", url: "https://www.google.com/search?q={name}" },
         { name: "Twitter", url: "https://twitter.com/search?q={name}" }
      ],
      showCategorySeparators: false
   }
};

export function AppStateProvider({ children }) {
   const { user } = useAuth();
   const [state, setStateRaw] = useState(null);
   const [dataLoading, setDataLoading] = useState(true);
   const [saveStatus, setSaveStatus] = useState(null);
   const saveTimerRef = useRef(null);
   const stateRef = useRef(null);

   /* Navigation */
   const [viewMode, setViewMode] = useState('category');
   const [activeId, setActiveId] = useState(null);
   const [selectedBoxId, setSelectedBoxId] = useState(null);
   const [searchText, setSearchText] = useState('');

   /* Modal */
   const [modal, setModal] = useState(null);
   const openModal = useCallback((type, props = {}) => setModal({ type, props }), []);
   const closeModal = useCallback(() => setModal(null), []);

   /* Scroll state for search preservation */
   const scrollRef = useRef(null);
   const preSearchState = useRef(null);

   const getDocRef = useCallback(() => {
      if (!user) return null;
      return db.collection("users").doc(user.uid).collection("data").doc("state");
   }, [user]);

   /* Load state from Firestore */
   useEffect(() => {
      if (!user) { setStateRaw(null); setDataLoading(false); return; }
      setDataLoading(true);
      const ref = getDocRef();
      ref.get().then(snap => {
         let s;
         if (snap.exists) {
            s = snap.data().payload;
            if (!s.tags) s.tags = [];
            if (!s.settings) s.settings = { searchTemplates: [] };
            if (!s.settings.searchTemplates) s.settings.searchTemplates = [];
            if (s.settings.showCategorySeparators === undefined) s.settings.showCategorySeparators = false;
         } else {
            s = JSON.parse(JSON.stringify(defaultState));
            ref.set({ payload: s });
         }
         setStateRaw(s);
         stateRef.current = s;

         /* Restore last category from localStorage */
         if (s.categories.length > 0) {
            const lastCat = localStorage.getItem('lastCategoryId');
            if (lastCat && s.categories.find(c => c.id === lastCat)) {
               setActiveId(lastCat);
            } else {
               setActiveId(s.categories[0].id);
            }
         }
         setDataLoading(false);
      }).catch(e => {
         console.error("Failed to load state:", e);
         const s = JSON.parse(JSON.stringify(defaultState));
         setStateRaw(s);
         stateRef.current = s;
         setDataLoading(false);
      });
   }, [user, getDocRef]);

   /* Persist last category */
   useEffect(() => {
      if (activeId && viewMode === 'category') {
         localStorage.setItem('lastCategoryId', activeId);
      }
   }, [activeId, viewMode]);

   /* Save with debounce */
   const save = useCallback((newState) => {
      setStateRaw(newState);
      stateRef.current = newState;
      clearTimeout(saveTimerRef.current);
      setSaveStatus('saving');
      saveTimerRef.current = setTimeout(async () => {
         try {
            const ref = getDocRef();
            if (ref) await ref.set({ payload: newState });
            setSaveStatus('saved');
            setTimeout(() => setSaveStatus(null), 2000);
         } catch (e) {
            console.error("Save failed:", e);
            setSaveStatus('error');
            setTimeout(() => setSaveStatus(null), 4000);
         }
      }, 800);
   }, [getDocRef]);

   const value = {
      state, save, dataLoading, saveStatus,
      viewMode, setViewMode,
      activeId, setActiveId,
      selectedBoxId, setSelectedBoxId,
      searchText, setSearchText,
      modal, openModal, closeModal,
      scrollRef, preSearchState
   };

   return html`<${AppStateContext.Provider} value=${value}>${children}<//>`;
}

export function useAppState() {
   return useContext(AppStateContext);
}

/* ─── State Helper Functions ───────────────── */

/** Normalize a link to { title, url } format */
export function normalizeLink(l) {
   if (typeof l === 'string') return { title: '', url: l };
   return l;
}

/** Find a box across all categories. Returns { box, category } or nulls */
export function findBox(state, boxId) {
   for (const cat of state.categories) {
      const box = cat.boxes.find(b => b.id === boxId);
      if (box) return { box, category: cat };
   }
   return { box: null, category: null };
}

/** Get a tag object by id */
export function getTagObj(state, tagId) {
   return state.tags.find(t => t.id === tagId) || { name: 'Unknown', color: '#555' };
}

/** Update a specific box immutably and return the new state */
export function updateBox(state, boxId, updater) {
   return {
      ...state,
      categories: state.categories.map(c => ({
         ...c,
         boxes: c.boxes.map(b => b.id === boxId ? updater(b) : b)
      }))
   };
}

/** Get the active name for URL templates (falls back to box.name) */
export function getActiveName(box) {
   return box.activeName || box.name;
}

/** Parse bulk link lines into { title, url } objects */
export function parseBulkLines(text) {
   const results = [];
   const lines = text.split('\n');
   for (let raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      if (/^https?:\/\//i.test(line)) {
         results.push({ title: '', url: line });
      } else {
         const commaIdx = line.indexOf(',');
         if (commaIdx !== -1) {
            const before = line.slice(0, commaIdx).trim();
            const after = line.slice(commaIdx + 1).trim();
            if (/^https?:\/\//i.test(after)) results.push({ title: before, url: after });
            else if (/^https?:\/\//i.test(before)) results.push({ title: '', url: before });
         }
      }
   }
   return results;
}

/** Friendly auth error messages */
export function friendlyAuthError(code) {
   const map = {
      'auth/user-not-found': 'Incorrect email or password.',
      'auth/wrong-password': 'Incorrect email or password.',
      'auth/invalid-credential': 'Incorrect email or password.',
      'auth/too-many-requests': 'Too many attempts. Try again later.',
      'auth/invalid-email': 'Please enter a valid email address.'
   };
   return map[code] || 'Sign-in failed. Please try again.';
}
