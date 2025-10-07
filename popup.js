//popup.js

// Dados das extensões maliciosas de todas as fontes
let allMaliciousData = [];

// Estado da aplicação
let currentExtensions = [];

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  await checkForUpdates();
  await scanExtensions();
});

// Configura event listeners
function setupEventListeners() {
  // Botões do header
  document.getElementById('updateBtn').addEventListener('click', updateAllLists);
  document.getElementById('settingsBtn').addEventListener('click', openSettings);

  // Prompt de atualização
  document.getElementById('updateYes').addEventListener('click', async () => {
    hideUpdatePrompt();
    await updateAllLists();
  });
  
  document.getElementById('updateNo').addEventListener('click', () => {
    hideUpdatePrompt();
  });
  
  document.getElementById('updateNever').addEventListener('click', async () => {
    await Utils.saveToStorage('askForUpdateOnOpen', false);
    hideUpdatePrompt();
  });

  // Abas
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      
      tab.classList.add('active');
      document.getElementById(tabName + 'Tab').classList.add('active');
    });
  });
}

// Verifica se deve perguntar sobre atualização
async function checkForUpdates() {
  const askForUpdate = await Utils.loadFromStorage('askForUpdateOnOpen');
  
  // Se não tem configuração salva, usa o padrão do config
  if (askForUpdate === null) {
    if (CONFIG.askForUpdateOnOpen) {
      showUpdatePrompt();
    }
  } else if (askForUpdate === true) {
    showUpdatePrompt();
  }
}

// Mostra prompt de atualização
function showUpdatePrompt() {
  document.getElementById('updatePrompt').style.display = 'block';
}

// Esconde prompt de atualização
function hideUpdatePrompt() {
  document.getElementById('updatePrompt').style.display = 'none';
}

// Atualiza todas as listas
async function updateAllLists() {
  showLoading('Atualizando listas...');
  
  try {
    const folders = await Utils.getListFolders();
    let totalUpdated = 0;
    
    for (const folder of folders) {
      try {
        console.log(`🔄 Iniciando update de: ${folder}`);
        const updated = await updateList(folder);
        if (updated) {
          totalUpdated++;
          console.log(`✅ ${folder} atualizado com sucesso`);
        }
      } catch (error) {
        console.error(`❌ Erro ao atualizar ${folder}:`, error);
      }
    }
    
    // Recarrega dados e atualiza display
    await loadAllMaliciousData();
    await scanExtensions();
    
    alert(`✅ ${totalUpdated} lista(s) atualizada(s) com sucesso!`);
  } catch (error) {
    console.error('❌ Erro ao atualizar listas:', error);
    alert('❌ Erro ao atualizar listas: ' + error.message);
  } finally {
    hideLoading();
  }
}

// Atualiza uma lista específica
async function updateList(folder) {
  try {
    console.log(`📋 [${folder}] Carregando configuração...`);
    
    // Carrega configuração da lista
    const configPath = `lists/${folder}/config.json`;
    const configText = await Utils.readLocalFile(configPath);
    
    if (!configText) {
      console.error(`❌ Config não encontrado para ${folder}`);
      return false;
    }
    
    const config = JSON.parse(configText);
    console.log(`📋 [${folder}] Config carregado:`, config);
    
    if (!config.enabled) {
      console.log(`⚠️ Lista ${folder} está desabilitada`);
      return false;
    }
    
    if (!config.url) {
      console.log(`⚠️ Lista ${folder} não tem URL configurada`);
      return false;
    }
    
    // Baixa arquivo da URL
    console.log(`🌐 [${folder}] Baixando de: ${config.url}`);
    const content = await Utils.fetchFile(config.url);
    console.log(`✅ [${folder}] Baixado: ${content.length} caracteres`);
    
    // Faz parse do conteúdo
    console.log(`🔍 [${folder}] Iniciando parse (formato: ${config.format})...`);
    const parsedData = Parser.parse(content, config);
    console.log(`✅ [${folder}] Parse concluído: ${parsedData.length} itens`);
    
    // Debug: mostra primeiros itens
    if (parsedData.length > 0) {
      console.log(`📊 [${folder}] Primeiros 3 itens:`, parsedData.slice(0, 3));
    } else {
      console.warn(`⚠️ [${folder}] NENHUM ITEM FOI PARSEADO!`);
      console.log(`📄 [${folder}] Primeiras 500 chars do conteúdo:`, content.substring(0, 500));
    }
    
    // Salva no cache
    const cacheData = {
      data: parsedData,
      lastUpdate: Utils.getCurrentTimestamp(),
      config: config
    };
    
    await Utils.saveToStorage(`cache_${folder}`, cacheData);
    console.log(`💾 [${folder}] Salvo no cache`);
    
    return true;
  } catch (error) {
    console.error(`❌ Erro ao atualizar lista ${folder}:`, error);
    throw error;
  }
}

// Carrega todos os dados maliciosos do cache
async function loadAllMaliciousData() {
  const folders = await Utils.getListFolders();
  allMaliciousData = [];
  
  for (const folder of folders) {
    const cached = await Utils.loadFromStorage(`cache_${folder}`);
    
    // Se não tem cache, tenta carregar do arquivo local
    if (!cached || !cached.data) {
      console.log(`⚠️ Sem cache para ${folder}, carregando do arquivo local...`);
      await loadListFromLocalFile(folder);
      continue;
    }
    
    console.log(`📦 [${folder}] Carregado do cache: ${cached.data.length} itens`);
    allMaliciousData.push(...cached.data);
  }
  
  console.log(`📊 Total de IDs maliciosos carregados: ${allMaliciousData.length}`);
}

// Carrega lista do arquivo local
async function loadListFromLocalFile(folder) {
  try {
    const configPath = `lists/${folder}/config.json`;
    const configText = await Utils.readLocalFile(configPath);
    
    if (!configText) return;
    
    const config = JSON.parse(configText);
    const dataPath = `lists/${folder}/${config.localFile}`;
    const content = await Utils.readLocalFile(dataPath);
    
    if (!content) return;
    
    const parsedData = Parser.parse(content, config);
    
    // Salva no cache
    await Utils.saveToStorage(`cache_${folder}`, {
      data: parsedData,
      lastUpdate: null,
      config: config
    });
    
    allMaliciousData.push(...parsedData);
    console.log(`✅ Lista ${folder} carregada do arquivo local: ${parsedData.length} itens`);
  } catch (error) {
    console.error(`❌ Erro ao carregar ${folder} do arquivo local:`, error);
  }
}

// Escaneia todas as extensões instaladas
async function scanExtensions() {
  showLoading('Analisando extensões...');
  
  try {
    await loadAllMaliciousData();
    
    const extensions = await chrome.management.getAll();
    currentExtensions = extensions.filter(ext => ext.id !== chrome.runtime.id);
    
    const maliciousExtensions = [];
    const safeExtensions = [];
    
    // Cria mapa de IDs maliciosos para lookup rápido
    const maliciousMap = new Map();
    allMaliciousData.forEach(item => {
      if (!maliciousMap.has(item.id)) {
        maliciousMap.set(item.id, []);
      }
      maliciousMap.get(item.id).push(item);
    });
    
    // Classifica extensões
    currentExtensions.forEach(ext => {
      if (maliciousMap.has(ext.id)) {
        maliciousExtensions.push({
          ...ext,
          sources: maliciousMap.get(ext.id)
        });
      } else {
        safeExtensions.push(ext);
      }
    });
    
    displayResults(maliciousExtensions, safeExtensions);
    
    // Atualiza badge
    chrome.runtime.sendMessage({ action: 'updateBadge' });
  } catch (error) {
    console.error('❌ Erro ao escanear extensões:', error);
    alert('Erro ao escanear extensões: ' + error.message);
  } finally {
    hideLoading();
  }
}

// Exibe resultados
function displayResults(malicious, safe) {
  // Atualiza contadores
  document.getElementById('safeCount').textContent = safe.length;
  document.getElementById('maliciousCount').textContent = malicious.length;
  document.getElementById('safeTabCount').textContent = safe.length;
  document.getElementById('maliciousTabCount').textContent = malicious.length;

  // Exibe extensões maliciosas
  const maliciousList = document.getElementById('maliciousList');
  if (malicious.length === 0) {
    maliciousList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">✅</div>
        <div class="empty-state-text">Nenhuma extensão maliciosa detectada!</div>
      </div>
    `;
  } else {
    maliciousList.innerHTML = malicious.map(ext => createExtensionCard(ext, true)).join('');
  }

  // Exibe extensões verificadas
  const safeList = document.getElementById('safeList');
  if (safe.length === 0) {
    safeList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📦</div>
        <div class="empty-state-text">Nenhuma extensão verificada encontrada.</div>
      </div>
    `;
  } else {
    safeList.innerHTML = safe.map(ext => createExtensionCard(ext, false)).join('');
  }

  // Adiciona event listeners
  attachButtonListeners();
}

// Cria card de extensão
function createExtensionCard(extension, isMalicious) {
  const iconUrl = extension.icons && extension.icons.length > 0 
    ? extension.icons[extension.icons.length - 1].url 
    : 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="32" height="32"%3E%3Crect width="32" height="32" fill="%23ccc"/%3E%3C/svg%3E';

  const statusClass = extension.enabled ? 'enabled' : 'disabled';
  const statusText = extension.enabled ? 'Ativa' : 'Desativada';

  let sourcesHtml = '';
  if (isMalicious && extension.sources && extension.sources.length > 0) {
    const sourcesItems = extension.sources.map(source => {
      return `
        <div class="source-item">
          <span class="source-name">📋 ${source.source}</span>
          ${source.name ? `<div class="source-detail"><strong>Nome:</strong> ${source.name}</div>` : ''}
          ${source.category ? `<div class="source-detail"><strong>Categoria:</strong> ${source.category}</div>` : ''}
          ${source.type ? `<div class="source-detail"><strong>Tipo:</strong> ${source.type}</div>` : ''}
          ${source.comment ? `<div class="source-detail"><strong>Comentário:</strong> ${source.comment}</div>` : ''}
          ${source.link ? `<div class="source-detail"><a href="${source.link}" target="_blank" class="source-link">🔗 Ver fonte</a></div>` : ''}
        </div>
      `;
    }).join('');
    
    sourcesHtml = `
      <div class="extension-sources">
        <div class="source-title">⚠️ Encontrado em ${extension.sources.length} lista(s):</div>
        ${sourcesItems}
      </div>
    `;
  }

  const actionsHtml = `
    <div class="extension-actions">
      ${extension.enabled ? `
        <button class="btn btn-disable" data-id="${extension.id}" data-action="disable">
          Desativar
        </button>
      ` : `
        <button class="btn btn-enable" data-id="${extension.id}" data-action="enable">
          Ativar
        </button>
      `}
      <button class="btn btn-remove" data-id="${extension.id}" data-action="uninstall">
        Remover
      </button>
    </div>
  `;

  return `
    <div class="extension-card ${isMalicious ? 'malicious' : 'safe'}">
      <div class="extension-header">
        <img src="${iconUrl}" alt="${extension.name}" class="extension-icon" data-fallback="true">
        <div class="extension-info">
          <div class="extension-name">${extension.name}</div>
          <div class="extension-id">${extension.id}</div>
        </div>
        <span class="extension-status ${statusClass}">${statusText}</span>
      </div>
      ${sourcesHtml}
      ${actionsHtml}
    </div>
  `;
}

// Adiciona listeners aos botões
function attachButtonListeners() {
  document.querySelectorAll('[data-action]').forEach(button => {
    button.addEventListener('click', handleAction);
  });
  
  // Tratamento de erro de imagem
  document.querySelectorAll('img[data-fallback]').forEach(img => {
    img.addEventListener('error', function() {
      this.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="32" height="32"%3E%3Crect width="32" height="32" fill="%23ccc"/%3E%3C/svg%3E';
    });
  });
}

// Gerencia ações
async function handleAction(event) {
  const button = event.target;
  const action = button.dataset.action;
  const extensionId = button.dataset.id;

  button.disabled = true;

  try {
    if (action === 'disable') {
      await chrome.management.setEnabled(extensionId, false);
    } else if (action === 'enable') {
      await chrome.management.setEnabled(extensionId, true);
    } else if (action === 'uninstall') {
      if (confirm('⚠️ Tem certeza que deseja remover esta extensão?')) {
        await chrome.management.uninstall(extensionId);
      } else {
        button.disabled = false;
        return;
      }
    }
    
    await scanExtensions();
  } catch (error) {
    console.error('Erro ao executar ação:', error);
    alert('❌ Erro: ' + error.message);
    button.disabled = false;
  }
}

// Abre configurações
function openSettings() {
  chrome.tabs.create({ url: chrome.runtime.getURL('settings.html') });
}

// Mostra loading
function showLoading(text = 'Carregando...') {
  document.getElementById('loadingText').textContent = text;
  document.getElementById('loading').classList.add('active');
}

// Esconde loading
function hideLoading() {
  document.getElementById('loading').classList.remove('active');
}