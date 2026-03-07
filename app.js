/* =========================================
   FIREBASE INIT
========================================= */
const firebaseConfig = {
   apiKey: "AIzaSyB7KQZQxFrKyr2gwYAOir8fVO_eXgWVl48",
   authDomain: "models-8ef22.firebaseapp.com",
   projectId: "models-8ef22",
   storageBucket: "models-8ef22.firebasestorage.app",
   messagingSenderId: "802274508112",
   appId: "1:802274508112:web:c20c6974acea5c6be2c055",
   measurementId: "G-C06GMK0NT6"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.firestore();

/* =========================================
   STATE
========================================= */
const defaultState = {
   categories: [],
   tags: [
      { id: 't1', name: 'Favorite', color: '#fbbf24' },
      { id: 't2', name: 'New',      color: '#34d399' }
   ],
   settings: {
      searchTemplates: [
         { name: "Google",  url: "https://www.google.com/search?q={name}" },
         { name: "Twitter", url: "https://twitter.com/search?q={name}" }
      ]
   }
};

let state = null;
let currentUid = null;

// Navigation state
let viewMode    = 'category';
let activeId    = null;
let selectedBoxId = null;
let dragSource  = null;

// Save debounce timer
let saveTimer = null;

/* =========================================
   FIRESTORE PERSISTENCE
========================================= */
function getDocRef() {
   return db.collection("users").doc(currentUid).collection("data").doc("state");
}

async function loadState() {
   try {
      const snap = await getDocRef().get();
      if (snap.exists) {
         state = snap.data().payload;
         if (!state.tags)     state.tags = [];
         if (!state.settings) state.settings = { searchTemplates: [] };
      } else {
         state = defaultState;
         await getDocRef().set({ payload: state });
      }
   } catch (e) {
      console.error("Failed to load state:", e);
      state = defaultState;
   }
}

function save() {
   clearTimeout(saveTimer);
   showSaveIndicator("saving");
   saveTimer = setTimeout(async () => {
      try {
         await getDocRef().set({ payload: state });
         showSaveIndicator("saved");
      } catch (e) {
         console.error("Save failed:", e);
         showSaveIndicator("error");
      }
   }, 800);
}

/* ── Save indicator ─────────────────────── */
let indicatorEl = null;
let indicatorHideTimer = null;

function showSaveIndicator(status) {
   if (!indicatorEl) {
      indicatorEl = document.createElement("div");
      indicatorEl.id = "saveIndicator";
      document.body.appendChild(indicatorEl);
   }
   clearTimeout(indicatorHideTimer);
   indicatorEl.classList.add("visible");

   if (status === "saving") {
      indicatorEl.innerHTML = `<i class="ph ph-circle-notch ph-spin"></i> Saving…`;
   } else if (status === "saved") {
      indicatorEl.innerHTML = `<i class="ph ph-check"></i> Saved`;
      indicatorHideTimer = setTimeout(() => indicatorEl.classList.remove("visible"), 2000);
   } else {
      indicatorEl.innerHTML = `<i class="ph ph-warning"></i> Save failed`;
      indicatorHideTimer = setTimeout(() => indicatorEl.classList.remove("visible"), 4000);
   }
}

/* =========================================
   LINK HELPERS
   Links stored as { title, url }.
   Old plain-string links normalised on read.
========================================= */
function normaliseLink(l) {
   if (typeof l === "string") return { title: "", url: l };
   return l;
}

/* =========================================
   DOM ELEMENTS
========================================= */
const els = {
   loginScreen:      document.getElementById("loginScreen"),
   loadingScreen:    document.getElementById("loadingScreen"),
   appLayout:        document.getElementById("appLayout"),
   loginEmail:       document.getElementById("loginEmail"),
   loginPassword:    document.getElementById("loginPassword"),
   loginError:       document.getElementById("loginError"),
   loginBtn:         document.getElementById("loginBtn"),
   catList:          document.getElementById("categoryList"),
   tagSidebarList:   document.getElementById("tagSidebarList"),
   boxContainer:     document.getElementById("boxContainer"),
   infoPanel:        document.getElementById("infoContent"),
   emptyState:       document.querySelector(".empty-state"),
   modalOverlay:     document.getElementById("modalOverlay"),
   modalTitle:       document.getElementById("modalTitle"),
   modalBody:        document.getElementById("modalBody"),
   modalConfirmBtn:  document.getElementById("modalConfirmBtn"),
   currentViewTitle: document.getElementById("currentViewTitle"),
   itemCount:        document.getElementById("itemCount"),
   searchInput:      document.getElementById("searchInput")
};

/* =========================================
   AUTH — LOGIN / LOGOUT
========================================= */
auth.onAuthStateChanged(async (user) => {
   if (user) {
      currentUid = user.uid;
      await loadState();
      showApp();
   } else {
      currentUid = null;
      state = null;
      showLogin();
   }
});

function showLogin() {
   els.loadingScreen.classList.add("hidden");
   els.loginScreen.classList.remove("hidden");
   // layout stays in DOM always — login screen overlays it via position:fixed
}

function showApp() {
   els.loadingScreen.classList.add("hidden");
   els.loginScreen.classList.add("hidden");
   // layout was always rendered — no display change needed, grid heights are correct
   initApp();
}

document.addEventListener("DOMContentLoaded", () => {
   els.loginBtn.addEventListener("click", handleLogin);
   els.loginPassword.addEventListener("keypress", (e) => { if (e.key === "Enter") handleLogin(); });
   els.loginEmail.addEventListener("keypress",    (e) => { if (e.key === "Enter") els.loginPassword.focus(); });
});

async function handleLogin() {
   const email    = els.loginEmail.value.trim();
   const password = els.loginPassword.value;
   if (!email || !password) { showLoginError("Please enter your email and password."); return; }

   els.loginBtn.disabled = true;
   els.loginBtn.innerHTML = `<i class="ph ph-circle-notch ph-spin"></i> Signing in…`;
   hideLoginError();

   try {
      await auth.signInWithEmailAndPassword(email, password);
   } catch (e) {
      els.loginBtn.disabled = false;
      els.loginBtn.innerHTML = `<i class="ph ph-sign-in"></i> Sign In`;
      showLoginError(friendlyAuthError(e.code));
   }
}

function handleLogout() { auth.signOut(); }

function showLoginError(msg) { els.loginError.innerText = msg; els.loginError.classList.remove("hidden"); }
function hideLoginError()    { els.loginError.classList.add("hidden"); }

function friendlyAuthError(code) {
   const map = {
      "auth/user-not-found":    "Incorrect email or password.",
      "auth/wrong-password":    "Incorrect email or password.",
      "auth/invalid-credential":"Incorrect email or password.",
      "auth/too-many-requests": "Too many attempts. Try again later.",
      "auth/invalid-email":     "Please enter a valid email address."
   };
   return map[code] || "Sign-in failed. Please try again.";
}

/* =========================================
   GRID HEIGHT — set directly in JS so no
   CSS parent chain can ever override it
========================================= */
function fixGridHeight() {
   const grid = document.getElementById("boxContainer");
   if (grid) grid.style.height = (window.innerHeight - 60) + "px";
}

/* =========================================
   APP INIT (runs after login + data load)
========================================= */
function initApp() {
   fixGridHeight();
   window.addEventListener("resize", fixGridHeight);
   if (state.categories.length > 0) {
      activeId = state.categories[0].id;
   } else {
      createCategory("My Collection");
      activeId = state.categories[0].id;
   }

   renderSidebar();
   renderBoxes();

   document.getElementById("addCategoryBtn").onclick  = () => openPromptModal("New Category", "Name", (val) => createCategory(val));
   document.getElementById("addBoxBtn").onclick       = openAddBoxModal;
   document.getElementById("bulkAddBoxBtn").onclick   = openBulkAddBoxModal;
   document.getElementById("settingsBtn").onclick     = openSettingsModal;
   document.getElementById("manageTagsBtn").onclick   = openTagManagerModal;
   document.getElementById("logoutBtn").onclick       = handleLogout;
   document.querySelectorAll(".close-modal").forEach(btn => btn.onclick = closeModal);

   els.searchInput.addEventListener("input", (e) => {
      const val = e.target.value.trim();
      if (val !== "") {
         viewMode = 'search'; selectedBoxId = null;
         renderSidebar(); renderBoxes(val);
      } else {
         viewMode = 'category';
         if (state.categories.length) activeId = state.categories[0].id;
         renderSidebar(); renderBoxes();
      }
   });
}

/* =========================================
   SIDEBAR & NAVIGATION
========================================= */
function createCategory(name) {
   if (!name) return;
   const newCat = { id: crypto.randomUUID(), name, boxes: [] };
   state.categories.push(newCat);
   viewMode = 'category';
   activeId = newCat.id;
   save();
   renderSidebar();
   renderBoxes();
}

function renderSidebar() {
   els.catList.innerHTML = "";
   state.categories.forEach(cat => {
      const div = document.createElement("div");
      const isActive = viewMode === 'category' && activeId === cat.id;
      div.className = `category-item ${isActive ? "active" : ""}`;
      div.draggable = true;
      div.innerHTML = `
         <span>${cat.name}</span>
         <div class="cat-actions">
            <button class="icon-btn" onclick="openPromptModal('Rename','New Name',(n)=>renameCategory('${cat.id}',n),'${cat.name}')"><i class="ph ph-pencil-simple"></i></button>
            <button class="icon-btn" onclick="confirmDeleteCategory('${cat.id}')"><i class="ph ph-trash"></i></button>
         </div>
      `;
      div.onclick = (e) => {
         if (e.target.closest("button")) return;
         viewMode = 'category'; activeId = cat.id; selectedBoxId = null;
         els.searchInput.value = "";
         renderSidebar(); renderBoxes(); renderInfo();
      };
      div.ondragstart = (e) => { dragSource = { type: 'category', id: cat.id }; e.dataTransfer.effectAllowed = 'move'; div.style.opacity = '0.5'; };
      div.ondragend   = ()  => div.style.opacity = '1';
      div.ondragover  = (e) => { e.preventDefault(); div.classList.add('drag-over'); };
      div.ondragleave = ()  => div.classList.remove('drag-over');
      div.ondrop      = (e) => { e.preventDefault(); div.classList.remove('drag-over'); handleDropOnCategory(cat.id); };
      els.catList.appendChild(div);
   });

   els.tagSidebarList.innerHTML = "";
   state.tags.forEach(tag => {
      const div = document.createElement("div");
      const isActive = viewMode === 'tag' && activeId === tag.id;
      div.className = `category-item ${isActive ? "active" : ""}`;
      div.innerHTML = `
         <div style="display:flex;align-items:center;">
            <div class="tag-dot" style="background:${tag.color}"></div>
            <span>${tag.name}</span>
         </div>
      `;
      div.onclick = () => {
         viewMode = 'tag'; activeId = tag.id; selectedBoxId = null;
         els.searchInput.value = "";
         renderSidebar(); renderBoxes(); renderInfo();
      };
      els.tagSidebarList.appendChild(div);
   });
}

function renameCategory(id, name) {
   const cat = state.categories.find(c => c.id === id);
   if (cat) { cat.name = name; save(); renderSidebar(); }
}

function confirmDeleteCategory(id) {
   openConfirmModal("Delete Category?", "This will delete all models inside it.", () => {
      state.categories = state.categories.filter(c => c.id !== id);
      if (state.categories.length) { viewMode = 'category'; activeId = state.categories[0].id; }
      save(); renderSidebar(); renderBoxes();
   });
}

/* =========================================
   BOXES / MODELS
========================================= */
function getTagObj(tagId) {
   return state.tags.find(t => t.id === tagId) || { name: 'Unknown', color: '#333' };
}

function renderBoxes(searchText = "") {
   els.boxContainer.innerHTML = "";
   let boxesToRender = [], title = "";

   if (viewMode === 'search') {
      title = `Search: "${searchText}"`;
      state.categories.forEach(cat =>
         cat.boxes.forEach(box => {
            if (box.name.toLowerCase().includes(searchText.toLowerCase())) boxesToRender.push(box);
         })
      );
   } else if (viewMode === 'tag') {
      const tag = getTagObj(activeId);
      title = `Tag: ${tag.name}`;
      state.categories.forEach(cat =>
         cat.boxes.forEach(box => { if (box.tags && box.tags.includes(activeId)) boxesToRender.push(box); })
      );
   } else {
      const cat = state.categories.find(c => c.id === activeId);
      if (cat) { title = cat.name; boxesToRender = cat.boxes; }
   }

   els.currentViewTitle.innerText = title;
   els.itemCount.innerText = `${boxesToRender.length} items`;

   boxesToRender.forEach(box => {
      const div = document.createElement("div");
      div.className = `box ${box.id === selectedBoxId ? "selected" : ""}`;
      div.draggable = true;

      const tagDots = (box.tags || []).map(tid => {
         const t = getTagObj(tid);
         return `<div class="mini-tag" style="background:${t.color}" title="${t.name}"></div>`;
      }).join('');

      div.innerHTML = `
         <img src="${box.image || 'https://via.placeholder.com/200x220?text=No+Image'}"
              onerror="this.src='https://via.placeholder.com/200x220?text=Error'">
         <div class="box-info">
            <h3>${box.name}</h3>
            <div class="box-tags">${tagDots}</div>
         </div>
      `;

      div.onclick = () => { selectedBoxId = box.id; renderBoxes(searchText); renderInfo(); };

      div.ondragstart = (e) => {
         const parentCat = state.categories.find(c => c.boxes.find(b => b.id === box.id));
         dragSource = { type: 'box', id: box.id, fromCatId: parentCat.id };
         e.dataTransfer.effectAllowed = 'move';
      };
      div.ondragover = (e) => e.preventDefault();
      div.ondrop = (e) => {
         e.preventDefault();
         if (viewMode === 'category' && dragSource.type === 'box' && dragSource.fromCatId === activeId) {
            const cat = state.categories.find(c => c.id === activeId);
            const from = cat.boxes.findIndex(b => b.id === dragSource.id);
            const to   = cat.boxes.findIndex(b => b.id === box.id);
            const [moved] = cat.boxes.splice(from, 1);
            cat.boxes.splice(to, 0, moved);
            save(); renderBoxes();
         }
      };
      els.boxContainer.appendChild(div);
   });
}

async function handleAddBox(name) {
   if (viewMode !== 'category' || !activeId) { alert("Please select a specific category to add a model."); return; }
   let image = "";
   try {
      const res  = await fetch(`https://api.camgirlfinder.net/models/search?model=${encodeURIComponent(name)}`);
      const json = await res.json();
      if (json.length && json[0].persons?.[0]?.urls?.faceImage) image = json[0].persons[0].urls.faceImage;
   } catch (e) { console.error("API Error", e); }

   const cat = state.categories.find(c => c.id === activeId);
   cat.boxes.push({ id: crypto.randomUUID(), name, image, tags: [], links: [] });
   save(); renderBoxes();
}

function openBulkAddBoxModal() {
   if (!activeId || viewMode !== 'category') { alert("Select a category first."); return; }
   els.modalTitle.innerText = "Bulk Add Models";
   els.modalBody.innerHTML = `
      <p style="font-size:12px;color:var(--text-muted);margin-bottom:14px;line-height:1.6;">
         One model name per line. Each will be looked up automatically.
      </p>
      <div class="form-group">
         <label>Model Names</label>
         <textarea id="bulkBoxInput" rows="12"
            style="resize:vertical;font-family:monospace;font-size:13px;line-height:1.8;"
            placeholder="judymiles&#10;islanomi&#10;somemodel"></textarea>
      </div>
      <div id="bulkBoxPreview" style="font-size:11px;color:var(--text-muted);margin-top:6px;"></div>
   `;
   els.modalOverlay.classList.remove("hidden");
   els.modalConfirmBtn.classList.remove("hidden");
   els.modalConfirmBtn.innerText = "Add Models";

   const textarea = document.getElementById("bulkBoxInput");
   const preview  = document.getElementById("bulkBoxPreview");

   textarea.addEventListener("input", () => {
      const names = textarea.value.split("\n").map(l => l.trim()).filter(Boolean);
      preview.innerText = names.length ? `${names.length} model${names.length !== 1 ? "s" : ""} will be added.` : "";
   });

   els.modalConfirmBtn.onclick = async () => {
      const names = textarea.value.split("\n").map(l => l.trim()).filter(Boolean);
      if (!names.length) { closeModal(); return; }

      els.modalConfirmBtn.disabled = true;
      els.modalConfirmBtn.innerText = "Adding…";
      document.getElementById("bulkBoxPreview").innerText = "Fetching images, please wait…";

      await handleBulkAddBoxes(names);
      closeModal();
   };
}

async function handleBulkAddBoxes(names) {
   const cat = state.categories.find(c => c.id === activeId);
   if (!cat) return;

   for (const name of names) {
      let image = "";
      try {
         const res  = await fetch(`https://api.camgirlfinder.net/models/search?model=${encodeURIComponent(name)}`);
         const json = await res.json();
         if (json.length && json[0].persons?.[0]?.urls?.faceImage) image = json[0].persons[0].urls.faceImage;
      } catch (e) { console.error("API Error for", name, e); }

      cat.boxes.push({ id: crypto.randomUUID(), name, image, tags: [], links: [] });
   }

   save();
   renderBoxes();
}

/* =========================================
   DRAG AND DROP
========================================= */
function handleDropOnCategory(targetCatId) {
   if (!dragSource) return;
   if (dragSource.type === 'category') {
      const from = state.categories.findIndex(c => c.id === dragSource.id);
      const to   = state.categories.findIndex(c => c.id === targetCatId);
      const [moved] = state.categories.splice(from, 1);
      state.categories.splice(to, 0, moved);
      save(); renderSidebar();
   } else if (dragSource.type === 'box') {
      if (dragSource.fromCatId === targetCatId) return;
      const src = state.categories.find(c => c.id === dragSource.fromCatId);
      const tgt = state.categories.find(c => c.id === targetCatId);
      const [moved] = src.boxes.splice(src.boxes.findIndex(b => b.id === dragSource.id), 1);
      tgt.boxes.push(moved);
      save();
      if (viewMode === 'category' && activeId === dragSource.fromCatId) renderBoxes();
   }
}

/* =========================================
   INFO PANEL
========================================= */
function renderInfo() {
   if (!selectedBoxId) {
      els.infoPanel.classList.add("hidden");
      els.emptyState.classList.remove("hidden");
      return;
   }
   let box = null, parentCat = null;
   state.categories.forEach(c => {
      const b = c.boxes.find(bx => bx.id === selectedBoxId);
      if (b) { box = b; parentCat = c; }
   });
   if (!box) return;

   box.links = (box.links || []).map(normaliseLink);

   els.emptyState.classList.add("hidden");
   els.infoPanel.classList.remove("hidden");

   const generatedLinks = (state.settings.searchTemplates || []).map(tmpl => {
      const url = tmpl.url.replace("{name}", encodeURIComponent(box.name));
      return `<a href="${url}" target="_blank" class="link-item"><i class="ph ph-link"></i> ${tmpl.name}</a>`;
   }).join('');

   const availableTags = state.tags.filter(t => !box.tags.includes(t.id));

   els.infoPanel.innerHTML = `
      <div class="info-header">
         <div>
            <h2 style="margin-bottom:4px;">${box.name}</h2>
            <div style="font-size:12px;color:var(--text-muted)">in ${parentCat.name}</div>
         </div>
         <div style="display:flex;gap:5px;">
            <button class="icon-btn" onclick="openPromptModal('Edit Image URL','URL',(u)=>updateBoxImage(u),'${box.image}')"><i class="ph ph-image"></i></button>
            <button class="icon-btn" style="color:var(--danger)" onclick="deleteBox()"><i class="ph ph-trash"></i></button>
         </div>
      </div>

      <div class="section">
         <div class="section-title">Tags</div>
         <div class="tag-cloud">
            ${(box.tags || []).map(tid => {
               const t = getTagObj(tid);
               return `<div class="tag-pill" style="background:${t.color}">${t.name} <i class="ph ph-x" onclick="removeTagFromBox('${tid}')"></i></div>`;
            }).join('')}
         </div>
         <div style="display:flex;gap:5px;margin-top:8px;">
            <select id="addTagSelect" style="flex:1;">
               <option value="">Select tag…</option>
               ${availableTags.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
            </select>
            <button class="btn primary small" onclick="addTagToBox()">Add</button>
         </div>
         <div style="margin-top:5px;text-align:right;">
            <a href="#" style="font-size:11px;color:var(--text-muted);" onclick="openTagManagerModal()">Manage Global Tags</a>
         </div>
      </div>

      <div class="section">
         <div class="section-title" style="display:flex;justify-content:space-between;align-items:center;">
            <span>Custom Links</span>
            <button class="btn small ghost" style="font-size:11px;padding:2px 8px;" onclick="openBulkAddLinksModal()">
               <i class="ph ph-list-bullets"></i> Bulk Add
            </button>
         </div>
         <div class="link-list">
            ${box.links.map((l, i) => {
               const norm  = normaliseLink(l);
               const label = norm.title ? norm.title : norm.url;
               return `
                  <div class="link-item">
                     <i class="ph ph-globe"></i>
                     <a href="${norm.url}" target="_blank" style="color:white;text-decoration:none;flex:1;overflow:hidden;text-overflow:ellipsis;" title="${norm.url}">${label}</a>
                     <i class="ph ph-x del-link" onclick="removeLink(${i})"></i>
                  </div>`;
            }).join('')}
         </div>
         <div style="display:flex;gap:5px;margin-top:10px;">
            <input id="newLinkTitle" placeholder="Label (optional)" style="width:35%;">
            <input id="newLinkInput" placeholder="https://…" onkeypress="if(event.key==='Enter') addLink()">
            <button class="btn primary small" onclick="addLink()">Add</button>
         </div>
      </div>

      <div class="section">
         <div class="section-title">Search</div>
         <div class="link-list">${generatedLinks}</div>
      </div>
   `;
}

function updateBoxImage(url) {
   state.categories.forEach(c => {
      const b = c.boxes.find(bx => bx.id === selectedBoxId);
      if (b) b.image = url;
   });
   save(); renderBoxes(els.searchInput.value); renderInfo();
}

function deleteBox() {
   openConfirmModal("Delete Model?", "Are you sure?", () => {
      state.categories.forEach(c => { c.boxes = c.boxes.filter(b => b.id !== selectedBoxId); });
      selectedBoxId = null;
      save(); renderBoxes(els.searchInput.value); renderInfo();
   });
}

function addTagToBox() {
   const tagId = document.getElementById("addTagSelect").value;
   if (!tagId) return;
   state.categories.forEach(c => {
      const b = c.boxes.find(bx => bx.id === selectedBoxId);
      if (b) { if (!b.tags) b.tags = []; b.tags.push(tagId); }
   });
   save(); renderInfo(); renderBoxes(els.searchInput.value);
}

function removeTagFromBox(tagId) {
   state.categories.forEach(c => {
      const b = c.boxes.find(bx => bx.id === selectedBoxId);
      if (b && b.tags) b.tags = b.tags.filter(t => t !== tagId);
   });
   save(); renderInfo(); renderBoxes(els.searchInput.value);
}

function addLink() {
   const urlVal   = document.getElementById("newLinkInput").value.trim();
   const titleVal = (document.getElementById("newLinkTitle")?.value || "").trim();
   if (!urlVal) return;
   state.categories.forEach(c => {
      const b = c.boxes.find(bx => bx.id === selectedBoxId);
      if (b) { b.links = (b.links || []).map(normaliseLink); b.links.push({ title: titleVal, url: urlVal }); }
   });
   save(); renderInfo();
}

function removeLink(i) {
   state.categories.forEach(c => {
      const b = c.boxes.find(bx => bx.id === selectedBoxId);
      if (b) b.links.splice(i, 1);
   });
   save(); renderInfo();
}

/* =========================================
   BULK ADD LINKS
========================================= */
function parseBulkLines(text) {
   const results = [];
   for (let raw of text.split("\n")) {
      const line = raw.trim();
      if (!line) continue;
      if (/^https?:\/\//i.test(line)) {
         results.push({ title: "", url: line });
      } else {
         const ci = line.indexOf(",");
         if (ci !== -1) {
            const before = line.slice(0, ci).trim();
            const after  = line.slice(ci + 1).trim();
            if (/^https?:\/\//i.test(after))  results.push({ title: before, url: after });
            else if (/^https?:\/\//i.test(before)) results.push({ title: "", url: before });
         }
      }
   }
   return results;
}

function openBulkAddLinksModal() {
   els.modalTitle.innerText = "Bulk Add Links";
   els.modalBody.innerHTML = `
      <p style="font-size:12px;color:var(--text-muted);margin-bottom:14px;line-height:1.6;">
         One entry per line. Two formats supported:<br>
         <code style="background:var(--bg-card);padding:2px 6px;border-radius:4px;font-size:11px;">Label, https://example.com</code> — with a custom label<br>
         <code style="background:var(--bg-card);padding:2px 6px;border-radius:4px;font-size:11px;">https://example.com</code> — URL only
      </p>
      <div class="form-group">
         <label>Links</label>
         <textarea id="bulkLinksInput" rows="12"
            style="resize:vertical;font-family:monospace;font-size:12px;line-height:1.6;"
            placeholder="My Site, https://example.com&#10;https://another.com&#10;Docs, https://docs.example.com"></textarea>
      </div>
      <div id="bulkPreview" style="font-size:11px;color:var(--text-muted);margin-top:6px;"></div>
   `;
   els.modalOverlay.classList.remove("hidden");
   els.modalConfirmBtn.classList.remove("hidden");
   els.modalConfirmBtn.innerText = "Add Links";

   const textarea = document.getElementById("bulkLinksInput");
   const preview  = document.getElementById("bulkPreview");
   textarea.addEventListener("input", () => {
      const n = parseBulkLines(textarea.value).length;
      preview.innerText = n ? `${n} link${n !== 1 ? "s" : ""} ready to add.` : "";
   });

   els.modalConfirmBtn.onclick = () => {
      const parsed = parseBulkLines(textarea.value);
      if (parsed.length) {
         state.categories.forEach(c => {
            const b = c.boxes.find(bx => bx.id === selectedBoxId);
            if (b) { b.links = (b.links || []).map(normaliseLink); b.links.push(...parsed); }
         });
         save(); renderInfo();
      }
      closeModal();
   };
}

/* =========================================
   TAG MANAGER
========================================= */
function openTagManagerModal() {
   els.modalTitle.innerText = "Manage Global Tags";
   els.modalBody.innerHTML = `
      <p style="font-size:11px;color:var(--text-muted);margin-bottom:10px;">Drag handles (::) to reorder.</p>
      <div id="tagManagerList"></div>
      <div style="display:grid;grid-template-columns:1fr 40px 60px;gap:10px;margin-top:20px;padding-top:15px;border-top:1px solid var(--border);">
         <input id="newTagName" placeholder="New Tag Name">
         <input type="color" id="newTagColor" value="#6366f1">
         <button class="btn primary small" id="addNewTagBtn">Add</button>
      </div>
   `;
   els.modalConfirmBtn.classList.add("hidden");
   els.modalOverlay.classList.remove("hidden");
   renderTagManagerList();
   document.getElementById("addNewTagBtn").onclick = () => {
      const name  = document.getElementById("newTagName").value.trim();
      const color = document.getElementById("newTagColor").value;
      if (name) {
         state.tags.push({ id: crypto.randomUUID(), name, color });
         save(); renderTagManagerList(); renderSidebar();
         document.getElementById("newTagName").value = "";
      }
   };
}

function renderTagManagerList() {
   const list = document.getElementById("tagManagerList");
   list.innerHTML = "";
   state.tags.forEach((tag, index) => {
      const div = document.createElement("div");
      div.className = "tag-manager-row";
      div.draggable = true;
      div.dataset.index = index;
      div.innerHTML = `
         <div class="drag-handle"><i class="ph ph-dots-six-vertical"></i></div>
         <input value="${tag.name}" onchange="updateTag(${index},'name',this.value)">
         <input type="color" value="${tag.color}" onchange="updateTag(${index},'color',this.value)">
         <button class="icon-btn" onclick="deleteGlobalTag(${index})"><i class="ph ph-trash"></i></button>
      `;
      div.ondragstart = (e) => { e.dataTransfer.setData("text/plain", index); div.classList.add("dragging"); };
      div.ondragend   = ()  => div.classList.remove("dragging");
      div.ondragover  = (e) => {
         e.preventDefault();
         const dragging = document.querySelector(".dragging");
         const siblings = [...list.querySelectorAll(".tag-manager-row:not(.dragging)")];
         const next     = siblings.find(s => e.clientY <= s.offsetTop + s.offsetHeight / 2);
         list.insertBefore(dragging, next);
      };
      div.ondrop = (e) => {
         e.preventDefault();
         const rows = [...list.querySelectorAll(".tag-manager-row")];
         state.tags = rows.map(r => state.tags[r.dataset.index]);
         save(); renderTagManagerList(); renderSidebar();
      };
      list.appendChild(div);
   });
}

function updateTag(index, field, value) { state.tags[index][field] = value; save(); renderSidebar(); }

function deleteGlobalTag(index) {
   const tagId = state.tags[index].id;
   state.tags.splice(index, 1);
   state.categories.forEach(c =>
      c.boxes.forEach(b => { if (b.tags) b.tags = b.tags.filter(t => t !== tagId); })
   );
   save(); renderTagManagerList(); renderSidebar(); renderBoxes(els.searchInput.value);
}

/* =========================================
   GENERIC MODALS
========================================= */
function closeModal() {
   els.modalOverlay.classList.add("hidden");
   els.modalConfirmBtn.classList.remove("hidden");
   els.modalConfirmBtn.innerText = "Confirm";
}

function openPromptModal(title, label, callback, defaultValue = "") {
   els.modalTitle.innerText = title;
   els.modalBody.innerHTML = `
      <div class="form-group">
         <label>${label}</label>
         <input id="modalInput" value="${defaultValue}" autocomplete="off">
      </div>
   `;
   els.modalOverlay.classList.remove("hidden");
   const input = document.getElementById("modalInput");
   input.focus();
   input.onkeypress = (e) => { if (e.key === "Enter") els.modalConfirmBtn.click(); };
   els.modalConfirmBtn.onclick = () => { if (input.value) callback(input.value); closeModal(); };
}

function openConfirmModal(title, message, callback) {
   els.modalTitle.innerText = title;
   els.modalBody.innerHTML = `<p style="color:var(--text-muted)">${message}</p>`;
   els.modalOverlay.classList.remove("hidden");
   els.modalConfirmBtn.onclick = () => { callback(); closeModal(); };
}

function openAddBoxModal() {
   if (!activeId || viewMode !== 'category') { alert("Select a category first."); return; }
   openPromptModal("Add New Model", "Name", handleAddBox);
}

function openSettingsModal() {
   els.modalTitle.innerText = "Settings";
   const templatesHtml = (state.settings.searchTemplates || []).map((t, i) => `
      <div style="display:flex;gap:10px;margin-bottom:10px;">
         <input value="${t.name}" id="tmpl-name-${i}" style="width:30%">
         <input value="${t.url}" id="tmpl-url-${i}">
         <button class="icon-btn" onclick="removeTemplate(${i})"><i class="ph ph-trash"></i></button>
      </div>
   `).join('');
   els.modalBody.innerHTML = `
      <div class="settings-section">
         <h3>Search Templates</h3>
         <div id="templateList">${templatesHtml}</div>
         <button class="btn small primary" id="addTmplBtn" style="margin-top:10px"><i class="ph ph-plus"></i> Add Template</button>
      </div>
      <div class="settings-section">
         <h3>Data</h3>
         <div style="display:flex;gap:10px;">
            <button class="btn" onclick="exportData()"><i class="ph ph-download"></i> Export</button>
            <button class="btn" onclick="importData()"><i class="ph ph-upload"></i> Import</button>
         </div>
      </div>
   `;
   els.modalOverlay.classList.remove("hidden");
   document.getElementById("addTmplBtn").onclick = () => {
      state.settings.searchTemplates.push({ name: "New", url: "https://" });
      save(); openSettingsModal();
   };
   els.modalConfirmBtn.onclick = () => {
      state.settings.searchTemplates = [];
      document.getElementById("templateList").querySelectorAll("div").forEach((div, i) => {
         const name = document.getElementById(`tmpl-name-${i}`)?.value;
         const url  = document.getElementById(`tmpl-url-${i}`)?.value;
         if (name && url) state.settings.searchTemplates.push({ name, url });
      });
      save(); renderInfo(); closeModal();
   };
}

function removeTemplate(index) { state.settings.searchTemplates.splice(index, 1); save(); openSettingsModal(); }

function exportData() {
   const a = document.createElement('a');
   a.href = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state));
   a.download = "model_manager_backup.json";
   a.click();
}

function importData() {
   const input = document.createElement('input');
   input.type = 'file';
   input.onchange = e => {
      const reader = new FileReader();
      reader.readAsText(e.target.files[0], 'UTF-8');
      reader.onload = async r => {
         try {
            state = JSON.parse(r.target.result);
            await getDocRef().set({ payload: state });
            location.reload();
         } catch (err) { alert("Invalid JSON"); }
      };
   };
   input.click();
}
