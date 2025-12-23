# GitHub Sync

Sincroniza automaticamente seu vault Obsidian com um repositório GitHub. Mantenha suas notas sincronizadas entre diferentes dispositivos e tenha backup automático no GitHub.

## ✨ Funcionalidades

- 🔄 **Sincronização Automática**: Sincroniza automaticamente ao abrir o vault e ao salvar arquivos
- 📤 **Push Manual**: Envie suas alterações para o GitHub quando quiser
- 📥 **Pull Manual**: Baixe as alterações do GitHub quando necessário
- 🔀 **Resolução de Conflitos**: Ferramentas para resolver conflitos de merge automaticamente
- 📝 **Mensagens de Commit Inteligentes**: Inclui automaticamente a lista de arquivos alterados nos commits
- 🔐 **Autenticação Flexível**: Suporte para SSH keys e Personal Access Tokens
- ⚙️ **Configurável**: Personalize o intervalo de sincronização, mensagens de commit e muito mais

## 📋 Requisitos

- Obsidian Desktop (versão 0.15.0 ou superior)
- Node.js (para desenvolvimento)
- Repositório GitHub configurado

## 🚀 Instalação

### Instalação Manual

1. Baixe os arquivos `main.js`, `manifest.json` e `styles.css` (se houver) da [última release](https://github.com/jvsajv/NetherPortal/releases)
2. Copie os arquivos para `VaultFolder/.obsidian/plugins/obsidian-github-sync/`
3. Recarregue o Obsidian
4. Ative o plugin em **Settings → Community plugins**

### Desenvolvimento

1. Clone este repositório:
   ```bash
   git clone https://github.com/jvsajv/NetherPortal.git
   cd NetherPortal
   ```

2. Instale as dependências:
   ```bash
   npm install
   ```

3. Compile o plugin em modo desenvolvimento:
   ```bash
   npm run dev
   ```

4. Para build de produção:
   ```bash
   npm run build
   ```

## ⚙️ Configuração

Acesse **Settings → Community plugins → GitHub Sync** para configurar:

### Configurações Básicas

- **GitHub Repository URL**: URL completa do seu repositório (ex: `https://github.com/user/repo.git` ou `git@github.com:user/repo.git`)
- **GitHub Branch**: Branch padrão para sincronização (geralmente `main` ou `master`)
- **GitHub User Name**: Nome do usuário para os commits
- **GitHub User Email**: Email do usuário para os commits

### Autenticação

Escolha entre duas opções de autenticação:

#### Opção 1: Personal Access Token (HTTPS)
- Desative "Usar SSH Key"
- Configure seu **GitHub Personal Access Token**
- Para criar um token: GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)

#### Opção 2: SSH Key
- Ative "Usar SSH Key"
- Configure o caminho para sua chave SSH privada (ex: `~/.ssh/id_rsa` ou `C:\Users\YourUser\.ssh\id_rsa`)
- Se sua chave tiver passphrase, configure-a também

### Opções de Sincronização

- **Auto-sync on Vault Open**: Sincroniza automaticamente ao abrir o Obsidian
- **Auto-sync on File Save**: Sincroniza automaticamente ao salvar arquivos (com debounce de 2 segundos)
- **Auto-sync Interval**: Intervalo em minutos para sincronização automática em background (0 para desativar)

### Template de Mensagem de Commit

Personalize a mensagem de commit usando placeholders:
- `{date}`: Data e hora atual
- `{files}`: Lista de arquivos alterados

Exemplo padrão: `[Obsidian Sync] {date}{files}`

## 🎮 Comandos Disponíveis

O plugin adiciona os seguintes comandos (acessíveis via Command Palette):

- **Sincronizar agora**: Executa pull e push completo
- **Pull do GitHub**: Baixa alterações do repositório remoto
- **Push para GitHub**: Envia alterações locais para o repositório remoto
- **Status de sincronização**: Mostra informações sobre commits à frente/atrás
- **Validar configuração do Git**: Verifica se todas as configurações estão corretas
- **Resolver conflitos (manter versão local)**: Resolve conflitos mantendo a versão local
- **Abortar merge em andamento**: Cancela um merge em andamento

## 📖 Como Usar

### Primeira Configuração

1. Configure todas as opções em **Settings → Community plugins → GitHub Sync**
2. Use o comando **Validar configuração do Git** para verificar se está tudo correto
3. Se seu vault ainda não for um repositório Git, o plugin inicializará automaticamente

### Sincronização Automática

Com as opções de sincronização automática ativadas, o plugin:
- Faz pull ao abrir o vault
- Faz commit e push ao salvar arquivos
- Sincroniza periodicamente em background (se configurado)

### Sincronização Manual

- Use o ícone na barra lateral (ribbon icon) para sincronizar manualmente
- Ou use os comandos **Pull do GitHub** ou **Push para GitHub** via Command Palette

### Resolução de Conflitos

Se houver conflitos durante o pull:
1. Use o comando **Resolver conflitos (manter versão local)** para manter sua versão
2. Ou use **Abortar merge em andamento** para cancelar e tentar novamente depois

## 🔧 Desenvolvimento

### Estrutura do Projeto

```
src/
  main.ts           # Ponto de entrada do plugin, gerencia lifecycle
  gitManager.ts     # Lógica de sincronização Git
  settings.ts       # Interface de configurações
```

### Scripts Disponíveis

- `npm run dev`: Compila em modo watch para desenvolvimento
- `npm run build`: Compila para produção
- `npm run lint`: Executa o linter ESLint
- `npm version patch|minor|major`: Atualiza a versão automaticamente

### Contribuindo

Contribuições são bem-vindas! Por favor:
1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 🐛 Solução de Problemas

### Erro ao inicializar Git

- Verifique se a URL do repositório está completa (deve incluir o nome do repositório)
- Certifique-se de que o vault tem permissões de escrita
- Use o comando **Validar configuração do Git** para verificar problemas

### Erro de autenticação

- Verifique se o token está correto e tem as permissões necessárias
- Se usar SSH, verifique se a chave existe e tem as permissões corretas
- Teste a conexão manualmente com `git ls-remote`

### Conflitos frequentes

- Considere aumentar o intervalo de sincronização automática
- Use pull antes de fazer alterações importantes
- Mantenha o vault sincronizado regularmente

## 📝 Licença

Este projeto está licenciado sob a licença 0-BSD.

## 🙏 Agradecimentos

- [Obsidian](https://obsidian.md) pela plataforma incrível
- [simple-git](https://github.com/steveukx/git-js) pela biblioteca Git
- Comunidade Obsidian pelo suporte e feedback

## 📞 Suporte

Para reportar bugs ou sugerir funcionalidades, abra uma [issue](https://github.com/jvsajv/NetherPortal/issues) no GitHub.

---

**Desenvolvido com ❤️ para a comunidade Obsidian**
