// Service Worker para background
// ===============================================
// UTILITÁRIOS INLINE (necessário para service worker)
// ===============================================

const CONFIG = {
  cacheValidityDays: 7,
  askForUpdateOnOpen: true,
  validateExtensionId: true,
  extensionIdPattern: /^[a-z0-9]{32}$/,  // ← ADICIONE 0-9 AQUI
  defaultListConfig: {
    enabled: true,
    autoUpdate: false,
    lastUpdate: null
  }
};

const Utils = {
  isValidExtensionId(id) {
    if (!CONFIG.validateExtensionId) return true;
    return CONFIG.extensionIdPattern.test(id);
  },

  getCurrentTimestamp() {
    return Date.now();
  },

  isCacheValid(lastUpdate) {
    if (!lastUpdate) return false;
    const daysSinceUpdate = (Date.now() - lastUpdate) / (1000 * 60 * 60 * 24);
    return daysSinceUpdate < CONFIG.cacheValidityDays;
  },

  async fetchFile(url) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        cache: 'no-cache'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.text();
    } catch (error) {
      console.error('Erro ao baixar arquivo:', error);
      throw error;
    }
  },

  async readLocalFile(path) {
    try {
      const url = chrome.runtime.getURL(path);
      console.log(`📂 Lendo arquivo local: ${path}`);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        console.error(`❌ Erro HTTP ${response.status} ao ler: ${path}`);
        return null;
      }
      
      // Lê COMO ARRAY BUFFER E DECODIFICA (evita corrupção)
      const arrayBuffer = await response.arrayBuffer();
      const decoder = new TextDecoder('utf-8');
      const text = decoder.decode(arrayBuffer);
      
      console.log(`✅ Arquivo lido: ${path} (${text.length} caracteres)`);
      
      return text;
    } catch (error) {
      console.error(`❌ Erro ao ler arquivo local ${path}:`, error);
      return null;
    }
  },

  async saveToStorage(key, data) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: data }, resolve);
    });
  },

  async loadFromStorage(key) {
    return new Promise((resolve) => {
      chrome.storage.local.get([key], (result) => {
        resolve(result[key] || null);
      });
    });
  },

  async getListFolders() {
    const stored = await this.loadFromStorage('listFolders');
    if (stored) return stored;
    
    return [
      'awesome-lists',
      'extension-list',
      'malicious-extensions-list',
      'chrome-mal-ids'
    ];
  }
};


// ===============================================
// PARSER INLINE (necessário para service worker)
// ===============================================

// Parser para diferentes formatos de listas

const Parser = {
  // Parse CSV com headers
  parseCSV(content, config) {
    console.log(`🔍 [${config.displayName || config.name}] Iniciando parse CSV`);
    
    // Normaliza quebras de linha
    content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = content.trim().split('\n');
    
    console.log(`📊 Total de linhas CSV: ${lines.length}`);
    
    if (lines.length === 0) {
      console.warn(`⚠️ Nenhuma linha encontrada!`);
      return [];
    }

    const results = [];
    let headers = [];

    // Função para dividir linha CSV respeitando aspas
    const splitCSVLine = (line) => {
      const result = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      
      result.push(current.trim());
      return result;
    };

    lines.forEach((line, index) => {
      line = line.trim();
      if (!line) return;

      // Primeira linha como header se configurado
      if (index === 0 && config.hasHeaders) {
        headers = splitCSVLine(line);
        console.log(`📋 Headers encontrados (${headers.length}):`, headers);
        return;
      }

      


      const values = splitCSVLine(line);
      
      // Debug primeira linha de dados
      if (index === 1 || (index === 0 && !config.hasHeaders)) {
        console.log(`📊 Primeira linha de dados:`, values.slice(0, 3));
      }
      
      let id = '';
      
      // Se tem headers, busca pelo campo configurado
      if (headers.length > 0 && config.idField) {
        const idIndex = headers.indexOf(config.idField);
        if (idIndex !== -1) {
          id = values[idIndex];
        }
      } else {
        // Sem headers, assume primeira coluna
        id = values[0];
      }
      
      // Valida e adiciona
      if (id && Utils.isValidExtensionId(id)) {
        // Se tem headers, cria objeto completo
        if (headers.length > 0) {
          const entry = {};
          headers.forEach((header, i) => {
            entry[header] = values[i] || '';
          });
          
          results.push({
            id: id,
            name: entry[config.nameField] || entry.browser_extension || '',
            category: entry[config.categoryField] || entry.metadata_category || 'unknown',
            type: entry[config.typeField] || entry.metadata_type || 'suspicious',
            link: entry[config.linkField] || entry.metadata_link || '',
            comment: entry[config.commentField] || entry.metadata_comment || '',
            source: config.displayName || config.name
          });
        } else {
          // Sem headers, adiciona só o ID
          results.push({
            id: id,
            name: '',
            category: 'malicious',
            type: 'unknown',
            link: '',
            comment: '',
            source: config.displayName || config.name
          });
        }
      }
    });

    console.log(`✅ Parse CSV: ${results.length} itens`);
    return results;
  },






  

  // Parse TXT (IDs linha a linha)
  parseTXT(content, config) {
    console.log(`🔍 [${config.displayName || config.name}] Iniciando parse TXT`);
    
    // Normaliza quebras de linha
    content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = content.trim().split('\n');
    
    console.log(`📊 Total de linhas TXT: ${lines.length}`);
    
    const results = [];
    let currentComment = '';

    lines.forEach((line, index) => {
      line = line.trim();
      
      // Ignora linhas vazias
      if (!line) {
        currentComment = '';
        return;
      }

      // Captura comentários (começam com #)
      if (line.startsWith('#')) {
        currentComment = line.substring(1).trim();
        return;
      }



      // ← ADICIONE ESTE LOG DE DEBUG
      if (index < 5) {
        console.log(`🔍 TXT Linha ${index}: "${line}", válido=${Utils.isValidExtensionId(line)}`);
      }


      // Valida e adiciona ID
      if (Utils.isValidExtensionId(line)) {
        results.push({
          id: line,
          name: '',
          category: 'malicious',
          type: 'suspicious',
          link: currentComment.startsWith('http') ? currentComment : '',
          comment: currentComment.startsWith('http') ? '' : currentComment,
          source: config.displayName || config.name
        });
      }
      
      currentComment = '';
    });

    console.log(`✅ Parse TXT: ${results.length} itens`);
    return results;
  },

  // Parse JSON
  parseJSON(content, config) {
    console.log(`🔍 [${config.displayName || config.name}] Iniciando parse JSON`);
    
    try {
      const data = JSON.parse(content);
      const results = [];

      console.log(`📊 JSON parseado, tipo: ${Array.isArray(data) ? 'array' : typeof data}`);

      // Se for array
      if (Array.isArray(data)) {
        console.log(`📊 Total de itens no array: ${data.length}`);
        
        data.forEach(item => {
          const id = item[config.idField] || item.id;
          if (id && Utils.isValidExtensionId(id)) {
            results.push({
              id: id,
              name: item[config.nameField] || item.name || '',
              category: item[config.categoryField] || item.category || 'unknown',
              type: item[config.typeField] || item.type || 'suspicious',
              link: item[config.linkField] || item.link || '',
              comment: item[config.commentField] || item.comment || '',
              source: config.displayName || config.name
            });
          }
        });
      }

      console.log(`✅ Parse JSON: ${results.length} itens`);
      return results;
    } catch (error) {
      console.error('❌ Erro ao fazer parse de JSON:', error);
      return [];
    }
  },

  // Parser principal que escolhe o método adequado
  parse(content, config) {
    console.log(`🔍 Parsing ${config.format} (${content.length} chars)`);
    
    switch (config.format.toLowerCase()) {
      case 'csv':
        return this.parseCSV(content, config);
      case 'txt':
        return this.parseTXT(content, config);
      case 'json':
        return this.parseJSON(content, config);
      default:
        console.error('❌ Formato desconhecido:', config.format);
        return [];
    }
  }
};

// ===============================================
// FUNÇÕES PRINCIPAIS
// ===============================================

// Quando a extensão é instalada, carrega os dados locais PRIMEIRO
// e depois já tenta atualizar.
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Extension Security Checker instalado');
  await loadInitialData(); // Garante que há dados base
  await updateAllLists(true); // Força a primeira atualização
});



// Adicione um listener para quando o navegador inicia
chrome.runtime.onStartup.addListener(() => {
    console.log("🚀 Navegador iniciado, verificando atualizações...");
    updateAllLists();
});


chrome.management.onInstalled.addListener(updateBadge);
chrome.management.onUninstalled.addListener(updateBadge);
chrome.management.onEnabled.addListener(updateBadge);
chrome.management.onDisabled.addListener(updateBadge);

async function loadInitialData() {
  console.log('🔄 Carregando dados iniciais...');
  
  const folders = await Utils.getListFolders();
  
  for (const folder of folders) {
    try {
      const cached = await Utils.loadFromStorage(`cache_${folder}`);
      if (cached && cached.data && cached.data.length > 0) {
        console.log(`✅ ${folder}: Cache com ${cached.data.length} itens`);
        continue;
      }
      
      const configPath = `lists/${folder}/config.json`;
      const configText = await Utils.readLocalFile(configPath);
      
      if (!configText) {
        console.error(`❌ Config não encontrado: ${folder}`);
        continue;
      }
      
      const config = JSON.parse(configText);
      const dataPath = `lists/${folder}/${config.localFile}`;
      const content = await Utils.readLocalFile(dataPath);
      
      if (!content) {
        console.error(`❌ Dados não encontrados: ${folder}`);
        continue;
      }
      
      const parsedData = Parser.parse(content, config);
      
      await Utils.saveToStorage(`cache_${folder}`, {
        data: parsedData,
        lastUpdate: null,
        config: config
      });
      
      console.log(`✅ ${folder}: ${parsedData.length} itens carregados`);
    } catch (error) {
      console.error(`❌ Erro ao carregar ${folder}:`, error);
    }
  }
  
  console.log('✅ Dados iniciais carregados!');
}

async function updateBadge() {
  try {
    const extensions = await chrome.management.getAll();
    const maliciousData = await loadAllMaliciousData();
    
    const maliciousIds = new Set();
    maliciousData.forEach(item => maliciousIds.add(item.id));
    
    const maliciousCount = extensions.filter(ext => 
      ext.id !== chrome.runtime.id && maliciousIds.has(ext.id)
    ).length;
    
    if (maliciousCount > 0) {
      chrome.action.setBadgeText({ text: maliciousCount.toString() });
      chrome.action.setBadgeBackgroundColor({ color: '#FF0000' });
      console.log(`⚠️ Badge: ${maliciousCount} extensões maliciosas`);
    } else {
      chrome.action.setBadgeText({ text: '' });
      console.log(`✅ Badge: Nenhuma extensão maliciosa`);
    }
  } catch (error) {
    console.error('❌ Erro ao atualizar badge:', error);
  }
}

async function loadAllMaliciousData() {
  try {
    const folders = await Utils.getListFolders();
    const allData = [];
    
    for (const folder of folders) {
      const cached = await Utils.loadFromStorage(`cache_${folder}`);
      if (cached && cached.data) {
        allData.push(...cached.data);
      }
    }
    
    console.log(`📦 Dados carregados: ${allData.length} itens de ${folders.length} lista(s)`);
    return allData;
  } catch (error) {
    console.error('❌ Erro ao carregar dados:', error);
    return [];
  }
}








// funçãode att no seu background.js

async function updateAllLists(forceUpdate = false) {
  console.log('🔄 Verificando atualizações das listas...');
  const folders = await Utils.getListFolders();

  for (const folder of folders) {
    try {
      console.log(`🔄 [${folder}] Iniciando update...`);
      
      // Carrega config do arquivo local
      const configPath = `lists/${folder}/config.json`;
      const configText = await Utils.readLocalFile(configPath);
      
      if (!configText) {
        console.error(`❌ [${folder}] Config não encontrado`);
        continue;
      }
      
      const config = JSON.parse(configText);
      
      // Pula se desabilitada ou sem URL
      if (!config.enabled || !config.url) {
        console.log(`⏭️ [${folder}] Pulando (enabled=${config.enabled}, url=${!!config.url})`);
        continue;
      }

      // Verifica cache apenas se não for forçado
      if (!forceUpdate) {
        const cache = await Utils.loadFromStorage(`cache_${folder}`);
        if (Utils.isCacheValid(cache?.lastUpdate)) {
          console.log(`✅ [${folder}] Cache válido`);
          continue;
        }
      }

      console.log(`🌐 [${folder}] Baixando de: ${config.url}`);
      const remoteContent = await Utils.fetchFile(config.url);
      
      if (remoteContent) {
        const parsedData = Parser.parse(remoteContent, config);
        
        await Utils.saveToStorage(`cache_${folder}`, {
          data: parsedData,
          lastUpdate: Utils.getCurrentTimestamp(),
          config: config
        });

        console.log(`✅ [${folder}] Atualizado: ${parsedData.length} itens`);
      }
    } catch (error) {
      console.error(`❌ Erro ao atualizar ${folder}:`, error);
    }
  }

  await updateBadge();
  console.log('✅ Verificação de atualização concluída');
}



chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'updateBadge') {
    updateBadge().then(() => sendResponse({ success: true }));
    return true;
  }
  
  if (request.action === 'loadMaliciousData') {
    loadAllMaliciousData().then((data) => {
      sendResponse({ success: true, data: data });
    });
    return true;
  }
  
  if (request.action === 'reloadInitialData') {
    loadInitialData().then(() => {
      updateBadge().then(() => {
        sendResponse({ success: true });
      });
    });
    return true;
  }
});

chrome.alarms.create('checkExtensions', { periodInMinutes: 30 });

// Modifique o seu alarme para chamar a função de atualização
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'checkExtensions') {
    console.log('⏰ Alarme disparado: Verificando extensões e atualizações de listas.');
    updateBadge();
    updateAllLists(); // << ADICIONE A CHAMADA AQUI
  }
});

console.log('🚀 Background script carregado');