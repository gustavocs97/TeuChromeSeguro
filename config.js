// Configuração global da extensão
const CONFIG = {
  // Tempo em dias para considerar cache válido
  cacheValidityDays: 7,
  
  // Perguntar para atualizar ao abrir extensão
  askForUpdateOnOpen: true,
  
  // Validar formato de ID (32 caracteres alfanuméricos)
  validateExtensionId: true,
  
  // Padrão de ID de extensão Chrome
  extensionIdPattern: /^[a-z]{32}$/,
  
  // Configurações padrão de listas
  defaultListConfig: {
    enabled: true,
    autoUpdate: false,
    lastUpdate: null
  }
};

// Exporta configuração
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}