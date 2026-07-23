import { html, useState, useEffect, useRef, useCallback, memo } from './lib.js';
import { useAppState, getTagObj, getActiveName } from './store.js';
import { dragSource, setDragSource } from './sidebar.js';

export function TopBar() {
  const { state, viewMode, setViewMode, activeId, setActiveId, searchText, setSearchText, openModal, save, preSearchState, scrollRef } = useAppState();

  let title = 'Main View';
  let count = 0;

  if (viewMode === 'category') {
    const cat = state.categories.find(c => c.id === activeId);
    title = cat ? cat.name : 'Category';
    count = cat ? cat.boxes.length : 0;
  } else if (viewMode === 'tag') {
    const tag = getTagObj(state, activeId);
    title = tag ? `Tag: ${tag.name}` : 'Tag';
    count = state.categories.flatMap(c => c.boxes).filter(b => (b.tags || []).includes(activeId)).length;
  } else if (viewMode === 'search') {
    title = `Search: "${searchText}"`;
    count = state.categories.flatMap(c => c.boxes).filter(b => getActiveName(b).toLowerCase().includes(searchText.toLowerCase())).length;
  }

  const handleSearchChange = (e) => {
    const val = e.target.value;
    if (val) {
      if (!searchText) {
        preSearchState.current = { categoryId: activeId, scrollTop: scrollRef.current?.scrollTop || 0 };
        setViewMode('search');
      }
      setSearchText(val);
    } else {
      setSearchText('');
      if (preSearchState.current) {
        setViewMode('category');
        setActiveId(preSearchState.current.categoryId);
        setTimeout(() => {
          if (scrollRef.current) scrollRef.current.scrollTop = preSearchState.current.scrollTop;
        }, 0);
      } else {
        setViewMode('category');
      }
    }
  };

  async function handleAddBox(name) {
    if (viewMode !== 'category' || !activeId) { alert('Select a category first.'); return; }
    let image = '';
    try {
      const res = await fetch(`https://api.camgirlfinder.net/models/search?model=${encodeURIComponent(name)}`);
      const json = await res.json();
      if (json.length && json[0].persons?.[0]?.urls?.faceImage) {
         image = json[0].persons[0].urls.faceImage;
      }
    } catch(e) { console.error('API Error', e); }
    const cat = state.categories.find(c => c.id === activeId);
    const newState = {
      ...state,
      categories: state.categories.map(c => c.id === activeId
         ? { ...c, boxes: [...c.boxes, { id: crypto.randomUUID(), name, image, tags: [], links: [] }] }
         : c
      )
    };
    save(newState);
  }

  return html`
    <div class="top-bar">
      <div class="top-bar-left">
        <h2>${title} <span class="badge">${count}</span></h2>
      </div>
      <div class="top-bar-right">
        <div class="search-box">
          <i class="ph ph-magnifying-glass"></i>
          <input type="text" placeholder="Search..." value=${searchText} onInput=${handleSearchChange} />
        </div>
        <button class="btn" onClick=${() => openModal('bulkAddModels')}>Bulk Add</button>
        ${viewMode === 'category' ? html`
          <button class="btn btn-primary" onClick=${() => openModal('prompt', { title: 'Add New Model', label: 'Name', onConfirm: handleAddBox })}>Add Model</button>
        ` : null}
      </div>
    </div>
  `;
}

export const BoxCard = memo(function BoxCard({ box, categoryId, isSelected, onSelect }) {
  const { state, save } = useAppState();

  const handleDragStart = (e) => {
    setDragSource({ type: 'box', id: box.id, fromCatId: categoryId });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (dragSource?.type === 'box' && dragSource.fromCatId === categoryId && dragSource.id !== box.id) {
      const cat = state.categories.find(c => c.id === categoryId);
      if (!cat) return;
      const newBoxes = [...cat.boxes];
      const fromIdx = newBoxes.findIndex(b => b.id === dragSource.id);
      const toIdx = newBoxes.findIndex(b => b.id === box.id);
      if (fromIdx >= 0 && toIdx >= 0) {
        const [moved] = newBoxes.splice(fromIdx, 1);
        newBoxes.splice(toIdx, 0, moved);
        const newState = {
          ...state,
          categories: state.categories.map(c => c.id === categoryId ? { ...c, boxes: newBoxes } : c)
        };
        save(newState);
      }
    }
  };

  const placeholderSvg = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><rect width='200' height='200' fill='%23ccc'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='20' fill='%23666'>No Image</text></svg>";

  const activeName = getActiveName(box);

  return html`
    <div 
      class="box ${isSelected ? 'selected' : ''}" 
      onClick=${onSelect}
      draggable="true"
      onDragStart=${handleDragStart}
      onDragOver=${handleDragOver}
      onDrop=${handleDrop}
    >
      <img 
        src=${box.image || placeholderSvg} 
        onError=${(e) => { e.target.src = placeholderSvg; }} 
        alt=${activeName} 
        loading="lazy"
      />
      <div class="box-info">
        <h3>${activeName}</h3>
        <div class="card-tags-text">
          ${(box.tags || []).map(tagId => {
            const tag = getTagObj(state, tagId);
            return tag ? html`<span class="card-tag-label" style=${{ color: tag.color }}>${tag.name}</span> ` : null;
          })}
        </div>
      </div>
    </div>
  `;
});

export function ScrollButtons() {
  const { scrollRef } = useAppState();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleScroll = () => {
      setShow(el.scrollHeight > el.clientHeight + 50);
    };
    el.addEventListener('scroll', handleScroll);
    window.addEventListener('resize', handleScroll);
    handleScroll();
    return () => {
      el.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [scrollRef]);

  if (!show) return null;

  const scrollToTop = () => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  const scrollToBottom = () => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });

  return html`
    <div class="scroll-buttons">
      <button class="scroll-btn" onClick=${scrollToTop} title="Go to Top">
        <i class="ph ph-arrow-up"></i>
      </button>
      <button class="scroll-btn" onClick=${scrollToBottom} title="Go to Bottom">
        <i class="ph ph-arrow-down"></i>
      </button>
    </div>
  `;
}

export function BoxGrid() {
  const { state, viewMode, activeId, searchText, selectedBoxId, setSelectedBoxId, scrollRef } = useAppState();

  useEffect(() => {
    const handleScroll = () => {
      if (viewMode === 'category' && activeId && scrollRef.current) {
        localStorage.setItem('lastScrollTop', scrollRef.current.scrollTop);
        localStorage.setItem('lastCategoryId', activeId);
      }
    };
    
    let timeout;
    const onScroll = () => {
      clearTimeout(timeout);
      timeout = setTimeout(handleScroll, 100);
    };

    const el = scrollRef.current;
    if (el) el.addEventListener('scroll', onScroll);
    return () => { if (el) el.removeEventListener('scroll', onScroll); clearTimeout(timeout); };
  }, [viewMode, activeId, scrollRef]);

  useEffect(() => {
    if (viewMode === 'category' && activeId) {
      const lastCat = localStorage.getItem('lastCategoryId');
      if (lastCat === activeId) {
        const lastScroll = localStorage.getItem('lastScrollTop');
        if (lastScroll && scrollRef.current) {
          scrollRef.current.scrollTop = parseInt(lastScroll, 10);
        }
      }
    }
  }, [viewMode, activeId, scrollRef]);

  let boxesToRender = [];
  if (viewMode === 'category') {
    const cat = state.categories.find(c => c.id === activeId);
    if (cat) boxesToRender = cat.boxes.map(b => ({ box: b, categoryId: cat.id }));
  } else if (viewMode === 'tag') {
    state.categories.forEach(c => {
      c.boxes.forEach(b => {
        if ((b.tags || []).includes(activeId)) boxesToRender.push({ box: b, categoryId: c.id });
      });
    });
  } else if (viewMode === 'search') {
    const term = searchText.toLowerCase();
    state.categories.forEach(c => {
      c.boxes.forEach(b => {
        if (getActiveName(b).toLowerCase().includes(term)) {
          boxesToRender.push({ box: b, categoryId: c.id });
        }
      });
    });
  }

  return html`
    <div class="box-grid" ref=${scrollRef} style=${{ position: 'relative' }}>
      ${boxesToRender.map(({ box, categoryId }) => html`
        <${BoxCard} 
          key=${box.id} 
          box=${box} 
          categoryId=${categoryId}
          isSelected=${selectedBoxId === box.id}
          onSelect=${() => setSelectedBoxId(box.id)}
        />
      `)}
      <${ScrollButtons} />
    </div>
  `;
}
