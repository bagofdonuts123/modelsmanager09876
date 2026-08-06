import { html, useState, useEffect, useRef, useCallback } from './lib.js';
import { useAppState, useAuth, useTheme, getTagObj, parseBulkLines, normalizeLink, findDuplicates, mergeBoxes, nameExistsGlobally, getActiveName } from './store.js';

export function ModalManager() {
  const { modal, closeModal } = useAppState();

  if (!modal) return null;

  const { type, props } = modal;

  return html`
    <div class="modal-overlay" onClick=${closeModal}>
      <div class="modal" onClick=${e => e.stopPropagation()}>
        ${renderModalContent(type, props, closeModal)}
      </div>
    </div>
  `;
}

function renderModalContent(type, props, closeModal) {
  switch (type) {
    case 'prompt':
      return html`<${PromptModal} ...${props} closeModal=${closeModal} />`;
    case 'confirm':
      return html`<${ConfirmModal} ...${props} closeModal=${closeModal} />`;
    case 'settings':
      return html`<${SettingsModal} ...${props} closeModal=${closeModal} />`;
    case 'tagManager':
      return html`<${TagManagerModal} ...${props} closeModal=${closeModal} />`;
    case 'bulkAddModels':
      return html`<${BulkAddModelsModal} ...${props} closeModal=${closeModal} />`;
    case 'bulkAddLinks':
      return html`<${BulkAddLinksModal} ...${props} closeModal=${closeModal} />`;
    case 'editLink':
      return html`<${EditLinkModal} ...${props} closeModal=${closeModal} />`;
    case 'iconLibrary':
      return html`<${IconLibraryModal} ...${props} closeModal=${closeModal} />`;
    case 'duplicateScanner':
      return html`<${DuplicateScannerModal} ...${props} closeModal=${closeModal} />`;
    default:
      return html`<div>Unknown modal type: ${type}</div>`;
  }
}

function EditLinkModal({ title, url, onConfirm, closeModal }) {
  const [newTitle, setNewTitle] = useState(title || '');
  const [newUrl, setNewUrl] = useState(url || '');

  const handleConfirm = () => {
    onConfirm({ title: newTitle.trim(), url: newUrl.trim() });
    closeModal();
  };

  return html`
    <header class="modal-header">
      <h2>Edit Link</h2>
      <button class="icon-btn" onClick=${closeModal}><i class="ph ph-x"></i></button>
    </header>
    <div class="modal-body">
      <div class="form-group">
        <label>Title (optional)</label>
        <input 
          type="text" 
          value=${newTitle} 
          onInput=${e => setNewTitle(e.target.value)}
        />
      </div>
      <div class="form-group">
        <label>URL</label>
        <input 
          type="text" 
          value=${newUrl} 
          onInput=${e => setNewUrl(e.target.value)}
          onKeyDown=${e => e.key === 'Enter' && handleConfirm()}
        />
      </div>
    </div>
    <footer class="modal-footer">
      <button class="btn secondary" onClick=${closeModal}>Cancel</button>
      <button class="btn primary" onClick=${handleConfirm}>Save</button>
    </footer>
  `;
}

// --- Specific Modals ---

function PromptModal({ title, label, defaultValue = '', onConfirm, closeModal }) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, []);

  const handleConfirm = () => {
    onConfirm(value);
    closeModal();
  };

  return html`
    <header class="modal-header">
      <h2>${title}</h2>
      <button class="icon-btn" onClick=${closeModal}><i class="ph ph-x"></i></button>
    </header>
    <div class="modal-body">
      <div class="form-group">
        <label>${label}</label>
        <input 
          ref=${inputRef}
          type="text" 
          value=${value} 
          onInput=${e => setValue(e.target.value)}
          onKeyDown=${e => e.key === 'Enter' && handleConfirm()}
        />
      </div>
    </div>
    <footer class="modal-footer">
      <button class="btn secondary" onClick=${closeModal}>Cancel</button>
      <button class="btn primary" onClick=${handleConfirm}>Confirm</button>
    </footer>
  `;
}

function ConfirmModal({ title, message, onConfirm, closeModal }) {
  const handleConfirm = () => {
    onConfirm();
    closeModal();
  };

  return html`
    <header class="modal-header">
      <h2>${title}</h2>
      <button class="icon-btn" onClick=${closeModal}><i class="ph ph-x"></i></button>
    </header>
    <div class="modal-body">
      <p>${message}</p>
    </div>
    <footer class="modal-footer">
      <button class="btn secondary" onClick=${closeModal}>Cancel</button>
      <button class="btn danger" onClick=${handleConfirm}>Confirm</button>
    </footer>
  `;
}

function SettingsModal({ closeModal }) {
  const { state, save } = useAppState();
  const { theme, setTheme } = useTheme();
  const [templates, setTemplates] = useState([...(state.settings?.searchTemplates || [])]);
  const [showCategorySeparators, setShowCategorySeparators] = useState(
    Boolean(state.settings?.showCategorySeparators)
  );

  const handleSave = () => {
    const newState = {
      ...state,
      settings: {
        ...(state.settings || {}),
        searchTemplates: templates.filter(t => t.name.trim() && t.url.trim()),
        showCategorySeparators
      }
    };
    save(newState);
    closeModal();
  };

  const addTemplate = () => {
    setTemplates([...templates, { name: '', url: '' }]);
  };

  const updateTemplate = (index, field, value) => {
    const newTemplates = [...templates];
    newTemplates[index][field] = value;
    setTemplates(newTemplates);
  };

  const removeTemplate = (index) => {
    const newTemplates = [...templates];
    newTemplates.splice(index, 1);
    setTemplates(newTemplates);
  };

  const exportData = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "data_export.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const importData = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedState = JSON.parse(event.target.result);
        if (confirm("This will overwrite your current data. Are you sure?")) {
          save(importedState);
          setTimeout(() => window.location.reload(), 1000);
        }
      } catch (err) {
        alert("Invalid JSON file");
      }
    };
    reader.readAsText(file);
  };

  return html`
    <header class="modal-header">
      <h2>Settings</h2>
      <button class="icon-btn" onClick=${closeModal}><i class="ph ph-x"></i></button>
    </header>
    <div class="modal-body">
      
      <div class="settings-section">
        <h3>Display</h3>
        <div class="form-group">
          <label>Theme</label>
          <div class="theme-selector">
             <button class="btn ${theme === 'light' ? 'primary' : 'secondary'}" onClick=${() => setTheme('light')}><i class="ph ph-sun"></i> Light</button>
             <button class="btn ${theme === 'dark' ? 'primary' : 'secondary'}" onClick=${() => setTheme('dark')}><i class="ph ph-moon"></i> Dark</button>
             <button class="btn ${theme === 'system' ? 'primary' : 'secondary'}" onClick=${() => setTheme('system')}><i class="ph ph-monitor"></i> System</button>
          </div>
        </div>
        <label class="checkbox-label separator-option">
          <input
            type="checkbox"
            checked=${showCategorySeparators}
            onChange=${e => setShowCategorySeparators(e.target.checked)}
          />
          <span>
            <strong>Category separation lines</strong>
            <small>Add a subtle divider between sidebar categories.</small>
          </span>
        </label>
      </div>

      <div class="settings-section">
        <h3>Search Templates</h3>
        <p class="muted-text">Use {name} as a placeholder for the model's active name.</p>
        <div class="template-list">
          ${templates.map((t, idx) => html`
            <div class="template-item">
              <input 
                type="text" 
                placeholder="Name" 
                value=${t.name} 
                onInput=${e => updateTemplate(idx, 'name', e.target.value)} 
              />
              <input 
                type="text" 
                placeholder="URL with {name}" 
                value=${t.url} 
                onInput=${e => updateTemplate(idx, 'url', e.target.value)} 
              />
              <button class="icon-btn danger" onClick=${() => removeTemplate(idx)}>
                <i class="ph ph-trash"></i>
              </button>
            </div>
          `)}
        </div>
        <button class="btn small" onClick=${addTemplate}>Add Template</button>
      </div>

      <div class="settings-section">
        <h3>Data Management</h3>
        <div class="data-actions">
          <button class="btn" onClick=${exportData}>Export Data</button>
          <label class="btn secondary file-upload-btn">
            Import Data
            <input type="file" accept=".json" onChange=${importData} style=${{display: 'none'}} />
          </label>
        </div>
      </div>

    </div>
    <footer class="modal-footer">
      <button class="btn secondary" onClick=${closeModal}>Cancel</button>
      <button class="btn primary" onClick=${handleSave}>Save Settings</button>
    </footer>
  `;
}

function IconLibraryModal({ closeModal }) {
  const { state, save } = useAppState();
  const [icons, setIcons] = useState([...(state.settings?.iconLibrary || [])]);
  const [newIconUrl, setNewIconUrl] = useState('');
  const [newIconTemplate, setNewIconTemplate] = useState('');

  const handleSave = () => {
    const newState = {
      ...state,
      settings: {
        ...(state.settings || {}),
        iconLibrary: icons
      }
    };
    save(newState);
    closeModal();
  };

  const addIcon = () => {
    if (!newIconUrl.trim()) return;
    setIcons([...icons, { 
      id: 'ic_' + Date.now(), 
      url: newIconUrl.trim(),
      urlTemplate: newIconTemplate.trim() || ''
    }]);
    setNewIconUrl('');
    setNewIconTemplate('');
  };

  const removeIcon = (idx) => {
    const newIcons = [...icons];
    newIcons.splice(idx, 1);
    setIcons(newIcons);
  };

  const updateIcon = (idx, field, value) => {
    const newIcons = [...icons];
    newIcons[idx] = { ...newIcons[idx], [field]: value };
    setIcons(newIcons);
  };

  return html`
    <header class="modal-header">
      <h2>Icon Library</h2>
      <button class="icon-btn" onClick=${closeModal}><i class="ph ph-x"></i></button>
    </header>
    <div class="modal-body">
      <p class="muted-text">Manage icons and their URL templates. Use <code>{name}</code> in the URL template as a placeholder for the model name.</p>
      
      <div class="icon-library-list">
        ${icons.map((ic, idx) => html`
          <div class="icon-library-item">
            <img class="model-icon" src=${ic.url} alt="icon" style=${{ width: '36px', height: '36px', objectFit: 'contain', borderRadius: '6px', border: '1px solid var(--border)' }} />
            <div class="icon-library-fields">
              <input 
                type="text" 
                placeholder="Icon image URL" 
                value=${ic.url} 
                onInput=${e => updateIcon(idx, 'url', e.target.value)} 
              />
              <input 
                type="text" 
                placeholder="URL template with {name}" 
                value=${ic.urlTemplate || ''} 
                onInput=${e => updateIcon(idx, 'urlTemplate', e.target.value)} 
              />
            </div>
            <button class="icon-btn danger" onClick=${() => removeIcon(idx)}>
              <i class="ph ph-trash"></i>
            </button>
          </div>
        `)}
      </div>

      <div class="icon-library-add">
        <input type="text" placeholder="Icon image URL" value=${newIconUrl} onInput=${e => setNewIconUrl(e.target.value)} />
        <input type="text" placeholder="URL template (optional)" value=${newIconTemplate} onInput=${e => setNewIconTemplate(e.target.value)} />
        <button class="btn" onClick=${addIcon}>Add Icon</button>
      </div>
    </div>
    <footer class="modal-footer">
      <button class="btn secondary" onClick=${closeModal}>Cancel</button>
      <button class="btn primary" onClick=${handleSave}>Save</button>
    </footer>
  `;
}

function DuplicateScannerModal({ closeModal }) {
  const { state, save } = useAppState();
  const groups = findDuplicates(state);

  const handleMerge = (keepBoxId, removeBoxId) => {
    if (!confirm('Merge these models? Data from the removed model will be added to the kept model.')) return;
    const newState = mergeBoxes(state, keepBoxId, removeBoxId);
    save(newState);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Unknown';
    try {
      return new Date(dateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return 'Unknown';
    }
  };

  return html`
    <header class="modal-header">
      <h2>Duplicate Scanner</h2>
      <button class="icon-btn" onClick=${closeModal}><i class="ph ph-x"></i></button>
    </header>
    <div class="modal-body">
      ${groups.length === 0 ? html`
        <div class="empty-state" style=${{ textAlign: 'center', padding: '30px 0' }}>
          <i class="ph ph-check-circle" style=${{ fontSize: '48px', color: 'var(--primary)', display: 'block', marginBottom: '12px' }}></i>
          <p>No duplicates found!</p>
        </div>
      ` : html`
        <p class="muted-text">Found ${groups.length} duplicate group${groups.length > 1 ? 's' : ''}. Select which model to keep — the other's data will be merged into it.</p>
        <div class="duplicate-groups">
          ${groups.map(group => html`
            <div class="duplicate-group">
              <div class="duplicate-group-header">
                <i class="ph ph-warning" style=${{ color: 'var(--warning, #f59e0b)' }}></i>
                <span>Shared name: <strong>"${group.sharedName}"</strong></span>
              </div>
              <div class="duplicate-group-entries">
                ${group.entries.map(entry => html`
                  <div class="duplicate-entry">
                    <div class="duplicate-entry-info">
                      <img 
                        src=${entry.box.image || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="%23333"/></svg>'} 
                        alt="" 
                        class="duplicate-entry-thumb" 
                      />
                      <div>
                        <div class="duplicate-entry-name">${getActiveName(entry.box)}</div>
                        <div class="muted-text" style=${{ fontSize: '11px' }}>in ${entry.category.name} · Created: ${formatDate(entry.box.dateCreated)}</div>
                        <div class="muted-text" style=${{ fontSize: '11px' }}>${(entry.box.nameHistory || []).length} names · ${(entry.box.tags || []).length} tags · ${(entry.box.links || []).length} links</div>
                      </div>
                    </div>
                    <div class="duplicate-entry-actions">
                      ${group.entries.filter(other => other.box.id !== entry.box.id).map(other => html`
                        <button 
                          class="btn small" 
                          onClick=${() => handleMerge(entry.box.id, other.box.id)}
                          title=${`Keep this model and merge data from "${getActiveName(other.box)}"`}
                        >
                          Keep this
                        </button>
                      `)}
                    </div>
                  </div>
                `)}
              </div>
            </div>
          `)}
        </div>
      `}
    </div>
    <footer class="modal-footer">
      <button class="btn primary" onClick=${closeModal}>Done</button>
    </footer>
  `;
}

function TagManagerModal({ closeModal }) {
  const { state, save } = useAppState();
  const tags = state.tags || [];
  
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#888888');

  const addTag = () => {
    if (!newTagName.trim()) return;
    const newTag = {
      id: 'tag_' + Date.now().toString() + '_' + Math.random().toString(36).substr(2, 5),
      name: newTagName.trim(),
      color: newTagColor
    };
    save({ ...state, tags: [...tags, newTag] });
    setNewTagName('');
  };

  const updateTag = (id, field, value) => {
    save({
      ...state,
      tags: tags.map(t => t.id === id ? { ...t, [field]: value } : t)
    });
  };

  const deleteTag = (id) => {
    if (!confirm('Are you sure you want to delete this tag? It will be removed from all models.')) return;
    
    const newTags = tags.filter(t => t.id !== id);
    
    const newCategories = state.categories.map(c => ({
      ...c,
      boxes: c.boxes.map(b => ({
        ...b,
        tags: (b.tags || []).filter(tid => tid !== id)
      }))
    }));
    
    save({ ...state, tags: newTags, categories: newCategories });
  };

  const dragItem = useRef(null);
  const dragOverItem = useRef(null);

  const handleSort = () => {
    if (dragItem.current === null || dragOverItem.current === null) return;
    const _tags = [...tags];
    const draggedItemContent = _tags.splice(dragItem.current, 1)[0];
    _tags.splice(dragOverItem.current, 0, draggedItemContent);
    dragItem.current = null;
    dragOverItem.current = null;
    save({ ...state, tags: _tags });
  };

  return html`
    <header class="modal-header">
      <h2>Manage Tags</h2>
      <button class="icon-btn" onClick=${closeModal}><i class="ph ph-x"></i></button>
    </header>
    <div class="modal-body">
      
      <div class="add-tag-row">
        <input 
          type="color" 
          value=${newTagColor} 
          onChange=${e => setNewTagColor(e.target.value)} 
        />
        <input 
          type="text" 
          placeholder="New tag name" 
          value=${newTagName} 
          onInput=${e => setNewTagName(e.target.value)}
          onKeyDown=${e => e.key === 'Enter' && addTag()}
        />
        <button class="btn" onClick=${addTag}>Add</button>
      </div>

      <div class="tags-list-manager">
        ${tags.map((t, idx) => html`
          <div 
            class="tag-manager-item"
            draggable="true"
            onDragStart=${() => dragItem.current = idx}
            onDragEnter=${() => dragOverItem.current = idx}
            onDragEnd=${handleSort}
            onDragOver=${e => e.preventDefault()}
          >
            <i class="ph ph-dots-six-vertical drag-handle"></i>
            <input 
              type="color" 
              value=${t.color} 
              onChange=${e => updateTag(t.id, 'color', e.target.value)} 
            />
            <input 
              type="text" 
              value=${t.name} 
              onInput=${e => updateTag(t.id, 'name', e.target.value)} 
            />
            <button class="icon-btn danger" onClick=${() => deleteTag(t.id)}>
              <i class="ph ph-trash"></i>
            </button>
          </div>
        `)}
      </div>

    </div>
    <footer class="modal-footer">
      <button class="btn primary" onClick=${closeModal}>Done</button>
    </footer>
  `;
}

function BulkAddModelsModal({ closeModal }) {
  const { state, save, activeId } = useAppState();
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  const handleConfirm = async () => {
    if (!activeId) {
      alert("Please select a category first.");
      return;
    }

    setLoading(true);
    const newBoxes = [];
    const skipped = [];

    for (const rawName of lines) {
      const name = rawName.trim();
      if (!name) continue;
      
      const existing = nameExistsGlobally(state, name);
      if (existing) {
        skipped.push(`${name} (exists in "${existing.category.name}")`);
        continue;
      }

      let image = '';
      try {
        const res = await fetch(`https://api.camgirlfinder.net/models/search?model=${encodeURIComponent(name)}`);
        const data = await res.json();
        if (data && data[0] && data[0].persons && data[0].persons[0] && data[0].persons[0].urls) {
          image = data[0].persons[0].urls.faceImage || '';
        }
      } catch (e) {
        console.error("Failed to fetch image for", name, e);
      }

      newBoxes.push({
        id: 'box_' + Date.now().toString() + '_' + Math.random().toString(36).substr(2, 5),
        name,
        activeName: name,
        image,
        tags: [],
        links: [],
        nameHistory: [],
        dateCreated: new Date().toISOString()
      });
    }

    if (newBoxes.length > 0) {
      const newState = {
        ...state,
        categories: state.categories.map(c => 
          c.id === activeId ? { ...c, boxes: [...(c.boxes || []), ...newBoxes] } : c
        )
      };
      save(newState);
    }

    setLoading(false);
    
    if (skipped.length > 0) {
      alert(`Skipped ${skipped.length} duplicate(s):\n${skipped.join('\n')}`);
    }
    
    closeModal();
  };

  return html`
    <header class="modal-header">
      <h2>Bulk Add Models</h2>
      <button class="icon-btn" onClick=${closeModal}><i class="ph ph-x"></i></button>
    </header>
    <div class="modal-body">
      <p class="muted-text">Enter one model name per line. Images will be fetched automatically.</p>
      <textarea 
        class="bulk-textarea" 
        value=${text} 
        onInput=${e => setText(e.target.value)}
        rows="10"
        placeholder="Name 1\nName 2\nName 3"
      ></textarea>
      <p>Models to add: ${lines.length}</p>
    </div>
    <footer class="modal-footer">
      <button class="btn secondary" onClick=${closeModal} disabled=${loading}>Cancel</button>
      <button class="btn primary" onClick=${handleConfirm} disabled=${loading || lines.length === 0}>
        ${loading ? 'Adding...' : 'Add Models'}
      </button>
    </footer>
  `;
}

function BulkAddLinksModal({ closeModal }) {
  const { state, save, selectedBoxId } = useAppState();
  const [text, setText] = useState('');
  
  if (!selectedBoxId) {
    return html`<div class="modal-body">No model selected.</div>`;
  }

  // To find the actual box from the state
  const findBoxLocal = (s, boxId) => {
    for (const cat of (s.categories || [])) {
      const box = (cat.boxes || []).find(b => b.id === boxId);
      if (box) return { box, category: cat };
    }
    return { box: null, category: null };
  };

  const { box, category } = findBoxLocal(state, selectedBoxId);
  const parsedLinks = parseBulkLines(text);

  const handleConfirm = () => {
    if (!box || !category) return;
    
    const newCategories = state.categories.map(c => {
      if (c.id === category.id) {
        return {
          ...c,
          boxes: c.boxes.map(b => {
            if (b.id === box.id) {
              return {
                ...b,
                links: [...(b.links || []), ...parsedLinks.map(normalizeLink)]
              };
            }
            return b;
          })
        };
      }
      return c;
    });

    save({ ...state, categories: newCategories });
    closeModal();
  };

  return html`
    <header class="modal-header">
      <h2>Bulk Add Links</h2>
      <button class="icon-btn" onClick=${closeModal}><i class="ph ph-x"></i></button>
    </header>
    <div class="modal-body">
      <p class="muted-text">Paste links below. Format: <code>URL</code> or <code>Title URL</code> or <code>[Title](URL)</code> per line.</p>
      <textarea 
        class="bulk-textarea" 
        value=${text} 
        onInput=${e => setText(e.target.value)}
        rows="10"
        placeholder="https://example.com\nMy Site https://mysite.com"
      ></textarea>
      <p>Links found: ${parsedLinks.length}</p>
    </div>
    <footer class="modal-footer">
      <button class="btn secondary" onClick=${closeModal}>Cancel</button>
      <button class="btn primary" onClick=${handleConfirm} disabled=${parsedLinks.length === 0}>Add Links</button>
    </footer>
  `;
}
