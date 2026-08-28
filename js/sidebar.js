import { html, useState, useEffect, useRef } from './lib.js';
import { useAuth, useAppState } from './store.js';

export let dragSource = null;
export function setDragSource(val) {
  dragSource = val;
}

export function Sidebar() {
  const {
    state,
    save,
    viewMode,
    setViewMode,
    activeId,
    setActiveId,
    setSearchText,
    setLinkSearchText,
    setSelectedBoxId,
    openModal
  } = useAppState();
  const { logout } = useAuth();

  const [dragOverId, setDragOverId] = useState(null);

  const [splitRatio, setSplitRatio] = useState(() => {
    const saved = localStorage.getItem('sidebar-split-ratio');
    return saved ? parseFloat(saved) : 0.65;
  });

  useEffect(() => {
    localStorage.setItem('sidebar-split-ratio', splitRatio.toString());
  }, [splitRatio]);

  const handleResizeStart = (e) => {
    e.preventDefault();
    const startY = e.clientY;
    const container = e.target.parentElement;
    const containerRect = container.getBoundingClientRect();
    const startRatio = splitRatio;

    const onMouseMove = (moveE) => {
      const deltaY = moveE.clientY - startY;
      const newRatio = Math.max(0.15, Math.min(0.85, startRatio + deltaY / containerRect.height));
      setSplitRatio(newRatio);
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      localStorage.setItem('sidebar-split-ratio', splitRatio.toString());
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const handleCategoryClick = (id) => {
    setViewMode('category');
    setActiveId(id);
    setSearchText('');
    setLinkSearchText('');
    setSelectedBoxId(null);
  };

  const handleTagClick = (id) => {
    setViewMode('tag');
    setActiveId(id);
    setSearchText('');
    setLinkSearchText('');
    setSelectedBoxId(null);
  };

  const handleAddCategory = () => {
    openModal('prompt', {
      title: 'New Category',
      label: 'Name',
      onConfirm: (name) => {
        if (!name) return;
        const newCategory = { id: 'cat_' + Date.now(), name, boxes: [] };
        save({ ...state, categories: [...state.categories, newCategory] });
      }
    });
  };

  const handleEditCategory = (e, category) => {
    e.stopPropagation();
    openModal('prompt', {
      title: 'Rename Category',
      label: 'Name',
      defaultValue: category.name,
      onConfirm: (name) => {
        if (!name || name === category.name) return;
        const newState = {
          ...state,
          categories: state.categories.map(c => 
            c.id === category.id ? { ...c, name } : c
          )
        };
        save(newState);
      }
    });
  };

  const handleDeleteCategory = (e, category) => {
    e.stopPropagation();
    openModal('confirm', {
      title: 'Delete Category',
      message: `Are you sure you want to delete "${category.name}" and all its boxes?`,
      onConfirm: () => {
        const newState = {
          ...state,
          categories: state.categories.filter(c => c.id !== category.id)
        };
        save(newState);
        if (viewMode === 'category' && activeId === category.id) {
          setActiveId(null);
        }
      }
    });
  };

  // Drag and drop for categories
  const handleDragStart = (e, category, index) => {
    dragSource = { type: 'category', id: category.id, index };
    e.dataTransfer.effectAllowed = 'move';
    // Firefox requires data to be set
    e.dataTransfer.setData('text/plain', category.id);
  };

  const handleDragOver = (e, category) => {
    e.preventDefault();
    if (!dragSource) return;
    
    // Allow dropping boxes onto categories or reordering categories
    if (dragSource.type === 'category' && dragSource.id === category.id) return;
    if (dragSource.type === 'box' && dragSource.fromCatId === category.id) return;
    
    setDragOverId(category.id);
  };

  const handleDragLeave = (e, category) => {
    if (dragOverId === category.id) {
      setDragOverId(null);
    }
  };

  const handleDrop = (e, targetIndex, targetCategory) => {
    e.preventDefault();
    setDragOverId(null);

    if (!dragSource) return;

    if (dragSource.type === 'category') {
      const sourceIndex = dragSource.index;
      if (sourceIndex === targetIndex) return;

      const newCategories = [...state.categories];
      const [moved] = newCategories.splice(sourceIndex, 1);
      newCategories.splice(targetIndex, 0, moved);
      
      save({ ...state, categories: newCategories });
    } else if (dragSource.type === 'box') {
      const sourceCatId = dragSource.fromCatId;
      const targetCatId = targetCategory.id;
      
      if (sourceCatId === targetCatId) return;

      const newCategories = [...state.categories];
      const sourceCatIdx = newCategories.findIndex(c => c.id === sourceCatId);
      const targetCatIdx = newCategories.findIndex(c => c.id === targetCatId);

      if (sourceCatIdx === -1 || targetCatIdx === -1) return;

      const sourceCat = { ...newCategories[sourceCatIdx], boxes: [...newCategories[sourceCatIdx].boxes] };
      const targetCat = { ...newCategories[targetCatIdx], boxes: [...newCategories[targetCatIdx].boxes] };

      const boxIdx = sourceCat.boxes.findIndex(b => b.id === dragSource.id);
      if (boxIdx === -1) return;

      const [movedBox] = sourceCat.boxes.splice(boxIdx, 1);
      targetCat.boxes.push(movedBox);

      newCategories[sourceCatIdx] = sourceCat;
      newCategories[targetCatIdx] = targetCat;

      save({ ...state, categories: newCategories });
    }
    
    setDragSource(null);
  };

  return html`
    <aside class="sidebar">
      <header class="sidebar-header">
        <div class="header-actions">
          <button class="icon-btn" title="Settings" onClick=${() => openModal('settings')}>
            <i class="ph ph-gear"></i>
          </button>
          <button class="icon-btn" title="Manage Tags" onClick=${() => openModal('tagManager')}>
            <i class="ph ph-tag"></i>
          </button>
          <button class="icon-btn" title="Icon Library" onClick=${() => openModal('iconLibrary')}>
            <i class="ph ph-images-square"></i>
          </button>
          <button class="icon-btn" title="Find Duplicates" onClick=${() => openModal('duplicateScanner')}>
            <i class="ph ph-copy-simple"></i>
          </button>
          <button class="icon-btn" title="Add Category" onClick=${handleAddCategory}>
            <i class="ph ph-plus"></i>
          </button>
          <button class="icon-btn" title="Sign Out" onClick=${logout}>
            <i class="ph ph-sign-out"></i>
          </button>
        </div>
      </header>

      <div class="sidebar-sections-container" style=${{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
        <div class="sidebar-section" style=${{ flex: splitRatio, overflow: 'auto', minHeight: '60px' }}>
        <h3 class="section-title">CATEGORIES</h3>
        <ul class="category-list ${state.settings?.showCategorySeparators ? 'show-separators' : ''}">
          ${(state.categories || []).map((category, index) => html`
            <li 
              key=${category.id}
              draggable="true"
              onDragStart=${(e) => handleDragStart(e, category, index)}
              onDragOver=${(e) => handleDragOver(e, category)}
              onDragLeave=${(e) => handleDragLeave(e, category)}
              onDrop=${(e) => handleDrop(e, index, category)}
              onClick=${() => handleCategoryClick(category.id)}
              class="category-item 
                ${viewMode === 'category' && activeId === category.id ? 'active' : ''} 
                ${dragOverId === category.id ? 'drag-over' : ''}"
            >
              <span class="category-name">${category.name}</span>
              <div class="category-actions">
                <button class="icon-btn edit-btn" onClick=${(e) => handleEditCategory(e, category)} title="Edit Category">
                  <i class="ph ph-pencil-simple"></i>
                </button>
                <button class="icon-btn delete-btn" onClick=${(e) => handleDeleteCategory(e, category)} title="Delete Category">
                  <i class="ph ph-trash"></i>
                </button>
              </div>
            </li>
          `)}
        </ul>
        </div>
        <div class="sidebar-resize-handle" onMouseDown=${handleResizeStart}>
          <div class="resize-handle-line"></div>
        </div>
        <div class="sidebar-section" style=${{ flex: 1 - splitRatio, overflow: 'auto', minHeight: '60px' }}>
          <h3 class="section-title">TAGS</h3>
        <ul class="tag-list">
          ${(state.tags || []).map(tag => html`
            <li 
              key=${tag.id}
              onClick=${() => handleTagClick(tag.id)}
              class="tag-item ${viewMode === 'tag' && activeId === tag.id ? 'active' : ''}"
            >
              <span class="tag-dot" style=${{ backgroundColor: tag.color }}></span>
              <span class="tag-name">${tag.name}</span>
            </li>
          `)}
        </ul>
        </div>
      </div>
    </aside>
  `;
}
