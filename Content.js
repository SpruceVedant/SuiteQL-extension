if (!window.__suitesenseContentInitialized) {
    window.__suitesenseContentInitialized = true;

    console.log('Suitesense content script is running.');
    const INLINE_ENHANCEMENTS_SETTING_KEY = 'suitesenseInlineEnhancementsEnabled';
    const COMMAND_PALETTE_NEW_TAB_SETTING_KEY = 'suitesenseCommandPaletteOpenInNewTab';

    function openIndexedDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('MyExtensionDB', 1);
            request.onupgradeneeded = function(event) {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' });
                }
            };
            request.onsuccess = function(event) {
                resolve(event.target.result);
            };
            request.onerror = function() {
                reject('Error opening IndexedDB');
            };
        });
    }

    function saveToIndexedDB(key, value) {
        openIndexedDB().then((db) => {
            const transaction = db.transaction('settings', 'readwrite');
            const store = transaction.objectStore('settings');
            store.put({ key, value });
            transaction.oncomplete = () => console.log(`${key} saved to IndexedDB`);
            transaction.onerror = () => console.error(`Error saving ${key} to IndexedDB`);
        });
    }

    function getInlineEnhancementsPreference() {
        return new Promise((resolve) => {
            chrome.storage.local.get({ [INLINE_ENHANCEMENTS_SETTING_KEY]: true }, (items) => {
                if (chrome.runtime.lastError) {
                    resolve(true);
                    return;
                }

                resolve(items[INLINE_ENHANCEMENTS_SETTING_KEY] !== false);
            });
        });
    }

    function getCommandPaletteOpenInNewTabPreference() {
        return new Promise((resolve) => {
            chrome.storage.local.get({ [COMMAND_PALETTE_NEW_TAB_SETTING_KEY]: true }, (items) => {
                if (chrome.runtime.lastError) {
                    resolve(true);
                    return;
                }

                resolve(items[COMMAND_PALETTE_NEW_TAB_SETTING_KEY] !== false);
            });
        });
    }

    function injectInlineEnhancementsPreference(enabled) {
        const script = document.createElement('script');
        script.dataset.suitesenseConfigInjected = 'true';
        script.textContent = `window.__suitesenseInlineEnhancementsEnabled = ${enabled ? 'true' : 'false'};`;
        (document.head || document.documentElement).appendChild(script);
        script.remove();
    }

    function postInlineEnhancementsPreference(enabled) {
        window.postMessage({
            type: 'SUITESENSE_INLINE_ENHANCEMENTS_CONFIG',
            enabled: enabled !== false
        }, '*');
    }

    async function syncInlineEnhancementsPreference() {
        const enabled = await getInlineEnhancementsPreference();
        postInlineEnhancementsPreference(enabled);
        return enabled;
    }

    function injectPageScript() {
        if (document.querySelector('script[data-suitesense-injected="true"]')) {
            syncInlineEnhancementsPreference();
            return;
        }

        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('injectedScript.js');
        script.dataset.suitesenseInjected = 'true';
        script.onload = function() {
            console.log('Injected script successfully.');
            syncInlineEnhancementsPreference();
            this.remove();
        };
        (document.head || document.documentElement).appendChild(script);

        console.log('Attempting to inject the script into the page.');
    }

    function isSavedSearchOrWorkflowPage() {
        const path = window.location.pathname.toLowerCase();
        return path.includes('/app/common/search/') || path.includes('/app/common/workflow/');
    }

    function initializeSavedSearchFieldFinder() {
        if (!isSavedSearchOrWorkflowPage() || window.__suitesenseFieldFinderInitialized) {
            return;
        }

        window.__suitesenseFieldFinderInitialized = true;

        const state = {
            activeCategory: 'all',
            activeRows: [],
            activeSelect: null,
            highlightedIndex: 0,
            isOpen: false
        };

        const ui = buildFieldFinderUi();

        function normalizeText(value) {
            return String(value || '').replace(/\s+/g, ' ').trim();
        }

        function escapeHtml(value) {
            return String(value || '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        function getNearbyLabel(select) {
            const explicitLabel = select.id ? document.querySelector(`label[for="${CSS.escape(select.id)}"]`) : null;
            if (explicitLabel && normalizeText(explicitLabel.textContent)) {
                return normalizeText(explicitLabel.textContent);
            }

            const row = select.closest('tr');
            if (row) {
                const rowLabel = row.querySelector('label, th, td.smalltextnolink, td.text, span.smalltext, span.uir-label, div.uir-label');
                if (rowLabel && rowLabel !== select && normalizeText(rowLabel.textContent)) {
                    return normalizeText(rowLabel.textContent);
                }
            }

            return normalizeText(select.getAttribute('aria-label')) ||
                normalizeText(select.getAttribute('title')) ||
                normalizeText(select.name) ||
                normalizeText(select.id) ||
                'Field selector';
        }

        function isUsefulCandidateSelect(select) {
            if (!select || select.disabled) {
                return false;
            }

            const options = Array.from(select.options || []).filter((option) => normalizeText(option.textContent || option.text) || option.value);
            if (options.length < 8) {
                return false;
            }

            const meta = `${select.id || ''} ${select.name || ''} ${select.className || ''} ${getNearbyLabel(select)}`.toLowerCase();
            return ['field', 'filter', 'column', 'criteria', 'result', 'summary', 'formula', 'workflow'].some((token) => meta.includes(token)) || options.length >= 20;
        }

        function inferFieldCategory(option) {
            const combined = `${option.value || ''} ${option.text || ''}`.toLowerCase();

            if (combined.includes('formula')) {
                return 'formula';
            }

            if (/^cust/.test(combined) || combined.includes('custom body') || combined.includes('custom column') || combined.includes('custbody') || combined.includes('custcol') || combined.includes('custentity')) {
                return 'custom';
            }

            if (combined.includes('related') || combined.includes('joined') || combined.includes(' from ')) {
                return 'related';
            }

            return 'standard';
        }

        function inferFieldType(option) {
            const combined = `${option.value || ''} ${option.text || ''}`.toLowerCase();

            if (combined.includes('date')) {
                return 'DATE';
            }

            if (combined.includes('amount') || combined.includes('number') || combined.includes('rate') || combined.includes('qty') || combined.includes('quantity') || combined.includes('percent')) {
                return 'NUMBER';
            }

            if (combined.includes('checkbox') || combined.includes('true/false')) {
                return 'CHECKBOX';
            }

            if (combined.includes('account') || combined.includes('status') || combined.includes('type') || combined.includes('entity') || combined.includes('department') || combined.includes('class') || combined.includes('location') || combined.includes('subsidiary')) {
                return 'SELECT';
            }

            return 'TEXT';
        }

        function extractFieldRows(select) {
            const seen = new Set();
            const rows = [];

            Array.from(select.options || []).forEach((option) => {
                const label = normalizeText(option.textContent || option.text);
                const internalId = normalizeText(option.value);

                if ((!label && !internalId) || (/^(none|select|choose)\b/i.test(label) && !internalId)) {
                    return;
                }

                const dedupeKey = `${label}::${internalId}`;
                if (seen.has(dedupeKey)) {
                    return;
                }

                seen.add(dedupeKey);
                rows.push({
                    category: inferFieldCategory(option),
                    inputType: inferFieldType(option),
                    internalId: internalId || label,
                    label: label || internalId || 'Unnamed field',
                    optionValue: option.value
                });
            });

            return rows;
        }

        function positionPanel() {
            if (!state.activeSelect) {
                return;
            }

            const rect = state.activeSelect.getBoundingClientRect();
            const width = Math.max(560, Math.min(920, window.innerWidth - rect.left - 24));
            ui.root.style.top = `${window.scrollY + rect.bottom + 4}px`;
            ui.root.style.left = `${window.scrollX + rect.left}px`;
            ui.root.style.width = `${width}px`;
        }

        function setActiveTab(category) {
            state.activeCategory = category;
            Array.from(ui.tabs.querySelectorAll('[data-category]')).forEach((button) => {
                button.classList.toggle('is-active', button.dataset.category === category);
            });
        }

        function getFilteredRows() {
            const term = normalizeText(ui.searchInput.value).toLowerCase();
            return state.activeRows.filter((row) => {
                const categoryMatch = state.activeCategory === 'all' || row.category === state.activeCategory;
                const haystack = `${row.label} ${row.internalId} ${row.inputType}`.toLowerCase();
                return categoryMatch && (!term || haystack.includes(term));
            });
        }

        function renderRows() {
            const rows = getFilteredRows();
            ui.count.textContent = `Showing ${rows.length} of ${state.activeRows.length} fields.`;

            if (!rows.length) {
                ui.tableBody.innerHTML = '<tr><td colspan="4" class="suitesense-fieldfinder-empty">No matching fields found.</td></tr>';
                return;
            }

            if (state.highlightedIndex >= rows.length) {
                state.highlightedIndex = 0;
            }

            ui.tableBody.innerHTML = rows.map((row, index) => `
                <tr class="suitesense-fieldfinder-row${index === state.highlightedIndex ? ' is-highlighted' : ''}" data-value="${escapeHtml(row.optionValue)}">
                    <td>${escapeHtml(row.label)}</td>
                    <td><code>${escapeHtml(row.internalId)}</code></td>
                    <td>${escapeHtml(row.category)}</td>
                    <td>${escapeHtml(row.inputType)}</td>
                </tr>
            `).join('');
        }

        function closePanel() {
            state.isOpen = false;
            state.activeSelect = null;
            ui.root.hidden = true;
        }

        function applySelection(optionValue) {
            if (!state.activeSelect) {
                return;
            }

            state.activeSelect.value = optionValue;
            state.activeSelect.dispatchEvent(new Event('input', { bubbles: true }));
            state.activeSelect.dispatchEvent(new Event('change', { bubbles: true }));
            state.activeSelect.focus();
            closePanel();
        }

        function openForSelect(select) {
            if (!isUsefulCandidateSelect(select)) {
                return;
            }

            state.activeSelect = select;
            state.activeRows = extractFieldRows(select);
            state.highlightedIndex = 0;
            setActiveTab('all');
            ui.meta.textContent = `${getNearbyLabel(select)} • ${state.activeRows.length} fields`;
            ui.searchInput.value = '';
            renderRows();
            positionPanel();
            ui.root.hidden = false;
            state.isOpen = true;
            window.setTimeout(() => ui.searchInput.focus(), 0);
        }

        ui.closeButton.addEventListener('click', closePanel);
        ui.searchInput.addEventListener('input', () => {
            state.highlightedIndex = 0;
            renderRows();
        });

        ui.searchInput.addEventListener('keydown', (event) => {
            const rows = getFilteredRows();
            if (!rows.length) {
                return;
            }

            if (event.key === 'ArrowDown') {
                event.preventDefault();
                state.highlightedIndex = Math.min(state.highlightedIndex + 1, rows.length - 1);
                renderRows();
                return;
            }

            if (event.key === 'ArrowUp') {
                event.preventDefault();
                state.highlightedIndex = Math.max(state.highlightedIndex - 1, 0);
                renderRows();
                return;
            }

            if (event.key === 'Enter') {
                event.preventDefault();
                applySelection(rows[state.highlightedIndex].optionValue);
            }
        });

        ui.tabs.addEventListener('click', (event) => {
            const target = event.target.closest('[data-category]');
            if (!target) {
                return;
            }

            setActiveTab(target.dataset.category);
            state.highlightedIndex = 0;
            renderRows();
        });

        ui.tableBody.addEventListener('click', (event) => {
            const row = event.target.closest('.suitesense-fieldfinder-row');
            if (!row) {
                return;
            }

            applySelection(row.dataset.value || '');
        });

        document.addEventListener('focusin', (event) => {
            const select = event.target && event.target.closest ? event.target.closest('select') : null;
            if (select && isUsefulCandidateSelect(select)) {
                openForSelect(select);
            }
        });

        document.addEventListener('click', (event) => {
            const select = event.target && event.target.closest ? event.target.closest('select') : null;
            if (select && isUsefulCandidateSelect(select)) {
                openForSelect(select);
                return;
            }

            if (state.isOpen && !ui.root.contains(event.target) && (!state.activeSelect || !state.activeSelect.contains(event.target))) {
                closePanel();
            }
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && state.isOpen) {
                closePanel();
            }
        });

        window.addEventListener('resize', () => {
            if (state.isOpen) {
                positionPanel();
            }
        });

        window.addEventListener('scroll', () => {
            if (state.isOpen) {
                positionPanel();
            }
        }, true);
    }

    function buildFieldFinderUi() {
        const style = document.createElement('style');
        style.textContent = `
            .suitesense-fieldfinder-inline[hidden] { display: none !important; }
            .suitesense-fieldfinder-inline { position: absolute; z-index: 2147483645; border: 1px solid #7ea4dc; background: #ffffff; box-shadow: 0 12px 32px rgba(22, 43, 84, 0.18); font-family: "Segoe UI", Arial, sans-serif; }
            .suitesense-fieldfinder-inline-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 10px; background: #f1f6fd; border-bottom: 1px solid #c9d8ed; }
            .suitesense-fieldfinder-inline-title { color: #173764; font-size: 12px; font-weight: 700; }
            .suitesense-fieldfinder-inline-meta { color: #60718c; font-size: 11px; }
            .suitesense-fieldfinder-inline-close { border: 0; background: transparent; color: #4b6488; cursor: pointer; font-size: 16px; line-height: 1; }
            .suitesense-fieldfinder-inline-toolbar { display: grid; grid-template-columns: 200px 1fr; gap: 10px; padding: 8px 10px; background: #ffffff; border-bottom: 1px solid #d9e5f5; }
            .suitesense-fieldfinder-searchhint { color: #6a7f9c; font-size: 11px; align-self: center; }
            .suitesense-fieldfinder-search { width: 100%; border: 1px solid #7ea4dc; padding: 6px 8px; outline: none; font-size: 12px; }
            .suitesense-fieldfinder-tabs { display: flex; gap: 4px; padding: 0 10px 8px; background: #ffffff; }
            .suitesense-fieldfinder-tab { border: 1px solid #aac0df; background: #f7fbff; color: #27456f; padding: 4px 8px; font-size: 12px; cursor: pointer; }
            .suitesense-fieldfinder-tab.is-active { background: #e5f0ff; border-color: #5f8cca; color: #12335f; font-weight: 700; }
            .suitesense-fieldfinder-count { margin-left: auto; color: #60718c; font-size: 11px; align-self: center; }
            .suitesense-fieldfinder-tablewrap { max-height: 320px; overflow: auto; border-top: 1px solid #d9e5f5; }
            .suitesense-fieldfinder-table { width: 100%; border-collapse: collapse; }
            .suitesense-fieldfinder-table thead th { position: sticky; top: 0; background: #5e7ca6; color: #ffffff; text-align: left; padding: 8px 10px; font-size: 12px; font-weight: 600; }
            .suitesense-fieldfinder-table td { padding: 8px 10px; border-top: 1px solid #e2ebf6; color: #173764; font-size: 12px; }
            .suitesense-fieldfinder-table code { color: #12335f; font-size: 11px; }
            .suitesense-fieldfinder-row { cursor: pointer; }
            .suitesense-fieldfinder-row:hover, .suitesense-fieldfinder-row.is-highlighted { background: #eef5ff; }
            .suitesense-fieldfinder-empty { text-align: center; color: #60718c; }
        `;
        document.documentElement.appendChild(style);

        const root = document.createElement('div');
        root.className = 'suitesense-fieldfinder-inline';
        root.hidden = true;
        root.innerHTML = `
            <div class="suitesense-fieldfinder-inline-header">
                <div>
                    <div class="suitesense-fieldfinder-inline-title">Saved Search Field Finder</div>
                    <div class="suitesense-fieldfinder-inline-meta"></div>
                </div>
                <button type="button" class="suitesense-fieldfinder-inline-close" aria-label="Close">x</button>
            </div>
            <div class="suitesense-fieldfinder-inline-toolbar">
                <input class="suitesense-fieldfinder-search" type="search" placeholder="Filter by Name or ID" aria-label="Filter by name or ID" />
                <div class="suitesense-fieldfinder-searchhint">Pick a field below to write it back into the current NetSuite selector.</div>
            </div>
            <div class="suitesense-fieldfinder-tabs">
                <button type="button" class="suitesense-fieldfinder-tab is-active" data-category="all">All</button>
                <button type="button" class="suitesense-fieldfinder-tab" data-category="standard">Standard</button>
                <button type="button" class="suitesense-fieldfinder-tab" data-category="custom">Custom</button>
                <button type="button" class="suitesense-fieldfinder-tab" data-category="related">Related</button>
                <button type="button" class="suitesense-fieldfinder-tab" data-category="formula">Formula</button>
                <div class="suitesense-fieldfinder-count"></div>
            </div>
            <div class="suitesense-fieldfinder-tablewrap">
                <table class="suitesense-fieldfinder-table">
                    <thead>
                        <tr>
                            <th>Field Label</th>
                            <th>Internal ID</th>
                            <th>Category</th>
                            <th>Type</th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                </table>
            </div>
        `;

        document.documentElement.appendChild(root);

        return {
            closeButton: root.querySelector('.suitesense-fieldfinder-inline-close'),
            count: root.querySelector('.suitesense-fieldfinder-count'),
            meta: root.querySelector('.suitesense-fieldfinder-inline-meta'),
            root,
            searchInput: root.querySelector('.suitesense-fieldfinder-search'),
            tableBody: root.querySelector('tbody'),
            tabs: root.querySelector('.suitesense-fieldfinder-tabs')
        };
    }

    function initializeSavedSearchDropdownEnhancer() {
        if (!isSavedSearchOrWorkflowPage() || window.__suitesenseSavedSearchDropdownEnhancerInitialized) {
            return;
        }

        window.__suitesenseSavedSearchDropdownEnhancerInitialized = true;

        const enhancerState = {
            activeCategory: 'all',
            activeContainer: null,
            activeRows: [],
            activeTarget: null,
            scheduledTarget: null,
            timer: null
        };

        const style = document.createElement('style');
        style.textContent = `
            .suitesense-inline-dropdown-enhancer {
                position: sticky;
                top: 0;
                z-index: 5;
                background: #ffffff;
                border-bottom: 1px solid #9cb6da;
                box-shadow: 0 2px 8px rgba(28, 53, 96, 0.10);
            }

            .suitesense-inline-dropdown-searchrow {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 6px;
                background: #f7fbff;
                border-bottom: 1px solid #d7e4f6;
            }

            .suitesense-inline-dropdown-search {
                flex: 1;
                min-width: 0;
                border: 1px solid #6f98d5;
                padding: 6px 8px;
                font: 12px/1.2 "Segoe UI", Arial, sans-serif;
                outline: none;
            }

            .suitesense-inline-dropdown-tabs {
                display: flex;
                align-items: center;
                gap: 4px;
                padding: 6px;
                background: #ffffff;
                border-bottom: 1px solid #d7e4f6;
            }

            .suitesense-inline-dropdown-tab {
                border: 1px solid #aac0df;
                background: #f5f9ff;
                color: #28466f;
                padding: 3px 8px;
                font: 12px/1.2 "Segoe UI", Arial, sans-serif;
                cursor: pointer;
            }

            .suitesense-inline-dropdown-tab.is-active {
                background: #ddecff;
                border-color: #5f8cca;
                color: #12335f;
                font-weight: 700;
            }

            .suitesense-inline-dropdown-count {
                margin-left: auto;
                color: #60718c;
                font: 11px/1.2 "Segoe UI", Arial, sans-serif;
            }
        `;
        document.documentElement.appendChild(style);

        function normalizeText(value) {
            return String(value || '').replace(/\s+/g, ' ').trim();
        }

        function isVisibleElement(element) {
            if (!element || !element.getBoundingClientRect) {
                return false;
            }

            const rect = element.getBoundingClientRect();
            const styles = window.getComputedStyle(element);
            return rect.width > 40 && rect.height > 16 && styles.display !== 'none' && styles.visibility !== 'hidden';
        }

        function inferCategory(label, internalId) {
            const combined = `${label} ${internalId}`.toLowerCase();
            if (combined.includes('formula')) {
                return 'formula';
            }
            if (/^cust/.test(combined) || combined.includes('custom body') || combined.includes('custom column') || combined.includes('custbody') || combined.includes('custcol') || combined.includes('custentity')) {
                return 'custom';
            }
            if (combined.includes('related') || combined.includes('joined') || combined.includes(' from ')) {
                return 'related';
            }
            return 'standard';
        }

        function getTargetLabel(target) {
            const row = target.closest('tr');
            if (row) {
                const labelCell = row.querySelector('label, th, td.smalltextnolink, td.text, span.smalltext, span.uir-label, div.uir-label');
                if (labelCell) {
                    const text = normalizeText(labelCell.textContent);
                    if (text) {
                        return text;
                    }
                }
            }

            return normalizeText(target.getAttribute('aria-label')) ||
                normalizeText(target.getAttribute('title')) ||
                normalizeText(target.name) ||
                normalizeText(target.id) ||
                '';
        }

        function findSiblingSelect(target) {
            const row = target.closest('tr');
            if (row) {
                const rowSelect = row.querySelector('select');
                if (rowSelect && rowSelect !== target) {
                    return rowSelect;
                }
            }

            const container = target.closest('td, div');
            if (container) {
                const nearSelect = container.querySelector('select');
                if (nearSelect && nearSelect !== target) {
                    return nearSelect;
                }
            }

            return target.matches('select') ? target : null;
        }

        function buildInternalIdMap(target) {
            const select = findSiblingSelect(target);
            const map = new Map();

            if (!select || !select.options) {
                return map;
            }

            Array.from(select.options).forEach((option) => {
                const label = normalizeText(option.textContent || option.text);
                const internalId = normalizeText(option.value);
                if (label) {
                    map.set(label.toLowerCase(), internalId);
                }
            });

            return map;
        }

        function isUsefulTarget(target) {
            if (!target || !isVisibleElement(target)) {
                return false;
            }

            const textMeta = `${target.id || ''} ${target.name || ''} ${target.className || ''} ${getTargetLabel(target)}`.toLowerCase();
            const controlMatch = target.matches('input, select, textarea, div');
            const hasSignal = ['field', 'filter', 'column', 'criteria', 'result', 'summary', 'formula'].some((token) => textMeta.includes(token));
            return controlMatch && hasSignal;
        }

        function findOpenDropdownContainer(target) {
            const targetRect = target.getBoundingClientRect();
            const candidates = Array.from(document.querySelectorAll('div, table, ul, tbody'))
                .filter((element) => {
                    if (element.classList && (element.classList.contains('suitesense-inline-dropdown-enhancer') || element.closest('.suitesense-inline-dropdown-enhancer'))) {
                        return false;
                    }

                    if (!isVisibleElement(element)) {
                        return false;
                    }

                    const rect = element.getBoundingClientRect();
                    const closeToTarget = Math.abs(rect.left - targetRect.left) < 120;
                    const underTarget = rect.top <= targetRect.bottom + 16 && rect.bottom >= targetRect.bottom;
                    const largeEnough = rect.height >= 80 && rect.width >= Math.max(targetRect.width, 220);
                    return closeToTarget && underTarget && largeEnough;
                })
                .map((element) => ({
                    element,
                    rect: element.getBoundingClientRect()
                }))
                .sort((left, right) => {
                    const leftDistance = Math.abs(left.rect.top - targetRect.bottom);
                    const rightDistance = Math.abs(right.rect.top - targetRect.bottom);
                    return leftDistance - rightDistance;
                });

            return candidates[0]?.element || null;
        }

        function extractDropdownRows(container, target) {
            const idMap = buildInternalIdMap(target);
            const seen = new Set();
            const rows = [];
            const candidates = Array.from(container.querySelectorAll('tr, li, td, div, a, span'));

            candidates.forEach((element) => {
                if (!isVisibleElement(element) || element.closest('.suitesense-inline-dropdown-enhancer')) {
                    return;
                }

                if (element.querySelector('input, button, select, textarea')) {
                    return;
                }

                const text = normalizeText(element.textContent);
                if (!text || text.length > 140) {
                    return;
                }

                if (seen.has(text.toLowerCase())) {
                    return;
                }

                const rect = element.getBoundingClientRect();
                if (rect.height < 12 || rect.width < 60) {
                    return;
                }

                seen.add(text.toLowerCase());
                rows.push({
                    category: inferCategory(text, idMap.get(text.toLowerCase()) || ''),
                    element,
                    internalId: idMap.get(text.toLowerCase()) || '',
                    label: text
                });
            });

            return rows;
        }

        function ensureEnhancer(container) {
            let enhancer = container.querySelector(':scope > .suitesense-inline-dropdown-enhancer');
            if (enhancer) {
                return enhancer;
            }

            enhancer = document.createElement('div');
            enhancer.className = 'suitesense-inline-dropdown-enhancer';
            enhancer.innerHTML = `
                <div class="suitesense-inline-dropdown-searchrow">
                    <input class="suitesense-inline-dropdown-search" type="search" placeholder="Filter by Name or ID" aria-label="Filter by name or ID" />
                </div>
                <div class="suitesense-inline-dropdown-tabs">
                    <button type="button" class="suitesense-inline-dropdown-tab is-active" data-category="all">All</button>
                    <button type="button" class="suitesense-inline-dropdown-tab" data-category="standard">Standard</button>
                    <button type="button" class="suitesense-inline-dropdown-tab" data-category="custom">Custom</button>
                    <button type="button" class="suitesense-inline-dropdown-tab" data-category="related">Related</button>
                    <button type="button" class="suitesense-inline-dropdown-tab" data-category="formula">Formula</button>
                    <div class="suitesense-inline-dropdown-count"></div>
                </div>
            `;

            container.prepend(enhancer);
            return enhancer;
        }

        function renderFilteredRows() {
            if (!enhancerState.activeContainer) {
                return;
            }

            const enhancer = ensureEnhancer(enhancerState.activeContainer);
            const searchInput = enhancer.querySelector('.suitesense-inline-dropdown-search');
            const count = enhancer.querySelector('.suitesense-inline-dropdown-count');
            const term = normalizeText(searchInput.value).toLowerCase();

            let visibleCount = 0;
            enhancerState.activeRows.forEach((row) => {
                const categoryMatch = enhancerState.activeCategory === 'all' || row.category === enhancerState.activeCategory;
                const haystack = `${row.label} ${row.internalId}`.toLowerCase();
                const visible = categoryMatch && (!term || haystack.includes(term));
                row.element.style.display = visible ? '' : 'none';
                if (visible) {
                    visibleCount += 1;
                }
            });

            count.textContent = `Showing ${visibleCount} of ${enhancerState.activeRows.length} fields.`;
        }

        function activateEnhancer(container, target) {
            const rows = extractDropdownRows(container, target);
            if (!rows.length) {
                return;
            }

            enhancerState.activeContainer = container;
            enhancerState.activeRows = rows;
            enhancerState.activeTarget = target;
            enhancerState.activeCategory = 'all';

            const enhancer = ensureEnhancer(container);
            const searchInput = enhancer.querySelector('.suitesense-inline-dropdown-search');
            searchInput.value = '';

            Array.from(enhancer.querySelectorAll('[data-category]')).forEach((button) => {
                button.classList.toggle('is-active', button.dataset.category === 'all');
            });

            if (!enhancer.dataset.bound) {
                enhancer.dataset.bound = 'true';

                searchInput.addEventListener('input', renderFilteredRows);

                enhancer.querySelector('.suitesense-inline-dropdown-tabs').addEventListener('click', (event) => {
                    const targetButton = event.target.closest('[data-category]');
                    if (!targetButton) {
                        return;
                    }

                    enhancerState.activeCategory = targetButton.dataset.category;
                    Array.from(enhancer.querySelectorAll('[data-category]')).forEach((button) => {
                        button.classList.toggle('is-active', button === targetButton);
                    });
                    renderFilteredRows();
                });
            }

            renderFilteredRows();
            window.setTimeout(() => searchInput.focus(), 0);
        }

        function scheduleEnhancer(target) {
            if (!isUsefulTarget(target)) {
                return;
            }

            enhancerState.scheduledTarget = target;
            window.clearTimeout(enhancerState.timer);
            enhancerState.timer = window.setTimeout(() => {
                const dropdown = findOpenDropdownContainer(target);
                if (dropdown) {
                    activateEnhancer(dropdown, target);
                }
            }, 120);
        }

        document.addEventListener('focusin', (event) => {
            const target = event.target;
            if (target && target.closest) {
                scheduleEnhancer(target.closest('input, select, textarea, div'));
            }
        });

        document.addEventListener('click', (event) => {
            const target = event.target;
            if (target && target.closest) {
                scheduleEnhancer(target.closest('input, select, textarea, div'));
            }
        });
    }

    const COMMAND_PALETTE_RECENTS_KEY = 'suitesenseCommandPaletteRecents';
    const accountId = window.location.hostname.split('.')[0];
    let commandPaletteOpenInNewTabPreference = true;

    getCommandPaletteOpenInNewTabPreference().then((enabled) => {
        commandPaletteOpenInNewTabPreference = enabled !== false;
    });

    function normalizeInlineText(value) {
        return String(value || '').replace(/\s+/g, ' ').trim();
    }

    function inferExecutionLogRecordType(titleText, detailsText) {
        const combined = `${titleText || ''} ${detailsText || ''}`.toLowerCase();

        if (combined.includes('file cabinet')) return 'file';
        if (combined.includes('created file')) return 'file';
        if (combined.includes('file id')) return 'file';
        if (combined.includes('media item')) return 'file';
        if (combined.includes('customer payment')) return 'customerpayment';
        if (combined.includes('customer refund')) return 'customerrefund';
        if (combined.includes('credit memo')) return 'creditmemo';
        if (combined.includes('item fulfillment')) return 'itemfulfillment';
        if (combined.includes('item receipt')) return 'itemreceipt';
        if (combined.includes('estimate')) return 'estimate';
        if (combined.includes('customer')) return 'customer';
        if (combined.includes('vendor bill')) return 'vendorbill';
        if (combined.includes('vendor')) return 'vendor';
        if (combined.includes('employee')) return 'employee';
        if (combined.includes('purchase order')) return 'purchaseorder';
        if (combined.includes('sales order')) return 'salesorder';
        if (combined.includes('invoice')) return 'invoice';
        if (combined.includes('return authorization')) return 'returnauthorization';
        if (combined.includes('opportunity')) return 'opportunity';
        if (combined.includes('cash sale')) return 'cashsale';
        if (combined.includes('item')) return 'item';

        return '';
    }

    function buildExecutionLogRecordUrl(recordType, internalId) {
        const id = encodeURIComponent(String(internalId || '').trim());
        if (!id) {
            return '';
        }

        const baseUrl = `https://${accountId}.app.netsuite.com/app`;
        const routeMap = {
            file: `${baseUrl}/common/media/mediaitem.nl?id=${id}`,
            customer: `${baseUrl}/common/entity/custjob.nl?id=${id}`,
            vendor: `${baseUrl}/common/entity/vendor.nl?id=${id}`,
            employee: `${baseUrl}/common/entity/employee.nl?id=${id}`,
            item: `${baseUrl}/common/item/item.nl?id=${id}`,
            salesorder: `${baseUrl}/accounting/transactions/salesord.nl?id=${id}&whence=`,
            purchaseorder: `${baseUrl}/accounting/transactions/purchord.nl?id=${id}&whence=`,
            invoice: `${baseUrl}/accounting/transactions/custinvc.nl?id=${id}&whence=`,
            estimate: `${baseUrl}/accounting/transactions/estimate.nl?id=${id}&whence=`,
            customerpayment: `${baseUrl}/accounting/transactions/custpymt.nl?id=${id}&whence=`,
            customerrefund: `${baseUrl}/accounting/transactions/custrfnd.nl?id=${id}&whence=`,
            creditmemo: `${baseUrl}/accounting/transactions/custcred.nl?id=${id}&whence=`,
            itemfulfillment: `${baseUrl}/accounting/transactions/itemship.nl?id=${id}&whence=`,
            itemreceipt: `${baseUrl}/accounting/transactions/itemrcpt.nl?id=${id}&whence=`,
            returnauthorization: `${baseUrl}/accounting/transactions/rtnauth.nl?id=${id}&whence=`,
            opportunity: `${baseUrl}/accounting/transactions/opprtnty.nl?id=${id}&whence=`,
            vendorbill: `${baseUrl}/accounting/transactions/vendbill.nl?id=${id}&whence=`,
            cashsale: `${baseUrl}/accounting/transactions/cashsale.nl?id=${id}&whence=`
        };

        return routeMap[recordType] || '';
    }

    function enhanceExecutionLogLinks() {
        const EXECUTION_LOG_LINK_VERSION = '2';
        const tables = Array.from(document.querySelectorAll('table'));

        tables.forEach((table) => {
            const rows = Array.from(table.querySelectorAll('tr'));
            if (!rows.length) {
                return;
            }

            const headerRowIndex = rows.findIndex((row) => {
                const cellTexts = Array.from(row.querySelectorAll('th, td'))
                    .map((cell) => normalizeInlineText(cell.textContent).toLowerCase())
                    .filter(Boolean);
                return cellTexts.includes('title') && cellTexts.includes('details') && cellTexts.includes('type');
            });

            if (headerRowIndex === -1) {
                return;
            }

            const headerCells = Array.from(rows[headerRowIndex].querySelectorAll('th, td'));
            const titleIndex = headerCells.findIndex((cell) => normalizeInlineText(cell.textContent).toLowerCase() === 'title');
            const detailsIndex = headerCells.findIndex((cell) => normalizeInlineText(cell.textContent).toLowerCase() === 'details');
            if (titleIndex === -1 || detailsIndex === -1) {
                return;
            }

            rows.slice(headerRowIndex + 1).forEach((row) => {
                const cells = row.querySelectorAll('td');
                if (!cells.length || !cells[detailsIndex]) {
                    return;
                }

                const titleCell = cells[titleIndex];
                const detailsCell = cells[detailsIndex];
                const titleText = normalizeInlineText(titleCell?.textContent || '');
                const rawDetailsText = detailsCell.dataset.suitesenseExecutionLogRaw
                    || normalizeInlineText(detailsCell.textContent || '');
                const detailsText = rawDetailsText;
                const identity = `${titleText}||${detailsText}`;

                if (!/(?:internal id|file id)\s*:\s*\d+/i.test(detailsText) && !/\b\d{1,10}\b/.test(detailsText)) {
                    return;
                }

                if (
                    detailsCell.dataset.suitesenseExecutionLogIdentity === identity
                    && detailsCell.dataset.suitesenseExecutionLogVersion === EXECUTION_LOG_LINK_VERSION
                ) {
                    return;
                }

                detailsCell.dataset.suitesenseExecutionLogRaw = rawDetailsText;
                detailsCell.dataset.suitesenseExecutionLogIdentity = identity;
                detailsCell.dataset.suitesenseExecutionLogVersion = EXECUTION_LOG_LINK_VERSION;
                const inferredType = inferExecutionLogRecordType(titleText, detailsText);
                const fragment = document.createDocumentFragment();
                const regex = /((?:Internal ID|File ID)\s*:\s*)(\d+)|\b(\d{1,10})\b/gi;
                let lastIndex = 0;
                let match;
                let linkedCount = 0;
                const ignoredBareIdLabelsPattern = /\b(?:row|rows|line|lines|count|total|page|pages|result|results|record|records|qty|quantity)\s*:\s*$/i;

                while ((match = regex.exec(detailsText)) !== null) {
                    const [fullMatch, prefix = '', labeledId = '', bareId = ''] = match;
                    const internalId = labeledId || bareId;
                    const matchStart = match.index;
                    const idStart = prefix ? matchStart + prefix.length : matchStart;

                    if (!internalId) {
                        continue;
                    }

                    const prevChar = matchStart > 0 ? detailsText[matchStart - 1] : '';
                    if (!prefix && /[A-Za-z]/.test(prevChar)) {
                        continue;
                    }

                    if (!prefix) {
                        const contextBefore = detailsText.slice(Math.max(0, matchStart - 24), matchStart);
                        if (ignoredBareIdLabelsPattern.test(contextBefore)) {
                            continue;
                        }
                    }

                    if (matchStart > lastIndex) {
                        fragment.appendChild(document.createTextNode(detailsText.slice(lastIndex, matchStart)));
                    }

                    if (prefix) {
                        fragment.appendChild(document.createTextNode(prefix));
                    }

                    const matchType = /^file id/i.test(prefix) ? 'file' : inferredType;
                    const url = buildExecutionLogRecordUrl(matchType, internalId);
                    const link = document.createElement('a');
                    link.href = url || '#';
                    link.textContent = internalId;
                    link.className = 'suitesense-execution-log-link';
                    link.dataset.internalId = internalId;
                    link.dataset.recordType = matchType;
                    link.title = matchType
                        ? `Open ${matchType} ${internalId}`
                        : `Resolve and open internal ID ${internalId}`;

                    link.addEventListener('click', (event) => {
                        event.preventDefault();
                        event.stopPropagation();

                        if (url) {
                            if (commandPaletteOpenInNewTabPreference) {
                                window.open(url, '_blank', 'noopener');
                            } else {
                                window.location.href = url;
                            }
                            return;
                        }

                        window.postMessage({ type: 'RESOLVE_INTERNAL_ID', internalId }, '*');
                    });

                    fragment.appendChild(link);
                    linkedCount += 1;
                    lastIndex = idStart + internalId.length;
                }

                if (!linkedCount) {
                    return;
                }

                if (lastIndex < detailsText.length) {
                    fragment.appendChild(document.createTextNode(detailsText.slice(lastIndex)));
                }

                detailsCell.textContent = '';
                detailsCell.appendChild(fragment);
            });
        });
    }

    function initializeExecutionLogLinkEnhancer() {
        if (window.__suitesenseExecutionLogLinkEnhancerInitialized) {
            return;
        }

        window.__suitesenseExecutionLogLinkEnhancerInitialized = true;

        const style = document.createElement('style');
        style.textContent = `
            .suitesense-execution-log-link {
                color: #1d5fbf;
                cursor: pointer;
                font-weight: 600;
                text-decoration: underline;
                text-underline-offset: 2px;
            }
            .suitesense-execution-log-link:hover {
                color: #0f4ea7;
            }
        `;
        document.documentElement.appendChild(style);

        const runEnhancer = () => {
            window.requestAnimationFrame(() => {
                enhanceExecutionLogLinks();
            });
        };

        runEnhancer();

        const observer = new MutationObserver(() => {
            runEnhancer();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName === 'local' && changes[COMMAND_PALETTE_NEW_TAB_SETTING_KEY]) {
                commandPaletteOpenInNewTabPreference = changes[COMMAND_PALETTE_NEW_TAB_SETTING_KEY].newValue !== false;
            }
        });
    }

    function initializeCommandPalette() {
        if (window.__suitesenseCommandPaletteInitialized) {
            return;
        }

        window.__suitesenseCommandPaletteInitialized = true;

        const state = {
            isOpen: false,
            query: '',
            commands: [],
            selectedIndex: 0,
            recentIds: loadRecentCommandIds(),
            idResolution: null,
            scriptSearch: null,
            openNavigationInNewTab: true,
            fieldIdsVisible: false,
            fieldIdBadges: [],
            fieldIdListenersBound: false
        };

        const ui = buildCommandPaletteUi();

        function normalizeText(value) {
            return String(value || '').replace(/\s+/g, ' ').trim();
        }

        function escapeHtml(value) {
            return String(value || '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        function loadRecentCommandIds() {
            try {
                const parsed = JSON.parse(localStorage.getItem(COMMAND_PALETTE_RECENTS_KEY) || '[]');
                return Array.isArray(parsed) ? parsed.slice(0, 8) : [];
            } catch (error) {
                return [];
            }
        }

        function saveRecentCommandIds() {
            localStorage.setItem(COMMAND_PALETTE_RECENTS_KEY, JSON.stringify(state.recentIds.slice(0, 8)));
        }

        function rememberCommand(id) {
            state.recentIds = [id, ...state.recentIds.filter((item) => item !== id)].slice(0, 8);
            saveRecentCommandIds();
        }

        function isVisibleElement(element) {
            if (!element || !element.isConnected) {
                return false;
            }

            const styles = window.getComputedStyle(element);
            if (styles.display === 'none' || styles.visibility === 'hidden' || styles.opacity === '0') {
                return false;
            }

            const rect = element.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
        }

        function showPaletteToast(message) {
            if (!message) {
                return;
            }

            ui.toast.textContent = message;
            ui.toast.hidden = false;
            ui.toast.classList.add('is-visible');
            window.clearTimeout(ui.toast.__hideTimer);
            ui.toast.__hideTimer = window.setTimeout(() => {
                ui.toast.classList.remove('is-visible');
                ui.toast.hidden = true;
            }, 2400);
        }

        function parseCurrentRecordContext() {
            const url = new URL(window.location.href);
            const path = url.pathname.toLowerCase();
            const recordId = url.searchParams.get('id');
            const mapping = [
                { token: '/app/accounting/transactions/salesord.nl', label: 'Sales Order' },
                { token: '/app/accounting/transactions/custinvc.nl', label: 'Invoice' },
                { token: '/app/accounting/transactions/purchord.nl', label: 'Purchase Order' },
                { token: '/app/common/entity/custjob.nl', label: 'Customer' },
                { token: '/app/common/entity/vendor.nl', label: 'Vendor' },
                { token: '/app/common/entity/employee.nl', label: 'Employee' },
                { token: '/app/common/item/item.nl', label: 'Item' },
                { token: '/app/accounting/transactions/opprtnty.nl', label: 'Opportunity' }
            ];

            const match = mapping.find((item) => path.includes(item.token));
            return {
                id: recordId,
                label: match ? match.label : '',
                title: normalizeText(document.title.replace(/\s*-\s*NetSuite.*$/i, '')) || 'NetSuite Page',
                url: window.location.href
            };
        }

        function openNetSuiteUrl(url, newTab = state.openNavigationInNewTab) {
            if (!url) {
                return;
            }

            closePalette();
            if (newTab) {
                window.open(url, '_blank', 'noopener');
                return;
            }

            window.location.assign(url);
        }

        function copyTextToClipboard(text, successMessage) {
            navigator.clipboard.writeText(text).then(() => {
                closePalette();
                showPaletteToast(successMessage || 'Copied to clipboard.');
            }).catch(() => {
                showPaletteToast('Unable to copy to clipboard.');
            });
        }

        function openSuitesensePanel() {
            chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL_FOR_SENDER' }, () => {
                if (chrome.runtime.lastError) {
                    console.debug('Unable to open Suitesense side panel:', chrome.runtime.lastError.message);
                }
            });
        }

        function fetchCurrentFields() {
            openSuitesensePanel();
            window.postMessage({ type: 'FETCH_ALL_FIELDS' }, '*');
            closePalette();
            showPaletteToast('Fetching current record fields...');
        }

        function openCustomerByName(customerName) {
            const name = normalizeText(customerName);
            if (!name) {
                return;
            }

            closePalette();
            showPaletteToast(`Looking up customer "${name}"...`);
            window.postMessage({
                type: 'OPEN_CUSTOMER_BY_NAME',
                customerName: name,
                openInNewTab: state.openNavigationInNewTab
            }, '*');
        }

        function resolveInternalId(idValue) {
            const normalizedId = String(idValue || '').trim();
            if (!/^\d+$/.test(normalizedId)) {
                showPaletteToast('Enter a numeric internal ID.');
                return;
            }

            state.idResolution = null;
            showPaletteToast(`Resolving internal ID ${normalizedId}...`);
            window.postMessage({ type: 'RESOLVE_INTERNAL_ID', internalId: normalizedId }, '*');
        }

        function searchSuiteScripts(scriptTerm) {
            const normalizedTerm = normalizeText(scriptTerm);
            if (!normalizedTerm) {
                showPaletteToast('Enter a script name or script ID.');
                return;
            }

            state.scriptSearch = null;
            showPaletteToast(`Searching scripts for "${normalizedTerm}"...`);
            window.postMessage({
                type: 'SEARCH_SUITESCRIPTS_BY_NAME',
                scriptTerm: normalizedTerm
            }, '*');
        }

        function looksLikeSuiteScriptQuery(searchTerm) {
            const normalized = normalizeText(searchTerm).toLowerCase();
            if (!normalized) {
                return false;
            }

            return /(?:\bcustomscript(?:[_-]?[a-z0-9]+)*\b|\bscript\b|\bscripts\b|\bsuitelet\b|\brestlet\b|\bmap\/?reduce\b|\bmap reduce\b|\bmapreduce\b|\buser event\b|\buserevent\b|\bclient script\b|\bclientscript\b|\bscheduled script\b|\bscheduled scripts\b|\bschedule script\b|\bschedule scripts\b|\bscheduled\b|\bworkflow action\b|\bworkflowaction\b|\bdeployment\b|\bdeployments\b|\bscript deployment\b|\bscript deployments\b)/.test(normalized);
        }

        function runPaletteQuery(query, description) {
            if (!query) {
                return;
            }

            openSuitesensePanel();
            window.postMessage({ type: 'RUN_QUERY', query }, '*');
            closePalette();
            showPaletteToast(description || 'Running SuiteQL query in Suitesense...');
        }

        function setNativeInputValue(input, value) {
            const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
            if (descriptor && typeof descriptor.set === 'function') {
                descriptor.set.call(input, value);
                return;
            }

            input.value = value;
        }

        function findGlobalSearchInput() {
            const candidates = Array.from(document.querySelectorAll('input')).filter((input) => {
                if (!isVisibleElement(input)) {
                    return false;
                }

                const meta = `${input.id || ''} ${input.name || ''} ${input.placeholder || ''} ${input.getAttribute('aria-label') || ''}`.toLowerCase();
                return meta.includes('search');
            });

            return candidates
                .filter((input) => !ui.overlay.contains(input))
                .sort((left, right) => {
                    const leftMeta = `${left.id || ''} ${left.name || ''} ${left.placeholder || ''} ${left.getAttribute('aria-label') || ''}`.toLowerCase();
                    const rightMeta = `${right.id || ''} ${right.name || ''} ${right.placeholder || ''} ${right.getAttribute('aria-label') || ''}`.toLowerCase();
                    const leftRect = left.getBoundingClientRect();
                    const rightRect = right.getBoundingClientRect();
                    const leftScore =
                        (leftRect.top < 180 ? 100 : 0) +
                        (leftMeta.includes('global') ? 60 : 0) +
                        (leftMeta.includes('search') ? 30 : 0);
                    const rightScore =
                        (rightRect.top < 180 ? 100 : 0) +
                        (rightMeta.includes('global') ? 60 : 0) +
                        (rightMeta.includes('search') ? 30 : 0);
                    return rightScore - leftScore;
                })[0] || null;
        }

        function findGlobalSearchTrigger(input) {
            if (!input) {
                return null;
            }

            const form = input.closest('form');
            const candidates = [];

            if (form) {
                candidates.push(...Array.from(form.querySelectorAll('button, input[type="submit"], a, span, div')));
            }

            const wrapper = input.closest('td, div, form');
            if (wrapper) {
                candidates.push(...Array.from(wrapper.querySelectorAll('button, input[type="submit"], a, span, div')));
            }

            const unique = Array.from(new Set(candidates));
            return unique.find((candidate) => {
                if (!candidate || candidate === input || !isVisibleElement(candidate)) {
                    return false;
                }

                const meta = `${candidate.id || ''} ${candidate.className || ''} ${candidate.getAttribute('title') || ''} ${candidate.getAttribute('aria-label') || ''} ${candidate.textContent || ''}`.toLowerCase();
                return meta.includes('search') || meta.includes('magnif') || meta.includes('submit');
            }) || null;
        }

        function submitSearchInput(input) {
            const trigger = findGlobalSearchTrigger(input);
            if (trigger && typeof trigger.click === 'function') {
                trigger.click();
                return;
            }

            const form = input.closest('form');
            if (form && typeof form.requestSubmit === 'function') {
                form.requestSubmit();
                return;
            }

            if (form && typeof form.submit === 'function') {
                form.submit();
                return;
            }

            const eventOptions = {
                bubbles: true,
                cancelable: true,
                key: 'Enter',
                code: 'Enter',
                keyCode: 13,
                which: 13
            };
            input.dispatchEvent(new KeyboardEvent('keydown', eventOptions));
            input.dispatchEvent(new KeyboardEvent('keypress', eventOptions));
            input.dispatchEvent(new KeyboardEvent('keyup', eventOptions));
        }

        function runNetSuiteSearch(term) {
            const searchTerm = normalizeText(term);
            if (!searchTerm) {
                return;
            }

            const input = findGlobalSearchInput();
            if (!input) {
                showPaletteToast('NetSuite search box not found on this page.');
                return;
            }

            input.focus();
            setNativeInputValue(input, searchTerm);
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            closePalette();
            window.setTimeout(() => {
                submitSearchInput(input);
            }, 60);
        }

        function getFieldIdValue(element) {
            return normalizeText(
                element.getAttribute('data-fieldid') ||
                element.getAttribute('data-ns-fieldid') ||
                element.getAttribute('data-name') ||
                element.name ||
                element.id
            );
        }

        function getFieldLabel(element) {
            const explicitLabel = element.id ? document.querySelector(`label[for="${element.id}"]`) : null;
            if (explicitLabel && normalizeText(explicitLabel.textContent)) {
                return normalizeText(explicitLabel.textContent);
            }

            const row = element.closest('tr');
            if (row) {
                const labelish = row.querySelector('label, th, td.smalltextnolink, span.uir-label');
                if (labelish && labelish !== element && normalizeText(labelish.textContent)) {
                    return normalizeText(labelish.textContent);
                }
            }

            const previous = element.closest('td,div,span')?.previousElementSibling;
            if (previous && normalizeText(previous.textContent)) {
                return normalizeText(previous.textContent);
            }

            return normalizeText(element.getAttribute('aria-label')) || normalizeText(element.placeholder) || 'Field';
        }

        function clearFieldIdOverlay() {
            state.fieldIdBadges.forEach((badge) => badge.remove());
            state.fieldIdBadges = [];
            state.fieldIdsVisible = false;
        }

        function positionFieldIdOverlay() {
            state.fieldIdBadges.forEach(({ badge, target }) => {
                if (!isVisibleElement(target)) {
                    badge.hidden = true;
                    return;
                }

                const rect = target.getBoundingClientRect();
                badge.hidden = false;
                badge.style.top = `${Math.max(8, window.scrollY + rect.top - 10)}px`;
                badge.style.left = `${Math.max(8, window.scrollX + rect.left + 8)}px`;
            });
        }

        function buildFieldIdOverlay() {
            clearFieldIdOverlay();

            const controls = Array.from(document.querySelectorAll('input, select, textarea')).filter((element) => {
                if (!isVisibleElement(element) || ui.overlay.contains(element)) {
                    return false;
                }

                const type = String(element.getAttribute('type') || '').toLowerCase();
                if (['hidden', 'button', 'submit', 'reset', 'radio', 'checkbox'].includes(type)) {
                    return false;
                }

                return !!getFieldIdValue(element);
            });

            const uniqueTargets = [];
            const seenKeys = new Set();
            controls.forEach((element) => {
                const key = `${getFieldIdValue(element)}::${getFieldLabel(element)}`;
                if (seenKeys.has(key)) {
                    return;
                }
                seenKeys.add(key);
                uniqueTargets.push(element);
            });

            uniqueTargets.forEach((element) => {
                const badge = document.createElement('div');
                badge.className = 'suitesense-field-id-badge';
                badge.textContent = `${getFieldLabel(element)}: ${getFieldIdValue(element)}`;
                badge.title = badge.textContent;
                document.body.appendChild(badge);
                state.fieldIdBadges.push({ badge, target: element });
            });

            state.fieldIdsVisible = true;
            positionFieldIdOverlay();

            if (!state.fieldIdListenersBound) {
                state.fieldIdListenersBound = true;
                window.addEventListener('resize', () => {
                    if (state.fieldIdsVisible) {
                        positionFieldIdOverlay();
                    }
                });
                window.addEventListener('scroll', () => {
                    if (state.fieldIdsVisible) {
                        positionFieldIdOverlay();
                    }
                }, true);
            }
        }

        function toggleFieldIdOverlay() {
            if (state.fieldIdsVisible) {
                clearFieldIdOverlay();
                closePalette();
                showPaletteToast('Field IDs hidden.');
                refreshCommands();
                return;
            }

            buildFieldIdOverlay();
            closePalette();
            showPaletteToast('Field IDs shown on the page.');
            refreshCommands();
        }

        function command(id, group, title, subtitle, keywords, run) {
            return { id, group, title, subtitle, keywords, run };
        }

        function buildResolvedIdCommands() {
            if (!state.idResolution || !Array.isArray(state.idResolution.matches) || !state.idResolution.matches.length) {
                return [];
            }

            return state.idResolution.matches.map((match) => {
                const typeLabel = normalizeText(match.recordTypeLabel || match.recordType || 'Record');
                const displayTitle = normalizeText(match.title || match.name || `${typeLabel} ${match.internalId || ''}`) || typeLabel;
                const subtitleParts = [typeLabel];
                if (match.internalId) {
                    subtitleParts.push(`ID ${match.internalId}`);
                }
                if (match.subtitle) {
                    subtitleParts.push(match.subtitle);
                }

                return command(
                    `open-resolved-id-${typeLabel}-${match.internalId}-${match.url}`,
                    'ID Matches',
                    displayTitle,
                    subtitleParts.join(' · '),
                    ['id match', String(match.internalId || ''), typeLabel, displayTitle],
                    () => openNetSuiteUrl(match.url)
                );
            });
        }

        function buildScriptSearchCommands() {
            if (!state.scriptSearch || !Array.isArray(state.scriptSearch.matches) || !state.scriptSearch.matches.length) {
                return [];
            }

            return state.scriptSearch.matches.map((match) => {
                const scriptName = normalizeText(match.name || match.title || 'SuiteScript');
                const scriptId = normalizeText(match.scriptId || match.scriptid || '');
                const subtitleParts = [];
                if (scriptId) {
                    subtitleParts.push(scriptId);
                }
                if (match.typeLabel) {
                    subtitleParts.push(match.typeLabel);
                }

                return command(
                    `open-script-${scriptId || scriptName}-${match.internalId || ''}`,
                    'Script Matches',
                    scriptName,
                    subtitleParts.join(' · ') || 'Open SuiteScript record',
                    ['script', scriptName, scriptId, match.typeLabel || ''],
                    () => openNetSuiteUrl(match.url)
                );
            });
        }

        function buildCommandList(query) {
            const currentRecord = parseCurrentRecordContext();
            const commands = [
                command('open-side-panel', 'Tools', 'Open Suitesense Side Panel', 'Bring the extension side panel into view for this tab.', ['panel', 'sidebar', 'extension'], openSuitesensePanel),
                command('fetch-current-fields', 'Tools', 'Fetch Current Record Fields', 'Open a structured field dump for the current record.', ['fields', 'record', 'xml', 'json'], fetchCurrentFields),
                command('toggle-field-ids', 'Tools', state.fieldIdsVisible ? 'Hide Field IDs' : 'Show Field IDs', 'Toggle lightweight field id badges directly on the page.', ['field ids', 'inspect', 'labels'], toggleFieldIdOverlay),
                command('copy-page-url', 'Current Page', 'Copy Current Page URL', 'Copy the current NetSuite URL to the clipboard.', ['copy', 'url', 'link'], () => copyTextToClipboard(window.location.href, 'Current page URL copied.')),
                command('new-sales-order', 'Navigation', 'New Sales Order', 'Open a new sales order.', ['sales order', 'new transaction'], () => openNetSuiteUrl(`https://${accountId}.app.netsuite.com/app/accounting/transactions/salesord.nl?whence=`)),
                command('new-purchase-order', 'Navigation', 'New Purchase Order', 'Open a new purchase order.', ['purchase order', 'new transaction'], () => openNetSuiteUrl(`https://${accountId}.app.netsuite.com/app/accounting/transactions/purchord.nl?whence=`)),
                command('new-customer', 'Navigation', 'New Customer', 'Open a new customer record.', ['customer', 'entity', 'new'], () => openNetSuiteUrl(`https://${accountId}.app.netsuite.com/app/common/entity/custjob.nl?whence=`)),
                command('open-invoice-list', 'Navigation', 'Open Invoice List', 'Jump to the invoice transaction list.', ['invoices', 'transaction list', 'ar'], () => openNetSuiteUrl(`https://${accountId}.app.netsuite.com/app/accounting/transactions/transactionlist.nl?Transaction_TYPE=CustInvc&whence=`)),
                command('script-upload', 'Admin', 'Go to Script File Upload', 'Open the SuiteScript file upload screen.', ['script', 'upload', 'file cabinet'], () => openNetSuiteUrl(`https://${accountId}.app.netsuite.com/app/common/scripting/uploadScriptFile.nl`)),
                command('script-deployments', 'Admin', 'Go to Script Deployments', 'Open the script deployments list.', ['script deployments', 'deployment', 'suitescript'], () => openNetSuiteUrl(`https://${accountId}.app.netsuite.com/app/common/scripting/scriptrecordlist.nl?whence=`)),
                command('run-open-invoices-query', 'Queries', 'Run Query: Open Invoices', 'Run a starter SuiteQL query for invoice records.', ['query', 'suiteql', 'invoices'], () => runPaletteQuery(`SELECT id, tranid, trandate, entity, foreigntotal, status FROM transaction WHERE type = 'CustInvc' AND ROWNUM <= 25`, 'Running the open invoices SuiteQL query...')),
                command('run-customers-query', 'Queries', 'Run Query: Customers', 'Run a starter SuiteQL query for customer records.', ['query', 'suiteql', 'customers'], () => runPaletteQuery(`SELECT id, entityid, companyname, email FROM customer WHERE ROWNUM <= 25`, 'Running the customer SuiteQL query...'))
            ];

            if (currentRecord.id) {
                commands.unshift(command('copy-current-record', 'Current Page', `Copy Current ${currentRecord.label || 'Record'} Info`, 'Copy record type, id, title, and URL to the clipboard.', ['copy record', 'record info', 'metadata'], () => {
                    copyTextToClipboard(JSON.stringify({
                        accountId,
                        title: currentRecord.title,
                        recordType: currentRecord.label || 'Unknown',
                        recordId: currentRecord.id,
                        url: currentRecord.url
                    }, null, 2), `${currentRecord.label || 'Record'} info copied.`);
                }));

                commands.unshift(command('open-current-record-edit', 'Current Page', `Open Current ${currentRecord.label || 'Record'} In Edit Mode`, 'Switch the current record into edit mode.', ['edit record', 'current record'], () => {
                    const editUrl = new URL(currentRecord.url);
                    editUrl.searchParams.set('e', 'T');
                    openNetSuiteUrl(editUrl.toString());
                }));
            }

            const searchTerm = normalizeText(query);
            if (searchTerm) {
                const openCustomerMatch = searchTerm.match(/^open customer (.+)$/i);
                const openIdMatch = searchTerm.match(/^(?:open\s+id|id)\s+(\d+)$/i);
                const scriptSearchMatch = searchTerm.match(/^(?:script|open script)\s+(.+)$/i);
                if (openCustomerMatch) {
                    const customerTerm = normalizeText(openCustomerMatch[1]);
                    commands.unshift(command(`search-customer-${customerTerm}`, 'Search', `Open Customer "${customerTerm}"`, 'Find the matching customer record and open it directly.', ['customer search', customerTerm, 'open customer'], () => openCustomerByName(customerTerm)));
                } else if (openIdMatch) {
                    const resolvedId = openIdMatch[1];
                    commands.unshift(command(`resolve-id-${resolvedId}`, 'Search', `Open Internal ID ${resolvedId}`, 'Resolve this internal ID across common NetSuite record types.', ['open id', 'internal id', resolvedId], () => resolveInternalId(resolvedId)));
                } else if (scriptSearchMatch) {
                    const scriptTerm = normalizeText(scriptSearchMatch[1]);
                    commands.unshift(command(`search-script-${scriptTerm}`, 'Search', `Find Script "${scriptTerm}"`, 'Search SuiteScript records by name or script ID.', ['script search', scriptTerm, 'suitescript'], () => searchSuiteScripts(scriptTerm)));
                } else {
                    if (looksLikeSuiteScriptQuery(searchTerm)) {
                        commands.unshift(command(`search-script-inferred-${searchTerm}`, 'Search', `Find Script "${searchTerm}"`, 'Search SuiteScript records by name or script ID.', ['script search', searchTerm, 'suitescript'], () => searchSuiteScripts(searchTerm)));
                    } else {
                        commands.unshift(command(`search-global-${searchTerm}`, 'Search', `Search NetSuite For "${searchTerm}"`, 'Use the native NetSuite search box with your current text.', ['search', 'global search', searchTerm], () => runNetSuiteSearch(searchTerm)));
                    }
                }
            }

            return commands;
        }

        function scoreCommand(item, query) {
            if (!query) {
                return -1;
            }

            const normalizedQuery = normalizeText(query).toLowerCase();
            const keywords = `${item.title} ${item.subtitle} ${(item.keywords || []).join(' ')}`.toLowerCase();
            const title = item.title.toLowerCase();
            let score = -1;

            if (title === normalizedQuery) {
                score = 1200;
            } else if (title.startsWith(normalizedQuery)) {
                score = 950;
            } else if (keywords.includes(normalizedQuery)) {
                score = 720 - keywords.indexOf(normalizedQuery);
            } else {
                const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean);
                if (queryTokens.length && queryTokens.every((token) => keywords.includes(token))) {
                    score = 420 - queryTokens.length * 5;
                }
            }

            const recentIndex = state.recentIds.indexOf(item.id);
            if (score >= 0 && recentIndex !== -1) {
                score += 80 - recentIndex * 5;
            }

            return score;
        }

        function renderCommands() {
            if (!state.commands.length) {
                const hasQuery = !!normalizeText(state.query);
                ui.results.innerHTML = `
                    <div class="suitesense-commandpalette-empty">
                        <div class="suitesense-commandpalette-empty-title">${hasQuery ? 'No commands found' : 'Start typing a command'}</div>
                        <div class="suitesense-commandpalette-empty-copy">${hasQuery ? 'Try a broader term like "invoice", "script", "fields", or "customer".' : 'Try things like "open customer acme", "id 324", "show field ids", or "script deployments".'}</div>
                    </div>
                `;
                return;
            }

            ui.results.innerHTML = state.commands.map((item, index) => `
                <button type="button" class="suitesense-commandpalette-item${index === state.selectedIndex ? ' is-active' : ''}" data-command-id="${escapeHtml(item.id)}">
                    <span class="suitesense-commandpalette-item-main">
                        <span class="suitesense-commandpalette-item-title">${escapeHtml(item.title)}</span>
                        <span class="suitesense-commandpalette-item-copy">${escapeHtml(item.subtitle)}</span>
                    </span>
                    <span class="suitesense-commandpalette-item-group">${escapeHtml(item.group)}</span>
                </button>
            `).join('');

            const activeItem = ui.results.querySelector('.suitesense-commandpalette-item.is-active');
            if (activeItem && typeof activeItem.scrollIntoView === 'function') {
                activeItem.scrollIntoView({ block: 'nearest' });
            }
        }

        function refreshCommands() {
            const available = buildCommandList(state.query);
            const rankedCommands = available
                .map((item) => ({ item, score: scoreCommand(item, state.query) }))
                .filter((entry) => entry.score >= 0)
                .sort((left, right) => right.score - left.score || left.item.title.localeCompare(right.item.title))
                .map((entry) => entry.item);

            const normalizedQuery = normalizeText(state.query);
            const resolvedCommands = state.idResolution && state.idResolution.query === normalizedQuery
                ? buildResolvedIdCommands()
                : [];
            const scriptCommands = state.scriptSearch && state.scriptSearch.query === normalizedQuery
                ? buildScriptSearchCommands()
                : [];

            state.commands = [
                ...resolvedCommands,
                ...scriptCommands,
                ...rankedCommands.filter((item) => !resolvedCommands.some((resolved) => resolved.id === item.id) && !scriptCommands.some((scriptCommand) => scriptCommand.id === item.id))
            ];

            if (state.selectedIndex >= state.commands.length) {
                state.selectedIndex = 0;
            }

            renderCommands();
        }

        function openPalette(initialQuery = '') {
            state.isOpen = true;
            state.query = initialQuery;
            ui.overlay.hidden = false;
            document.documentElement.classList.add('suitesense-commandpalette-open');
            ui.input.value = initialQuery;
            state.selectedIndex = 0;
            refreshCommands();
            window.setTimeout(() => ui.input.focus(), 0);
        }

        function closePalette() {
            state.isOpen = false;
            ui.overlay.hidden = true;
            document.documentElement.classList.remove('suitesense-commandpalette-open');
        }

        function executeSelectedCommand() {
            const commandToRun = state.commands[state.selectedIndex];
            if (!commandToRun) {
                return;
            }

            rememberCommand(commandToRun.id);
            commandToRun.run();
        }

        ui.input.addEventListener('input', () => {
            state.query = ui.input.value;
            if (!state.idResolution || state.idResolution.query !== normalizeText(state.query)) {
                state.idResolution = null;
            }
            if (!state.scriptSearch || state.scriptSearch.query !== normalizeText(state.query)) {
                state.scriptSearch = null;
            }
            state.selectedIndex = 0;
            refreshCommands();
        });

        ui.input.addEventListener('keydown', (event) => {
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                if (state.commands.length) {
                    state.selectedIndex = Math.min(state.selectedIndex + 1, state.commands.length - 1);
                    renderCommands();
                }
                return;
            }

            if (event.key === 'ArrowUp') {
                event.preventDefault();
                if (state.commands.length) {
                    state.selectedIndex = Math.max(state.selectedIndex - 1, 0);
                    renderCommands();
                }
                return;
            }

            if (event.key === 'Enter') {
                event.preventDefault();
                executeSelectedCommand();
            }
        });

        ui.closeButton.addEventListener('click', closePalette);
        ui.overlay.addEventListener('click', (event) => {
            if (event.target === ui.overlay) {
                closePalette();
            }
        });

        ui.results.addEventListener('mousemove', (event) => {
            const target = event.target.closest('.suitesense-commandpalette-item');
            if (!target) {
                return;
            }

            const nextIndex = state.commands.findIndex((item) => item.id === target.dataset.commandId);
            if (nextIndex !== -1 && nextIndex !== state.selectedIndex) {
                state.selectedIndex = nextIndex;
                renderCommands();
            }
        });

        ui.results.addEventListener('click', (event) => {
            const target = event.target.closest('.suitesense-commandpalette-item');
            if (!target) {
                return;
            }

            const nextIndex = state.commands.findIndex((item) => item.id === target.dataset.commandId);
            if (nextIndex !== -1) {
                state.selectedIndex = nextIndex;
                executeSelectedCommand();
            }
        });

        document.addEventListener('keydown', (event) => {
            const isPaletteShortcut = (event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'k';
            if (isPaletteShortcut) {
                event.preventDefault();
                if (state.isOpen) {
                    closePalette();
                } else {
                    openPalette('');
                }
                return;
            }

            if (!state.isOpen) {
                return;
            }

            if (event.key === 'Escape') {
                event.preventDefault();
                closePalette();
            }
        });

        window.addEventListener('message', (event) => {
            if (event.source !== window || !event.data) {
                return;
            }

            if (event.data.type === 'COMMAND_PALETTE_ACTION_RESULT' && event.data.message) {
                showPaletteToast(String(event.data.message));
                return;
            }

            if (event.data.type === 'INTERNAL_ID_RESOLUTION_RESULT') {
                const matches = Array.isArray(event.data.matches) ? event.data.matches : [];
                const resolutionQuery = normalizeText(state.query);

                if (!matches.length) {
                    showPaletteToast(`No record found for internal ID ${event.data.internalId || ''}.`);
                    state.idResolution = null;
                    refreshCommands();
                    return;
                }

                if (matches.length === 1 && matches[0].url) {
                    openNetSuiteUrl(matches[0].url);
                    return;
                }

                state.idResolution = {
                    query: resolutionQuery,
                    matches
                };
                state.selectedIndex = 0;
                if (!state.isOpen) {
                    openPalette(state.query);
                    return;
                }
                refreshCommands();
                showPaletteToast(`Found ${matches.length} records for internal ID ${event.data.internalId || ''}. Choose one.`);
                return;
            }

            if (event.data.type === 'SCRIPT_SEARCH_RESULT') {
                const matches = Array.isArray(event.data.matches) ? event.data.matches : [];
                const searchQuery = normalizeText(state.query);

                if (!matches.length) {
                    showPaletteToast(`No scripts found for "${event.data.scriptTerm || searchQuery}".`);
                    state.scriptSearch = null;
                    refreshCommands();
                    return;
                }

                if (matches.length === 1 && matches[0].url) {
                    openNetSuiteUrl(matches[0].url);
                    return;
                }

                state.scriptSearch = {
                    query: searchQuery,
                    matches
                };
                state.selectedIndex = 0;
                if (!state.isOpen) {
                    openPalette(state.query);
                    return;
                }
                refreshCommands();
                showPaletteToast(`Found ${matches.length} scripts for "${event.data.scriptTerm || searchQuery}". Choose one.`);
            }
        });

        getCommandPaletteOpenInNewTabPreference().then((enabled) => {
            state.openNavigationInNewTab = enabled !== false;
        });

        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName !== 'local' || !changes[COMMAND_PALETTE_NEW_TAB_SETTING_KEY]) {
                return;
            }

            state.openNavigationInNewTab = changes[COMMAND_PALETTE_NEW_TAB_SETTING_KEY].newValue !== false;
        });

        refreshCommands();
    }

    function buildCommandPaletteUi() {
        const style = document.createElement('style');
        style.textContent = `
            .suitesense-commandpalette-overlay[hidden] { display: none !important; }
            .suitesense-commandpalette-overlay {
                position: fixed;
                inset: 0;
                z-index: 2147483646;
                display: flex;
                align-items: flex-start;
                justify-content: center;
                padding: 28px 20px 24px;
                background: transparent;
                backdrop-filter: none;
            }
            .suitesense-commandpalette {
                width: min(980px, calc(100vw - 180px));
                max-height: min(76vh, 760px);
                overflow: visible;
                border-radius: 0;
                border: 0;
                background: transparent;
                box-shadow: none;
                backdrop-filter: none;
                font-family: "Segoe UI", Arial, sans-serif;
                color: #eef5ff;
            }
            .suitesense-commandpalette-header {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 0;
                background: transparent;
            }
            .suitesense-commandpalette-search {
                flex: 1;
                min-height: 58px;
                border: 1px solid rgba(112, 139, 184, 0.3);
                border-radius: 16px;
                padding: 0 20px;
                background: linear-gradient(180deg, rgba(35, 39, 47, 0.96) 0%, rgba(24, 27, 34, 0.95) 100%);
                color: #ffffff;
                font-size: 18px;
                font-weight: 500;
                outline: none;
                -webkit-text-fill-color: #ffffff;
                box-shadow: 0 16px 40px rgba(8, 12, 20, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.04);
            }
            .suitesense-commandpalette-search::placeholder { color: rgba(255, 255, 255, 0.82); }
            .suitesense-commandpalette-search:focus {
                border-color: rgba(106, 169, 255, 0.55);
                box-shadow: 0 18px 44px rgba(8, 12, 20, 0.18), inset 0 0 0 1px rgba(78, 151, 255, 0.22);
            }
            .suitesense-commandpalette-close {
                min-width: 72px;
                min-height: 58px;
                border: 1px solid rgba(146, 208, 149, 0.18);
                border-radius: 16px;
                padding: 0 18px;
                background: linear-gradient(180deg, rgba(185, 248, 165, 0.92) 0%, rgba(158, 233, 141, 0.92) 100%);
                color: #122312;
                font-size: 14px;
                font-weight: 700;
                cursor: pointer;
                box-shadow: 0 14px 34px rgba(92, 160, 82, 0.18);
            }
            .suitesense-commandpalette-close:hover {
                filter: brightness(1.03);
            }
            .suitesense-commandpalette-close:active {
                transform: translateY(1px);
            }
            .suitesense-commandpalette-close[data-mode="escape"] {
                border: 1px solid rgba(112, 139, 184, 0.26);
                background: linear-gradient(180deg, rgba(52, 57, 67, 0.96) 0%, rgba(37, 41, 49, 0.95) 100%);
                color: #ffffff;
                box-shadow: 0 14px 34px rgba(8, 12, 20, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.03);
            }
            .suitesense-commandpalette-meta {
                display: none;
            }
            .suitesense-commandpalette-results {
                margin-top: 12px;
                padding: 10px 12px 12px;
                overflow: auto;
                max-height: calc(76vh - 96px);
                border-radius: 18px;
                border: 1px solid rgba(106, 129, 166, 0.22);
                background: linear-gradient(180deg, rgba(36, 40, 48, 0.96) 0%, rgba(28, 31, 38, 0.95) 100%);
                box-shadow: 0 18px 42px rgba(8, 12, 20, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.03);
            }
            .suitesense-commandpalette-item {
                width: 100%;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 14px;
                border: 0;
                border-radius: 14px;
                margin: 4px 0;
                padding: 12px 14px;
                text-align: left;
                background: transparent;
                cursor: pointer;
                transition: transform 0.14s ease, background 0.14s ease, box-shadow 0.14s ease;
            }
            .suitesense-commandpalette-item:hover,
            .suitesense-commandpalette-item.is-active {
                background: linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.05) 100%);
                box-shadow: inset 0 0 0 1px rgba(166, 196, 236, 0.12);
                transform: translateY(-1px);
            }
            .suitesense-commandpalette-item-main {
                min-width: 0;
                display: flex;
                flex-direction: column;
                gap: 4px;
            }
            .suitesense-commandpalette-item-title {
                color: #ffffff;
                font-size: 15px;
                font-weight: 700;
            }
            .suitesense-commandpalette-item-copy {
                color: rgba(255, 255, 255, 0.84);
                font-size: 12px;
                line-height: 1.45;
            }
            .suitesense-commandpalette-item-group {
                flex: 0 0 auto;
                border-radius: 999px;
                padding: 6px 10px;
                background: rgba(255, 255, 255, 0.07);
                color: #ffffff;
                font-size: 11px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.06em;
                box-shadow: inset 0 0 0 1px rgba(191, 214, 244, 0.1);
            }
            .suitesense-commandpalette-empty {
                padding: 32px 18px 34px;
                text-align: center;
            }
            .suitesense-commandpalette-empty-title {
                color: #ffffff;
                font-size: 16px;
                font-weight: 700;
            }
            .suitesense-commandpalette-empty-copy {
                margin-top: 8px;
                color: rgba(255, 255, 255, 0.82);
                font-size: 13px;
                line-height: 1.55;
            }
            .suitesense-commandpalette-toast[hidden] { display: none !important; }
            .suitesense-commandpalette-toast {
                position: fixed;
                left: 50%;
                bottom: 22px;
                transform: translate(-50%, 14px);
                z-index: 2147483647;
                padding: 12px 16px;
                border-radius: 999px;
                background: rgba(17, 29, 49, 0.94);
                color: #ffffff;
                font: 600 13px/1.3 "Segoe UI", Arial, sans-serif;
                box-shadow: 0 18px 36px rgba(13, 24, 41, 0.28);
                opacity: 0;
                transition: opacity 0.18s ease, transform 0.18s ease;
                pointer-events: none;
            }
            .suitesense-commandpalette-toast.is-visible {
                opacity: 1;
                transform: translate(-50%, 0);
            }
            .suitesense-field-id-badge {
                position: absolute;
                z-index: 2147483645;
                max-width: 260px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                border-radius: 999px;
                padding: 4px 10px;
                background: rgba(15, 59, 127, 0.94);
                color: #ffffff;
                font: 600 11px/1.3 "Segoe UI", Arial, sans-serif;
                box-shadow: 0 12px 26px rgba(15, 59, 127, 0.26);
                pointer-events: none;
            }
        `;
        document.documentElement.appendChild(style);

        const overlay = document.createElement('div');
        overlay.className = 'suitesense-commandpalette-overlay';
        overlay.hidden = true;
        overlay.innerHTML = `
            <section class="suitesense-commandpalette" role="dialog" aria-modal="true" aria-label="Suitesense Command Palette">
                <div class="suitesense-commandpalette-header">
                    <input class="suitesense-commandpalette-search" type="text" autocomplete="off" placeholder="Type a command, page action, or search..." />
                    <button type="button" class="suitesense-commandpalette-close" data-mode="escape">Esc</button>
                </div>
                <div class="suitesense-commandpalette-meta">
                    <span>Ctrl+K to open. Arrow keys to move. Enter to run.</span>
                    <span>Command Palette for NetSuite</span>
                </div>
                <div class="suitesense-commandpalette-results"></div>
            </section>
        `;
        document.body.appendChild(overlay);

        const toast = document.createElement('div');
        toast.className = 'suitesense-commandpalette-toast';
        toast.hidden = true;
        document.body.appendChild(toast);

        return {
            closeButton: overlay.querySelector('.suitesense-commandpalette-close'),
            input: overlay.querySelector('.suitesense-commandpalette-search'),
            overlay,
            results: overlay.querySelector('.suitesense-commandpalette-results'),
            toast
        };
    }
    console.log('Account ID:', accountId);
    saveToIndexedDB('accountId', accountId);

    chrome.runtime.sendMessage({ type: 'ACCOUNT_ID', accountId }, (response) => {
        if (chrome.runtime.lastError) {
            console.debug('Unable to save account ID:', chrome.runtime.lastError.message);
            return;
        }

        if (response?.status) {
            console.log(response.status);
        }
    });

    getInlineEnhancementsPreference().then((enabled) => {
        injectInlineEnhancementsPreference(enabled);
        injectPageScript();
    });

    initializeExecutionLogLinkEnhancer();
    initializeCommandPalette();

    chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== 'local' || !changes[INLINE_ENHANCEMENTS_SETTING_KEY]) {
            return;
        }

        postInlineEnhancementsPreference(changes[INLINE_ENHANCEMENTS_SETTING_KEY].newValue !== false);
    });

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (!message || !message.type) {
            return;
        }

        if (message.type === 'RUN_QUERY') {
            window.postMessage({ type: 'RUN_QUERY', query: message.query }, '*');
            sendResponse({ ok: true });
            return;
        }

        if (message.type === 'RUN_CUSTOM_SCRIPT') {
            window.postMessage({ type: 'RUN_CUSTOM_SCRIPT', script: message.script }, '*');
            sendResponse({ ok: true });
            return;
        }

        if (message.type === 'FETCH_ALL_FIELDS') {
            window.postMessage({ type: 'FETCH_ALL_FIELDS' }, '*');
            sendResponse({ ok: true });
            return;
        }

        if (message.type === 'SET_INLINE_ENHANCEMENTS_ENABLED') {
            postInlineEnhancementsPreference(message.enabled !== false);
            sendResponse({ ok: true });
            return;
        }

        if (message.type === 'RUN_UNAPPLIED_PAYMENTS_CHECK') {
            window.postMessage({ type: 'RUN_UNAPPLIED_PAYMENTS_CHECK' }, '*');
            sendResponse({ ok: true });
            return;
        }

        if (message.type === 'SEND_TO_SALESFORCE') {
            window.postMessage({ type: 'SEND_TO_SALESFORCE', customerId: message.customerId }, '*');
            sendResponse({ ok: true });
        }
    });

    window.addEventListener('message', function(event) {
        if (!event.data || !event.data.type) {
            return;
        }

        if (event.source !== window) {
            return;
        }

        if (event.data.type === 'CUSTOM_SCRIPT_RESULT') {
            console.log('Received results from injected script:', event.data.result);
            chrome.runtime.sendMessage({ type: 'CUSTOM_SCRIPT_RESULT', result: event.data.result });
        }

        if (event.data.type === 'FROM_PAGE') {
            console.log('Received results from injected script:', event.data.text);
            chrome.runtime.sendMessage({ type: 'QUERY_RESULTS', data: event.data.text });
        }

        if (event.data.type === 'HIERARCHY_RESULT') {
            console.log('Received hierarchy result:', event.data.hierarchy);
            chrome.runtime.sendMessage({ type: 'OPEN_RESULTS_TAB', hierarchy: event.data.hierarchy });
        }

        if (event.data.type === 'UNAPPLIED_PAYMENTS_RESULT') {
            console.log('Received unapplied payments result:', event.data.text);
            chrome.runtime.sendMessage({ type: 'UNAPPLIED_PAYMENTS_RESULT', data: event.data.text });
        }

        if (event.data.type === 'SALESFORCE_SUCCESS') {
            console.log('Salesforce Account Created:', event.data.text);
            chrome.runtime.sendMessage({ type: 'SALESFORCE_SUCCESS', data: event.data.text });
            const salesforceUrl = '';
            window.location.href = salesforceUrl;
        }

        if (event.data.type === 'FIELDS_FETCHED') {
            console.log('Received fields fetched:', event.data.text);
            chrome.runtime.sendMessage({
                type: 'FIELDS_FETCHED',
                data: typeof event.data.data !== 'undefined' ? event.data.data : event.data.text
            });
        }

        if (event.data.type === 'FIELDS_FETCH_ERROR') {
            console.log('Received field fetch error:', event.data.error);
            chrome.runtime.sendMessage({ type: 'FIELDS_FETCH_ERROR', error: event.data.error });
        }
    });

    document.addEventListener('keydown', function(event) {
        const savedShortcuts = JSON.parse(localStorage.getItem('shortcuts')) || {
            salesOrder: 'Alt+S',
            invoices: 'Alt+I',
            purchaseOrder: 'Alt+P',
            customers: 'Alt+C',
            ScriptUpload: 'Alt+U'
        };

        const isKeyPressed = (shortcut, keyboardEvent) => {
            const [modifier, key] = shortcut.split('+');
            return keyboardEvent[`${modifier.toLowerCase()}Key`] && keyboardEvent.key.toUpperCase() === key.toUpperCase();
        };

        if (isKeyPressed(savedShortcuts.salesOrder, event)) {
            window.open(`https://${accountId}.app.netsuite.com/app/accounting/transactions/salesord.nl?whence=`, '_blank');
        } else if (isKeyPressed(savedShortcuts.invoices, event)) {
            window.open(`https://${accountId}.app.netsuite.com/app/accounting/transactions/transactionlist.nl?Transaction_TYPE=CustInvc&whence=`, '_blank');
        } else if (isKeyPressed(savedShortcuts.purchaseOrder, event)) {
            window.open(`https://${accountId}.app.netsuite.com/app/accounting/transactions/purchord.nl?whence=`, '_blank');
        } else if (isKeyPressed(savedShortcuts.customers, event)) {
            window.open(`https://${accountId}.app.netsuite.com/app/common/entity/custjob.nl?whence=`, '_blank');
        } else if (isKeyPressed(savedShortcuts.ScriptUpload, event)) {
            window.open(`https://${accountId}.app.netsuite.com/app/common/scripting/uploadScriptFile.nl`, '_blank');
        }
    });
}
