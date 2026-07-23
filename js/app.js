/* =========================================
   APP SHELL — Entry Point
   ========================================= */
import { html, useState, useEffect, useRef, useCallback } from './lib.js';
import {
   ThemeProvider, AuthProvider, AppStateProvider,
   useAuth, useAppState, friendlyAuthError
} from './store.js';
import { Sidebar } from './sidebar.js';
import { TopBar, BoxGrid } from './main.js';
import { InfoPanel } from './infopanel.js';
import { ModalManager } from './modals.js';

/* ─── Login Screen ─────────────────────────── */
function LoginScreen() {
   const { login } = useAuth();
   const [email, setEmail] = useState('');
   const [password, setPassword] = useState('');
   const [error, setError] = useState('');
   const [loading, setLoading] = useState(false);
   const passwordRef = useRef(null);

   const handleLogin = useCallback(async () => {
      if (!email.trim() || !password) {
         setError('Please enter your email and password.');
         return;
      }
      setLoading(true);
      setError('');
      try {
         await login(email.trim(), password);
      } catch (e) {
         setLoading(false);
         setError(friendlyAuthError(e.code));
      }
   }, [email, password, login]);

   const onEmailKey = useCallback((e) => {
      if (e.key === 'Enter') passwordRef.current?.focus();
   }, []);

   const onPasswordKey = useCallback((e) => {
      if (e.key === 'Enter') handleLogin();
   }, [handleLogin]);

   return html`
      <div class="login-screen">
         <div class="login-card">
            <div class="login-logo"><i class="ph ph-shield-check"></i></div>
            <h1 class="login-title">Model Manager</h1>
            <p class="login-sub">Sign in to continue</p>
            <div class="form-group">
               <label>Email</label>
               <input
                  type="email"
                  placeholder="you@example.com"
                  autocomplete="email"
                  value=${email}
                  onInput=${(e) => setEmail(e.target.value)}
                  onKeyPress=${onEmailKey}
               />
            </div>
            <div class="form-group">
               <label>Password</label>
               <input
                  ref=${passwordRef}
                  type="password"
                  placeholder="••••••••"
                  autocomplete="current-password"
                  value=${password}
                  onInput=${(e) => setPassword(e.target.value)}
                  onKeyPress=${onPasswordKey}
               />
            </div>
            ${error && html`
               <div class="login-error">${error}</div>
            `}
            <button
               class="btn primary login-btn"
               onClick=${handleLogin}
               disabled=${loading}
            >
               ${loading
                  ? html`<i class="ph ph-circle-notch ph-spinner"></i> Signing in…`
                  : html`<i class="ph ph-sign-in"></i> Sign In`
               }
            </button>
         </div>
      </div>
   `;
}

/* ─── Loading Screen ───────────────────────── */
function LoadingScreen() {
   return html`
      <div class="loading-screen">
         <i class="ph ph-circle-notch ph-spinner"></i>
      </div>
   `;
}

/* ─── Save Indicator ───────────────────────── */
function SaveIndicator() {
   const { saveStatus } = useAppState();

   if (!saveStatus) return null;

   const content = {
      saving: html`<i class="ph ph-circle-notch ph-spinner"></i> Saving…`,
      saved: html`<i class="ph ph-check"></i> Saved`,
      error: html`<i class="ph ph-warning"></i> Save failed`
   };

   return html`
      <div class="save-indicator ${saveStatus ? 'visible' : ''}">
         ${content[saveStatus]}
      </div>
   `;
}

/* ─── Main Layout ──────────────────────────── */
function AppLayout() {
   const { state, dataLoading } = useAppState();

   if (dataLoading || !state) return html`<${LoadingScreen} />`;

   return html`
      <div class="app-layout">
         <${Sidebar} />
         <main class="main-content">
            <${TopBar} />
            <${BoxGrid} />
         </main>
         <${InfoPanel} />
      </div>
      <${ModalManager} />
      <${SaveIndicator} />
   `;
}

/* ─── App Root ─────────────────────────────── */
function AppShell() {
   const { user, authLoading } = useAuth();

   if (authLoading) return html`<${LoadingScreen} />`;
   if (!user) return html`<${LoginScreen} />`;

   return html`<${AppStateProvider}><${AppLayout} /><//>`;
}

function App() {
   return html`
      <${ThemeProvider}>
         <${AuthProvider}>
            <${AppShell} />
         <//>
      <//>
   `;
}

/* ─── Mount ────────────────────────────────── */
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(html`<${App} />`);
