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