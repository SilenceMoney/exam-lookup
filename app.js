// Fast-lookup application logic
document.addEventListener('DOMContentLoaded', () => {
    // Cache DOM Elements
    const searchInput = document.getElementById('search-input');
    const clearBtn = document.getElementById('clear-btn');
    const resultsList = document.getElementById('results-list');
    const totalCountEl = document.getElementById('total-questions-count');
    const matchedCountEl = document.getElementById('matched-count');
    const searchTimeEl = document.getElementById('search-time');
    const resultsMetaEl = document.getElementById('results-meta');
    const subjectFiltersEl = document.getElementById('subject-filters');
    const typeFiltersEl = document.getElementById('type-filters');
    const scrollToTopBtn = document.getElementById('scroll-to-top');
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');

    // Global Database
    const db = window.QUESTION_DATABASE || [];
    
    // Active Filter State
    let activeSubject = 'all';
    let activeType = 'all';
    let searchQuery = '';
    
    // Keyboard navigation state
    let selectedIndex = -1;
    let visibleCards = [];

    // Auto-clear State
    let needClearOnNextInput = false;

    function triggerAutoClear() {
        needClearOnNextInput = true;
        searchInput.focus();
        searchInput.select(); // Highlight the text so typing will replace it
    }

    // Initialize UI
    totalCountEl.textContent = db.length.toLocaleString();
    generateFilters();
    performSearch();

    // Focus input on load
    searchInput.focus();

    // --- Search & Filtering Logic ---
    function performSearch() {
        const startTime = performance.now();
        
        const rawQuery = searchInput.value.trim().toLowerCase();
        searchQuery = rawQuery;
        
        // Split query into space-separated terms for multi-word search
        const queryTerms = rawQuery.split(/\s+/).filter(t => t.length > 0);
        
        const filtered = db.filter(item => {
            // 1. Subject filter
            if (activeSubject !== 'all' && item.subject !== activeSubject) {
                return false;
            }
            
            // 2. Type filter
            if (activeType !== 'all' && item.type !== activeType) {
                return false;
            }
            
            // 3. Keyword matching (all query terms must match)
            if (queryTerms.length > 0) {
                return queryTerms.every(term => {
                    // Match question text
                    if (item.question.toLowerCase().includes(term)) return true;
                    
                    // Match options raw text
                    if (item.options_raw.toLowerCase().includes(term)) return true;
                    
                    // Match pinyin initials
                    if (item.q_initials && item.q_initials.includes(term)) return true;
                    
                    // Match full pinyin
                    if (item.q_full && item.q_full.includes(term)) return true;
                    
                    // Match answer
                    if (item.answer.toLowerCase().includes(term)) return true;
                    
                    // Match subject/type
                    if (item.subject.toLowerCase().includes(term)) return true;
                    if (item.type.toLowerCase().includes(term)) return true;
                    
                    return false;
                });
            }
            
            return true;
        });

        const endTime = performance.now();
        const duration = (endTime - startTime).toFixed(1);
        
        // Update stats
        matchedCountEl.textContent = filtered.length.toLocaleString();
        searchTimeEl.textContent = duration;
        
        // Reset keyboard selection
        selectedIndex = -1;
        
        // Render results (sliced for performance)
        const maxResults = 100;
        const slicedResults = filtered.slice(0, maxResults);
        renderResults(slicedResults, queryTerms);
        
        if (filtered.length > 1 && queryTerms.length > 0) {
            resultsMetaEl.innerHTML = `<span style="color: #f59e0b; font-weight: 800; animation: pulseGlow 1.5s infinite;">⚠️ 检测到相似题干！</span> 请仔细比对 <span class="cond-tag tag-action-shoot" style="font-size:0.75rem; padding: 0.1rem 0.35rem;">🏀 投篮/突破</span>、<span class="cond-tag tag-warn" style="font-size:0.75rem; padding: 0.1rem 0.35rem;">以球为主/以人为主</span> 等发光条件胶囊！`;
        } else if (filtered.length > maxResults) {
            resultsMetaEl.textContent = `已为您展示前 ${maxResults} 条匹配结果（共 ${filtered.length} 条）`;
        } else {
            resultsMetaEl.textContent = `已为您展示所有 ${filtered.length} 条匹配结果`;
        }

        // Keep track of rendered list items for keyboard navigation
        visibleCards = Array.from(resultsList.querySelectorAll('.question-card'));
    }

    // --- Render Cards ---
    function renderResults(questions, queryTerms) {
        resultsList.innerHTML = '';
        
        if (questions.length === 0) {
            resultsList.innerHTML = `
                <div class="no-results">
                    <div class="no-results-icon">📂</div>
                    <h3>没有找到匹配的题目</h3>
                    <p>请尝试减少关键词、检查拼写，或者更改筛选器类别。</p>
                </div>
            `;
            return;
        }
        
        questions.forEach((q, idx) => {
            const card = document.createElement('div');
            card.className = 'question-card';
            card.dataset.index = idx;
            card.dataset.id = q.id;
            
            // Generate tags
            const typeClass = getTypeClass(q.type);
            const typeBadge = `<span class="badge ${typeClass}">${q.type}</span>`;
            const subjectBadge = `<span class="badge subject">${q.subject}</span>`;
            
            // Highlighted question text
            let highlightedQuestion = highlightText(q.question, queryTerms);
            highlightedQuestion = parseConditionTags(highlightedQuestion);
            
            let optionsHtml = '';
            let directAnswerHtml = '';
            
            // Correct options parsing
            const correctKeys = parseAnswerKeys(q.answer, q.type);
            
            if (q.type === '单选题' || q.type === '多选题') {
                if (q.options && q.options.length > 0) {
                    optionsHtml = `<div class="options-list">`;
                    q.options.forEach(opt => {
                        const isCorrect = correctKeys.includes(opt.key);
                        const correctClass = isCorrect ? 'correct' : '';
                        let highlightedOptText = highlightText(opt.text, queryTerms);
                        highlightedOptText = parseConditionTags(highlightedOptText);
                        
                        optionsHtml += `
                            <div class="option-item ${correctClass}">
                                <div class="option-letter">${opt.key}</div>
                                <div class="option-text">${highlightedOptText}</div>
                            </div>
                        `;
                    });
                    optionsHtml += `</div>`;
                } else {
                    // Fallback if options failed to parse but text exists
                    let highlightedOptionsRaw = highlightText(q.options_raw, queryTerms);
                    highlightedOptionsRaw = parseConditionTags(highlightedOptionsRaw);
                    optionsHtml = `
                        <div style="margin-bottom: 1rem; color: var(--text-secondary); line-height: 1.5; font-size: 0.95rem; background: rgba(255,255,255,0.02); padding: 0.75rem 1rem; border-radius: 10px; border: 1px solid var(--border-color);">
                            <strong>选项内容:</strong> ${highlightedOptionsRaw}
                        </div>
                    `;
                    
                    let highlightedAnswer = highlightText(q.answer, queryTerms);
                    highlightedAnswer = parseConditionTags(highlightedAnswer);
                    directAnswerHtml = `
                        <div class="direct-answer-container">
                            <span class="direct-answer-label">参考答案</span>
                            <span class="direct-answer-text">${highlightedAnswer}</span>
                        </div>
                    `;
                }
            } else {
                // 判断题 or 填空题
                let highlightedAnswer = highlightText(q.answer, queryTerms);
                highlightedAnswer = parseConditionTags(highlightedAnswer);
                directAnswerHtml = `
                    <div class="direct-answer-container">
                        <span class="direct-answer-label">正确答案</span>
                        <span class="direct-answer-text">${highlightedAnswer}</span>
                    </div>
                `;
            }
            
            card.innerHTML = `
                <div class="card-header">
                    <span class="card-id">#${q.id}</span>
                    <div class="tag-container">
                        ${subjectBadge}
                        ${typeBadge}
                    </div>
                </div>
                <div class="question-text">${highlightedQuestion}</div>
                ${optionsHtml}
                ${directAnswerHtml}
                <div class="card-actions">
                    <button class="action-btn copy-q" data-id="${q.id}">复制题目</button>
                    <button class="action-btn copy-answer" data-id="${q.id}">复制答案</button>
                </div>
            `;
            
            // Add click handlers for buttons
            card.querySelector('.copy-q').addEventListener('click', (e) => {
                e.stopPropagation();
                copyToClipboard(q.question, '题目复制成功！');
            });
            
            card.querySelector('.copy-answer').addEventListener('click', (e) => {
                e.stopPropagation();
                copyToClipboard(q.answer, `答案 [${q.answer}] 已复制到剪贴板！`);
                triggerAutoClear();
            });
            
            // Click card to select
            card.addEventListener('click', () => {
                selectCard(idx);
            });
            
            resultsList.appendChild(card);
        });
    }

    // Helper: Highlight Search Terms
    function highlightText(text, terms) {
        if (!text || terms.length === 0) return text;
        
        let highlighted = text;
        // Escape special regex chars
        const escapedTerms = terms.map(term => term.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
        
        // Sort terms by length descending to match longer combinations first
        escapedTerms.sort((a, b) => b.length - a.length);
        
        escapedTerms.forEach(term => {
            if (term.trim() === '') return;
            const regex = new RegExp(`(${term})`, 'gi');
            highlighted = highlighted.replace(regex, '<mark>$1</mark>');
        });
        
        return highlighted;
    }

    // Helper: Replace text only outside HTML tags to avoid breaking tag attributes
    function replaceTextOutsideTags(html, searchRegExp, replaceTemplate) {
        const parts = html.split(/(<[^>]+>)/g);
        for (let i = 0; i < parts.length; i++) {
            if (i % 2 === 0) { // Text node, safe to replace
                parts[i] = parts[i].replace(searchRegExp, replaceTemplate);
            }
        }
        return parts.join('');
    }

    // Helper: Add colored neon tags to key conditions (gender, grade, metrics) to make similar questions pop out
    function parseConditionTags(html) {
        if (!html) return html;
        let parsed = html;
        
        // 1. Gender Conditions (boys are neon blue, girls are neon pink/rose)
        parsed = replaceTextOutsideTags(parsed, /(男生|男子|男)/g, '<span class="cond-tag tag-boy">♂ $1</span>');
        parsed = replaceTextOutsideTags(parsed, /(女生|女子|女)/g, '<span class="cond-tag tag-girl">♀ $1</span>');
        
        // 2. Grades/Years (Grade 1/2 is yellow, Grade 3/4 is orange)
        parsed = replaceTextOutsideTags(parsed, /(大一大二)/g, '<span class="cond-tag tag-g12">$1</span>');
        parsed = replaceTextOutsideTags(parsed, /(大三大四)/g, '<span class="cond-tag tag-g34">$1</span>');
        
        // 3. Basketball Specific Actions (Shoot vs Drive)
        parsed = replaceTextOutsideTags(parsed, /(投篮)/g, '<span class="cond-tag tag-action-shoot">🏀 $1</span>');
        parsed = replaceTextOutsideTags(parsed, /(突破)/g, '<span class="cond-tag tag-action-drive">⚡ $1</span>');
        
        // 4. Basketball Principles Traps (Ball-oriented vs Person-oriented)
        parsed = replaceTextOutsideTags(parsed, /(以球为主)/g, '<span class="cond-tag tag-warn">⚠️ $1</span>');
        parsed = replaceTextOutsideTags(parsed, /(以人为主)/g, '<span class="cond-tag tag-ok">✓ $1</span>');
        parsed = replaceTextOutsideTags(parsed, /(不允许|犯规已达6次)/g, '<span class="cond-tag tag-warn">$1</span>');
        parsed = replaceTextOutsideTags(parsed, /(允许)/g, '<span class="cond-tag tag-ok">$1</span>');
        
        // 5. Special metric distance values and numbers
        parsed = replaceTextOutsideTags(parsed, /(800\s*米|1000\s*米|50\s*米|2\s*分|3\s*分|两\s*分|三\s*分|罚\s*球)/g, '<span class="cond-tag tag-num">$1</span>');
        
        return parsed;
    }

    // Helper: Determine badge class
    function getTypeClass(type) {
        switch (type) {
            case '单选题': return 'type-single';
            case '多选题': return 'type-multiple';
            case '判断题': return 'type-judge';
            case '填空题': return 'type-blank';
            default: return 'type-single';
        }
    }

    // Helper: Parse keys (e.g. "A、B" -> ["A", "B"])
    function parseAnswerKeys(answer, type) {
        if (!answer || (type !== '单选题' && type !== '多选题')) return [];
        
        // Match standard letters A-G
        const keys = answer.match(/[A-G]/g) || [];
        return keys;
    }

    // --- Filters Generation & Event Handlers ---
    function generateFilters() {
        const subjectCounts = {};
        const typeCounts = {};
        
        // Count frequencies in database
        db.forEach(item => {
            subjectCounts[item.subject] = (subjectCounts[item.subject] || 0) + 1;
            typeCounts[item.type] = (typeCounts[item.type] || 0) + 1;
        });

        // Set total count inside "All" buttons
        const allSubjBtn = document.getElementById('count-subj-all').closest('.filter-pill');
        const allTypeBtn = document.getElementById('count-type-all').closest('.filter-pill');
        
        allSubjBtn.addEventListener('click', () => handleFilterClick(allSubjBtn, 'subject', 'all'));
        allTypeBtn.addEventListener('click', () => handleFilterClick(allTypeBtn, 'type', 'all'));

        document.getElementById('count-subj-all').textContent = db.length;
        document.getElementById('count-type-all').textContent = db.length;

        // Render Subject Filters
        Object.entries(subjectCounts).forEach(([subject, count]) => {
            const btn = document.createElement('button');
            btn.className = 'filter-pill';
            btn.dataset.filter = subject;
            btn.dataset.type = 'subject';
            btn.innerHTML = `${subject} <span class="count">${count}</span>`;
            
            btn.addEventListener('click', () => handleFilterClick(btn, 'subject', subject));
            subjectFiltersEl.appendChild(btn);
        });

        // Render Type Filters
        Object.entries(typeCounts).forEach(([type, count]) => {
            const btn = document.createElement('button');
            btn.className = 'filter-pill';
            btn.dataset.filter = type;
            btn.dataset.type = 'type';
            btn.innerHTML = `${type} <span class="count">${count}</span>`;
            
            btn.addEventListener('click', () => handleFilterClick(btn, 'type', type));
            typeFiltersEl.appendChild(btn);
        });
    }

    function handleFilterClick(element, category, filterValue) {
        // Remove active class from sibling pills
        const container = category === 'subject' ? subjectFiltersEl : typeFiltersEl;
        container.querySelectorAll('.filter-pill').forEach(btn => btn.classList.remove('active'));
        
        // Add active to current
        element.classList.add('active');
        
        // Update state
        if (category === 'subject') {
            activeSubject = filterValue;
        } else {
            activeType = filterValue;
        }
        
        // Recalculate and focus
        performSearch();
        searchInput.focus();
    }

    // --- Clipboard & Toast Utilities ---
    function copyToClipboard(text, message) {
        if (!text) return;
        
        // Standard copy to clipboard
        navigator.clipboard.writeText(text).then(() => {
            showToast(message);
        }).catch(err => {
            // Fallback
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            try {
                document.execCommand('copy');
                showToast(message);
            } catch (e) {
                console.error('Copy failed:', e);
            }
            document.body.removeChild(textarea);
        });
    }

    function showToast(message) {
        toastMessage.textContent = message;
        toast.classList.add('show');
        
        // Clear previous timeout if any
        if (window.toastTimeout) {
            clearTimeout(window.toastTimeout);
        }
        
        window.toastTimeout = setTimeout(() => {
            toast.classList.remove('show');
        }, 2000);
    }

    // --- Keyboard Navigation ---
    function selectCard(index) {
        if (visibleCards.length === 0) return;
        
        // Remove selection from previous card
        visibleCards.forEach(c => c.classList.remove('selected'));
        
        // Clamp index
        if (index < 0) index = 0;
        if (index >= visibleCards.length) index = visibleCards.length - 1;
        
        selectedIndex = index;
        const selectedCard = visibleCards[selectedIndex];
        selectedCard.classList.add('selected');
        
        // Smooth scroll into view if not visible
        selectedCard.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest'
        });
    }

    // Key Listeners
    window.addEventListener('keydown', (e) => {
        // 1. ESC key: Clear and focus
        if (e.key === 'Escape') {
            searchInput.value = '';
            performSearch();
            searchInput.focus();
            e.preventDefault();
            return;
        }
        
        // 2. Arrow Down: Navigate list
        if (e.key === 'ArrowDown') {
            if (visibleCards.length > 0) {
                if (selectedIndex < visibleCards.length - 1) {
                    selectCard(selectedIndex + 1);
                } else {
                    selectCard(0); // Wrap around to top
                }
                e.preventDefault();
            }
            return;
        }
        
        // 3. Arrow Up: Navigate list
        if (e.key === 'ArrowUp') {
            if (visibleCards.length > 0) {
                if (selectedIndex > 0) {
                    selectCard(selectedIndex - 1);
                } else {
                    selectCard(visibleCards.length - 1); // Wrap around to bottom
                }
                e.preventDefault();
            }
            return;
        }
        
        // 4. Enter key inside Search or inside window: Copy current selected answer
        if (e.key === 'Enter') {
            if (selectedIndex !== -1 && visibleCards[selectedIndex]) {
                const id = parseInt(visibleCards[selectedIndex].dataset.id);
                const questionObj = db.find(q => q.id === id);
                if (questionObj) {
                    copyToClipboard(questionObj.answer, `答案 [${questionObj.answer}] 已复制到剪贴板！`);
                    triggerAutoClear();
                }
                e.preventDefault();
            } else if (visibleCards.length > 0) {
                // If nothing selected but there are results, copy first result's answer
                const id = parseInt(visibleCards[0].dataset.id);
                const questionObj = db.find(q => q.id === id);
                if (questionObj) {
                    selectCard(0);
                    copyToClipboard(questionObj.answer, `答案 [${questionObj.answer}] 已复制到剪贴板！`);
                    triggerAutoClear();
                }
                e.preventDefault();
            }
        }
    });

    // Search input change handler
    searchInput.addEventListener('input', performSearch);

    // Listen keypress: if we need to auto-clear, and it's a character key, clear input first
    searchInput.addEventListener('keydown', (e) => {
        if (needClearOnNextInput && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            searchInput.value = '';
            needClearOnNextInput = false; // Reset flag
        }
    });

    // Reset auto-clear flag if user clicks to edit
    searchInput.addEventListener('click', () => {
        if (needClearOnNextInput) {
            needClearOnNextInput = false;
        }
    });

    // Clear search button
    clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        performSearch();
        searchInput.focus();
        needClearOnNextInput = false;
    });



    // --- Scroll-to-Top Button logic ---
    window.addEventListener('scroll', () => {
        if (window.scrollY > 300) {
            scrollToTopBtn.classList.add('visible');
        } else {
            scrollToTopBtn.classList.remove('visible');
        }
    });

    scrollToTopBtn.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
        searchInput.focus();
    });
});
