# 🚀 Guia de Publicação do Dashboard OKR (Google Workspace)

Este guia foi desenhado para quem nunca fez isso antes. Vamos abandonar o seu servidor local (Python) e transformar o seu sistema em uma plataforma corporativa na nuvem, usando os recursos gratuitos e seguros do **Google Workspace** que sua empresa já paga.

A lógica é simples:
1. O **Google Sheets (Planilhas)** será o nosso "banco de dados" definitivo.
2. O **Google Apps Script** será o nosso "servidor" invisível na nuvem.
3. O código da **Tela (HTML/JS)** será conectado à API que vamos gerar.

---

## 🛠 Passo 1: Criar o seu "Banco de Dados" (Planilha)

1. Acesse o seu [Google Drive](https://drive.google.com).
2. Clique no botão **`+ Novo`** no canto superior esquerdo e escolha **`Google Planilhas`**.
3. Dê o nome de **`Banco de Dados - OKR System`** à planilha.
4. Você criará **Duas Abas (Páginas)** na parte inferior do Excel do Google:
   * Renomeie a primeira aba, que já vem aberta como "Página1", para **`objectives`**.
   * Clique no sinal de `+` no rodapé esquerdo para abrir uma nova aba e a renomeie para **`key_results`**.

### Configurando as Colunas (Crucial)

Na **aba `objectives`**, escreva na primeira linha do cabeçalho (Células A1 à E1):
* A1: `id` (exemplo de preenchimento real: `obj-1`)
* B1: `type` (ex: `global` ou `quarterly`)
* C1: `name` (ex: `Objetivo Principal de Receitas`)
* D1: `quarter` (ex: `Q1`)
* E1: `global_id` (vazio se for global, ID do global se for trimestral)

Na **aba `key_results`**, escreva na primeira linha do cabeçalho (Células A1 à H1):
* A1: `id` (ex: `kr-1`)
* B1: `global_id` (vazio se não tiver vínculo com um global)
* C1: `quarterly_id` (vazio se não tiver vínculo trimestral)
* D1: `name` (ex: `Atingir 1 milhão`)
* E1: `base_value` (ex: `0`)
* F1: `target_value` (ex: `1000000`)
* G1: `measurement` (ex: `increase` ou `decrease`)
* H1: `history` (Deixe sempre a célula vazia. Nosso sistema vai salvar automaticamente os gráficos mensais aqui!)

> **Dica Inicial:** Cadastre manualmente um ou dois objetivos e uma KR abaixo das colunas da linha 1 para ter dados para enxergar de imediato na tela!

---

## 🤖 Passo 2: Criar o Lado Robótico (O Servidor Apps Script)

1. Ainda, na sua planilha aberta, clique no menu superior **`Extensões`** e em seguida selecione **`Apps Script`**.
2. Essa nova tela preta de códigos é o cérebro que vai comunicar a Planilha com a sua interface.
3. Haverá um texto "Código.gs". Selecione tudo o que estiver escrito e apague.
4. **Copie e Cole** exatamente o script azul inteiro abaixo:

```javascript
/* MÁQUINA DE API PARA LER E SALVAR OKRS DIRETO NAS PLANILHAS */

function doGet(e) {
  var sheetApp = SpreadsheetApp.getActiveSpreadsheet();
  
  // Extrai de forma dinâmica Dados dos Objetivos
  var objSheet = sheetApp.getSheetByName("objectives");
  
  if (!objSheet) return ContentService.createTextOutput("Erro! Aba objectives nao existe.").setMimeType(ContentService.MimeType.JSON);
  
  var objData = objSheet.getDataRange().getValues();
  var objectives = buildJsonFromSheet(objData);
  
  // Extrai Dados dos Key Results
  var krSheet = sheetApp.getSheetByName("key_results");
  if (!krSheet) return ContentService.createTextOutput("Erro! Aba key_results nao existe.").setMimeType(ContentService.MimeType.JSON);

  var krData = krSheet.getDataRange().getValues();
  var keyResults = buildJsonFromSheet(krData);
  
  var responsePayload = {
    objectives: objectives,
    key_results: keyResults
  };
  
  return ContentService.createTextOutput(JSON.stringify(responsePayload))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  // Captura as atualizações do gráfico enviadas do seu App Node
  try {
    if(e.postData && e.postData.contents) {
      var payload = JSON.parse(e.postData.contents);
      if(payload.type === "update_kr") {
        updateKrHistory(payload.id, payload.history);
        return ContentService.createTextOutput(JSON.stringify({success: true, message: "Anotado no Google Sheets com Sucesso!"}))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
  } catch(error) {
     return ContentService.createTextOutput(JSON.stringify({success: false, message: error.message}))
          .setMimeType(ContentService.MimeType.JSON);
  }
}

// ---- ENGRENAGENS INTERNAS (NÃO MEXER) ----

// Faz o Excel inteiro virar código JSON (Formato de robô)
function buildJsonFromSheet(dataArray) {
  var result = [];
  if (dataArray.length < 1) return result;
  
  var headers = dataArray[0]; // Pega todo cabeçalho
  for(var i = 1; i < dataArray.length; i++) {
    var row = dataArray[i];
    var obj = {};
    for(var j = 0; j < headers.length; j++) {
      var value = row[j];
      
      // Essa parte é vital. A Coluna 'history' injeta gráficos complexos em uma unica celula do Sheets, então descompactamos magicamente
      if (headers[j] === "history") {
         try {
            obj[headers[j]] = value ? JSON.parse(value) : [];
         } catch(e) {
            obj[headers[j]] = [];
         }
      } else {
         obj[headers[j]] = value;
      }
    }
    result.push(obj);
  }
  return result;
}

// Quando você editar o Modam mensal, ele caça seu ID na planilha e atualiza a celula secreta com o Status
function updateKrHistory(krId, historyArray) {
  var krSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("key_results");
  var data = krSheet.getDataRange().getValues();
  var historyString = JSON.stringify(historyArray);
  
  // Escaneia do primeiro item ate o ultimo na coluna ID
  for(var i = 1; i < data.length; i++) {
    if(data[i][0] === krId) {  
      krSheet.getRange(i + 1, 8).setValue(historyString); // Regrava direto na Coluna H
      break;
    }
  }
}
```
5. Clique no ícone de "Salvar" (O Disquete) no topo!

---

## 🌎 Passo 3: Colocar a Planilha Viva na Internet !

1. No canto **Superior Direito** da tela do script azul, clique no botão azulão **`Implantar`** (Deploy).
2. Escolha **`Nova Implantação`**.
3. Na janela em branco, clique no ícone minúsculo de engrenagem ⚙️ e escolha **`App da Web`**.
4. Configure rigorosamente assim:
   * Descrição: `API Oficial OKR Dashboard`
   * Executar como: `Eu (Seu email corporativo)`
   * Quem pode acessar: `Qualquer Pessoa` *(Tranquilo, nós não usaremos senhas aqui porque eles precisam acessar a API sem logar no backend, porém nós protegeremos o frontend na intranet)*
5. Clique em **`Implantar`**.
6. Uma tela de "Autorização Negada" pode surgir. Clique em **`Revisar Permissões`**, faça login com seu email, clique na parte inferior em **`Avançado`**, clique no link sublinhado e em **"Permitir"**.
7. Será criado no final uma grande **`URL do App da Web`** parecida com:
   `https://script.google.com/macros/s/AKfycbzzxzxasasa.../exec`
8. **COPIE EXTAMENTE ESSE LINK INTEIRO. ELE É O SEU NOVO SERVIDOR (SUA API)**.

---

## 🔀 Passo 4: Conectar nosso HTML aos Tubos da Nuvem

Até hoje, o nosso dashboard se grudava num pequeno arquivo de mentira usando o Python. Agora, ele vai comunicar pela internet oficial do google.

1. No seu VSCode ou pasta em seu computador local, abra o arquivo original de JavaScript `app.js`.
2. Localize a linha principal nas quatro primeiras linhas, que provavelmente está assim:
```javascript
const API_URL = 'http://localhost:8000/api';
```
3. Substitua esse Localhost vazio diretamente pela sua **URL DO APP DA WEB** gigantesca recém copiada:
```javascript
const API_URL = 'https://script.google.com/macros/s/... SUA CHAVE AQUI .../exec';
```
4. PRONTO! Basta Recarregar(Dar F5)! O sistema vai carregar magicamente conectando e batendo nas luzes verdes do Google Sheets que recém configuramos! Qualquer KR mudada no sistema reflete em milésimos de segundo injetado na coluna `history` da sua planilha oficial, para auditoria!

---

## ✨ Passo Final (Opcional): Distribuir na Empresa usando GitHub Sites / Vercel
Como removemos a necessidade de um servidor robusto pago, agora nossa interface inteira com Modos de TV incríveis não passa de meia dúzia de arquivos `.html` estáticos e Javascript limpo com base no CSS Tailwind!

Você pode livremente hospedar as duas páginas (index.html e a logo symbol-sl) dezenas de vezes nas SmartTvs e Servidores Estáticos sem custo (Vercel ou Netlify). Eles irão se auto-sustentar apenas batendo lá nos cofres de Sheets pelo endpoint que programamos, com segurança e velocidade relâmpago!
