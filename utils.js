// utils.js
// Funções utilitárias

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
      console.log(`🌐 Baixando: ${url}`);
      
      const response = await fetch(url, {
        method: 'GET',
        cache: 'no-cache',
        headers: {
          'Accept': 'text/plain, text/csv, application/json, */*'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const text = await response.text();
      console.log(`✅ Baixado: ${text.length} chars`);
      
      return text;
    } catch (error) {
      console.error('❌ Erro ao baixar arquivo:', error);
      throw error;
    }
  },

  async readLocalFile(path) {
    try {
      const url = chrome.runtime.getURL(path);
      console.log(`📂 Lendo: ${path}`);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        console.error(`❌ Erro HTTP ${response.status}: ${path}`);
        return null;
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const decoder = new TextDecoder('utf-8');
      const text = decoder.decode(arrayBuffer);
      
      console.log(`✅ Lido: ${path} (${text.length} chars)`);
      
      const newlineRegex = /\r?/;
      

      const lineCount = text.split(/\r?/).filter(line => line.trim()).length;
      console.log(`   📊 Total de linhas: ${lineCount}`);


      return text;
    } catch (error) {
      console.error(`❌ Erro ao ler ${path}:`, error);
      return null;
    }
  },

  async saveToStorage(key, data) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: data }, () => {
        if (chrome.runtime.lastError) {
          console.error(`❌ Erro ao salvar ${key}:`, chrome.runtime.lastError);
        } else {
          console.log(`💾 Salvo: ${key}`);
        }
        resolve();
      });
    });
  },

  async loadFromStorage(key) {
    return new Promise((resolve) => {
      chrome.storage.local.get([key], (result) => {
        if (chrome.runtime.lastError) {
          console.error(`❌ Erro ao carregar ${key}:`, chrome.runtime.lastError);
          resolve(null);
        } else {
          const data = result[key] || null;
          if (data) {
            console.log(`📦 Carregado: ${key}`);
          }
          resolve(data);
        }
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
  },

  formatDate(timestamp) {
    if (!timestamp) return 'Nunca';
    const date = new Date(timestamp);
    return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR');
  },

  async clearListCache(folder) {
    try {
      await chrome.storage.local.remove(`cache_${folder}`);
      console.log(`🗑️ Cache limpo: ${folder}`);
      return true;
    } catch (error) {
      console.error(`❌ Erro ao limpar cache ${folder}:`, error);
      return false;
    }
  },

  async clearAllCache() {
    try {
      const folders = await this.getListFolders();
      for (const folder of folders) {
        await this.clearListCache(folder);
      }
      console.log(`🗑️ Todo cache limpo!`);
      return true;
    } catch (error) {
      console.error(`❌ Erro ao limpar todo cache:`, error);
      return false;
    }
  }
};