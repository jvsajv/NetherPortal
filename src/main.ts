import { App, Editor, MarkdownView, Notice, Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, MyPluginSettings, SampleSettingTab } from "./settings";
import { GitManager, GitSyncConfig } from "./gitManager";

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;
	gitManager: GitManager | null = null;
	syncInterval: NodeJS.Timeout | null = null;
	lastSyncTime: number = 0;
	syncDebounceTimer: NodeJS.Timeout | null = null;

	async onload() {
		await this.loadSettings();

		// Criar ribbon icon para sincronização manual
		this.addRibbonIcon('git-branch', 'Sincronizar com GitHub', async (evt: MouseEvent) => {
			await this.performSync('Manual sync');
		});

		// Adicionar status bar item
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('GitHub Sync: Pronto');

		// Comando para sincronização manual
		this.addCommand({
			id: 'github-sync-manual',
			name: 'Sincronizar agora',
			callback: async () => {
				await this.performSync('Manual sync via command');
			}
		});

		// Comando para pull
		this.addCommand({
			id: 'github-sync-pull',
			name: 'Pull do GitHub',
			callback: async () => {
				if (!this.gitManager) {
					const initialized = await this.initializeGit();
					if (!initialized) {
						new Notice('❌ Git não configurado. Configure nas settings.');
						return;
					}
				}
				if (!this.gitManager) {
					new Notice('❌ Git não configurado. Configure nas settings.');
					return;
				}
				const success = await this.gitManager.pull();
				if (success) {
					// Verificar se há conflitos após o pull
					const hasConflicts = await this.gitManager.hasConflicts();
					if (!hasConflicts) {
						new Notice('✅ Pull realizado com sucesso!');
					}
					// Se houver conflitos, a mensagem já foi mostrada no método pull()
				}
			}
		});

		// Comando para push
		this.addCommand({
			id: 'github-sync-push',
			name: 'Push para GitHub',
			callback: async () => {
				if (!this.gitManager) {
					await this.initializeGit();
				}
				if (!this.gitManager) {
					new Notice('❌ Git não configurado. Configure nas settings.');
					return;
				}
				
				// Obter arquivos alterados
				let changedFiles: string[] | undefined;
				try {
					const status = await this.gitManager.getStatus();
					if (status && status.files) {
						changedFiles = status.files.map(f => f.path);
					}
				} catch (error) {
					console.warn('Não foi possível obter lista de arquivos alterados:', error);
				}
				
				const commitMessage = this.getCommitMessage(changedFiles);
				const success = await this.gitManager.commitAndPush(commitMessage, changedFiles);
				if (success) {
					new Notice('✅ Push realizado com sucesso!');
				}
			}
		});

		 // Comando para validar configuração
		this.addCommand({
			id: 'github-sync-validate',
			name: 'Validar configuração do Git',
			callback: async () => {
				if (!this.gitManager) {
					await this.initializeGit();
				}
				if (!this.gitManager) {
					new Notice('❌ Erro ao inicializar Git');
					return;
				}
				const validation = await this.gitManager.validateConfiguration();
				if (validation.valid) {
					new Notice('✅ Configuração validada com sucesso!');
				} else {
					new Notice(`❌ Erros de configuração:\n${validation.errors.join('\n')}`);
				}
			}
		});

		// Comando para verificar status de sincronização
		this.addCommand({
			id: 'github-sync-status',
			name: 'Status de sincronização',
			callback: async () => {
				if (!this.gitManager) {
					await this.initializeGit();
				}
				if (!this.gitManager) {
					new Notice('❌ Git não configurado');
					return;
				}
				const info = await this.gitManager.getSyncInfo();
				if (info) {
					const msg = `Branch: ${info.currentBranch}\nCommits adiante: ${info.aheadBy}\nCommits atrás: ${info.behindBy}\nÚltimo commit: ${info.lastCommitDate?.toLocaleString('pt-BR') || 'N/A'}`;
					new Notice(msg);
				} else {
					new Notice('❌ Erro ao obter status');
				}
			}
		});

		// Comando para resolver conflitos
		this.addCommand({
			id: 'github-sync-resolve-conflicts',
			name: 'Resolver conflitos (manter versão local)',
			callback: async () => {
				if (!this.gitManager) {
					await this.initializeGit();
				}
				if (!this.gitManager) {
					new Notice('❌ Git não configurado');
					return;
				}
				const hasConflicts = await this.gitManager.hasConflicts();
				if (!hasConflicts) {
					new Notice('✅ Nenhum conflito encontrado');
					return;
				}
				const success = await this.gitManager.resolveConflicts('ours');
				if (success) {
					new Notice('✅ Conflitos resolvidos e sincronizados!');
				} else {
					new Notice('❌ Erro ao resolver conflitos');
				}
			}
		});

		// Comando para abortar merge
		this.addCommand({
			id: 'github-sync-abort-merge',
			name: 'Abortar merge em andamento',
			callback: async () => {
				if (!this.gitManager) {
					await this.initializeGit();
				}
				if (!this.gitManager) {
					new Notice('❌ Git não configurado');
					return;
				}
				const success = await this.gitManager.abortMerge();
				if (success) {
					new Notice('✅ Merge abortado com sucesso');
				} else {
					new Notice('❌ Erro ao abortar merge');
				}
			}
		});

		// Aba de configurações
		this.addSettingTab(new SampleSettingTab(this.app, this));

		// Evento ao criar/abrir arquivo
		this.registerEvent(
			this.app.vault.on('create', async (file) => {
				console.log('Arquivo criado/vault inicializado');
				if (this.settings.autoSyncOnOpen && this.settings.githubRepoUrl) {
					await this.initializeGit();
					await this.performSync('Auto-sync on vault init');
				}
			})
		);

		// Evento ao salvar um arquivo
		this.registerEvent(
			this.app.vault.on('modify', async (file) => {
				if (this.settings.autoSyncOnSave && this.settings.githubRepoUrl) {
					// Debounce para evitar múltiplas sincronizações rápidas
					if (this.syncDebounceTimer) {
						clearTimeout(this.syncDebounceTimer);
					}

					this.syncDebounceTimer = setTimeout(async () => {
						await this.initializeGit();
						// Passar o arquivo modificado para a sincronização
						const filePath = file.path || file.name;
						await this.performSync(`Auto-sync on save: ${file.name}`, [filePath]);
					}, 2000); // Aguarda 2 segundos após última modificação
				}
			})
		);

		// Intervalo de sincronização automática em background
		this.registerInterval(
			window.setInterval(async () => {
				if (this.settings.syncInterval > 0 && this.settings.githubRepoUrl) {
					const now = Date.now();
					const timeSinceLastSync = now - this.lastSyncTime;
					const intervalMs = this.settings.syncInterval * 60 * 1000;

					if (timeSinceLastSync >= intervalMs) {
						await this.initializeGit();
						await this.performSync('Background auto-sync');
					}
				}
			}, 60 * 1000) // Verifica a cada minuto
		);

		console.log('Plugin GitHub Sync carregado');
	}

	onunload() {
		if (this.syncInterval) {
			clearInterval(this.syncInterval);
		}
		if (this.syncDebounceTimer) {
			clearTimeout(this.syncDebounceTimer);
		}
		console.log('Plugin GitHub Sync descarregado');
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<MyPluginSettings>);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	/**
	 * Inicializa o GitManager com as configurações
	 */
	async initializeGit(): Promise<boolean> {
		try {
			if (!this.settings.githubRepoUrl) {
				new Notice('❌ URL do repositório GitHub não configurada. Configure nas settings.');
				console.error('GitHub repo URL não configurado');
				return false;
			}

			// Validar URL básica
			const repoUrl = this.settings.githubRepoUrl.trim();
			if (repoUrl.endsWith('/') || (!repoUrl.includes('.git') && repoUrl.split('/').filter(s => s).length < 3)) {
				new Notice('❌ URL do repositório parece incompleta. Deve incluir o nome do repositório (ex: https://github.com/user/repo.git)');
				console.error('URL do repositório incompleta:', repoUrl);
				return false;
			}

			if (!this.gitManager) {
				// Obter o caminho do vault
				const vaultPath = (this.app.vault.adapter as any).basePath || 
					(this.app.vault.adapter as any).path || 
					process.cwd();

				console.log('Inicializando GitManager no caminho:', vaultPath);

				const config: GitSyncConfig = {
					repoPath: vaultPath,
					remoteUrl: this.settings.githubRepoUrl,
					branch: this.settings.githubBranch,
					userName: this.settings.githubUserName,
					userEmail: this.settings.githubUserEmail,
					token: this.settings.githubToken,
					useSSH: this.settings.useSSH,
					sshKeyPath: this.settings.sshKeyPath,
					sshKeyPassphrase: this.settings.sshKeyPassphrase
				};

				this.gitManager = new GitManager(config);
				const initialized = await this.gitManager.initialize();
				
				if (!initialized) {
					// A mensagem de erro específica já foi mostrada no método initialize()
					return false;
				}
			}

			return true;
		} catch (error: any) {
			const errorMsg = error.message || String(error);
			console.error('Erro ao inicializar Git:', errorMsg);
			new Notice(`❌ Erro ao inicializar Git: ${errorMsg}`);
			return false;
		}
	}

	/**
	 * Realiza a sincronização completa
	 */
	private async performSync(source: string, changedFiles?: string[]): Promise<void> {
		try {
			if (!this.gitManager) {
				const initialized = await this.initializeGit();
				if (!initialized) {
					return;
				}
			}

			// Obter arquivos alterados se não foram passados
			let files = changedFiles;
			if (!files && this.gitManager) {
				try {
					const status = await this.gitManager.getStatus();
					if (status && status.files) {
						files = status.files.map(f => f.path);
					}
				} catch (error) {
					console.warn('Não foi possível obter lista de arquivos alterados:', error);
				}
			}

			const commitMessage = this.getCommitMessage(files);
			console.log(`[${source}] Iniciando sincronização...`);
			
			const success = await this.gitManager!.fullSync(commitMessage, files);
			this.lastSyncTime = Date.now();

			if (success) {
				console.log(`[${source}] Sincronização concluída com sucesso`);
			}
		} catch (error) {
			console.error(`Erro ao realizar sincronização (${source}):`, error);
			new Notice('❌ Erro ao sincronizar com GitHub');
		}
	}

	/**
	 * Gera a mensagem de commit baseada no template
	 */
	private getCommitMessage(files?: string[]): string {
		const now = new Date();
		const dateStr = now.toLocaleString('pt-BR');
		
		let message = this.settings.commitMessageTemplate.replace('{date}', dateStr);
		
		// Substituir {files} com a lista de arquivos alterados
		if (files && files.length > 0) {
			// Limitar a quantidade de arquivos mostrados (máximo 10)
			const filesToShow = files.slice(0, 10);
			const filesList = filesToShow.map(f => `  - ${f}`).join('\n');
			const moreFiles = files.length > 10 ? `\n  ... e mais ${files.length - 10} arquivo(s)` : '';
			const filesText = `\nArquivos alterados:\n${filesList}${moreFiles}`;
			message = message.replace('{files}', filesText);
		} else {
			// Se não houver arquivos ou {files} não foi usado, remover o placeholder
			message = message.replace('{files}', '');
		}
		
		return message.trim();
	}
}
