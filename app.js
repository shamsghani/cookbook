/**
 * Cookbook & Expat Pantry Application
 * High-Yield Recipes & Stepwise Cooking Mode
 */

(function () {
  'use strict';

  // Fallback / Data loader from window.CookbookData or module export
  const Data = window.CookbookData || {};
  const { PANTRY_ITEMS = [], RECIPES = [], ALL_INGREDIENTS = [] } = Data;

  // --------------------------------------------------------------------------
  // Application State
  // --------------------------------------------------------------------------
  const STATE = {
    currentTab: 'recipes',
    recipeFilter: 'all',
    recipeSearch: '',
    pantryFilter: 'all',
    pantrySearch: '',
    
    // Stored in localStorage
    stockedPantry: new Set(loadStorage('cookbook_pantry', [
      'onions', 'cooking_oil', 'basmati_rice', 'mayonnaise', 'cream', 'shredded_cheese'
    ])),
    matcherSelected: new Set(loadStorage('cookbook_matcher', [
      'chicken', 'yogurt', 'onions', 'cooking_oil', 'basmati_rice', 'mayonnaise'
    ])),
    shoppingList: loadStorage('cookbook_shopping', []),
    favorites: new Set(loadStorage('cookbook_favorites', [])),
    theme: loadStorage('cookbook_theme', 'dark'),
    checkedIngredients: new Set(loadStorage('cookbook_checked_ing', [])),

    // Active Recipe Modal State
    activeRecipeId: null,
    activeMode: 'detailed', // 'detailed' | 'stepwise'
    servingsMultiplier: 1,
    stepwiseCurrentStep: 0,
    
    // Timer State
    timerSeconds: 0,
    timerTotal: 0,
    timerInterval: null,
    timerRunning: false
  };

  function loadStorage(key, defaultValue) {
    try {
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : defaultValue;
    } catch (e) {
      console.warn('Storage read error for key:', key, e);
      return defaultValue;
    }
  }

  function saveStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn('Storage write error for key:', key, e);
    }
  }

  // --------------------------------------------------------------------------
  // Web Audio Synthesizer (Chime alert without external audio files)
  // --------------------------------------------------------------------------
  function playTimerChime() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      
      const now = ctx.currentTime;
      // Play high pleasant chime (E5 -> G#5 -> B5)
      const notes = [659.25, 830.61, 987.77];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.15);
        gain.gain.setValueAtTime(0.3, now + idx * 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.15 + 0.6);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.15);
        osc.stop(now + idx * 0.15 + 0.65);
      });
    } catch (err) {
      console.warn('Audio chime unsupported or blocked:', err);
    }
  }

  // --------------------------------------------------------------------------
  // Toast Notifications
  // --------------------------------------------------------------------------
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type === 'success' ? 'success' : ''}`;
    toast.innerHTML = `
      <span>${type === 'success' ? '✅' : 'ℹ️'}</span>
      <span>${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 2800);
  }

  // --------------------------------------------------------------------------
  // Theme Toggle
  // --------------------------------------------------------------------------
  function initTheme() {
    const theme = STATE.theme || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    const icon = document.getElementById('theme-icon');
    if (icon) icon.textContent = theme === 'dark' ? '🌙' : '☀️';

    const btn = document.getElementById('btn-theme-toggle');
    if (btn) {
      btn.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        STATE.theme = next;
        saveStorage('cookbook_theme', next);
        if (icon) icon.textContent = next === 'dark' ? '🌙' : '☀️';
      });
    }
  }

  // --------------------------------------------------------------------------
  // Tab Navigation
  // --------------------------------------------------------------------------
  function switchTab(tabId) {
    if (!['recipes', 'matcher', 'pantry', 'shopping'].includes(tabId)) return;
    STATE.currentTab = tabId;

    // Desktop nav buttons
    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    // Mobile nav buttons
    document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    // Tab view contents
    document.querySelectorAll('.tab-view').forEach(view => {
      view.classList.toggle('active', view.id === `view-${tabId}`);
    });

    // Trigger tab-specific render if needed
    if (tabId === 'matcher') {
      renderMatcher();
    } else if (tabId === 'pantry') {
      renderPantry();
    } else if (tabId === 'shopping') {
      renderShoppingList();
    }

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function initNavigation() {
    document.querySelectorAll('[data-tab]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = el.dataset.tab;
        switchTab(tab);
        window.location.hash = tab;
      });
    });

    // Check hash on load
    const hash = window.location.hash.replace('#', '');
    if (['recipes', 'matcher', 'pantry', 'shopping'].includes(hash)) {
      switchTab(hash);
    }
  }

  // --------------------------------------------------------------------------
  // Section 1: Recipes Grid
  // --------------------------------------------------------------------------
  function renderRecipes() {
    const grid = document.getElementById('recipes-grid');
    if (!grid) return;

    const searchTerm = STATE.recipeSearch.toLowerCase().trim();
    const filter = STATE.recipeFilter;

    const filtered = RECIPES.filter(recipe => {
      // Category / Tag filter
      if (filter !== 'all') {
        const matchesTag = recipe.tags.some(t => t.toLowerCase() === filter.toLowerCase());
        const matchesCategory = recipe.category.toLowerCase().includes(filter.toLowerCase());
        const matchesMethod = recipe.cookingMethod.toLowerCase().includes(filter.toLowerCase());
        if (!matchesTag && !matchesCategory && !matchesMethod) return false;
      }

      // Search filter
      if (searchTerm) {
        const inTitle = recipe.title.toLowerCase().includes(searchTerm);
        const inDesc = recipe.description.toLowerCase().includes(searchTerm);
        const inTag = recipe.tags.some(t => t.toLowerCase().includes(searchTerm));
        const inIng = recipe.ingredients.some(i => i.name.toLowerCase().includes(searchTerm));
        if (!inTitle && !inDesc && !inTag && !inIng) return false;
      }

      return true;
    });

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-state-icon">🍳</div>
          <h3 class="empty-state-title">No matching recipes found</h3>
          <p class="empty-state-desc">Try clearing your search query or selecting "All Recipes" to see all 8 cookbook meals.</p>
          <button class="btn-sm-action accent" id="btn-reset-recipe-filters">Reset Filters</button>
        </div>
      `;
      const resetBtn = document.getElementById('btn-reset-recipe-filters');
      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          STATE.recipeSearch = '';
          STATE.recipeFilter = 'all';
          const input = document.getElementById('recipe-search-input');
          if (input) input.value = '';
          document.querySelectorAll('#recipe-filter-chips .chip-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.filter === 'all');
          });
          renderRecipes();
        });
      }
      return;
    }

    grid.innerHTML = filtered.map(recipe => {
      const isFav = STATE.favorites.has(recipe.id);
      return `
        <div class="recipe-card" data-recipe-id="${recipe.id}">
          <div>
            <div class="recipe-card-header">
              <span class="recipe-card-category">${recipe.category}</span>
              <div class="recipe-card-quick-actions">
                <button class="card-action-btn ${isFav ? 'active' : ''}" data-action="toggle-fav" data-id="${recipe.id}" title="${isFav ? 'Remove from favorites' : 'Add to favorites'}">
                  ${isFav ? '★' : '☆'}
                </button>
                <button class="card-action-btn" data-action="quick-add-cart" data-id="${recipe.id}" title="Add ingredients to shopping list">
                  🛒
                </button>
              </div>
            </div>

            <div class="recipe-card-title-row">
              <span class="recipe-emoji">${recipe.emoji}</span>
              <h3 class="recipe-card-title">${recipe.shortTitle}</h3>
            </div>

            <p class="recipe-card-desc">${recipe.tagline}</p>

            <div class="recipe-meta-row">
              <span class="meta-pill">⏱️ ${recipe.totalTime}</span>
              <span class="meta-pill">🔥 ${recipe.cookingMethod}</span>
              <span class="meta-pill">👥 ${recipe.servings}</span>
              <span class="meta-pill">⚡ ${recipe.difficulty}</span>
            </div>
          </div>

          <div class="recipe-card-footer">
            <button class="btn-card-secondary" data-action="open-detail" data-id="${recipe.id}">
              📖 Full Recipe
            </button>
            <button class="btn-card-primary" data-action="open-stepwise" data-id="${recipe.id}">
              👨‍🍳 Cook Stepwise
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Attach click events on recipe cards
    grid.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        const id = btn.dataset.id;

        if (action === 'open-detail') {
          openRecipeModal(id, 'detailed');
        } else if (action === 'open-stepwise') {
          openRecipeModal(id, 'stepwise');
        } else if (action === 'toggle-fav') {
          toggleFavorite(id);
        } else if (action === 'quick-add-cart') {
          addRecipeToShoppingList(id);
        }
      });
    });

    // Clicking anywhere on card opens detailed view
    grid.querySelectorAll('.recipe-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.recipeId;
        openRecipeModal(id, 'detailed');
      });
    });
  }

  function initRecipeControls() {
    const searchInput = document.getElementById('recipe-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        STATE.recipeSearch = e.target.value;
        renderRecipes();
      });
    }

    const filterChips = document.getElementById('recipe-filter-chips');
    if (filterChips) {
      filterChips.querySelectorAll('.chip-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          filterChips.querySelectorAll('.chip-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          STATE.recipeFilter = btn.dataset.filter;
          renderRecipes();
        });
      });
    }
  }

  function toggleFavorite(recipeId) {
    if (STATE.favorites.has(recipeId)) {
      STATE.favorites.delete(recipeId);
      showToast('Removed from favorites');
    } else {
      STATE.favorites.add(recipeId);
      showToast('Added to favorites! ⭐', 'success');
    }
    saveStorage('cookbook_favorites', Array.from(STATE.favorites));
    renderRecipes();
    updateModalFavButton();
  }

  // --------------------------------------------------------------------------
  // Section 2: Ingredient Matcher ("What Can I Make?")
  // --------------------------------------------------------------------------
  function renderMatcher() {
    const tagsContainer = document.getElementById('matcher-tags-container');
    const resultsGrid = document.getElementById('matcher-results-grid');
    const countBadge = document.getElementById('matcher-count-badge');
    if (!tagsContainer || !resultsGrid) return;

    // Render tags
    tagsContainer.innerHTML = ALL_INGREDIENTS.map(item => {
      const selected = STATE.matcherSelected.has(item.id);
      return `
        <label class="tag-checkbox-label ${selected ? 'selected' : ''}">
          <input type="checkbox" value="${item.id}" ${selected ? 'checked' : ''}>
          <span>${item.emoji}</span>
          <span>${item.name}</span>
        </label>
      `;
    }).join('');

    // Attach tag toggle events
    tagsContainer.querySelectorAll('label').forEach(label => {
      label.addEventListener('click', (e) => {
        e.preventDefault();
        const input = label.querySelector('input');
        const key = input.value;
        if (STATE.matcherSelected.has(key)) {
          STATE.matcherSelected.delete(key);
        } else {
          STATE.matcherSelected.add(key);
        }
        saveStorage('cookbook_matcher', Array.from(STATE.matcherSelected));
        renderMatcher();
      });
    });

    // Calculate recipe match scores
    const scoredRecipes = RECIPES.map(recipe => {
      const totalKeys = recipe.matcherKeys.length;
      const matched = recipe.matcherKeys.filter(k => STATE.matcherSelected.has(k));
      const missing = recipe.matcherKeys.filter(k => !STATE.matcherSelected.has(k));
      const matchPct = totalKeys > 0 ? Math.round((matched.length / totalKeys) * 100) : 0;

      return {
        recipe,
        matched,
        missing,
        matchPct,
        isPerfect: missing.length === 0,
        isMissingOne: missing.length === 1
      };
    });

    // Sort: highest match first
    scoredRecipes.sort((a, b) => b.matchPct - a.matchPct);

    if (countBadge) {
      const perfectCount = scoredRecipes.filter(r => r.isPerfect).length;
      countBadge.textContent = `${perfectCount} Ready to Cook • ${scoredRecipes.length} Total`;
    }

    resultsGrid.innerHTML = scoredRecipes.map(({ recipe, matched, missing, matchPct, isPerfect, isMissingOne }) => {
      let statusClass = 'missing-more';
      let statusText = `${matchPct}% Match (${missing.length} missing)`;
      if (isPerfect) {
        statusClass = 'perfect';
        statusText = '🌟 100% Ready to Cook!';
      } else if (isMissingOne) {
        statusClass = 'missing-one';
        statusText = `🟡 Missing Only 1 Item!`;
      }

      const getIngName = (key) => {
        const item = ALL_INGREDIENTS.find(i => i.id === key);
        return item ? item.name.split('(')[0].trim() : key.replace(/_/g, ' ');
      };

      return `
        <div class="recipe-card" data-recipe-id="${recipe.id}">
          <div>
            <div class="recipe-card-header">
              <span class="match-status-badge ${statusClass}">${statusText}</span>
              <span class="meta-pill">⏱️ ${recipe.totalTime}</span>
            </div>

            <div class="recipe-card-title-row">
              <span class="recipe-emoji">${recipe.emoji}</span>
              <h3 class="recipe-card-title">${recipe.shortTitle}</h3>
            </div>

            <p class="recipe-card-desc">${recipe.tagline}</p>

            <div class="ingredient-breakdown">
              <div style="font-weight: 600; color: var(--text-secondary); font-size: 0.76rem; text-transform: uppercase;">
                Ingredients in Stock (${matched.length}/${recipe.matcherKeys.length}):
              </div>
              <div class="ing-status-list">
                ${matched.map(k => `<span class="ing-item-badge have">✓ ${getIngName(k)}</span>`).join('')}
              </div>

              ${missing.length > 0 ? `
                <div style="font-weight: 600; color: var(--secondary); font-size: 0.76rem; text-transform: uppercase; margin-top: 0.35rem;">
                  Missing to Buy:
                </div>
                <div class="ing-status-list">
                  ${missing.map(k => `
                    <span class="ing-item-badge missing" title="Click to add to shopping list" data-add-missing="${k}" style="cursor: pointer;">
                      + ${getIngName(k)}
                    </span>
                  `).join('')}
                </div>
              ` : ''}
            </div>
          </div>

          <div class="recipe-card-footer">
            <button class="btn-card-secondary" data-action="open-detail" data-id="${recipe.id}">
              📖 Details
            </button>
            <button class="btn-card-primary" data-action="open-stepwise" data-id="${recipe.id}">
              👨‍🍳 Cook Now
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Attach actions
    resultsGrid.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        const id = btn.dataset.id;
        if (action === 'open-detail') openRecipeModal(id, 'detailed');
        if (action === 'open-stepwise') openRecipeModal(id, 'stepwise');
      });
    });

    resultsGrid.querySelectorAll('[data-add-missing]').forEach(badge => {
      badge.addEventListener('click', (e) => {
        e.stopPropagation();
        const key = badge.dataset.addMissing;
        const ing = ALL_INGREDIENTS.find(i => i.id === key);
        const name = ing ? ing.name : key;
        addItemToShoppingList(name, 'Missing Ingredient');
      });
    });

    resultsGrid.querySelectorAll('.recipe-card').forEach(card => {
      card.addEventListener('click', () => {
        openRecipeModal(card.dataset.recipeId, 'detailed');
      });
    });
  }

  function initMatcherControls() {
    const btnSyncPantry = document.getElementById('btn-sync-pantry-matcher');
    if (btnSyncPantry) {
      btnSyncPantry.addEventListener('click', () => {
        // Sync stocked items from pantry checklist into matcher
        let count = 0;
        STATE.stockedPantry.forEach(pId => {
          if (!STATE.matcherSelected.has(pId)) {
            STATE.matcherSelected.add(pId);
            count++;
          }
        });
        saveStorage('cookbook_matcher', Array.from(STATE.matcherSelected));
        renderMatcher();
        showToast(`Synced ${STATE.stockedPantry.size} stocked pantry items!`, 'success');
      });
    }

    const btnSelectAll = document.getElementById('btn-select-all-matcher');
    if (btnSelectAll) {
      btnSelectAll.addEventListener('click', () => {
        ALL_INGREDIENTS.forEach(i => STATE.matcherSelected.add(i.id));
        saveStorage('cookbook_matcher', Array.from(STATE.matcherSelected));
        renderMatcher();
        showToast('Selected all ingredients');
      });
    }

    const btnClearAll = document.getElementById('btn-clear-all-matcher');
    if (btnClearAll) {
      btnClearAll.addEventListener('click', () => {
        STATE.matcherSelected.clear();
        saveStorage('cookbook_matcher', []);
        renderMatcher();
        showToast('Cleared all ingredient selections');
      });
    }
  }

  // --------------------------------------------------------------------------
  // Section 3: Abroad Living Pantry Checklist (25 Essentials)
  // --------------------------------------------------------------------------
  function renderPantry() {
    const container = document.getElementById('pantry-categories-container');
    const progressText = document.getElementById('pantry-progress-text');
    const progressBar = document.getElementById('pantry-progress-bar');
    const navPantryCount = document.getElementById('nav-pantry-count');
    if (!container) return;

    // Update Progress Stats
    const totalPantry = PANTRY_ITEMS.length;
    const stockedCount = STATE.stockedPantry.size;
    const pct = Math.round((stockedCount / totalPantry) * 100);
    
    if (progressText) {
      progressText.textContent = `${stockedCount} / ${totalPantry} Stocked (${pct}%)`;
    }
    if (progressBar) {
      progressBar.style.width = `${pct}%`;
    }
    if (navPantryCount) {
      navPantryCount.textContent = `${stockedCount}/${totalPantry}`;
    }

    // Filter items
    const searchTerm = STATE.pantrySearch.toLowerCase().trim();
    const filter = STATE.pantryFilter; // 'all' | 'needed' | 'stocked'

    // Group by category
    const categoriesMap = new Map();
    PANTRY_ITEMS.forEach(item => {
      const isStocked = STATE.stockedPantry.has(item.id);

      if (filter === 'needed' && isStocked) return;
      if (filter === 'stocked' && !isStocked) return;

      if (searchTerm) {
        const inName = item.name.toLowerCase().includes(searchTerm);
        const inDesc = item.description.toLowerCase().includes(searchTerm);
        const inCat = item.category.toLowerCase().includes(searchTerm);
        if (!inName && !inDesc && !inCat) return;
      }

      if (!categoriesMap.has(item.category)) {
        categoriesMap.set(item.category, []);
      }
      categoriesMap.get(item.category).push(item);
    });

    if (categoriesMap.size === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🧺</div>
          <h3 class="empty-state-title">No pantry items match the filter</h3>
          <p class="empty-state-desc">Try clearing your search query or switching to "All Items".</p>
        </div>
      `;
      return;
    }

    container.innerHTML = Array.from(categoriesMap.entries()).map(([category, items]) => {
      const catEmoji = items[0] ? items[0].categoryEmoji : '📦';
      return `
        <div class="pantry-category-group">
          <div class="category-group-header">
            <h3 class="category-group-title">
              <span>${catEmoji}</span>
              <span>${category}</span>
            </h3>
            <span class="category-group-count">${items.length} items</span>
          </div>

          <div class="pantry-items-grid">
            ${items.map(item => {
              const stocked = STATE.stockedPantry.has(item.id);
              const relatedRecipes = item.usedIn.map(rid => {
                const r = RECIPES.find(rec => rec.id === rid);
                return r ? r.shortTitle : rid;
              });

              return `
                <div class="pantry-item-card ${stocked ? 'stocked' : ''}" data-pantry-id="${item.id}">
                  <div class="pantry-checkbox">✓</div>
                  <div class="pantry-item-body">
                    <div class="pantry-item-title-row">
                      <h4 class="pantry-item-title">${item.emoji} ${item.shortName}</h4>
                      <button class="btn-add-pantry-to-cart" data-cart-item="${item.shortName}" title="Add item to shopping list">
                        + Cart
                      </button>
                    </div>
                    <p class="pantry-item-desc">${item.description}</p>
                    ${relatedRecipes.length > 0 ? `
                      <div class="pantry-item-tags">
                        ${relatedRecipes.map(r => `<span class="pantry-recipe-tag">Used in: ${r}</span>`).join('')}
                      </div>
                    ` : ''}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }).join('');

    // Toggle stock status when clicking card
    container.querySelectorAll('.pantry-item-card').forEach(card => {
      card.addEventListener('click', (e) => {
        // Prevent toggle if clicking "+ Cart" button
        if (e.target.closest('.btn-add-pantry-to-cart')) return;
        
        const id = card.dataset.pantryId;
        if (STATE.stockedPantry.has(id)) {
          STATE.stockedPantry.delete(id);
        } else {
          STATE.stockedPantry.add(id);
        }
        saveStorage('cookbook_pantry', Array.from(STATE.stockedPantry));
        renderPantry();
      });
    });

    // Add individual pantry item to shopping list
    container.querySelectorAll('.btn-add-pantry-to-cart').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const itemName = btn.dataset.cartItem;
        addItemToShoppingList(itemName, 'Pantry Restock');
      });
    });
  }

  function initPantryControls() {
    const searchInput = document.getElementById('pantry-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        STATE.pantrySearch = e.target.value;
        renderPantry();
      });
    }

    const filterChips = document.getElementById('pantry-filter-chips');
    if (filterChips) {
      filterChips.querySelectorAll('.chip-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          filterChips.querySelectorAll('.chip-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          STATE.pantryFilter = btn.dataset.pfilter;
          renderPantry();
        });
      });
    }

    const btnAddMissing = document.getElementById('btn-add-missing-pantry-to-cart');
    if (btnAddMissing) {
      btnAddMissing.addEventListener('click', () => {
        const missing = PANTRY_ITEMS.filter(item => !STATE.stockedPantry.has(item.id));
        if (missing.length === 0) {
          showToast('All 25 pantry essentials are already stocked in your kitchen! 🎉', 'success');
          return;
        }

        let addedCount = 0;
        missing.forEach(item => {
          const exists = STATE.shoppingList.some(s => s.name.toLowerCase() === item.shortName.toLowerCase());
          if (!exists) {
            STATE.shoppingList.push({
              id: 'shop_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
              name: item.shortName,
              category: item.category,
              checked: false,
              source: 'Pantry Checklist'
            });
            addedCount++;
          }
        });

        saveStorage('cookbook_shopping', STATE.shoppingList);
        updateCartBadge();
        showToast(`Added ${addedCount} missing pantry items to your shopping list! 🛒`, 'success');
      });
    }

    const btnMarkAll = document.getElementById('btn-mark-all-pantry');
    if (btnMarkAll) {
      btnMarkAll.addEventListener('click', () => {
        PANTRY_ITEMS.forEach(i => STATE.stockedPantry.add(i.id));
        saveStorage('cookbook_pantry', Array.from(STATE.stockedPantry));
        renderPantry();
        showToast('Marked all 25 pantry items as stocked!', 'success');
      });
    }

    const btnClearPantry = document.getElementById('btn-clear-pantry');
    if (btnClearPantry) {
      btnClearPantry.addEventListener('click', () => {
        STATE.stockedPantry.clear();
        saveStorage('cookbook_pantry', []);
        renderPantry();
        showToast('Reset pantry stock');
      });
    }
  }

  // --------------------------------------------------------------------------
  // Section 4: Shopping List
  // --------------------------------------------------------------------------
  function updateCartBadge() {
    const total = STATE.shoppingList.length;
    const remaining = STATE.shoppingList.filter(i => !i.checked).length;

    const navCount = document.getElementById('nav-cart-count');
    if (navCount) {
      navCount.textContent = total;
    }

    const mobileBadge = document.getElementById('mobile-cart-count');
    if (mobileBadge) {
      if (remaining > 0) {
        mobileBadge.textContent = remaining;
        mobileBadge.style.display = 'block';
      } else {
        mobileBadge.style.display = 'none';
      }
    }
  }

  function renderShoppingList() {
    const listContainer = document.getElementById('shopping-items-list');
    const totalCountEl = document.getElementById('cart-total-count');
    const checkedCountEl = document.getElementById('cart-checked-count');
    const remainingCountEl = document.getElementById('cart-remaining-count');
    if (!listContainer) return;

    updateCartBadge();

    const total = STATE.shoppingList.length;
    const checkedCount = STATE.shoppingList.filter(i => i.checked).length;
    const remainingCount = total - checkedCount;

    if (totalCountEl) totalCountEl.textContent = total;
    if (checkedCountEl) checkedCountEl.textContent = checkedCount;
    if (remainingCountEl) remainingCountEl.textContent = remainingCount;

    if (total === 0) {
      listContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🛒</div>
          <h3 class="empty-state-title">Your shopping list is empty</h3>
          <p class="empty-state-desc">
            Add items manually using the input above, or use the "Add Ingredients" button on any recipe or pantry card.
          </p>
          <button class="btn-sm-action accent" id="btn-empty-add-pantry">
            + Add Missing Pantry Essentials
          </button>
        </div>
      `;
      const btn = document.getElementById('btn-empty-add-pantry');
      if (btn) {
        btn.addEventListener('click', () => {
          document.getElementById('btn-add-missing-pantry-to-cart')?.click();
          renderShoppingList();
        });
      }
      return;
    }

    listContainer.innerHTML = STATE.shoppingList.map(item => `
      <div class="shopping-item-row ${item.checked ? 'checked' : ''}" data-item-id="${item.id}">
        <div class="shopping-item-left" data-action="toggle-check">
          <div class="shopping-checkbox">✓</div>
          <div>
            <span class="shopping-item-name">${item.name}</span>
            <span class="shopping-item-source">(${item.source || 'General'})</span>
          </div>
        </div>
        <button class="btn-remove-item" data-action="delete" title="Remove item">✕</button>
      </div>
    `).join('');

    // Toggle checked
    listContainer.querySelectorAll('[data-action="toggle-check"]').forEach(el => {
      el.addEventListener('click', () => {
        const row = el.closest('.shopping-item-row');
        const id = row.dataset.itemId;
        const item = STATE.shoppingList.find(i => i.id === id);
        if (item) {
          item.checked = !item.checked;
          saveStorage('cookbook_shopping', STATE.shoppingList);
          renderShoppingList();
        }
      });
    });

    // Delete item
    listContainer.querySelectorAll('[data-action="delete"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const row = btn.closest('.shopping-item-row');
        const id = row.dataset.itemId;
        STATE.shoppingList = STATE.shoppingList.filter(i => i.id !== id);
        saveStorage('cookbook_shopping', STATE.shoppingList);
        renderShoppingList();
      });
    });
  }

  function addItemToShoppingList(name, source = 'Manual Entry') {
    if (!name || !name.trim()) return;
    const cleanName = name.trim();

    // Check duplicate
    const exists = STATE.shoppingList.some(i => i.name.toLowerCase() === cleanName.toLowerCase());
    if (exists) {
      showToast(`"${cleanName}" is already on your shopping list!`);
      return;
    }

    STATE.shoppingList.unshift({
      id: 'shop_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      name: cleanName,
      category: 'General',
      checked: false,
      source: source
    });

    saveStorage('cookbook_shopping', STATE.shoppingList);
    updateCartBadge();
    showToast(`Added "${cleanName}" to shopping list! 🛒`, 'success');
    if (STATE.currentTab === 'shopping') {
      renderShoppingList();
    }
  }

  function addRecipeToShoppingList(recipeId) {
    const recipe = RECIPES.find(r => r.id === recipeId);
    if (!recipe) return;

    let addedCount = 0;
    recipe.ingredients.forEach(ing => {
      const exists = STATE.shoppingList.some(i => i.name.toLowerCase().includes(ing.name.toLowerCase()));
      if (!exists) {
        STATE.shoppingList.push({
          id: 'shop_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
          name: `${ing.amount ? ing.amount + ' ' + (ing.unit || '') + ' ' : ''}${ing.name}`.trim(),
          category: ing.category,
          checked: false,
          source: recipe.shortTitle
        });
        addedCount++;
      }
    });

    saveStorage('cookbook_shopping', STATE.shoppingList);
    updateCartBadge();
    showToast(`Added ${addedCount} ingredients from "${recipe.shortTitle}"! 🛒`, 'success');
  }

  function initShoppingControls() {
    const form = document.getElementById('shopping-add-form');
    const input = document.getElementById('shopping-item-input');
    if (form && input) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        addItemToShoppingList(input.value, 'Custom Item');
        input.value = '';
      });
    }

    // Copy to clipboard formatted for WhatsApp / Notes
    const btnCopy = document.getElementById('btn-copy-shopping-list');
    if (btnCopy) {
      btnCopy.addEventListener('click', () => {
        if (STATE.shoppingList.length === 0) {
          showToast('Shopping list is empty to copy!');
          return;
        }

        const remaining = STATE.shoppingList.filter(i => !i.checked);
        const checked = STATE.shoppingList.filter(i => i.checked);

        let text = `🛒 GROCERY SHOPPING LIST (${STATE.shoppingList.length} items):\n\n`;
        if (remaining.length > 0) {
          text += `TO BUY:\n` + remaining.map(i => `[ ] ${i.name}`).join('\n') + `\n\n`;
        }
        if (checked.length > 0) {
          text += `BOUGHT:\n` + checked.map(i => `[x] ${i.name}`).join('\n') + `\n`;
        }

        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(() => {
            showToast('Copied shopping list to clipboard! 📋', 'success');
          }).catch(() => {
            promptCopy(text);
          });
        } else {
          promptCopy(text);
        }
      });
    }

    function promptCopy(text) {
      window.prompt('Copy your shopping list:', text);
    }

    // Clear Checked
    const btnClearChecked = document.getElementById('btn-clear-checked-shopping');
    if (btnClearChecked) {
      btnClearChecked.addEventListener('click', () => {
        const initial = STATE.shoppingList.length;
        STATE.shoppingList = STATE.shoppingList.filter(i => !i.checked);
        const removed = initial - STATE.shoppingList.length;
        saveStorage('cookbook_shopping', STATE.shoppingList);
        renderShoppingList();
        showToast(`Cleared ${removed} checked items`);
      });
    }

    // Clear All
    const btnClearAll = document.getElementById('btn-clear-all-shopping');
    if (btnClearAll) {
      btnClearAll.addEventListener('click', () => {
        if (STATE.shoppingList.length === 0) return;
        if (confirm('Clear your entire shopping list?')) {
          STATE.shoppingList = [];
          saveStorage('cookbook_shopping', []);
          renderShoppingList();
          showToast('Cleared shopping list');
        }
      });
    }

    // Print
    const btnPrint = document.getElementById('btn-print-shopping');
    if (btnPrint) {
      btnPrint.addEventListener('click', () => {
        window.print();
      });
    }
  }

  // --------------------------------------------------------------------------
  // Recipe Modal & View Modes (Detailed vs Stepwise)
  // --------------------------------------------------------------------------
  function openRecipeModal(recipeId, mode = 'detailed') {
    const recipe = RECIPES.find(r => r.id === recipeId);
    if (!recipe) return;

    STATE.activeRecipeId = recipeId;
    STATE.activeMode = mode;
    STATE.servingsMultiplier = 1;
    STATE.stepwiseCurrentStep = 0;

    const backdrop = document.getElementById('recipe-modal-backdrop');
    if (backdrop) {
      backdrop.classList.add('open');
      backdrop.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    }

    updateModalFavButton();
    renderModalContent();
  }

  function closeRecipeModal() {
    const backdrop = document.getElementById('recipe-modal-backdrop');
    if (backdrop) {
      backdrop.classList.remove('open');
      backdrop.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }
    STATE.activeRecipeId = null;
    clearCookingTimer();
  }

  function setRecipeMode(mode) {
    STATE.activeMode = mode;
    const btnDetailed = document.getElementById('btn-mode-detailed');
    const btnStepwise = document.getElementById('btn-mode-stepwise');

    if (btnDetailed) btnDetailed.classList.toggle('active', mode === 'detailed');
    if (btnStepwise) btnStepwise.classList.toggle('active', mode === 'stepwise');

    const detailView = document.getElementById('modal-detailed-view');
    const stepwiseView = document.getElementById('modal-stepwise-view');

    if (detailView) detailView.style.display = mode === 'detailed' ? 'flex' : 'none';
    if (stepwiseView) stepwiseView.style.display = mode === 'stepwise' ? 'flex' : 'none';

    renderModalContent();
  }

  function updateModalFavButton() {
    const btnFav = document.getElementById('btn-modal-fav');
    if (!btnFav || !STATE.activeRecipeId) return;
    const isFav = STATE.favorites.has(STATE.activeRecipeId);
    btnFav.textContent = isFav ? '★' : '☆';
    btnFav.style.color = isFav ? 'var(--secondary)' : 'var(--text-secondary)';
  }

  function renderModalContent() {
    const recipe = RECIPES.find(r => r.id === STATE.activeRecipeId);
    if (!recipe) return;

    if (STATE.activeMode === 'detailed') {
      renderDetailedRecipeView(recipe);
    } else {
      renderStepwiseRecipeView(recipe);
    }
  }

  // --------------------------------------------------------------------------
  // Modal: Detailed View (from recipes full.txt)
  // --------------------------------------------------------------------------
  function renderDetailedRecipeView(recipe) {
    const container = document.getElementById('modal-detailed-view');
    if (!container) return;

    const mult = STATE.servingsMultiplier;

    container.innerHTML = `
      <!-- Hero Section -->
      <div class="recipe-hero-section">
        <div class="recipe-hero-badges">
          <span class="recipe-card-category">${recipe.category}</span>
          <span class="meta-pill">Prep: ${recipe.prepTime}</span>
          <span class="meta-pill">Cook: ${recipe.cookTime}</span>
          <span class="meta-pill">Total: ${recipe.totalTime}</span>
          <span class="meta-pill">⚡ ${recipe.difficulty}</span>
        </div>
        <h1 class="recipe-hero-title">${recipe.emoji} ${recipe.title}</h1>
        <p class="recipe-hero-tagline">${recipe.description}</p>
      </div>

      <!-- Quick Action / Start Cooking Bar -->
      <div class="recipe-quick-bar">
        <div class="recipe-info-pills">
          <div class="info-pill">
            <span class="info-pill-label">Servings</span>
            <span class="info-pill-value">${recipe.servings}</span>
          </div>
          <div class="info-pill">
            <span class="info-pill-label">Cooking Method</span>
            <span class="info-pill-value">${recipe.cookingMethod}</span>
          </div>
          <div class="info-pill">
            <span class="info-pill-label">Steps</span>
            <span class="info-pill-value">${recipe.instructionsFull.length} Detailed Phases</span>
          </div>
        </div>

        <button class="btn-start-cooking" id="btn-jump-stepwise">
          <span>👨‍🍳 Start Step-by-Step Cooking</span>
          <span>→</span>
        </button>
      </div>

      <!-- Simultaneous Operations Callout Box -->
      ${recipe.simultaneousOperations ? `
        <div class="simultaneous-callout">
          <span class="simultaneous-icon">⚡</span>
          <div class="simultaneous-content">
            <h4>Simultaneous Operations (Save Cooking Time)</h4>
            <p>${recipe.simultaneousOperations.replace(/\n/g, '<br>')}</p>
          </div>
        </div>
      ` : ''}

      <!-- Ingredients Section with Serving Scaler -->
      <div>
        <div class="recipe-section-title">
          <span>Ingredients Checklist</span>
          <div class="servings-controls">
            <span>Scale portions:</span>
            <button class="servings-btn" id="btn-scale-down">-</button>
            <span class="servings-display">${mult}x</span>
            <button class="servings-btn" id="btn-scale-up">+</button>
          </div>
        </div>

        <div class="ingredients-checklist" id="ingredients-checklist">
          ${recipe.ingredients.map((ing, idx) => {
            const ingKey = `${recipe.id}_ing_${idx}`;
            const isChecked = STATE.checkedIngredients.has(ingKey);
            const scaledAmount = ing.amount ? formatAmount(ing.amount * mult) : '';

            return `
              <div class="ingredient-check-item ${isChecked ? 'done' : ''}" data-ing-key="${ingKey}">
                <div class="ing-left">
                  <div class="ing-custom-checkbox">✓</div>
                  <div class="ing-text">
                    ${scaledAmount ? `<span class="ing-amount-badge">${scaledAmount} ${ing.unit || ''}</span>` : ''}
                    <span class="ing-name-highlight">${ing.name}</span>
                    ${ing.notes ? `<span class="ing-notes">(${ing.notes})</span>` : ''}
                    ${ing.optional ? `<span class="meta-pill" style="font-size:0.7rem; margin-left:0.3rem;">Optional</span>` : ''}
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <button class="btn-sm-action accent" id="btn-modal-add-all-cart" style="padding: 0.6rem 1rem;">
          🛒 Add All Ingredients to Shopping List
        </button>
      </div>

      <!-- Equipment Needed -->
      ${recipe.equipment && recipe.equipment.length > 0 ? `
        <div>
          <h3 class="recipe-section-title" style="font-size: 1.1rem;">Gear &amp; Equipment</h3>
          <div class="equipment-pill-group">
            ${recipe.equipment.map(eq => `<span class="equipment-pill">🍳 ${eq}</span>`).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Full Step-by-Step Instructions Timeline (from recipes full.txt) -->
      <div>
        <h3 class="recipe-section-title">Detailed Step-by-Step Instructions</h3>
        <div class="full-steps-timeline">
          ${recipe.instructionsFull.map(step => `
            <div class="full-step-card">
              <div class="full-step-header">
                <div class="step-number-title">
                  <div class="step-num-circle">${step.step}</div>
                  <h4 class="step-title-text">${step.title}</h4>
                </div>
                ${step.phase ? `<span class="step-phase-badge">${step.phase}</span>` : ''}
              </div>
              <p class="full-step-body">${step.text}</p>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Chef's Notes & Quick Fixes -->
      ${recipe.chefsNotes && recipe.chefsNotes.length > 0 ? `
        <div>
          <h3 class="recipe-section-title">Chef’s Notes &amp; Quick Fix Tips</h3>
          <div class="chefs-notes-section">
            ${recipe.chefsNotes.map(note => `
              <div class="chef-note-card">
                <h5 class="chef-note-title">💡 ${note.title}</h5>
                <p class="chef-note-body">${note.body}</p>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Companion Recipes -->
      ${recipe.combinesWith && recipe.combinesWith.length > 0 ? `
        <div style="border-top: 1px solid var(--border-subtle); padding-top: 1.5rem;">
          <h4 style="font-size: 1rem; font-weight: 700; margin-bottom: 0.75rem;">
            🔄 Meals that use this or combine well:
          </h4>
          <div style="display: flex; flex-wrap: wrap; gap: 0.6rem;">
            ${recipe.combinesWith.map(rid => {
              const r = RECIPES.find(rec => rec.id === rid);
              if (!r) return '';
              return `
                <button class="btn-sm-action" data-open-companion="${r.id}" style="padding: 0.5rem 0.85rem;">
                  <span>${r.emoji}</span>
                  <span>${r.shortTitle}</span>
                </button>
              `;
            }).join('')}
          </div>
        </div>
      ` : ''}
    `;

    // Hook buttons
    document.getElementById('btn-jump-stepwise')?.addEventListener('click', () => {
      setRecipeMode('stepwise');
    });

    document.getElementById('btn-scale-up')?.addEventListener('click', () => {
      STATE.servingsMultiplier = Math.min(4, STATE.servingsMultiplier + 0.5);
      renderDetailedRecipeView(recipe);
    });

    document.getElementById('btn-scale-down')?.addEventListener('click', () => {
      STATE.servingsMultiplier = Math.max(0.5, STATE.servingsMultiplier - 0.5);
      renderDetailedRecipeView(recipe);
    });

    document.getElementById('btn-modal-add-all-cart')?.addEventListener('click', () => {
      addRecipeToShoppingList(recipe.id);
    });

    // Check ingredients
    container.querySelectorAll('.ingredient-check-item').forEach(item => {
      item.addEventListener('click', () => {
        const key = item.dataset.ingKey;
        if (STATE.checkedIngredients.has(key)) {
          STATE.checkedIngredients.delete(key);
        } else {
          STATE.checkedIngredients.add(key);
        }
        saveStorage('cookbook_checked_ing', Array.from(STATE.checkedIngredients));
        item.classList.toggle('done', STATE.checkedIngredients.has(key));
      });
    });

    // Companion recipe buttons
    container.querySelectorAll('[data-open-companion]').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.dataset.openCompanion;
        openRecipeModal(targetId, 'detailed');
      });
    });
  }

  function formatAmount(num) {
    if (!num) return '';
    // Format fractions nicely
    if (Math.abs(num - 0.25) < 0.01) return '¼';
    if (Math.abs(num - 0.33) < 0.02) return '⅓';
    if (Math.abs(num - 0.5) < 0.01) return '½';
    if (Math.abs(num - 0.75) < 0.01) return '¾';
    if (Math.abs(num - 1.5) < 0.01) return '1 ½';
    if (Math.abs(num - 2.25) < 0.01) return '2 ¼';
    if (Math.abs(num - 2.5) < 0.01) return '2 ½';
    if (Math.abs(num - 3.5) < 0.01) return '3 ½';
    return Number.isInteger(num) ? num.toString() : num.toFixed(1);
  }

  // --------------------------------------------------------------------------
  // Modal: Stepwise View (from cookbook recipes.txt)
  // --------------------------------------------------------------------------
  function renderStepwiseRecipeView(recipe) {
    const container = document.getElementById('modal-stepwise-view');
    if (!container) return;

    const steps = recipe.instructionsStepwise;
    const currentIdx = Math.max(0, Math.min(STATE.stepwiseCurrentStep, steps.length - 1));
    const step = steps[currentIdx];
    const totalSteps = steps.length;
    const progressPct = Math.round(((currentIdx + 1) / totalSteps) * 100);

    const isFirst = currentIdx === 0;
    const isLast = currentIdx === totalSteps - 1;

    // Check timer for this step
    const stepTimerMinutes = step.timer;

    container.innerHTML = `
      <!-- Stepwise Top Bar -->
      <div class="stepwise-top-bar">
        <div class="stepwise-progress-header">
          <span>Step ${currentIdx + 1} of ${totalSteps}</span>
          <span style="color: var(--primary);">${progressPct}% Completed</span>
        </div>
        <div class="stepwise-progress-track">
          <div class="stepwise-progress-bar" style="width: ${progressPct}%;"></div>
        </div>
      </div>

      <!-- Main Step Cooking Card -->
      <div class="stepwise-card">
        <div class="stepwise-badge-row">
          <span class="stepwise-step-indicator">Step ${currentIdx + 1}</span>
          <span class="meta-pill" style="font-size: 0.8rem;">${recipe.shortTitle}</span>
        </div>

        <h2 class="stepwise-step-title">${step.title}</h2>
        <p class="stepwise-step-text">${step.text}</p>

        <!-- Simultaneous Operation Banner if available -->
        ${recipe.simultaneousOperations ? `
          <div class="stepwise-simul-box">
            <span class="stepwise-simul-icon">⚡</span>
            <div class="stepwise-simul-text">
              <h5>Simultaneous Operation</h5>
              <p>${recipe.simultaneousOperations.replace(/\n/g, '<br>')}</p>
            </div>
          </div>
        ` : ''}

        <!-- Integrated Step Timer -->
        ${stepTimerMinutes ? `
          <div class="stepwise-timer-widget">
            <div class="timer-display-col">
              <span class="timer-digits" id="timer-display">${formatTimerDigits(STATE.timerSeconds || stepTimerMinutes * 60)}</span>
              <div>
                <span class="timer-status-label" id="timer-status-label">${STATE.timerRunning ? 'Countdown Active' : 'Step Duration'}</span>
                <div style="font-size: 0.85rem; color: var(--text-secondary);">${stepTimerMinutes} Minutes Recommended</div>
              </div>
            </div>

            <div class="timer-controls">
              <button class="btn-timer primary" id="btn-timer-toggle">
                ${STATE.timerRunning ? '⏸ Pause' : '▶ Start Timer'}
              </button>
              <button class="btn-timer" id="btn-timer-reset">↺ Reset</button>
            </div>
          </div>
        ` : ''}
      </div>

      <!-- Bottom Step Navigation Controls -->
      <div class="stepwise-nav-controls">
        <button class="btn-step-nav" id="btn-step-prev" ${isFirst ? 'disabled' : ''}>
          <span>←</span>
          <span>Previous</span>
        </button>

        <!-- Quick Jump Step Selector -->
        <select id="select-jump-step" style="background: var(--bg-surface); border: 1px solid var(--border-subtle); padding: 0.6rem 0.9rem; border-radius: var(--radius-md); font-weight: 600; color: var(--text-main);">
          ${steps.map((s, idx) => `
            <option value="${idx}" ${idx === currentIdx ? 'selected' : ''}>
              Step ${idx + 1}: ${s.title}
            </option>
          `).join('')}
        </select>

        <button class="btn-step-nav next" id="btn-step-next">
          <span>${isLast ? '🎉 Finish Recipe' : 'Next Step'}</span>
          <span>${isLast ? '✓' : '→'}</span>
        </button>
      </div>
    `;

    // Hook timer controls if step has timer
    if (stepTimerMinutes) {
      if (!STATE.timerRunning && STATE.timerSeconds === 0) {
        STATE.timerSeconds = stepTimerMinutes * 60;
        STATE.timerTotal = stepTimerMinutes * 60;
      }
      initStepTimerControls();
    }

    // Step Nav buttons
    document.getElementById('btn-step-prev')?.addEventListener('click', () => {
      if (STATE.stepwiseCurrentStep > 0) {
        clearCookingTimer();
        STATE.stepwiseCurrentStep--;
        renderStepwiseRecipeView(recipe);
      }
    });

    document.getElementById('btn-step-next')?.addEventListener('click', () => {
      if (isLast) {
        showToast('🎉 Recipe Completed! Enjoy your meal!', 'success');
        playTimerChime();
        setRecipeMode('detailed');
      } else {
        clearCookingTimer();
        STATE.stepwiseCurrentStep++;
        renderStepwiseRecipeView(recipe);
      }
    });

    document.getElementById('select-jump-step')?.addEventListener('change', (e) => {
      clearCookingTimer();
      STATE.stepwiseCurrentStep = parseInt(e.target.value, 10);
      renderStepwiseRecipeView(recipe);
    });
  }

  function formatTimerDigits(totalSecs) {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  function initStepTimerControls() {
    const btnToggle = document.getElementById('btn-timer-toggle');
    const btnReset = document.getElementById('btn-timer-reset');
    const display = document.getElementById('timer-display');
    const statusLabel = document.getElementById('timer-status-label');

    btnToggle?.addEventListener('click', () => {
      if (STATE.timerRunning) {
        // Pause
        clearInterval(STATE.timerInterval);
        STATE.timerRunning = false;
        btnToggle.textContent = '▶ Resume';
        if (statusLabel) statusLabel.textContent = 'Paused';
      } else {
        // Start
        STATE.timerRunning = true;
        btnToggle.textContent = '⏸ Pause';
        if (statusLabel) statusLabel.textContent = 'Cooking...';

        STATE.timerInterval = setInterval(() => {
          if (STATE.timerSeconds > 0) {
            STATE.timerSeconds--;
            if (display) display.textContent = formatTimerDigits(STATE.timerSeconds);
          } else {
            // Done
            clearInterval(STATE.timerInterval);
            STATE.timerRunning = false;
            playTimerChime();
            showToast('⏰ Step Timer Completed!', 'success');
            if (statusLabel) statusLabel.textContent = 'Done!';
            if (btnToggle) btnToggle.textContent = '▶ Restart';
          }
        }, 1000);
      }
    });

    btnReset?.addEventListener('click', () => {
      clearCookingTimer();
      const recipe = RECIPES.find(r => r.id === STATE.activeRecipeId);
      if (recipe) {
        const step = recipe.instructionsStepwise[STATE.stepwiseCurrentStep];
        if (step && step.timer) {
          STATE.timerSeconds = step.timer * 60;
          if (display) display.textContent = formatTimerDigits(STATE.timerSeconds);
          if (statusLabel) statusLabel.textContent = 'Step Duration';
          if (btnToggle) btnToggle.textContent = '▶ Start Timer';
        }
      }
    });
  }

  function clearCookingTimer() {
    if (STATE.timerInterval) {
      clearInterval(STATE.timerInterval);
      STATE.timerInterval = null;
    }
    STATE.timerRunning = false;
    STATE.timerSeconds = 0;
  }

  function initModalControls() {
    document.getElementById('btn-modal-close')?.addEventListener('click', closeRecipeModal);

    document.getElementById('recipe-modal-backdrop')?.addEventListener('click', (e) => {
      if (e.target.id === 'recipe-modal-backdrop') {
        closeRecipeModal();
      }
    });

    document.getElementById('btn-mode-detailed')?.addEventListener('click', () => setRecipeMode('detailed'));
    document.getElementById('btn-mode-stepwise')?.addEventListener('click', () => setRecipeMode('stepwise'));

    document.getElementById('btn-modal-fav')?.addEventListener('click', () => {
      if (STATE.activeRecipeId) toggleFavorite(STATE.activeRecipeId);
    });

    document.getElementById('btn-modal-cart')?.addEventListener('click', () => {
      if (STATE.activeRecipeId) addRecipeToShoppingList(STATE.activeRecipeId);
    });

    document.getElementById('btn-modal-print')?.addEventListener('click', () => {
      window.print();
    });

    // Keyboard navigation
    window.addEventListener('keydown', (e) => {
      if (!STATE.activeRecipeId) return;

      if (e.key === 'Escape') {
        closeRecipeModal();
      } else if (STATE.activeMode === 'stepwise') {
        if (e.key === 'ArrowRight' || e.key === ' ') {
          e.preventDefault();
          document.getElementById('btn-step-next')?.click();
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          document.getElementById('btn-step-prev')?.click();
        }
      }
    });
  }

  // --------------------------------------------------------------------------
  // Application Bootstrap
  // --------------------------------------------------------------------------
  function init() {
    initTheme();
    initNavigation();
    initRecipeControls();
    initMatcherControls();
    initPantryControls();
    initShoppingControls();
    initModalControls();

    // Initial renders
    renderRecipes();
    renderMatcher();
    renderPantry();
    renderShoppingList();
    updateCartBadge();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
