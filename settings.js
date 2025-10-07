// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  setupEventListeners();
  await displayLists();
});

// Configura event listeners
function setupEventListeners() {


  // Checkbox de pergunta na abertura
  document.getElementById('askOnOpen').addEventListener('change', async (e) => {
    await Utils.saveToStorage('askForUpdateOnOpen', e.target.checked);
  });

  // Botão adicionar lista
  document.getElementById('addListBtn').addEventListener('click', () => {
    showAddListForm();
  });

  // Cancelar adição
  document.getElementById('cancelAddBtn').addEventListener('click', () => {
    hideAddListForm();
  });

  // Form de adicionar lista
  document.getElementById('addListForm').addEventListener('submit', handleAddList);

  // Mudança de formato
  document.getElementById('listFormat').addEventListener('change', (e) => {
    const csvOptions = document.getElementById('csvOptions');
    if (e.target.value === 'csv' || e.target.value === 'json') {
      csvOptions.style.display = 'block';
    } else {
      csvOptions.style.display = 'none';
    }
  });

  // Has headers checkbox
  document.getElementById('listHasHeaders').addEventListener('change', (e) => {
    const csvOptions = document.getElementById('csvOptions');
    if (e.target.checked) {
      csvOptions.style.display = 'block';
    }
  });

  // Botão recarregar dados locais
  document.getElementById('reloadLocalBtn').addEventListener('click', async () => {
    if (confirm('🔄 Recarregar todos os arquivos locais? Isso irá substituir os dados atuais.')) {
      try {
        await chrome.runtime.sendMessage({ action: 'reloadInitialData' });
        await displayLists();
        alert('✅ Arquivos locais recarregados com sucesso!');
      } catch (error) {
        alert('❌ Erro ao recarregar: ' + error.message);
      }
    }
  });



  // Dentro de setupEventListeners()
  document.getElementById('debugCacheBtn').addEventListener('click', async () => {
    const folders = await Utils.getListFolders();
    console.log('=== DEBUG CACHE ===');
    for (const folder of folders) {
      const cache = await Utils.loadFromStorage(`cache_${folder}`);
      console.log(`  📦 ${folder}:`, {
        items: cache?.data?.length || 0,
        lastUpdate: Utils.formatDate(cache?.lastUpdate),
        config: cache?.config
      });
    }
    alert('✅ Veja o console (F12) para detalhes do cache');
  });




}

// Carrega configurações
async function loadSettings() {
  const askOnOpen = await Utils.loadFromStorage('askForUpdateOnOpen');
  document.getElementById('askOnOpen').checked = askOnOpen !== false;
}

// Exibe listas
async function displayLists() {
  const listsList = document.getElementById('listsList');
  const folders = await Utils.getListFolders();
  
  if (folders.length === 0) {
    listsList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <div class="empty-state-text">Nenhuma lista configurada.</div>
      </div>
    `;
    return;
  }

  let html = '';
  
  for (const folder of folders) {
    const cached = await Utils.loadFromStorage(`cache_${folder}`);
    const config = cached?.config || await loadListConfig(folder);
    
    if (!config) {
      console.warn(`⚠️ Config não encontrado para ${folder}`);
      continue;
    }

    const itemCount = cached?.data?.length || 0;
    const lastUpdate = cached?.lastUpdate;
    const isEnabled = config.enabled !== false;
    
    console.log(`📊 [${folder}] Exibindo: ${itemCount} itens, última atualização: ${Utils.formatDate(lastUpdate)}`);

    html += `
      <div class="list-card ${isEnabled ? '' : 'disabled'}">
        <div class="list-header">
          <div class="list-title">📋 ${config.displayName || folder}</div>
          <div class="list-toggle">
            <label class="switch">
              <input type="checkbox" 
                     ${isEnabled ? 'checked' : ''} 
                     data-folder="${folder}"
                     class="list-enabled-toggle">
              <span class="slider"></span>
            </label>
          </div>
        </div>

        <div class="list-info">
          <div class="info-item">
            <span class="info-label">Formato:</span>
            ${config.format?.toUpperCase() || 'N/A'}
          </div>
          <div class="info-item">
            <span class="info-label">Itens:</span>
            ${itemCount}
          </div>
          <div class="info-item">
            <span class="info-label">Última Atualização:</span>
            ${Utils.formatDate(lastUpdate)}
          </div>
          <div class="info-item">
            <span class="info-label">Status:</span>
            ${isEnabled ? 
              '<span class="badge badge-success">Ativa</span>' : 
              '<span class="badge badge-warning">Desativada</span>'}
          </div>
        </div>

        <div class="list-url">
          🔗 ${config.url || 'Local apenas'}
        </div>

        <div class="list-actions">
          <button class="btn btn-success btn-small" 
                  data-folder="${folder}" 
                  data-action="update"
                  ${!config.url ? 'disabled' : ''}>
            🔄 Atualizar
          </button>
          <button class="btn btn-danger btn-small" 
                  data-folder="${folder}" 
                  data-action="delete">
            🗑️ Remover
          </button>
        </div>
      </div>
    `;
  }

  listsList.innerHTML = html;
  attachListEventListeners();
}

// Carrega configuração de uma lista
async function loadListConfig(folder) {
  try {
    const configPath = `lists/${folder}/config.json`;
    const configText = await Utils.readLocalFile(configPath);
    if (!configText) return null;
    return JSON.parse(configText);
  } catch (error) {
    console.error(`❌ Erro ao carregar config de ${folder}:`, error);
    return null;
  }
}

// Adiciona listeners aos botões das listas
function attachListEventListeners() {
  // Toggles de ativar/desativar
  document.querySelectorAll('.list-enabled-toggle').forEach(toggle => {
    toggle.addEventListener('change', handleToggleList);
  });

  // Botões de ação
  document.querySelectorAll('[data-action]').forEach(button => {
    button.addEventListener('click', handleListAction);
  });
}

// Gerencia toggle de lista
async function handleToggleList(event) {
  const folder = event.target.dataset.folder;
  const enabled = event.target.checked;

  try {
    const cached = await Utils.loadFromStorage(`cache_${folder}`);
    if (cached && cached.config) {
      cached.config.enabled = enabled;
      await Utils.saveToStorage(`cache_${folder}`, cached);
      await displayLists();
    }
  } catch (error) {
    console.error('❌ Erro ao alternar lista:', error);
    alert('❌ Erro ao alternar lista: ' + error.message);
  }
}

// Gerencia ações das listas
async function handleListAction(event) {
  const button = event.target;
  const folder = button.dataset.folder;
  const action = button.dataset.action;

  button.disabled = true;

  try {
    if (action === 'update') {
      console.log(`🔄 Iniciando atualização de ${folder}...`);
      const count = await updateList(folder);
      alert(`✅ Lista atualizada com sucesso! ${count} itens encontrados.`);
      await displayLists();
    } else if (action === 'delete') {
      if (confirm('⚠️ Tem certeza que deseja remover esta lista?')) {
        await deleteList(folder);
        await displayLists();
      }
    }
  } catch (error) {
    console.error('❌ Erro ao executar ação:', error);
    alert('❌ Erro: ' + error.message);
  } finally {
    button.disabled = false;
  }
}












// Atualiza uma lista
async function updateList(folder) {
  try {
    console.log(`🔄 [${folder}] Iniciando atualização...`);
    
    // Sempre carrega o config do arquivo local primeiro
    const configPath = `lists/${folder}/config.json`;
    const configText = await Utils.readLocalFile(configPath);
    
    if (!configText) {
      throw new Error('Config não encontrado');
    }
    
    const config = JSON.parse(configText);
    console.log(`📋 [${folder}] Config carregado:`, config);
    
    if (!config.url) {
      throw new Error('Lista não tem URL configurada');
    }

    // Baixa arquivo
    console.log(`🌐 [${folder}] Baixando de: ${config.url}`);
    const content = await Utils.fetchFile(config.url);
    console.log(`✅ [${folder}] Baixado: ${content.length} caracteres`);
    
    // Faz parse
    console.log(`🔍 [${folder}] Parseando (formato: ${config.format})...`);
    const parsedData = Parser.parse(content, config);
    console.log(`✅ [${folder}] Parse concluído: ${parsedData.length} itens`);
    
    // Debug: mostra primeiros itens
    if (parsedData.length > 0) {
      console.log(`📊 [${folder}] Primeiros 3 itens:`, parsedData.slice(0, 3));
    } else {
      console.warn(`⚠️ [${folder}] NENHUM ITEM PARSEADO!`);
      console.log(`📄 Primeiros 500 chars:`, content.substring(0, 500));
    }
    
    // Salva no cache
    const cacheData = {
      data: parsedData,
      lastUpdate: Utils.getCurrentTimestamp(),
      config: config
    };
    
    await Utils.saveToStorage(`cache_${folder}`, cacheData);
    console.log(`💾 [${folder}] Salvo no cache`);
    
    // Verifica se salvou corretamente
    const saved = await Utils.loadFromStorage(`cache_${folder}`);
    console.log(`🔍 [${folder}] Verificação: ${saved?.data?.length || 0} itens no cache`);

    return parsedData.length;
  } catch (error) {
    console.error(`❌ [${folder}] Erro:`, error);
    throw new Error(`Erro ao atualizar lista: ${error.message}`);
  }
}

// Remove uma lista
async function deleteList(folder) {
  try {
    // Remove do cache
    await chrome.storage.local.remove([`cache_${folder}`]);
    
    // Remove da lista de folders
    const folders = await Utils.getListFolders();
    const newFolders = folders.filter(f => f !== folder);
    await Utils.saveToStorage('listFolders', newFolders);
    
    alert('✅ Lista removida com sucesso!');
  } catch (error) {
    throw new Error(`Erro ao remover lista: ${error.message}`);
  }
}

// Mostra formulário de adicionar lista
function showAddListForm() {
  document.getElementById('addListSection').style.display = 'block';
  document.getElementById('addListBtn').style.display = 'none';
}

// Esconde formulário de adicionar lista
function hideAddListForm() {
  document.getElementById('addListSection').style.display = 'none';
  document.getElementById('addListBtn').style.display = 'block';
  document.getElementById('addListForm').reset();
  document.getElementById('csvOptions').style.display = 'none';
}

// Gerencia adição de nova lista
async function handleAddList(event) {
  event.preventDefault();

  const name = document.getElementById('listName').value.trim();
  const url = document.getElementById('listUrl').value.trim();
  const format = document.getElementById('listFormat').value;
  const hasHeaders = document.getElementById('listHasHeaders').checked;

  // Valida nome
  if (!/^[a-z0-9-]+$/.test(name)) {
    alert('❌ Nome inválido. Use apenas letras minúsculas, números e hífens.');
    return;
  }

  // Verifica se já existe
  const folders = await Utils.getListFolders();
  if (folders.includes(name)) {
    alert('❌ Já existe uma lista com este nome.');
    return;
  }

  try {
    // Cria configuração
    const config = {
      name: name,
      displayName: name,
      url: url,
      format: format,
      hasHeaders: hasHeaders,
      enabled: true,
      localFile: `data.${format}`
    };

    // Se for CSV/JSON com headers, adiciona campos
    if ((format === 'csv' || format === 'json') && hasHeaders) {
      config.idField = document.getElementById('listIdField').value.trim();
      config.nameField = document.getElementById('listNameField').value.trim();
      config.categoryField = document.getElementById('listCategoryField').value.trim();
      config.typeField = document.getElementById('listTypeField').value.trim();
      config.linkField = document.getElementById('listLinkField').value.trim();
      config.commentField = document.getElementById('listCommentField').value.trim();
    }

    // Baixa e valida
    const content = await Utils.fetchFile(url);
    const parsedData = Parser.parse(content, config);

    if (parsedData.length === 0) {
      if (!confirm('⚠️ Nenhum ID válido foi encontrado. Deseja adicionar mesmo assim?')) {
        return;
      }
    }

    // Salva no cache
    await Utils.saveToStorage(`cache_${name}`, {
      data: parsedData,
      lastUpdate: Utils.getCurrentTimestamp(),
      config: config
    });

    // Adiciona à lista de folders
    folders.push(name);
    await Utils.saveToStorage('listFolders', folders);

    alert(`✅ Lista "${name}" adicionada com sucesso! ${parsedData.length} itens encontrados.`);
    
    hideAddListForm();
    await displayLists();
  } catch (error) {
    console.error('Erro ao adicionar lista:', error);
    alert('❌ Erro ao adicionar lista: ' + error.message);
  }
}