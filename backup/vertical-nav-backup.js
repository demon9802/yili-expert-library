/**
 * =============================================================
 * 垂直领域导航备份 (v2.0)
 * 备份时间: 2026-06-17
 * 来源: app.js 行 645-771 + style.css 行 1372-1515
 * 
 * 恢复方法:
 * 1. 将此文件中的 JS 代码合并回 app.js
 * 2. 将此文件中的 CSS 代码合并回 style.css
 * 3. 在 renderFrontend() 中恢复 renderVerticalFieldSelector() 调用
 * =============================================================
 */

// ===== JS 部分: app.js 行 645-771 =====
/*
// ===== Vertical Field Selector (right side) =====
let _verticalFieldScrollHandler = null;

function setupVerticalFieldScroll() {
  if (_verticalFieldScrollHandler) {
    window.removeEventListener('scroll', _verticalFieldScrollHandler);
    _verticalFieldScrollHandler = null;
  }
  
  _verticalFieldScrollHandler = () => {
    const vertSel = document.getElementById('vertical-field-selector');
    const pnav = document.getElementById('page-navigation');
    
    if (appState.mode !== 'frontend') {
      if (vertSel) vertSel.classList.remove('visible');
      if (pnav) pnav.classList.remove('visible');
      return;
    }
    
    const statsBar = document.querySelector('.stats-bar');
    const filterBar = document.querySelector('.filter-bar');
    
    if (!statsBar && !filterBar) {
      if (vertSel) vertSel.classList.add('visible');
      if (pnav) pnav.classList.add('visible');
      return;
    }
    
    let headerBottom = 0;
    if (statsBar) {
      const rect = statsBar.getBoundingClientRect();
      headerBottom = Math.max(headerBottom, rect.bottom);
    }
    if (filterBar) {
      const rect = filterBar.getBoundingClientRect();
      headerBottom = Math.max(headerBottom, rect.bottom);
    }
    
    if (headerBottom < 80) {
      if (vertSel) vertSel.classList.add('visible');
      if (pnav) pnav.classList.add('visible');
    } else {
      if (vertSel) vertSel.classList.remove('visible');
      if (pnav) pnav.classList.remove('visible');
    }
  };
  
  window.addEventListener('scroll', _verticalFieldScrollHandler, { passive: true });
  _verticalFieldScrollHandler();
}

const MASCOT_TIP = '此处为多选，想看单一领域，记得再次点击当前标签、进行清空哦~';

function renderVerticalFieldSelector() {
  const db = appState.db;
  const frontendExperts = db.experts.filter(e => e.status !== 'eliminated' && e.scores.overall >= 7);
  const usedFieldNames = new Set(frontendExperts.flatMap(e => e.fields || []));
  const visibleFields = db.fields.filter(f => {
    if (f.hideWhenEmpty && !usedFieldNames.has(f.name)) return false;
    return true;
  });
  
  let vertSel = document.getElementById('vertical-field-selector');
  if (!vertSel) {
    vertSel = document.createElement('div');
    vertSel.id = 'vertical-field-selector';
    vertSel.className = 'vertical-field-selector';
    document.body.appendChild(vertSel);
  }
  
  vertSel.innerHTML = '';
  
  const tipBubble = h('div', { className: 'vertical-field-tip-bubble' }, MASCOT_TIP);
  vertSel.appendChild(tipBubble);
  
  const headerDiv = h('div', { className: 'vertical-field-header' });
  headerDiv.appendChild(h('div', { className: 'vertical-field-title' }, '适用领域'));
  
  const allBtn = h('div', {
    className: 'vertical-field-item vertical-field-all' + (appState.fieldFilter.size === 0 ? ' active' : ''),
    onclick: () => {
      appState.fieldFilter = new Set();
      appState.currentPage = 1;
      renderFrontend();
    }
  }, '全部');
  headerDiv.appendChild(allBtn);
  vertSel.appendChild(headerDiv);
  
  const bodyDiv = h('div', { className: 'vertical-field-body' });
  
  visibleFields.forEach(f => {
    const isActive = appState.fieldFilter.has(f.name);
    const btn = h('div', {
      className: 'vertical-field-item' + (isActive ? ' active' : ''),
      style: isActive ? { background: f.color, color: f.textColor || '#fff' } : { borderLeftColor: f.color },
      onclick: () => {
        const newFilter = new Set(appState.fieldFilter);
        if (newFilter.has(f.name)) {
          newFilter.delete(f.name);
        } else {
          newFilter.add(f.name);
        }
        appState.fieldFilter = newFilter;
        appState.currentPage = 1;
        renderFrontend();
      }
    }, f.name.length > 6 ? f.name.substring(0,5) + '…' : f.name);
    bodyDiv.appendChild(btn);
  });
  vertSel.appendChild(bodyDiv);
}
*/

// ===== CSS 部分: style.css 行 1372-1515 =====
/*
.vertical-field-selector {
  position: fixed;
  left: 8px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 90;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: 0 4px 24px rgba(0,0,0,0.08);
  display: flex;
  flex-direction: column;
  max-height: 80vh;
  overflow: visible;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;
  min-width: 72px;
}
.vertical-field-selector.visible {
  opacity: 1;
  pointer-events: auto;
}
.vertical-field-tip-bubble { ... }
.vertical-field-tip-bubble::after { ... }
.vertical-field-selector:hover .vertical-field-tip-bubble { ... }
.vertical-field-header { ... }
.vertical-field-body { ... }
.vertical-field-item { ... }
.vertical-field-item.active { ... }
.vertical-field-all { ... }
.vertical-field-title { ... }
*/
