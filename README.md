# 💰 finança — Controle Financeiro Pessoal

Dashboard financeiro pessoal com tema escuro, gráficos e exportação de extrato em PDF.

## ✨ Funcionalidades

- **Autenticação real** via Firebase Authentication (login, cadastro, recuperação de senha)
- **Dados na nuvem** via Firestore — acessíveis de qualquer dispositivo
- **Painel** com KPIs em tempo real (salário, gastos, saldo, entradas)
- **Barra de uso do salário** com alerta por cor
- **Gráfico de linha** com evolução do saldo
- **Gráfico de pizza** com distribuição por categoria
- **Lançamentos** com filtros por tipo, categoria e mês
- **Categorias** personalizáveis (cor + ícone)
- **Extrato em PDF** estilo bancário, por mês


## 📁 Estrutura

```
finance-dashboard/
├── index.html    # App principal (dashboard)
├── auth.html     # Tela de login e cadastro
├── app.js        # Lógica do app + integração Firestore
├── auth.js       # Autenticação Firebase
├── firebase.js   # Configuração Firebase
├── style.css     # Estilos dark mode
└── README.md
```

## 🛠 Tecnologias

- HTML5 + CSS3
- [Tailwind CSS](https://tailwindcss.com) via CDN
- [Chart.js](https://chartjs.org) via CDN
- [Firebase Authentication](https://firebase.google.com/products/auth) — login real
- [Cloud Firestore](https://firebase.google.com/products/firestore) — banco de dados na nuvem
- Google Fonts: DM Sans + DM Mono + Playfair Display
