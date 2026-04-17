// Servidor backend local/VPS
const API_URL = '/api';
let rawData = { objectives: [], key_results: [] };
let activeKRId = null; // For the modal

// Chart instances map
const chartInstances = {};

// Quarters mapping
const Q_MONTHS = {
    'Q1': ['Jan', 'Feb', 'Mar'],
    'Q2': ['Apr', 'May', 'Jun'],
    'Q3': ['Jul', 'Aug', 'Sep'],
    'Q4': ['Oct', 'Nov', 'Dec']
};

let isTvMode = new URLSearchParams(window.location.search).get('tv'); // 'global' ou 'quarter'
const CURRENT_QUARTER = 'Q1'; // Em um app real, calcular baseado no mês atual
const ALL_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

document.addEventListener('DOMContentLoaded', () => {
    fetchData();
    setupForms();

    if (isTvMode) {
        document.body.classList.add('tv-mode');
        // Oculta elementos desnecessários na TV
        const sidebar = document.querySelector('aside');
        const header = document.querySelector('header');
        if (sidebar) sidebar.style.display = 'none';
        if (header) header.style.display = 'none';

        const masterStats = document.querySelector('#view-dashboard > div.grid');
        if (masterStats) masterStats.style.display = 'none';

        // Ajusta main para engolir a tela toda sem scroll
        const main = document.querySelector('main');
        main.className = 'w-screen h-screen bg-app-bg px-[2vw] py-[2vh] overflow-hidden flex flex-col pt-[3vh]';

        // Esconde wrapper de scroll
        document.body.style.overflow = 'hidden';

        // Botão flutuante para sair da TV discretamente
        const exitBtn = document.createElement('a');
        exitBtn.href = '?'; // Limpa parâmetros
        exitBtn.className = 'fixed bottom-[3vh] right-[2vw] bg-gray-800/50 hover:bg-gray-700 border border-gray-700 p-[1vh] rounded-[1vh] text-gray-400 hover:text-white transition flex items-center gap-[0.5vw] backdrop-blur-md opacity-10 hover:opacity-100 z-50';
        exitBtn.innerHTML = '<i class="ph ph-sign-out text-[2vh]"></i> <span class="text-[1vh] font-medium uppercase tracking-widest">Sair da TV</span>';
        document.body.appendChild(exitBtn);
    }
});

function switchTab(tabId) {
    document.getElementById('view-dashboard').classList.add('hidden');
    document.getElementById('view-cadastro').classList.add('hidden');
    
    // Safety check para o tab-import que acabou de ser adicionado no index.html
    const viewImport = document.getElementById('view-import');
    if (viewImport) viewImport.classList.add('hidden');
    
    const targetView = document.getElementById(`view-${tabId}`);
    if (targetView) targetView.classList.remove('hidden');

    const btnCadastro = document.getElementById('nav-cadastro');
    const btnDashboard = document.getElementById('nav-dashboard');
    const btnImport = document.getElementById('nav-import');

    const activeClass = 'w-full flex flex-row items-center gap-3 px-3 py-3 rounded-xl bg-primary-600/20 text-primary-400 font-medium transition-all group';
    const inactiveClass = 'w-full flex items-center justify-between px-3 py-3 rounded-xl hover:bg-gray-700/50 text-gray-400 hover:text-white font-medium transition-all group';
    
    const simpleActiveClass = 'w-full flex items-center gap-3 px-3 py-3 rounded-xl bg-primary-600/20 text-primary-400 font-medium transition-all';
    const simpleInactiveClass = 'w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-gray-700/50 text-gray-400 hover:text-white font-medium transition-all';

    if (btnCadastro) btnCadastro.className = tabId === 'cadastro' ? simpleActiveClass : simpleInactiveClass;
    if (btnDashboard) btnDashboard.className = tabId === 'dashboard' ? activeClass : inactiveClass;
    if (btnImport) btnImport.className = tabId === 'import' ? simpleActiveClass : simpleInactiveClass;
}

function toggleSubmenu(id) {
    // Se estivemos em outra página, e o usuário clicar no submenu do dashboard, a gente também chaveia para a página global
    if (id === 'submenu-dashboard') {
        switchTab('dashboard');
    }

    const menu = document.getElementById(id);
    const icon = document.getElementById(`icon-${id}`);

    if (menu.classList.contains('hidden') || menu.style.maxHeight === '0px') {
        menu.classList.remove('hidden');
        menu.style.maxHeight = menu.scrollHeight + 'px';
        icon.classList.add('rotate-180');
    } else {
        menu.style.maxHeight = '0px';
        icon.classList.remove('rotate-180');
        setTimeout(() => {
            if (menu.style.maxHeight === '0px') menu.classList.add('hidden');
        }, 300); // 300ms timer matching the transition-all duration
    }
}

function toggleSidebar() {
    document.getElementById('app-sidebar').classList.toggle('sidebar-collapsed');
}

async function fetchData() {
    try {
        const response = await fetch(`${API_URL}/data`);
        if (response.ok) {
            rawData = await response.json();
            renderDashboard();
            populateSelects();
        } else {
            throw new Error(`Erro na API: ${response.status}`);
        }
    } catch (e) {
        console.error("Failed to fetch data", e);
        alert(`Ocorreu um erro: ${e.message}\nVerifique o console para mais detalhes.`);
    }
}

function calculateKRProgress(kr) {
    const base = parseFloat(kr.base_value);
    const target = parseFloat(kr.target_value);

    const quarterlyObj = rawData.objectives.find(o => o.id === kr.quarterly_id);
    // KRs que não tem quarter tem "validação" em todos os 12 meses
    const validMonths = kr.quarterly_id && quarterlyObj ? Q_MONTHS[quarterlyObj.quarter] : ALL_MONTHS;

    const values = [];
    validMonths.forEach(m => {
        if (kr[m] && kr[m] !== "") {
            values.push(parseFloat(kr[m]));
        }
    });

    let current = base;
    if (values.length > 0) {
        if (kr.calculation === 'sum') {
            current = values.reduce((a, b) => a + b, 0);
        } else if (kr.calculation === 'avg') {
            current = values.reduce((a, b) => a + b, 0) / values.length;
        }
    } else {
        return {
            progress: 0,
            currentValue: base,
            values: [],
            validMonths: validMonths
        };
    }

    let progress = (current - base) / (target - base) * 100;
    if (isNaN(progress)) progress = 0;

    return {
        progress: Math.max(0, Math.min(progress, 150)),
        currentValue: current,
        values: values,
        validMonths: validMonths
    };
}

function renderDashboard() {
    const globals = rawData.objectives.filter(o => o.type === 'global');
    const quarterlies = rawData.objectives.filter(o => o.type === 'quarterly');

    document.getElementById('stat-globals').innerText = globals.length;
    document.getElementById('stat-quarterly').innerText = quarterlies.length;

    const container = document.getElementById('global-objectives-container');
    container.innerHTML = '';

    let totalGlobalsProgress = 0;
    let computedGlobals = 0;

    // Modo TV: Usar grid para aproveitar toda a tela horizontalmente
    if (isTvMode) {
        const viewDashboard = document.getElementById('view-dashboard');
        if (viewDashboard) {
            viewDashboard.className = 'h-full w-full flex flex-col min-h-0 flex-1';
            if (viewDashboard.parentElement) {
                viewDashboard.parentElement.className = 'flex-1 min-h-0 w-full flex flex-col px-4 md:px-8 py-2 md:py-4';
            }
        }

        // Grid auto-responsivo que esmaga o layout para caber no h-full sem vazar
        container.className = 'flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 auto-rows-fr w-full pb-2';

        // Função exclusiva para TV mode hiper compacta Z-pattern
        const renderCompactKRListHtml = (krs) => {
            if (!krs || krs.length === 0) return '';
            return krs.map(kr => {
                const krData = calculateKRProgress(kr);
                const isDecrease = kr.measurement === 'decrease';
                return `
                <div class="bg-gray-800/60 border border-gray-700/40 rounded px-2.5 py-1.5 mb-1.5 hover:border-gray-500 transition shadow-sm flex flex-row items-center gap-3">
                    <div class="flex-1 min-w-0 flex flex-col justify-center">
                        <h4 class="text-white font-semibold text-[11.5px] lg:text-xs leading-tight mb-1 break-words whitespace-normal" title="${kr.name}">
                            ${kr.name}
                        </h4>
                        <div class="flex flex-row flex-wrap items-center gap-2 text-[10px] text-gray-400">
                            <span class="flex items-center gap-0.5">B: <span class="text-white font-medium">${kr.base_value}</span></span>
                            <span class="flex items-center gap-0.5">M: <span class="text-white font-medium">${kr.target_value}</span></span>
                            <span class="flex items-center gap-0.5 px-1 py-px rounded bg-primary-900/30 text-primary-300">
                                Real: <span class="text-white font-bold text-[11px]">${Number.isInteger(krData.currentValue) ? krData.currentValue : Number(krData.currentValue).toFixed(1)}</span>
                            </span>
                            <span class="font-bold text-${isDecrease ? 'red' : 'green'}-400 ml-auto">${isDecrease ? '↓' : '↑'} ${krData.progress.toFixed(0)}%</span>
                        </div>
                    </div>
                    
                    <div class="w-16 lg:w-24 shrink-0 flex flex-col justify-center self-stretch">
                        <div class="w-full h-8 opacity-80"><canvas id="chart-kr-${kr.id}"></canvas></div>
                        <div class="w-full bg-gray-900 border border-gray-700/50 rounded-full h-1 mt-1 overflow-hidden shrink-0">
                            <div class="bg-primary-500 h-full rounded-full" style="width: ${Math.min(krData.progress, 100)}%"></div>
                        </div>
                    </div>
                </div>
                `;
            }).join('');
        };

        if (isTvMode === 'global') {
            globals.forEach(globalObj => {
                const linkedKRs = rawData.key_results.filter(kr => kr.global_id === globalObj.id);

                let progress = 0;
                if (linkedKRs.length > 0) {
                    progress = linkedKRs.reduce((s, kr) => s + calculateKRProgress(kr).progress, 0) / linkedKRs.length;
                }

                const card = document.createElement('div');
                card.className = 'bg-gray-900/90 rounded-lg border border-gray-700/80 overflow-hidden shadow-2xl flex flex-col h-full ring-1 ring-white/5 min-h-0';
                card.innerHTML = `
                    <div class="bg-blue-700 px-4 py-3 border-b border-blue-800 flex items-start justify-between shrink-0 gap-2">
                        <div class="flex-1 min-w-0">
                            <h3 class="text-base text-white font-bold tracking-tight uppercase break-words whitespace-normal leading-snug" title="${globalObj.name}">
                                <span class="bg-white/20 px-1 py-0.5 rounded text-xs mr-1 align-middle">Global</span>
                                ${globalObj.name}
                            </h3>
                        </div>
                        <div class="text-lg font-black text-blue-900 bg-white px-2 py-0.5 rounded shadow-sm shrink-0 mt-0.5">${progress.toFixed(0)}%</div>
                    </div>
                    <div class="p-4 flex-1 overflow-y-auto min-h-0">
                        ${renderCompactKRListHtml(linkedKRs)}
                    </div>
                `;
                container.appendChild(card);
                linkedKRs.forEach(kr => {
                    const krData = calculateKRProgress(kr);
                    renderKRChart(`chart-kr-${kr.id}`, kr, krData.validMonths);
                });
            });
        } else if (['Q1', 'Q2', 'Q3', 'Q4'].includes(isTvMode)) {
            const currentQuarters = quarterlies.filter(q => q.quarter === isTvMode);
            currentQuarters.forEach(qObj => {
                const qKRs = rawData.key_results.filter(kr => kr.quarterly_id === qObj.id);

                const linkedGlobal = globals.find(g => g.id === qObj.global_id);
                const globalName = linkedGlobal ? linkedGlobal.name : 'Sem Vínculo Global';

                let progress = 0;
                if (qKRs.length > 0) {
                    progress = qKRs.reduce((s, kr) => s + calculateKRProgress(kr).progress, 0) / qKRs.length;
                }

                const card = document.createElement('div');
                card.className = 'bg-gray-900/90 rounded-lg border border-gray-700/80 overflow-hidden shadow-2xl flex flex-col h-full ring-1 ring-white/5 min-h-0';
                card.innerHTML = `
                    <div class="bg-blue-700 px-4 py-3 border-b border-blue-800 flex items-start justify-between shrink-0 gap-2">
                        <div class="flex-1 min-w-0">
                            <h3 class="text-base text-white font-bold tracking-tight uppercase break-words whitespace-normal leading-snug" title="${qObj.name}">
                                <span class="bg-white/20 px-1 py-0.5 rounded text-xs mr-1 align-middle">${qObj.quarter}</span>
                                ${qObj.name}
                            </h3>
                            <div class="text-xs text-blue-200 mt-2 opacity-90 break-words whitespace-normal leading-relaxed" title="Vinculado a: ${globalName}"><span class="font-medium text-blue-300">Vinc:</span> ${globalName}</div>
                        </div>
                        <div class="text-lg font-black text-blue-900 bg-white px-2 py-0.5 rounded shadow-sm shrink-0 mt-0.5">${progress.toFixed(0)}%</div>
                    </div>
                    <div class="p-4 flex-1 overflow-y-auto min-h-0">
                        ${renderCompactKRListHtml(qKRs)}
                    </div>
                `;
                container.appendChild(card);
                qKRs.forEach(kr => {
                    const krData = calculateKRProgress(kr);
                    renderKRChart(`chart-kr-${kr.id}`, kr, krData.validMonths);
                });
            });
        }
        return;
    }

    // ==========================================
    // DESKTOP NORMAL RENDERING
    // ==========================================
    globals.forEach(globalObj => {
        const linkedKRs = rawData.key_results.filter(kr => kr.global_id === globalObj.id);

        let globalAvgProgress = 0;
        if (linkedKRs.length > 0) {
            const sumProgress = linkedKRs.reduce((sum, kr) => sum + calculateKRProgress(kr).progress, 0);
            globalAvgProgress = sumProgress / linkedKRs.length;
        }

        totalGlobalsProgress += globalAvgProgress;
        computedGlobals++;

        const card = document.createElement('div');
        card.className = 'glass-card rounded-2xl overflow-hidden border border-gray-700/50 mb-6 group/gobj';

        card.innerHTML = `
            <div class="p-6 cursor-pointer hover:bg-white/5 transition flex items-center justify-between" onclick="toggleAccordion('acc-${globalObj.id}')">
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 rounded-xl bg-gray-800 border border-gray-700 flex justify-center items-center shrink-0">
                        <i class="ph ph-globe-hemisphere-east text-2xl text-primary-400"></i>
                    </div>
                    <div>
                        <span class="text-[10px] font-bold uppercase tracking-wider text-primary-400">Objetivo Global</span>
                        <div class="flex items-center gap-2">
                            <h3 class="text-xl font-semibold text-white tracking-tight">${globalObj.name}</h3>
                            <div class="flex items-center gap-1 opacity-0 group-hover/gobj:opacity-100 transition-opacity" onclick="event.stopPropagation()">
                                <button onclick="editObjectivePrompt('${globalObj.id}', '${globalObj.name.replace(/'/g, "\\'")}')" class="p-1 text-gray-500 hover:text-blue-400 rounded transition" title="Editar Título"><i class="ph ph-pencil-simple"></i></button>
                                <button onclick="deleteObjective('${globalObj.id}')" class="p-1 text-gray-500 hover:text-red-400 rounded transition" title="Excluir Objetivo Global e Vinculados"><i class="ph ph-trash"></i></button>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="flex items-center gap-4 shrink-0">
                    <div class="text-right">
                        <div class="text-xl font-bold text-white">${globalAvgProgress.toFixed(1)}%</div>
                    </div>
                    <div class="bg-gray-800 rounded-full overflow-hidden w-32 h-3">
                        <div class="bg-primary-500 rounded-full progress-bar shadow-[0_0_10px_rgba(0,87,168,0.6)] h-full" style="width: ${Math.min(globalAvgProgress, 100)}%"></div>
                    </div>
                    <i class="ph ph-caret-down text-gray-400 transition-transform duration-300" id="icon-${globalObj.id}"></i>
                </div>
            </div>
            
            <div id="acc-${globalObj.id}" class="hidden border-t border-gray-700/50 bg-gray-900/50 p-6">
                <div class="space-y-4" id="qo-container-${globalObj.id}"></div>
            </div>
        `;
        container.appendChild(card);

        const qoContainer = document.getElementById(`qo-container-${globalObj.id}`);

        // 1. Renderizar KRs Globais Diretas
        const globalDirectKRs = linkedKRs.filter(kr => !kr.quarterly_id || kr.quarterly_id === "");
        if (globalDirectKRs.length > 0) {
            const gSection = document.createElement('div');
            gSection.className = 'bg-gray-800/20 rounded-xl border border-primary-500/20 p-5 mb-8';
            let krHtml = renderKRListHtml(globalDirectKRs);

            gSection.innerHTML = `
                <div class="flex items-center gap-3 mb-5 pb-3 border-b border-gray-700/50">
                    <span class="bg-primary-600 text-white text-[10px] font-bold px-2 py-0.5 rounded tracking-wide uppercase">Global</span>
                    <h4 class="text-base text-gray-300 font-medium tracking-tight">KRs vinculadas diretamente ao Objetivo Global</h4>
                </div>
                <div class="mt-4">
                    ${krHtml}
                </div>
            `;
            qoContainer.appendChild(gSection);

            globalDirectKRs.forEach(kr => {
                const krData = calculateKRProgress(kr);
                renderKRChart(`chart-kr-${kr.id}`, kr, krData.validMonths);
            });
        }

        // 2. Renderizar KRs Trimestrais
        const qObjs = quarterlies.filter(q => q.global_id === globalObj.id);
        qObjs.forEach(qObj => {
            const qKRs = linkedKRs.filter(kr => kr.quarterly_id === qObj.id);
            let qProgress = 0;
            if (qKRs.length > 0) {
                qProgress = qKRs.reduce((s, kr) => s + calculateKRProgress(kr).progress, 0) / qKRs.length;
            }

            const qSection = document.createElement('div');
            qSection.className = 'bg-gray-800/40 rounded-xl border border-blue-500/20 p-5 mt-6 relative overflow-hidden group/qobj';

            let krHtml = renderKRListHtml(qKRs);

            qSection.innerHTML = `
                <div class="absolute top-0 left-0 w-1 h-full bg-blue-500/50"></div>
                
                <div class="flex flex-col md:flex-row md:items-center gap-3 mb-5 pl-2 pb-3 border-b border-gray-700/50">
                    <div class="flex items-center gap-3">
                        <span class="bg-blue-600 font-bold px-2.5 py-1 rounded text-white text-xs">${qObj.quarter}</span>
                        <h4 class="text-lg text-white font-semibold tracking-tight">${qObj.name}</h4>
                        ${!isTvMode ? `
                        <div class="ml-2 flex items-center gap-1 opacity-0 group-hover/qobj:opacity-100 transition-opacity">
                            <button onclick="editObjectivePrompt('${qObj.id}', '${qObj.name.replace(/'/g, "\\'")}')" class="p-1.5 text-gray-400 hover:text-blue-400 rounded-lg hover:bg-gray-700 transition" title="Editar Título" event.stopPropagation()><i class="ph ph-pencil-simple"></i></button>
                            <button onclick="deleteObjective('${qObj.id}')" class="p-1.5 text-gray-400 hover:text-red-400 rounded-lg hover:bg-gray-700 transition" title="Excluir Objetivo Trimestral" event.stopPropagation()><i class="ph ph-trash"></i></button>
                        </div>
                        ` : ''}
                    </div>
                    <div class="md:ml-auto flex items-center gap-2">
                        <span class="text-xs text-gray-400">Progresso do Trimestre:</span>
                        <div class="flex items-center gap-2">
                            <div class="w-24 h-2 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
                                <div class="bg-blue-500 h-full rounded-full" style="width: ${Math.min(qProgress, 100)}%"></div>
                            </div>
                            <span class="text-blue-400 font-bold text-sm min-w-10">${qProgress.toFixed(1)}%</span>
                        </div>
                    </div>
                </div>
                <div class="mt-4 pl-2">
                    ${krHtml || '<p class="text-gray-500 text-sm py-4 italic text-center rounded-lg border border-dashed border-gray-700 bg-gray-900/50">Nenhuma KR vinculada a este trimestre ainda.</p>'}
                </div>
            `;
            qoContainer.appendChild(qSection);

            qKRs.forEach(kr => {
                const krData = calculateKRProgress(kr);
                renderKRChart(`chart-kr-${kr.id}`, kr, krData.validMonths);
            });
        });
    });

    if (computedGlobals > 0) {
        const globalAvg = totalGlobalsProgress / computedGlobals;
        document.getElementById('stat-avg-progress').innerText = `${globalAvg.toFixed(1)}%`;
    }
}

// Aux function to render KR HTML chunks
function renderKRListHtml(krs) {
    if (!krs || krs.length === 0) return '';
    return krs.map(kr => {
        const krData = calculateKRProgress(kr);
        const isDecrease = kr.measurement === 'decrease';

        return `
        <div class="bg-gray-800/80 border border-gray-700/50 rounded-xl p-4 hover:border-gray-500 transition flex flex-row items-center gap-4 mb-3 group/kr">
            <div class="flex-1 min-w-0"> <!-- min-w-0 prevents flex items from overflowing -->
                <div class="flex justify-between items-start mb-2">
                    <div class="min-w-0 w-full flex items-start justify-between pr-2">
                        <h4 class="text-white font-semibold flex items-start gap-2 text-[15px] leading-snug">
                            <i class="ph ph-target text-primary-400 shrink-0 mt-0.5 text-lg"></i>
                            <span class="break-words">${kr.name}</span>
                        </h4>
                        
                        ${!isTvMode ? `
                        <div class="flex items-center gap-1 opacity-0 group-hover/kr:opacity-100 transition-opacity">
                            <button onclick="editKRPrompt('${kr.id}', '${kr.name.replace(/'/g, "\\'")}')" class="p-1 text-gray-500 hover:text-blue-400 rounded transition" title="Editar KR"><i class="ph ph-pencil-simple"></i></button>
                            <button onclick="deleteKR('${kr.id}')" class="p-1 text-gray-500 hover:text-red-400 rounded transition" title="Excluir KR"><i class="ph ph-trash"></i></button>
                        </div>
                        ` : ''}
                    </div>
                    ${!isTvMode ? `
                    <button onclick="openKRModal('${kr.id}')" class="px-3 py-2 text-xs uppercase tracking-wider bg-gray-700 hover:bg-primary-600 rounded-lg text-white font-bold transition flex items-center gap-1.5 shrink-0 ml-3">
                        <i class="ph ph-pencil-simple"></i> Lançar
                    </button>
                    ` : ''}
                </div>
                <div class="flex flex-wrap items-center gap-2.5 text-xs text-gray-400 mt-2">
                    <span class="bg-gray-700/50 px-2 py-0.5 rounded">Base: <span class="font-medium text-gray-300">${kr.base_value}</span></span>
                    <span class="bg-gray-700/50 px-2 py-0.5 rounded">Meta: <span class="text-white font-medium">${kr.target_value}</span></span>
                    <span class="bg-primary-900/30 border border-primary-500/30 px-2 py-0.5 rounded text-primary-300">Realizado: <span class="font-bold">${Number.isInteger(krData.currentValue) ? krData.currentValue : Number(krData.currentValue).toFixed(2)}</span></span>
                    <span class="bg-gray-700/50 px-2 py-0.5 rounded text-${isDecrease ? 'red' : 'green'}-400">${isDecrease ? '↓ Reduzir' : '↑ Aumentar'}</span>
                </div>
                
                <div class="${isTvMode ? 'mt-2' : 'mt-3'} flex items-center gap-3">
                    <span class="text-primary-300 font-bold shrink-0 w-10 text-base">${krData.progress.toFixed(0)}%</span>
                    <div class="${isTvMode ? 'w-full' : 'flex-1'} bg-gray-700 rounded-full h-2 overflow-hidden">
                        <div class="bg-primary-500 h-2 rounded-full progress-bar transition-all" style="width: ${Math.min(krData.progress, 100)}%"></div>
                    </div>
                </div>
            </div>
            
            <div class="${isTvMode ? 'w-32 h-20' : 'w-1/3 max-w-[360px] h-28'} bg-gray-900 rounded-lg p-2 border border-gray-800 shrink-0">
                <canvas id="chart-kr-${kr.id}"></canvas>
            </div>
        </div>
        `;
    }).join('');
}

function renderKRChart(canvasId, kr, validMonths) {
    const ctx = document.getElementById(canvasId).getContext('2d');

    if (chartInstances[canvasId]) chartInstances[canvasId].destroy();

    const dataPoints = validMonths.map(m => kr[m] ? parseFloat(kr[m]) : null);
    const goalData = validMonths.map(() => parseFloat(kr.target_value));

    chartInstances[canvasId] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: validMonths,
            datasets: [
                {
                    label: 'Realizado',
                    data: dataPoints,
                    borderColor: '#0057A8',
                    backgroundColor: 'rgba(0, 87, 168, 0.12)',
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true,
                    spanGaps: true,
                    pointRadius: 4,
                    pointBackgroundColor: '#3498db'
                },
                {
                    label: 'Meta',
                    data: goalData,
                    borderColor: 'rgba(156, 163, 175, 0.3)',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    pointRadius: 0,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    enabled: true,
                    mode: 'index',
                    intersect: false,
                    bodyFont: { size: isTvMode ? 9 : 12 },
                    titleFont: { size: isTvMode ? 9 : 12 },
                    padding: isTvMode ? 4 : 8,
                    displayColors: !isTvMode,
                    callbacks: isTvMode ? {
                        title: () => null,
                        label: (context) => `${context.dataset.label}: ${context.parsed.y}`
                    } : undefined
                }
            },
            scales: {
                x: { display: false },
                y: { display: false, min: kr.measurement === 'decrease' ? parseFloat(kr.target_value) * 0.5 : 0 }
            },
            interaction: { mode: 'nearest', axis: 'x', intersect: false },
            layout: { padding: 0 }
        }
    });
}

function toggleAccordion(id) {
    const el = document.getElementById(id);
    const icon = document.getElementById('icon-' + id.replace('acc-', ''));
    if (el.classList.contains('hidden')) {
        el.classList.remove('hidden');
        icon.style.transform = 'rotate(180deg)';
    } else {
        el.classList.add('hidden');
        icon.style.transform = 'rotate(0deg)';
    }
}

let krRowCount = 0;

function populateSelects() {
    const globals = rawData.objectives.filter(o => o.type === 'global');

    // Preenche o select de vínculo Global no formulário de cadastro
    const parentSel = document.getElementById('obj-global-parent');
    if (parentSel) {
        parentSel.innerHTML = '<option value="">Selecione o objetivo global...</option>' +
            globals.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
    }
}

function onObjTypeChange() {
    const type = document.getElementById('obj-type').value;
    const fields = document.getElementById('obj-quarterly-fields');
    if (type === 'quarterly') {
        fields.classList.remove('hidden');
        fields.classList.add('grid');
    } else {
        fields.classList.add('hidden');
        fields.classList.remove('grid');
    }
}

function addKRRow() {
    krRowCount++;
    const id = krRowCount;
    const container = document.getElementById('kr-list-container');
    const row = document.createElement('div');
    row.id = `kr-row-${id}`;
    row.className = 'bg-gray-800/60 border border-gray-700/50 rounded-xl p-5 space-y-4 animate-[fadeIn_0.2s_ease]';
    row.innerHTML = `
        <div class="flex items-center justify-between">
            <span class="text-sm font-semibold text-primary-300 flex items-center gap-2">
                <i class="ph ph-target"></i> Key Result #${id}
            </span>
            <button type="button" onclick="removeKRRow(${id})" class="text-gray-500 hover:text-red-400 transition p-1 rounded" title="Remover KR">
                <i class="ph ph-trash text-lg"></i>
            </button>
        </div>
        <div>
            <label class="block text-xs text-gray-400 mb-1">Descrição da Key Result <span class="text-red-400">*</span></label>
            <input type="text" id="kr-name-${id}"
                class="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary-500 transition text-sm"
                placeholder="Ex: Atingir R$ 1,2MM de faturamento no Q1">
        </div>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
                <label class="block text-xs text-gray-400 mb-1">Base (Inicial)</label>
                <input type="number" id="kr-base-${id}" step="any" value="0"
                    class="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-primary-500 transition text-sm">
            </div>
            <div>
                <label class="block text-xs text-gray-400 mb-1">Meta (Target)</label>
                <input type="number" id="kr-target-${id}" step="any" value="100"
                    class="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-primary-500 transition text-sm">
            </div>
            <div>
                <label class="block text-xs text-gray-400 mb-1">Tipo de Cálculo</label>
                <select id="kr-calculation-${id}"
                    class="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-primary-500 transition text-sm">
                    <option value="sum">Soma (acumulado)</option>
                    <option value="avg">Média</option>
                </select>
            </div>
            <div>
                <label class="block text-xs text-gray-400 mb-1">Direção</label>
                <select id="kr-measurement-${id}"
                    class="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-primary-500 transition text-sm">
                    <option value="increase">↑ Aumentar</option>
                    <option value="decrease">↓ Reduzir</option>
                </select>
            </div>
        </div>
        <div>
            <label class="block text-xs text-gray-400 mb-1">Frequência de Medição</label>
            <select id="kr-frequency-${id}"
                class="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-primary-500 transition text-sm">
                <option value="monthly">Mensal</option>
                <option value="quarterly">Trimestral</option>
                <option value="annual">Anual</option>
            </select>
        </div>
    `;
    container.appendChild(row);
    // Scroll para o novo campo
    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function removeKRRow(id) {
    const row = document.getElementById(`kr-row-${id}`);
    if (row) row.remove();
}

async function saveObjectiveWithKRs() {
    const title = document.getElementById('obj-title')?.value?.trim();
    const type = document.getElementById('obj-type')?.value;
    const owner = document.getElementById('obj-owner')?.value?.trim();
    const year = document.getElementById('obj-year')?.value;

    if (!title) {
        showToast('⚠️ Informe o título do objetivo.', 'warn');
        return;
    }

    // Monta payload do objetivo
    const objPayload = { type, name: title, owner: owner || '', year: year || '2026' };

    if (type === 'quarterly') {
        const globalParent = document.getElementById('obj-global-parent')?.value;
        const quarter = document.getElementById('obj-quarter')?.value;
        if (!globalParent) {
            showToast('⚠️ Selecione o Objetivo Global vinculado ao trimestral.', 'warn');
            return;
        }
        objPayload.global_id = globalParent;
        objPayload.quarter = quarter;
    }

    // Salva o objetivo
    const objRes = await postDataWithResponse('/objectives', objPayload);
    if (!objRes || !objRes.id) {
        showToast('❌ Erro ao salvar o objetivo.', 'error');
        return;
    }
    const newObjId = objRes.id;

    // Coleta e salva as KRs
    const rows = document.getElementById('kr-list-container').querySelectorAll('[id^="kr-row-"]');
    let savedKRs = 0;
    for (const row of rows) {
        const rid = row.id.replace('kr-row-', '');
        const krName = document.getElementById(`kr-name-${rid}`)?.value?.trim();
        if (!krName) continue;

        const krPayload = {
            name: krName,
            calculation: document.getElementById(`kr-calculation-${rid}`).value,
            measurement: document.getElementById(`kr-measurement-${rid}`).value,
            base_value: document.getElementById(`kr-base-${rid}`).value || '0',
            target_value: document.getElementById(`kr-target-${rid}`).value || '100',
            frequency: document.getElementById(`kr-frequency-${rid}`).value,
        };

        // Vincula a KR automaticamente ao objetivo recém-criado
        if (type === 'global') {
            krPayload.global_id = newObjId;
            krPayload.quarterly_id = '';
        } else {
            // Trimestral: vincula ao trimestral E ao global pai
            krPayload.quarterly_id = newObjId;
            krPayload.global_id = objPayload.global_id;
        }

        await postData('/krs', krPayload);
        savedKRs++;
    }

    // Limpa o formulário
    document.getElementById('obj-title').value = '';
    document.getElementById('obj-owner').value = '';
    document.getElementById('obj-type').value = 'global';
    document.getElementById('obj-quarterly-fields').classList.add('hidden');
    document.getElementById('kr-list-container').innerHTML = '';
    krRowCount = 0;

    await fetchData();
    switchTab('dashboard');
    showToast(`✅ Objetivo salvo com ${savedKRs} KR${savedKRs !== 1 ? 's' : ''} vinculada${savedKRs !== 1 ? 's' : ''}!`);
}

function setupForms() {
    // Formulário unificado — não há listeners de submit antigos
    // A lógica está toda em saveObjectiveWithKRs()
}

// ----------------------------------------------------
// LÓGICA DE IMPORTAÇÃO EM LOTE
// ----------------------------------------------------

function downloadCsvTemplate() {
    const csvContent = "\uFEFFTipo,Título,Responsável,Ano,Objetivo Global Vinculado,Trimestre,KR Nome,Base,Meta,Cálculo,Direção,Frequência\n" +
        "Global,Chegar a dezenas de milhões,João Silva,2026,,,Aumentar receita LTV,0,10,sum,increase,monthly\n" + 
        "Global,Chegar a dezenas de milhões,João Silva,2026,,,Reduzir cancelamentos,15,5,avg,decrease,monthly\n" + 
        "Trimestral,Triplicar Vendas Q1,Maria Souza,2026,Chegar a dezenas de milhões,Q1,Vender 3 milhões,0,3,sum,increase,monthly\n" +
        "Trimestral,Triplicar Vendas Q1,Maria Souza,2026,Chegar a dezenas de milhões,Q1,Fechar 50 contratos,0,50,sum,increase,monthly\n";
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "Template_Importacao_OKRs.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    document.getElementById('upload-csv-label').innerText = "Arquivo selecionado: " + file.name;
    const statsDiv = document.getElementById('import-stats');
    statsDiv.classList.remove('hidden');
    statsDiv.innerHTML = '<span class="text-blue-400 font-bold"><i class="ph ph-spinner animate-spin"></i> Lendo arquivo CSV...</span>';

    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async function(results) {
            const data = results.data;
            await processBulkImport(data);
        },
        error: function(err) {
            statsDiv.innerHTML = `<span class="text-red-400 font-bold"><i class="ph ph-warning-circle"></i> Erro ao ler CSV: ${err.message}</span>`;
        }
    });
}

async function processBulkImport(data) {
    const statsDiv = document.getElementById('import-stats');
    statsDiv.innerHTML = '<span class="text-blue-400 font-bold"><i class="ph ph-spinner animate-spin"></i> Processando importação nos servidores...</span>';
    
    try {
        const objectivesMap = new Map();
        
        // 1. Agrupar dados por Objetivo
        data.forEach(row => {
            const t = row['Título']?.trim();
            if (!t) return;
            if (!objectivesMap.has(t)) {
                objectivesMap.set(t, {
                    type: row['Tipo']?.trim() === 'Trimestral' ? 'quarterly' : 'global',
                    name: t,
                    owner: row['Responsável']?.trim() || '',
                    year: row['Ano']?.trim() || '2026',
                    quarter: row['Trimestre']?.trim() || '',
                    globalLinkStr: row['Objetivo Global Vinculado']?.trim() || '',
                    krs: []
                });
            }
            if (row['KR Nome'] && row['KR Nome'].trim() !== '') {
                objectivesMap.get(t).krs.push({
                    name: row['KR Nome'].trim(),
                    base_value: row['Base']?.trim() || '0',
                    target_value: row['Meta']?.trim() || '100',
                    calculation: row['Cálculo']?.trim() || 'sum',
                    measurement: row['Direção']?.trim() || 'increase',
                    frequency: row['Frequência']?.trim() || 'monthly'
                });
            }
        });

        // 2. Separar Globais de Trimestrais para garantir que os links funcionem
        const globalObjs = Array.from(objectivesMap.values()).filter(o => o.type === 'global');
        const qObjs = Array.from(objectivesMap.values()).filter(o => o.type === 'quarterly');

        let createdObjs = 0;
        let createdKRs = 0;
        const titleToIdMap = new Map();
        
        // 2a. Criar Objetivos Globais Primeiro
        for (const g of globalObjs) {
            const objPayload = { type: 'global', name: g.name, owner: g.owner, year: g.year };
            const objRes = await postDataWithResponse('/objectives', objPayload);
            if (objRes && objRes.id) {
                createdObjs++;
                titleToIdMap.set(g.name, objRes.id);
                for (const kr of g.krs) {
                    const krPayload = { ...kr, global_id: objRes.id, quarterly_id: "" };
                    await postData('/krs', krPayload);
                    createdKRs++;
                }
            }
        }
        
        // 2b. Criar Objetivos Trimestrais
        for (const q of qObjs) {
            let globalId = titleToIdMap.get(q.globalLinkStr);
            if (!globalId) {
                const exist = rawData.objectives.find(o => o.type === 'global' && o.name === q.globalLinkStr);
                if (exist) globalId = exist.id;
            }
            if (!globalId) {
                console.warn("Global não encontrado para Trimestral: ", q.name);
                continue; // Pula se n achar o global
            }
            
            const objPayload = { type: 'quarterly', name: q.name, owner: q.owner, year: q.year, global_id: globalId, quarter: q.quarter };
            const objRes = await postDataWithResponse('/objectives', objPayload);
            if (objRes && objRes.id) {
                createdObjs++;
                titleToIdMap.set(q.name, objRes.id);
                for (const kr of q.krs) {
                    const krPayload = { ...kr, global_id: globalId, quarterly_id: objRes.id };
                    await postData('/krs', krPayload);
                    createdKRs++;
                }
            }
        }

        statsDiv.innerHTML = `<span class="text-green-400 font-bold"><i class="ph ph-check-circle"></i> Sucesso! Foram importados ${createdObjs} Objetivos e ${createdKRs} KRs para o sistema.</span>`;
        await fetchData(); // Atualiza painel
        
        document.getElementById('csv-upload-file').value = ''; // Limpa pra permitir re-envio

        setTimeout(() => {
            switchTab('dashboard');
            statsDiv.classList.add('hidden');
            document.getElementById('upload-csv-label').innerText = "Clique ou arraste o arquivo preenchido (.csv).";
        }, 3000);
        
    } catch(e) {
        statsDiv.innerHTML = `<span class="text-red-400 font-bold"><i class="ph ph-warning-circle"></i> Erro na importação: ${e.message}</span>`;
        console.error(e);
    }
}

async function postDataWithResponse(endpoint, data) {
    try {
        const res = await fetch(`${API_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return await res.json();
    } catch (e) {
        console.error(e);
        return null;
    }
}

async function postData(endpoint, data) {
    try {
        await fetch(`${API_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    } catch (e) {
        console.error(e);
    }
}

function showToast(msg, type = 'success') {
    const colors = { success: 'bg-primary-600', warn: 'bg-yellow-600', error: 'bg-red-600' };
    const toast = document.createElement('div');
    toast.className = `fixed bottom-6 right-6 z-50 ${colors[type] || colors.success} text-white px-6 py-3 rounded-xl shadow-2xl font-medium text-sm flex items-center gap-2 animate-[fadeIn_0.3s_ease]`;
    toast.innerHTML = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
}


function openKRModal(krId) {
    activeKRId = krId;
    const kr = rawData.key_results.find(k => k.id === krId);
    if (!kr) return;

    document.getElementById('modal-kr-name').innerText = `Lançamentos: ${kr.name}`;

    let validMonths = ALL_MONTHS;
    if (kr.quarterly_id && kr.quarterly_id !== "") {
        const qObj = rawData.objectives.find(o => o.id === kr.quarterly_id);
        if (qObj) validMonths = Q_MONTHS[qObj.quarter];
    }

    const grid = document.getElementById('months-grid');
    grid.innerHTML = '';

    ALL_MONTHS.forEach(m => {
        const isLocked = !validMonths.includes(m);
        const wrap = document.createElement('div');
        let val = kr[m] !== undefined ? kr[m] : "";
        wrap.innerHTML = `
            <label class="block text-xs text-gray-400 mb-1">${m}</label>
            <input type="number" id="input-${m}" value="${val}" step="any"
                ${isLocked ? 'disabled' : ''} 
                class="w-full bg-gray-900 border ${isLocked ? 'border-gray-800 opacity-50 cursor-not-allowed' : 'border-gray-700 hover:border-primary-500'} rounded text-white px-3 py-2 text-sm focus:outline-none focus:border-primary-500">
        `;
        grid.appendChild(wrap);
    });

    document.getElementById('modal-update-kr').classList.remove('hidden');
    document.getElementById('modal-update-kr').classList.add('flex');
}

function closeModal() {
    document.getElementById('modal-update-kr').classList.add('hidden');
    document.getElementById('modal-update-kr').classList.remove('flex');
    activeKRId = null;
}

async function saveKRUpdate() {
    if (!activeKRId) return;

    const kr = rawData.key_results.find(k => k.id === activeKRId);
    let validMonths = ALL_MONTHS;
    if (kr.quarterly_id && kr.quarterly_id !== "") {
        const qObj = rawData.objectives.find(o => o.id === kr.quarterly_id);
        if (qObj) validMonths = Q_MONTHS[qObj.quarter];
    }

    const payload = {};
    validMonths.forEach(m => {
        const el = document.getElementById(`input-${m}`);
        if (el) {
            payload[m] = el.value;
        }
    });

    try {
        await fetch(`${API_URL}/krs/${activeKRId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        closeModal();
        fetchData();
        showToast('✅ Progresso da KR atualizado!');
    } catch (e) {
        console.error(e);
        alert("Erro ao salvar dados.");
    }
}

// ==========================================
// FUNÇÕES DE EDIÇÃO E EXCLUSÃO (OBJETIVOS / KRs)
// ==========================================

async function deleteKR(id) {
    if (!confirm("Tem certeza que deseja excluir esta KR? Todos os lançamentos serão perdidos.")) return;
    try {
        const res = await fetch(`${API_URL}/krs/${id}`, { method: 'DELETE' });
        if (res.ok) {
            showToast('✅ KR excluída.');
            fetchData();
        } else {
            showToast('❌ Erro ao excluir KR.', 'error');
        }
    } catch (e) {
        console.error(e);
    }
}

async function deleteObjective(id) {
    if (!confirm("Atenção! Excluir este objetivo também excluirá todas as KRs vinculadas e eventuais KRs em trimestres abaixo dele. Deseja continuar?")) return;
    try {
        const res = await fetch(`${API_URL}/objectives/${id}`, { method: 'DELETE' });
        if (res.ok) {
            showToast('✅ Objetivo excluído com sucesso.');
            fetchData();
        } else {
            showToast('❌ Erro ao excluir Objetivo.', 'error');
        }
    } catch (e) {
        console.error(e);
    }
}

async function editKRPrompt(id, oldName) {
    const newName = prompt("Editar Título da Key Result:", oldName);
    if (newName && newName.trim() !== "" && newName.trim() !== oldName) {
        try {
            const res = await fetch(`${API_URL}/krs/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newName.trim() })
            });
            if (res.ok) {
                showToast('✅ Título da KR atualizado.');
                fetchData();
            }
        } catch (e) { console.error(e); }
    }
}

async function editObjectivePrompt(id, oldName) {
    const newName = prompt("Editar Título do Objetivo:", oldName);
    if (newName && newName.trim() !== "" && newName.trim() !== oldName) {
        try {
            const res = await fetch(`${API_URL}/objectives/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newName.trim() })
            });
            if (res.ok) {
                showToast('✅ Título do Objetivo atualizado.');
                fetchData();
            }
        } catch (e) { console.error(e); }
    }
}
