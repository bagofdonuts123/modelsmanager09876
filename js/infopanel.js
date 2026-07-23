import { html, useState, useEffect, useRef, useCallback } from './lib.js';
import { useAppState, findBox, getTagObj, normalizeLink, updateBox, getActiveName } from './store.js';

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
      const newHistory = [...(box.nameHistory || [])];
      
      if (!newHistory.find(h => h.name === oldName)) {
        newHistory.push({ name: oldName, tag: '' });
      }
      
      const newState = updateBox(state, box.id, b => ({
        ...b,
        name: newName,
        activeName: newName,
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
              <h2>${box.name}</h2>
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

function ModelNameManager({ box, state, save }) {
  const activeName = getActiveName(box);
  const history = box.nameHistory || [];
  
  const allNames = [{ name: box.name, tag: '', isCurrent: true }];
  history.forEach(h => {
    if (h.name !== box.name) {
      allNames.push({ ...h, isCurrent: false });
    }
  });

  const setAsActive = (nameToSet) => {
    const newState = updateBox(state, box.id, b => ({ ...b, activeName: nameToSet }));
    save(newState);
  };

  const updateHistoryTag = (nameToUpdate, newTag) => {
    const newHistory = [...(box.nameHistory || [])];
    const existingIdx = newHistory.findIndex(h => h.name === nameToUpdate);
    
    if (existingIdx >= 0) {
      newHistory[existingIdx] = { ...newHistory[existingIdx], tag: newTag };
    } else {
      newHistory.push({ name: nameToUpdate, tag: newTag });
    }
    
    const newState = updateBox(state, box.id, b => ({ ...b, nameHistory: newHistory }));
    save(newState);
  };

  return html`
    <div class="name-manager">
      <h3>Name History</h3>
      <div class="name-list">
        ${allNames.map(entry => {
          const isActuallyActive = entry.name === activeName;
          return html`
            <div class="name-entry">
              <span class="name-text">${entry.name}</span>
              <input 
                class="name-tag-input"
                type="text" 
                placeholder="tag (e.g. twitter)" 
                value=${entry.tag || ''}
                onBlur=${e => updateHistoryTag(entry.name, e.target.value)}
              />
              ${isActuallyActive ? html`
                <span class="badge active-badge">ACTIVE</span>
              ` : html`
                <button class="btn small" onClick=${() => setAsActive(entry.name)}>Set Active</button>
              `}
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
            <span class="tag-pill" style=${{ backgroundColor: tagObj.color }}>
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
            <i class="ph ph-link"></i>
            <a href=${link.url} target="_blank" rel="noopener noreferrer">${link.title || link.url}</a>
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
