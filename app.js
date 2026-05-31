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
        const activeTab = document.querySelector('.tab-btn.active').id;
        if (activeTab === 'tab-search') {
            searchInput.focus();
        }
    });

    // ==========================================================================
    // 📚 Structured Study Mode Implementation
    // ==========================================================================
    
    // 1. Study Categories Definition
    const studyCategories = [
        // Public Foundation
        {
            id: "f1",
            name: "《国家学生体质健康标准》测试与评分",
            isBasketball: false,
            keywords: ["体质健康", "评分", "立定跳远", "坐位体前屈", "800米", "1000米", "中长跑", "身高", "体重", "男生", "女生", "满分", "得分为", "占总", "指标", "达标", "测试项目"],
            facts: [
                "大学生体质健康标准评分组成：身高体重（身体形态）占 15%；肺活量体重指数（身体机能）占 15%；坐位体前屈（柔韧性）占 10%；立定跳远（下肢爆发力）占 10%；50米跑占 20%；引体向上/仰卧起坐占 10%；男生1000米/女生800米（心肺耐力）占 20%。",
                "立定跳远满分标准：大一大二男生 273cm，大三大四男生 275cm；大一大二女生 207cm，大三大四女生 208cm。",
                "肺活量测试：计算肺活量体重指数时，肺活量单位为毫升（ml），测试时保留整数。影响测试结果最显著的因素是身高（胸廓容积）。"
            ]
        },
        {
            id: "f2",
            name: "运动生理学与心肺机能（呼吸、循环系统）",
            isBasketball: false,
            keywords: ["肺活量", "心率", "心跳", "脉搏", "血压", "每搏", "心输出", "安静时", "有氧", "无氧", "有氧代谢", "二氧化碳", "心肺", "靶心率", "呼吸", "气体交换", "血液", "血管"],
            facts: [
                "评价肺活量指数公式：肺活量（ml）÷ 体重（kg）/ 体重g。",
                "优秀运动员安静时心率：一般在 40-50 次/分 左右，比普通人（60-80 次/分）明显偏低，表现出安静时“心动徐缓”现象，具有更强的泵血储备。",
                "每搏输出量与心输出量：经常参加体育锻炼的人左心室心肌发达，收缩有力，安静时每搏输出量比普通人显著增加（可达 80-100 ml）。",
                "有氧运动：是提高心肺功能最有效的锻炼方式。有氧代谢以糖、脂肪等为底物，在充分供氧下氧化，最终副产物为二氧化碳和水。"
            ]
        },
        {
            id: "f3",
            name: "运动解剖学与肌肉系统（骨骼、关节、肌肉）",
            isBasketball: false,
            keywords: ["骨骼", "关节", "肌肉", "韧带", "脊柱", "躯干", "造血", "钙", "磷", "红肌", "白肌", "肌纤维", "杠杆", "枢纽", "动力", "肌力"],
            facts: [
                "骨骼系统：骨骼是人体运动的“杠杆”，具有造血（红骨髓）以及储备钙、磷等矿物质的机能。经常锻炼的同龄大学生平均身高高出 4-8 厘米。",
                "关节系统：关节是运动的“枢纽”，在运动中起到连接、支点和缓冲震荡的作用。关节的灵活性和牢固性通过体育锻炼能得到显著提高。",
                "肌肉系统：肌肉是人体运动的“动力源”，构成人体健美的外在表现。人体共有600多块骨骼肌，分为快肌（白肌，适合爆发力）和慢肌（红肌，适合耐力）纤维。"
            ]
        },
        {
            id: "f4",
            name: "运动供能与能量代谢",
            isBasketball: false,
            keywords: ["新陈代谢", "能量", "供能", "ATP", "糖酵解", "磷酸原", "有氧氧化", "底物", "同化", "异化"],
            facts: [
                "新陈代谢：是物质代谢与能量代谢的总和。同化作用（合成代谢）和异化作用（分解代谢）的平衡决定人体的发育与健康。",
                "三大供能系统：\n" +
                "  1) 磷酸原系统：无氧，极快但容量小，维持 6-8秒，适用于短时间、超高强度运动（如100米、立定跳远）。\n" +
                "  2) 糖酵解系统：无氧，副产物是乳酸，维持 30秒-2分钟，适用于高强度持续运动（如400米跑）。\n" +
                "  3) 有氧氧化系统：有氧，容量极大但速度慢，适用于中低强度、长时间运动（如长跑、有氧操）。"
            ]
        },
        {
            id: "f5",
            name: "身体锻炼的基本原则与科学方法",
            isBasketball: false,
            keywords: ["锻炼原则", "指导性原则", "自觉积极", "全面发展", "持之以恒", "因人制宜", "循序渐进", "散步", "慢跑", "靶心率", "运动量", "锻炼手段"],
            facts: [
                "身体锻炼五大原则：自觉积极性原则、全面发展原则、持之以恒原则、因人制宜原则、循序渐进原则。",
                "锻炼负荷的控制：靶心率是确定运动强度的核心，最常使用的简易公式为 [220 - 年龄] × 锻炼强度百分比。",
                "散步锻炼法：普通散步法适用于以保健为目的的锻炼者；定量散步法、快速散步法和摆臂散步法则适用于不同强度的运动康复和有氧锻炼。"
            ]
        },
        {
            id: "f6",
            name: "运动损伤预防、处理与急救常识",
            isBasketball: false,
            keywords: ["损伤", "拉伤", "扭伤", "急救", "出血", "人工呼吸", "心肺复苏", "骨折", "中暑", "冷敷", "加压", "热敷", "RICE", "止血"],
            facts: [
                "急性运动损伤处理：遵循 RICE原则（Rest 休息、Ice 冰敷、Compression 加压包扎、Elevation 抬高伤肢）。急性期禁止热敷、按摩，防止毛细血管破裂加重出血。",
                "冷敷与热敷的时机：急性损伤 24-48小时 内使用冷敷（收缩血管、减缓肿胀）；48小时 后转为热敷（促进血液循环、消散淤血）。",
                "急救常识：骨折急救首要原则是“固定”伤肢，切勿强行复位；心肺复苏（CPR）的胸外按压与人工呼吸比例为 30:2。"
            ]
        },
        {
            id: "f7",
            name: "体育人文与社会价值（奥林匹克、体育精神）",
            isBasketball: false,
            keywords: ["奥林匹克", "乒乓外交", "交流", "精神", "学校体育", "体育素养", "德育", "教育作用", "体育文化"],
            facts: [
                "学校体育的核心作用：为了适应未来社会生活和工作的需要，集中在培养学生的“体育素养”和“终身体育意识”。",
                "经典体育外交：20世纪70年代，我国利用乒乓球运动打破外交僵局，史称“乒乓外交”。",
                "奥林匹克运动：宗旨是通过体育运动教育青年，促进世界和平与发展。格言是“更快、更高、更强——更团结”。"
            ]
        },
        // Basketball Specialization
        {
            id: "b1",
            name: "篮球运动起源、历史与文化常识",
            isBasketball: true,
            keywords: ["詹姆斯", "奈史密斯", "CUBA", "NBA", "最好成绩", "世界锦标赛", "奥运会", "起源", "发明", "巴特尔", "姚明", "戒指", "第一人", "女篮", "男篮", "前身"],
            facts: [
                "发明背景：篮球运动于 1891年 由美国麻省春田青年会学院的詹姆斯·奈史密斯（James Naismith）发明。最初使用的是桃筐和足球。",
                "中国队最好成绩：中国女篮最好成绩是奥运会和世锦赛亚军（第二名，1992巴塞罗那）；中国男篮最好成绩是世锦赛和奥运会第八名（1996、2004、2008）。",
                "CUBA与NBA常识：中国大学生篮球协会于 1998年 正式推行CUBA联赛。亚洲获得NBA总冠军戒指的第一人是巴特尔（2003随马刺队）。"
            ]
        },
        {
            id: "b2",
            name: "篮球场地规格与器材标准",
            isBasketball: true,
            keywords: ["球场", "界线", "篮圈", "篮板", "三分线", "限制区", "尺寸", "宽", "长", "高度", "厘米", "直径", "气压", "气嘴", "重量"],
            facts: [
                "标准球场尺寸：长 28米，宽 15米。球场的界线（边线、端线）属于场外，踩线即出界。",
                "篮筐高度与规格：篮圈上沿距离地面的垂直高度为 3.05 米。篮圈内径直径为 45 厘米，颜色为橙色。",
                "篮板规格：长 1.80米，高 1.05米，下沿距离地面高度为 2.90 米。"
            ]
        },
        {
            id: "b3",
            name: "篮球个人基本技术要领",
            isBasketball: true,
            keywords: ["传球", "接球", "运球", "投篮", "突破", "持球", "三步上篮", "急停", "转身", "滑步", "防守脚步", "投篮弧度", "单手肩上投篮"],
            facts: [
                "传接球核心：传球时应全身协调用力，脚底蹬地、伸臂、抖腕、拨指；接球时双手迎球，触球后顺势收臂缓冲。",
                "运球核心：运球时应以肘或肩为轴，用手指和掌指部位控制球，重心降低，身体侧向防守队员保护球。",
                "投篮核心：出手角度和弧度决定命中率，最后用力来自手腕的抖动和手指的拨指拨球。"
            ]
        },
        {
            id: "b4",
            name: "篮球战术配合与团队防守",
            isBasketball: true,
            keywords: ["战术", "配合", "快攻", "掩护", "突分", "传切", "人盯人", "联防", "策应", "关门", "补防", "防守配合", "半场", "夹击"],
            facts: [
                "战术构成三要素：技术、战术意识、身体素质。组织战术的核心在位置、路线与时机配合。",
                "快攻与防守：阻止快攻发动的关键是阻挠发球和堵截第一传（破坏传球第一落点、紧逼一传队员）。",
                "基础配合：传切配合（传球后切入）、突分配合（突破后分球）、掩护配合（用身体挡住同伴防守人路线）、策应配合（内线高大队员接球后传给切入同伴）。"
            ]
        },
        {
            id: "b5",
            name: "篮球竞赛规则之违例判定（走步、时间违例等）",
            isBasketball: true,
            keywords: ["违例", "秒", "走步", "掷球入界", "带球走", "球出界", "出界", "脚踢球", "起跳", "回后场", "二次运球", "球回后场", "发球5秒", "12秒"],
            facts: [
                "时间违例规则：\n" +
                "  - 3秒违例：在前场控制活球且计时钟运行时，进攻队员不得在对方限制区内停留超过持续的3秒。\n" +
                "  - 5秒违例：持球队员被严密防守（一步内）时，须在5秒内传、投、运；发界外球时，须在5秒内将球发出。\n" +
                "  - 8秒违例：控制球队必须在 8秒 内将球推进到前场。\n" +
                "  - 24秒/14秒违例：全队控制球后须在24秒内投篮且球触及篮圈；前场抢到篮板或因对方违规，复位为14秒。",
                "出界违例：球触及界线上或界线外的人或物，或触及篮板背面、支架即为出界。由最后触球的对方队员在出界处掷球入界。"
            ]
        },
        {
            id: "b6",
            name: "篮球竞赛规则之犯规判定与罚则",
            isBasketball: true,
            keywords: ["犯规", "技术犯规", "违反体育运动精神", "双方犯规", "阻挡", "打手", "夺权", "侵人", "带球撞人", "掩护犯规", "队犯规", "罚球", "界外球"],
            facts: [
                "犯规分类：侵人犯规（非法身体接触，如打手、阻挡、推拉人等）；技术犯规（非接触性犯规，如对裁判不敬、延误比赛）；违体犯规（野蛮或过分身体接触）；双方犯规（两对手几乎同时发生侵人犯规）。",
                "队犯规累计罚则：每节比赛全队侵人/技术犯规累计达到 4次 后，从第5次起，所有非投篮动作的侵人犯规均执行 2次罚球。"
            ]
        },
        {
            id: "b7",
            name: "三人制篮球（3x3）专项竞赛规则",
            isBasketball: true,
            keywords: ["三对三", "三人制", "圆弧", "12秒", "21分", "加时赛", "常规时间", "决胜期", "1分", "2分"],
            facts: [
                "3x3场地与时间：在半个标准场（一个篮）进行。时间 10分钟。先拿 21分 球队直接获胜（爆分）。如果常规时间平局，加时赛率先获得 2分 球队获胜。",
                "3x3得分标准：圆弧内投中或罚球得 1分；圆弧外投中得 2分（无3分概念）。",
                "3x3进攻时限与转换：进攻限时 12秒。进球后无须裁判死球洗球，进球队员不能碰球，防守方在篮圈下拿到球直接运或传出圆弧外（双脚均跨出圆弧）即完成攻防转换，即可直接组织进攻。"
            ]
        }
    ];

    // 2. Study State
    let activeTab = 'search'; // 'search' or 'study'
    let currentStudyCategoryId = 'f1';
    let studyMode = 'memorize'; // 'memorize' (answers showing) or 'practice' (interactive clicks)
    let hideMastered = false;
    
    // Set of mastered question IDs (loaded from localStorage)
    let masteredQuestions = new Set();
    try {
        const saved = localStorage.getItem('QUESTION_MASTERED_IDS');
        if (saved) {
            const arr = JSON.parse(saved);
            masteredQuestions = new Set(arr);
        }
    } catch (e) {
        console.error("Failed to load mastered questions from localStorage:", e);
    }

    // Questions clustered by category ID
    const questionsByCategory = {};
    studyCategories.forEach(cat => {
        questionsByCategory[cat.id] = [];
    });

    // 3. Cluster questions on load (highly optimized keyword match)
    function clusterQuestions() {
        db.forEach(q => {
            let assignedCatId = null;
            const text = (q.question + " " + q.subject + " " + q.options_raw).toLowerCase();
            const isBasketballSubject = /篮球/.test(q.subject);

            // Grouping categories by subject type first
            const primaryCats = studyCategories.filter(cat => cat.isBasketball === isBasketballSubject);
            const fallbackCats = studyCategories.filter(cat => cat.isBasketball !== isBasketballSubject);

            // Match primary subject categories
            for (let cat of primaryCats) {
                for (let kw of cat.keywords) {
                    if (text.includes(kw.toLowerCase())) {
                        assignedCatId = cat.id;
                        break;
                    }
                }
                if (assignedCatId) break;
            }

            // Cross match fallback if not found
            if (!assignedCatId) {
                for (let cat of fallbackCats) {
                    for (let kw of cat.keywords) {
                        if (text.includes(kw.toLowerCase())) {
                            assignedCatId = cat.id;
                            break;
                        }
                    }
                    if (assignedCatId) break;
                }
            }

            // Ultimate fallback (guarantees 100% database coverage)
            if (!assignedCatId) {
                assignedCatId = isBasketballSubject ? 'b1' : 'f1';
            }

            questionsByCategory[assignedCatId].push(q);
        });
    }

    clusterQuestions();

    // 4. Tab Switching Event Listeners
    const tabSearchBtn = document.getElementById('tab-search');
    const tabStudyBtn = document.getElementById('tab-study');
    const searchView = document.getElementById('search-view');
    const studyView = document.getElementById('study-view');

    tabSearchBtn.addEventListener('click', () => {
        activeTab = 'search';
        tabSearchBtn.classList.add('active');
        tabStudyBtn.classList.remove('active');
        searchView.classList.add('active');
        studyView.classList.remove('active');
        searchInput.focus();
    });

    tabStudyBtn.addEventListener('click', () => {
        activeTab = 'study';
        tabStudyBtn.classList.add('active');
        tabSearchBtn.classList.remove('active');
        studyView.classList.add('active');
        searchView.classList.remove('active');
        
        // Render study view contents
        renderStudySidebar();
        renderStudyMain();
    });

    // 5. Sidebar rendering
    const categoryListEl = document.getElementById('study-category-list');
    
    function renderStudySidebar() {
        categoryListEl.innerHTML = '';
        
        studyCategories.forEach((cat, index) => {
            const list = questionsByCategory[cat.id] || [];
            const total = list.length;
            const masteredCount = list.filter(q => masteredQuestions.has(q.id)).length;
            const percent = total > 0 ? Math.round((masteredCount / total) * 100) : 0;
            const isCompleted = percent === 100;
            const isActive = cat.id === currentStudyCategoryId;

            const card = document.createElement('div');
            card.className = `category-card ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`;
            card.dataset.id = cat.id;

            card.innerHTML = `
                <div class="category-card-header">
                    <span class="category-card-title">${index + 1}. ${cat.name}</span>
                    <span class="category-card-count">${total}题</span>
                </div>
                <div class="category-progress-mini">
                    <div class="category-progress-meta-mini">
                        <span>进度: ${masteredCount}/${total}</span>
                        <span>${percent}%</span>
                    </div>
                    <div class="category-progress-bar-bg-mini">
                        <div class="category-progress-bar-fill-mini" style="width: ${percent}%;"></div>
                    </div>
                </div>
            `;

            card.addEventListener('click', () => {
                currentStudyCategoryId = cat.id;
                
                // Set active card styles in sidebar
                categoryListEl.querySelectorAll('.category-card').forEach(el => el.classList.remove('active'));
                card.classList.add('active');
                
                // Render main content
                renderStudyMain();
            });

            categoryListEl.appendChild(card);
        });
    }

    // 6. Main Study Pane rendering
    const categoryInfoEl = document.getElementById('selected-category-info');
    const studyQuestionsListEl = document.getElementById('study-questions-list');
    
    const studyProgressText = document.getElementById('study-progress-text');
    const studyProgressPercent = document.getElementById('study-progress-percent');
    const studyProgressBarFill = document.getElementById('study-progress-bar-fill');
    
    const hideMasteredToggle = document.getElementById('hide-mastered-toggle');
    const btnMemorize = document.getElementById('study-mode-memorize');
    const btnPractice = document.getElementById('study-mode-practice');

    // Toggle Handlers
    hideMasteredToggle.checked = hideMastered;
    hideMasteredToggle.addEventListener('change', (e) => {
        hideMastered = e.target.checked;
        filterMasteredCards();
    });

    btnMemorize.addEventListener('click', () => {
        studyMode = 'memorize';
        btnMemorize.classList.add('active');
        btnPractice.classList.remove('active');
        renderStudyMainQuestions();
    });

    btnPractice.addEventListener('click', () => {
        studyMode = 'practice';
        btnPractice.classList.add('active');
        btnMemorize.classList.remove('active');
        renderStudyMainQuestions();
    });

    function renderStudyMain() {
        const cat = studyCategories.find(c => c.id === currentStudyCategoryId);
        if (!cat) return;

        // 1. Facts mindmap card
        let factsHtml = '';
        cat.facts.forEach(fact => {
            factsHtml += `<li>${fact}</li>`;
        });
        
        categoryInfoEl.innerHTML = `
            <h2>${cat.name}</h2>
            <p class="cat-desc">由题库中真实题目关联提炼，考前必背干货点：</p>
            <div class="facts-header-title">💡 核心考点脑图背诵</div>
            <ul class="selected-category-facts-list">
                ${factsHtml}
            </ul>
        `;

        // 2. Progress calculations
        updateStudyProgress();

        // 3. Render questions list
        renderStudyMainQuestions();
    }

    function updateStudyProgress() {
        const list = questionsByCategory[currentStudyCategoryId] || [];
        const total = list.length;
        const masteredCount = list.filter(q => masteredQuestions.has(q.id)).length;
        const percent = total > 0 ? Math.round((masteredCount / total) * 100) : 0;

        studyProgressText.textContent = `${masteredCount} / ${total}`;
        studyProgressPercent.textContent = `${percent}%`;
        studyProgressBarFill.style.width = `${percent}%`;
    }

    // 7. Render all questions in category
    function renderStudyMainQuestions() {
        studyQuestionsListEl.innerHTML = '';
        const questions = questionsByCategory[currentStudyCategoryId] || [];

        if (questions.length === 0) {
            studyQuestionsListEl.innerHTML = `
                <div class="no-results">
                    <div class="no-results-icon">📂</div>
                    <h3>此分类中暂无题目</h3>
                </div>
            `;
            return;
        }

        // We render all questions for full review coverage. Very fast in modern browsers.
        questions.forEach(q => {
            const isMastered = masteredQuestions.has(q.id);
            const card = document.createElement('div');
            card.className = `question-card ${isMastered ? 'mastered' : ''} ${isMastered && hideMastered ? 'hidden' : ''}`;
            card.dataset.id = q.id;

            // Header tags
            const typeClass = getTypeClass(q.type);
            const typeBadge = `<span class="badge ${typeClass}">${q.type}</span>`;
            const subjectBadge = `<span class="badge subject">${q.subject}</span>`;

            // Condition colored tags
            let highlightedQuestion = parseConditionTags(q.question);

            let optionsHtml = '';
            let directAnswerHtml = '';
            
            const correctKeys = parseAnswerKeys(q.answer, q.type);

            if (q.type === '单选题' || q.type === '多选题') {
                if (q.options && q.options.length > 0) {
                    optionsHtml = `<div class="options-list">`;
                    
                    q.options.forEach(opt => {
                        const isCorrect = correctKeys.includes(opt.key);
                        
                        // Memorize mode styles (immediately show green) vs Practice mode (interactive)
                        let stateClass = '';
                        if (studyMode === 'memorize') {
                            stateClass = isCorrect ? 'correct' : '';
                        } else {
                            stateClass = 'clickable';
                        }
                        
                        let highlightedOptText = parseConditionTags(opt.text);
                        
                        optionsHtml += `
                            <div class="option-item ${stateClass}" data-key="${opt.key}">
                                <div class="option-letter">${opt.key}</div>
                                <div class="option-text">${highlightedOptText}</div>
                            </div>
                        `;
                    });
                    optionsHtml += `</div>`;
                } else {
                    // Fallback options
                    let highlightedOptionsRaw = parseConditionTags(q.options_raw);
                    optionsHtml = `
                        <div style="margin-bottom: 1rem; color: var(--text-secondary); line-height: 1.5; font-size: 0.95rem; background: rgba(255,255,255,0.02); padding: 0.75rem 1rem; border-radius: 10px; border: 1px solid var(--border-color);">
                            <strong>选项内容:</strong> ${highlightedOptionsRaw}
                        </div>
                    `;
                    
                    if (studyMode === 'memorize') {
                        let highlightedAnswer = parseConditionTags(q.answer);
                        directAnswerHtml = `
                            <div class="direct-answer-container">
                                <span class="direct-answer-label">参考答案</span>
                                <span class="direct-answer-text">${highlightedAnswer}</span>
                            </div>
                        `;
                    } else {
                        // Practice mode button
                        directAnswerHtml = `
                            <div class="direct-answer-container" style="cursor:pointer; background: rgba(255, 255, 255, 0.02); border: 1px dashed var(--border-color); justify-content: center;" id="reveal-ans-btn-${q.id}">
                                <span class="direct-answer-label" style="background: rgba(255,255,255,0.06); color: var(--text-secondary);">💡 点击查看参考答案</span>
                            </div>
                        `;
                    }
                }
            } else {
                // Judgement or Blank
                if (studyMode === 'memorize') {
                    let highlightedAnswer = parseConditionTags(q.answer);
                    directAnswerHtml = `
                        <div class="direct-answer-container">
                            <span class="direct-answer-label">正确答案</span>
                            <span class="direct-answer-text">${highlightedAnswer}</span>
                        </div>
                    `;
                } else {
                    // Practice mode button
                    directAnswerHtml = `
                        <div class="direct-answer-container" style="cursor:pointer; background: rgba(255, 255, 255, 0.02); border: 1px dashed var(--border-color); justify-content: center;" id="reveal-ans-btn-${q.id}">
                            <span class="direct-answer-label" style="background: rgba(255,255,255,0.06); color: var(--text-secondary);">💡 点击显示正确答案</span>
                        </div>
                    `;
                }
            }

            card.innerHTML = `
                <div class="card-header">
                    <span class="card-id">#${q.id}</span>
                    <div class="tag-container">
                        ${subjectBadge}
                        ${typeBadge}
                    </div>
                    
                    <!-- Mastered Checkbox -->
                    <label class="mastered-checkbox-container">
                        <input type="checkbox" class="mastered-card-checkbox" ${isMastered ? 'checked' : ''}>
                        <span class="mastered-checkbox-label">已掌握</span>
                    </label>
                </div>
                <div class="question-text">${highlightedQuestion}</div>
                ${optionsHtml}
                ${directAnswerHtml}
                <div class="card-actions">
                    <button class="action-btn copy-q" data-id="${q.id}">复制题目</button>
                    <button class="action-btn copy-answer" data-id="${q.id}">复制答案</button>
                </div>
            `;

            // Card Action Buttons
            card.querySelector('.copy-q').addEventListener('click', (e) => {
                e.stopPropagation();
                copyToClipboard(q.question, '题目复制成功！');
            });
            
            card.querySelector('.copy-answer').addEventListener('click', (e) => {
                e.stopPropagation();
                copyToClipboard(q.answer, `答案 [${q.answer}] 已复制到剪贴板！`);
            });

            // Master Checkbox Logic
            const chkBox = card.querySelector('.mastered-card-checkbox');
            chkBox.addEventListener('change', (e) => {
                const checked = e.target.checked;
                
                if (checked) {
                    card.classList.add('mastered');
                    masteredQuestions.add(q.id);
                    
                    // Smoothly fade-out and hide if hideMastered is active
                    if (hideMastered) {
                        setTimeout(() => {
                            if (masteredQuestions.has(q.id) && hideMastered) {
                                card.classList.add('hidden');
                            }
                        }, 500);
                    }
                } else {
                    card.classList.remove('mastered');
                    card.classList.remove('hidden');
                    masteredQuestions.delete(q.id);
                }

                // Save status
                localStorage.setItem('QUESTION_MASTERED_IDS', JSON.stringify(Array.from(masteredQuestions)));

                // Update UI progress in real time
                updateStudyProgress();
                renderStudySidebar(); // Updates mini-progress bars in sidebar list
            });

            // Interactive Option Clicks in Practice Mode
            if (studyMode === 'practice') {
                // For multiple choice
                const optionItems = card.querySelectorAll('.option-item.clickable');
                optionItems.forEach(item => {
                    item.addEventListener('click', () => {
                        const clickedKey = item.dataset.key;
                        
                        if (q.type === '单选题') {
                            // Clear previous states
                            optionItems.forEach(opt => {
                                opt.classList.remove('wrong', 'correct-reveal');
                            });

                            if (correctKeys.includes(clickedKey)) {
                                item.classList.add('correct-reveal');
                            } else {
                                item.classList.add('wrong');
                                // Highlight the correct one
                                optionItems.forEach(opt => {
                                    if (correctKeys.includes(opt.dataset.key)) {
                                        opt.classList.add('correct-reveal');
                                    }
                                });
                            }
                        } else if (q.type === '多选题') {
                            // Multiple choice toggle wrong/correct locally
                            if (correctKeys.includes(clickedKey)) {
                                item.classList.toggle('correct-reveal');
                            } else {
                                item.classList.toggle('wrong');
                            }
                        }
                    });
                });

                // For reveal answer buttons (Blanks/Judgments or fallback options)
                const revealBtn = card.querySelector(`[id^="reveal-ans-btn-"]`);
                if (revealBtn) {
                    revealBtn.addEventListener('click', () => {
                        revealBtn.style.cursor = 'default';
                        revealBtn.style.background = 'rgba(16, 185, 129, 0.08)';
                        revealBtn.style.borderColor = 'rgba(16, 185, 129, 0.35)';
                        revealBtn.innerHTML = `
                            <span class="direct-answer-label">正确答案</span>
                            <span class="direct-answer-text">${parseConditionTags(q.answer)}</span>
                        `;
                    });
                }
            }

            studyQuestionsListEl.appendChild(card);
        });
    }

    // 8. Filters Mastered questions on active status
    function filterMasteredCards() {
        const cards = studyQuestionsListEl.querySelectorAll('.question-card');
        cards.forEach(card => {
            const id = parseInt(card.dataset.id);
            const isMastered = masteredQuestions.has(id);

            if (isMastered) {
                if (hideMastered) {
                    card.classList.add('hidden');
                } else {
                    card.classList.remove('hidden');
                }
            }
        });
    }
});

