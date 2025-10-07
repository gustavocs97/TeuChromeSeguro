# Template de Lista

Este é um template para criar novas listas de extensões maliciosas.

## Como usar:

1. Copie esta pasta inteira
2. Renomeie para o nome da sua lista (use apenas letras minúsculas, números e hífens)
3. Edite o arquivo `config.json` com suas configurações
4. (Opcional) Adicione um arquivo `data.[csv|txt|json]` com dados locais

## Configuração:

### Campos obrigatórios:

- `name`: Nome interno da lista (mesmo nome da pasta)
- `url`: URL de onde baixar a lista
- `format`: Formato do arquivo (`csv`, `txt` ou `json`)

### Campos opcionais:

- `displayName`: Nome amigável para exibição
- `hasHeaders`: Se o arquivo tem linha de cabeçalho (CSV/JSON)
- `idField`: Nome do campo que contém o ID da extensão
- `nameField`: Nome do campo que contém o nome
- `categoryField`: Nome do campo que contém a categoria
- `typeField`: Nome do campo que contém o tipo
- `linkField`: Nome do campo que contém o link de referência
- `commentField`: Nome do campo que contém comentários
- `enabled`: Se a lista está ativa
- `localFile`: Nome do arquivo local de backup

## Formatos suportados:

### CSV

csv browser_extension_id,browser_extension,metadata_category abcdefghijklmnopqrstuvwxyz123456,Extension Name,malware


### TXT (IDs linha a linha)

abcdefghijklmnopqrstuvwxyz123456
bcdefghijklmnopqrstuvwxyz123456a



### JSON

json [ { "id": "abcdefghijklmnopqrstuvwxyz123456", "name": "Extension Name", "category": "malware" } ]




