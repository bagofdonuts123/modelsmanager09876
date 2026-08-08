import { html, useState, useEffect, useRef, useCallback } from './lib.js';
import { useAppState, findBox, getTagObj, normalizeLink, updateBox, getActiveName, getActiveIcon, getContrastTextColor, nameExistsGlobally } from './store.js';

export function InfoPanel() {
  const { state, save, selectedBoxId, setSelectedBoxId, openModal } = useAppState();
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameEditValue, setNameEditValue] = useState('');
  
  if (!selectedBoxId) {
    return html`
      <div class="info-panel empty-state">
        <i class="ph ph-cursor-click"></i>
        <p>Select a model to view details</p>
      </div>
    `;
  }
  
  const { box, category } = findBox(state, selectedBoxId);
  
  if (!box) {
    return html`
      <div class="info-panel empty-state">
        <i class="ph ph-warning"></i>
        <p>Model not found</p>
      </div>
    `;
  }

  const startEditName = () => {
    setNameEditValue(box.name);
    setIsEditingName(true);
  };
  
  const saveNameEdit = () => {
    if (nameEditValue.trim() && nameEditValue !== box.name) {
      const oldName = box.name;
      const newName = nameEditValue.trim();

      // Block duplicate names within this model's history
      const existsInHistory = (box.nameHistory || []).some(h => h.name.trim().toLowerCase() === newName.toLowerCase());
      if (existsInHistory && newName.toLowerCase() !== oldName.toLowerCase()) {
        alert(`The name "${newName}" already exists in this model's name history.`);
        setIsEditingName(false);
        return;
      }
      // Block if name exists globally in another model
      const globalExists = nameExistsGlobally(state, newName, box.id);
      if (globalExists) {
        alert(`The name "${newName}" already exists in category "${globalExists.category.name}" (model: "${globalExists.box.name}").`);
        setIsEditingName(false);
        return;
      }

      const newHistory = [...(box.nameHistory || [])];
      
      const oldEntryIndex = newHistory.findIndex(h => h.name === oldName);
      const oldWasActive = getActiveName(box) === oldName;

      if (oldEntryIndex === -1) {
        newHistory.push({ name: oldName, state: 'stopped', active: false });
      } else if (newHistory[oldEntryIndex].state === 'active') {
        newHistory[oldEntryIndex] = {
          ...newHistory[oldEntryIndex],
          state: 'running',
          active: false
        };
      }

      if (oldWasActive) {
        for (let index = 0; index < newHistory.length; index += 1) {
          newHistory[index] = { ...newHistory[index], active: false };
        }
        const newEntryIndex = newHistory.findIndex(h => h.name === newName);
        if (newEntryIndex >= 0) {
          newHistory[newEntryIndex] = { ...newHistory[newEntryIndex], active: true };
        } else {
          newHistory.push({ name: newName, state: 'running', active: true });
        }
      }
      
      const newState = updateBox(state, box.id, b => ({
        ...b,
        name: newName,
        activeName: oldWasActive ? newName : (b.activeName || b.name),
        nameHistory: newHistory
      }));
      save(newState);
    }
    setIsEditingName(false);
  };

  const handleEditImage = () => {
    openModal('prompt', {
      title: 'Edit Image URL',
      label: 'Image URL',
      defaultValue: box.image || '',
      onConfirm: (url) => {
        const newState = updateBox(state, box.id, b => ({ ...b, image: url }));
        save(newState);
      }
    });
  };

  const handleDelete = () => {
    openModal('confirm', {
      title: 'Delete Model',
      message: `Are you sure you want to delete "${box.name}"?`,
      onConfirm: () => {
        const newState = {
          ...state,
          categories: state.categories.map(c => 
            c.id === category.id 
              ? { ...c, boxes: c.boxes.filter(b => b.id !== box.id) }
              : c
          )
        };
        save(newState);
        setSelectedBoxId(null);
      }
    });
  };

  return html`
    <div class="info-panel">
      <div class="panel-header">
        <div class="panel-header-top">
          <div class="model-name-container">
            ${isEditingName ? html`
              <input 
                type="text" 
                value=${nameEditValue} 
                onInput=${e => setNameEditValue(e.target.value)}
                onBlur=${saveNameEdit}
                onKeyDown=${e => e.key === 'Enter' && saveNameEdit()}
                autoFocus
              />
            ` : html`
              <h2 style=${{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                ${getActiveIcon(state.settings, box) ? html`<img class="model-icon" src=${getActiveIcon(state.settings, box).url} alt="" style=${{ width: '24px', height: '24px', objectFit: 'contain' }} />` : null}
                ${getActiveName(box)}
              </h2>
              <button class="icon-btn" onClick=${startEditName} title="Edit Name">
                <i class="ph ph-pencil-simple"></i>
              </button>
            `}
          </div>
          <div class="header-actions">
            <button class="icon-btn" onClick=${handleEditImage} title="Edit Image URL">
              <i class="ph ph-image"></i>
            </button>
            <button class="icon-btn danger" onClick=${handleDelete} title="Delete Model">
              <i class="ph ph-trash"></i>
            </button>
          </div>
        </div>
        <div class="parent-category muted-text">In: ${category?.name || 'Unknown Category'}</div>
      </div>
      
      <div class="panel-section">
        <${ModelNameManager} box=${box} state=${state} save=${save} />
      </div>
      
      <div class="panel-section">
        <${TagsManager} box=${box} state=${state} save=${save} openModal=${openModal} />
      </div>
      
      <div class="panel-section">
        <${LinksManager} box=${box} state=${state} save=${save} openModal=${openModal} />
      </div>
      
      <div class="panel-section">
        <${SearchLinks} box=${box} state=${state} />
      </div>
    </div>
  `;
}

function IconPicker({ selectedId, icons, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedIcon = icons.find(i => i.id === selectedId);
  const selectedUrl = selectedIcon ? selectedIcon.url : '';

  return html`
    <div class="icon-picker" style=${{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <button class="icon-btn small" onClick=${() => setIsOpen(!isOpen)} title="Pick Icon" style=${{ padding: '2px' }}>
        ${selectedUrl ? html`<img class="model-icon" src=${selectedUrl} alt="" style=${{ width: '20px', height: '20px', objectFit: 'contain' }} />` : html`<i class="ph ph-image"></i>`}
      </button>
      ${isOpen && html`
        <div class="icon-picker-dropdown" style=${{ 
            position: 'absolute', top: '100%', left: 0, zIndex: 10, background: 'var(--bg-panel)', 
            border: '1px solid var(--border)', borderRadius: '6px', padding: '6px', 
            display: 'flex', gap: '4px', flexWrap: 'wrap', width: '120px', boxShadow: 'var(--shadow)' 
          }}>
          <div onClick=${() => { onChange(''); setIsOpen(false); }} style=${{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '1px dashed var(--border)', borderRadius: '4px' }}>
            <i class="ph ph-prohibit"></i>
          </div>
          ${icons.map(ic => html`
            <img 
              class="model-icon"
              src=${ic.url} 
              alt=""
              onClick=${() => { onChange(ic.id); setIsOpen(false); }}
              style=${{ width: '24px', height: '24px', objectFit: 'contain', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: '4px' }}
            />
          `)}
        </div>
      `}
    </div>
  `;
}

function ModelNameManager({ box, state, save }) {
  const activeName = getActiveName(box);
  const history = box.nameHistory || [];
  const icons = state.settings?.iconLibrary || [];
  const hasExplicitActive = history.some(h => h.active === true || h.state === 'active');

  const getOperationalState = entry => {
    if (entry?.state === 'running' || entry?.state === 'active') return 'running';
    return 'stopped';
  };
  
  const currentHistoryEntry = history.find(h => h.name === box.name);
  const allNames = [{
    name: box.name,
    state: getOperationalState(currentHistoryEntry),
    active: currentHistoryEntry?.active === true || currentHistoryEntry?.state === 'active',
    iconId: currentHistoryEntry?.iconId,
    isCurrent: true
  }];
  history.forEach(h => {
    if (h.name !== box.name) {
      allNames.push({ ...h, state: getOperationalState(h), isCurrent: false });
    }
  });

  const updateHistory = (nameToUpdate, updates) => {
    let newHistory = (box.nameHistory || []).map(h => ({
      ...h,
      state: getOperationalState(h),
      active: h.active === true || h.state === 'active'
    }));
    let existingIdx = newHistory.findIndex(h => h.name === nameToUpdate);

    if (existingIdx >= 0) {
      newHistory[existingIdx] = { ...newHistory[existingIdx], ...updates };
    } else {
      newHistory.push({ name: nameToUpdate, ...updates });
    }
    
    const newState = updateBox(state, box.id, b => ({ ...b, nameHistory: newHistory }));
    save(newState);
  };

  const setActiveNameHandler = (nameToActivate) => {
    let newHistory = (box.nameHistory || []).map(h => ({
      ...h,
      state: getOperationalState(h),
      active: false
    }));
    const existingIdx = newHistory.findIndex(h => h.name === nameToActivate);

    if (existingIdx >= 0) {
      newHistory[existingIdx] = { ...newHistory[existingIdx], active: true };
    } else {
      newHistory.push({ name: nameToActivate, state: 'running', active: true });
    }

    const newState = updateBox(state, box.id, b => ({
      ...b,
      nameHistory: newHistory,
      activeName: nameToActivate
    }));
    save(newState);
  };

  const deleteName = (nameToDelete) => {
    // Cannot delete if it's the primary name and no other names exist
    if (nameToDelete === box.name && allNames.length <= 1) {
      alert('Cannot delete the only name.');
      return;
    }
    
    let newHistory = (box.nameHistory || []).filter(h => h.name !== nameToDelete);
    
    // If deleted entry was active, activate the first remaining or box.name
    const wasActive = allNames.find(e => e.name === nameToDelete);
    if (wasActive && (wasActive.active === true || wasActive.state === 'active' || (!hasExplicitActive && activeName === nameToDelete))) {
      // Find first remaining name to activate
      const firstRemaining = newHistory[0];
      if (firstRemaining) {
        newHistory = newHistory.map((h, i) => ({ ...h, active: i === 0 }));
      }
      // If deleting from history but it's not box.name, just ensure box.name entry is active
      if (nameToDelete !== box.name) {
        const boxNameIdx = newHistory.findIndex(h => h.name === box.name);
        if (boxNameIdx >= 0) {
          newHistory = newHistory.map(h => ({ ...h, active: h.name === box.name }));
        }
      }
    }

    let updates = { nameHistory: newHistory };
    // If we're deleting box.name itself, promote the first history entry to be box.name
    if (nameToDelete === box.name && newHistory.length > 0) {
      const promoted = newHistory[0];
      updates.name = promoted.name;
      updates.activeName = promoted.name;
      newHistory[0] = { ...newHistory[0], active: true };
      updates.nameHistory = newHistory;
    }
    
    const newState = updateBox(state, box.id, b => ({ ...b, ...updates }));
    save(newState);
  };

  const handleSearchWithIcon = (entry) => {
    if (!entry.iconId) return;
    const icon = icons.find(i => i.id === entry.iconId);
    if (!icon || !icon.urlTemplate) return;
    const url = icon.urlTemplate.replace('{name}', encodeURIComponent(entry.name));
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return html`
    <div class="name-manager">
      <h3>Name History</h3>
      <div class="name-list">
        ${allNames.map(entry => {
          const isActuallyActive =
            entry.active === true ||
            entry.state === 'active' ||
            (!hasExplicitActive && activeName === entry.name);
          const operationalState = getOperationalState(entry);
          const entryIcon = entry.iconId ? icons.find(i => i.id === entry.iconId) : null;
          const hasSearchUrl = entryIcon && entryIcon.urlTemplate;
          return html`
            <div class="name-entry ${isActuallyActive ? 'is-active' : ''}">
              <div class="name-entry-icon">
                <${IconPicker} 
                  selectedId=${entry.iconId} 
                  icons=${icons} 
                  onChange=${id => updateHistory(entry.name, { iconId: id })} 
                />
              </div>
              <div class="name-entry-top">
                <span class="name-text">${entry.name}</span>
                <button 
                  class="icon-btn small name-entry-search-btn" 
                  onClick=${() => handleSearchWithIcon(entry)}
                  disabled=${!hasSearchUrl}
                  title=${hasSearchUrl ? 'Search with icon template' : 'No URL template set for this icon'}
                >
                  <i class="ph ph-magnifying-glass"></i>
                </button>
              </div>
              <div class="name-entry-bottom">
                <select 
                  class="name-state-select state-${operationalState}"
                  value=${operationalState}
                  onChange=${e => updateHistory(entry.name, { state: e.target.value })}
                  aria-label=${`State for ${entry.name}`}
                >
                  <option value="running">Running</option>
                  <option value="stopped">Stopped</option>
                </select>
                <button
                  type="button"
                  class="active-toggle ${isActuallyActive ? 'is-on' : ''}"
                  role="switch"
                  aria-checked=${isActuallyActive}
                  title=${isActuallyActive ? 'Currently active' : 'Set as active'}
                  onClick=${() => !isActuallyActive && setActiveNameHandler(entry.name)}
                >
                  <span class="active-toggle-track"><span></span></span>
                  <span>Active</span>
                </button>
                <button 
                  class="icon-btn danger small" 
                  onClick=${() => deleteName(entry.name)}
                  title="Delete this name"
                >
                  <i class="ph ph-trash"></i>
                </button>
              </div>
            </div>
          `;
        })}
      </div>
    </div>
  `;
}

function TagsManager({ box, state, save, openModal }) {
  const boxTags = box.tags || [];
  const allTags = state.tags || [];
  
  const unassignedTags = allTags.filter(t => !boxTags.includes(t.id));

  const removeTag = (tagId) => {
    const newState = updateBox(state, box.id, b => ({
      ...b,
      tags: (b.tags || []).filter(id => id !== tagId)
    }));
    save(newState);
  };

  const addTag = (e) => {
    const tagId = e.target.value;
    if (!tagId) return;
    const newState = updateBox(state, box.id, b => ({
      ...b,
      tags: [...(b.tags || []), tagId]
    }));
    save(newState);
    e.target.value = "";
  };

  return html`
    <div class="tags-manager">
      <div class="section-header">
        <h3>Tags</h3>
        <a href="#" class="link-btn" onClick=${e => { e.preventDefault(); openModal('tagManager'); }}>Manage Global Tags</a>
      </div>
      <div class="tags-list">
        ${boxTags.map(tagId => {
          const tagObj = getTagObj(state, tagId);
          if (!tagObj) return null;
          return html`
            <span
              class="tag-pill"
              style=${{ backgroundColor: tagObj.color, color: getContrastTextColor(tagObj.color) }}
            >
              ${tagObj.name}
              <button class="remove-tag" onClick=${() => removeTag(tagId)}><i class="ph ph-x"></i></button>
            </span>
          `;
        })}
      </div>
      ${unassignedTags.length > 0 && html`
        <select class="tag-select" onChange=${addTag}>
          <option value="">Add tag...</option>
          ${unassignedTags.map(t => html`
            <option value=${t.id}>${t.name}</option>
          `)}
        </select>
      `}
    </div>
  `;
}

function LinksManager({ box, state, save, openModal }) {
  const links = box.links || [];
  const [newTitle, setNewTitle] = useState('');
  const [newUrl, setNewUrl] = useState('');

  const removeLink = (index) => {
    const newState = updateBox(state, box.id, b => {
      const newLinks = [...(b.links || [])];
      newLinks.splice(index, 1);
      return { ...b, links: newLinks };
    });
    save(newState);
  };

  const editLink = (index) => {
    const link = links[index];
    openModal('editLink', {
      title: link.title,
      url: link.url,
      onConfirm: (newLink) => {
        const newState = updateBox(state, box.id, b => {
          const newLinks = [...(b.links || [])];
          newLinks[index] = normalizeLink(newLink);
          return { ...b, links: newLinks };
        });
        save(newState);
      }
    });
  };

  const addLink = () => {
    if (!newUrl.trim()) return;
    const l = normalizeLink({ title: newTitle.trim(), url: newUrl.trim() });
    const newState = updateBox(state, box.id, b => ({
      ...b,
      links: [...(b.links || []), l]
    }));
    save(newState);
    setNewTitle('');
    setNewUrl('');
  };

  return html`
    <div class="links-manager">
      <div class="section-header">
        <h3>Custom Links</h3>
        <button class="btn small" onClick=${() => openModal('bulkAddLinks')}>Bulk Add</button>
      </div>
      
      <div class="links-list">
        ${links.map((link, idx) => html`
          <div class="link-item">
            <button class="icon-btn small" onClick=${() => editLink(idx)} title="Edit Link"><i class="ph ph-pencil-simple"></i></button>
            <a href=${link.url} target="_blank" rel="noopener noreferrer" style=${{ flex: 1, marginLeft: '4px' }}>${link.title || link.url}</a>
            <button class="icon-btn danger small" onClick=${() => removeLink(idx)}><i class="ph ph-x"></i></button>
          </div>
        `)}
      </div>

      <div class="add-link-row">
        <input 
          type="text" 
          placeholder="Label (opt)" 
          value=${newTitle} 
          onInput=${e => setNewTitle(e.target.value)} 
        />
        <input 
          type="text" 
          placeholder="URL" 
          value=${newUrl} 
          onInput=${e => setNewUrl(e.target.value)} 
          onKeyDown=${e => e.key === 'Enter' && addLink()}
        />
        <button class="btn" onClick=${addLink}>Add</button>
      </div>
    </div>
  `;
}

function SearchLinks({ box, state }) {
  const templates = state.settings?.searchTemplates || [];
  const activeName = encodeURIComponent(getActiveName(box));

  if (templates.length === 0) {
    return html`
      <div class="search-links">
        <h3>Search</h3>
        <p class="muted-text">No search templates configured.</p>
      </div>
    `;
  }

  return html`
    <div class="search-links">
      <h3>Search</h3>
      <div class="links-list">
        ${templates.map(t => {
          const url = t.url.replace('{name}', activeName);
          return html`
            <div class="link-item">
              <i class="ph ph-magnifying-glass"></i>
              <a href=${url} target="_blank" rel="noopener noreferrer">${t.name}</a>
            </div>
          `;
        })}
      </div>
    </div>
  `;
}
