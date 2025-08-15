# Monitoramento de Rede - IFPR

Este projeto permite o monitoramento em tempo real de dispositivos da rede do campus, com visualização gráfica de histórico e status.

## Funcionalidades
- Visualização de dispositivos online/offline
- Histórico de latência com gráficos
- Adição e edição de equipamentos via painel web
- Armazenamento de dados no Firebase Realtime Database

## Requisitos
- Python 3.x
- Firebase Realtime Database configurado
- Arquivo `serviceAccountKey.json` com chave de serviço do Firebase
- Dependências Python: `ping3`, `firebase_admin`

## Como executar
1. Instale as dependências:
   ```bash
   pip install ping3 firebase-admin
   ```

2. Inicie o agente de monitoramento:
   ```bash
   python agente.py
   ```

3. Hospede os arquivos HTML (`index.html`, `style.css`, `dashboard.js`) em um servidor estático (ex: GitHub Pages).

## Firebase
Certifique-se de ativar o Firebase Realtime Database e configurar as regras para testes (ou conforme segurança da instituição):
```json
{
  "rules": {
    ".read": true,
    ".write": "auth != null"
  }
}
```

---

Desenvolvido para IFPR - Campus União da Vitória.
