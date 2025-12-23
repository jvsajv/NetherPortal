import { App, PluginSettingTab, Setting } from "obsidian";
import MyPlugin from "./main";

export interface MyPluginSettings {
	githubRepoUrl: string;
	githubBranch: string;
	githubUserName: string;
	githubUserEmail: string;
	githubToken: string;
	useSSH: boolean;
	sshKeyPath: string;
	sshKeyPassphrase: string;
	autoSyncOnOpen: boolean;
	autoSyncOnSave: boolean;
	commitMessageTemplate: string;
	syncInterval: number; // em minutos
}

export const DEFAULT_SETTINGS: MyPluginSettings = {
	githubRepoUrl: '',
	githubBranch: 'main',
	githubUserName: 'Obsidian User',
	githubUserEmail: 'user@example.com',
	githubToken: '',
	useSSH: false,
	sshKeyPath: '~/.ssh/id_rsa',
	sshKeyPassphrase: '',
	autoSyncOnOpen: true,
	autoSyncOnSave: true,
	commitMessageTemplate: '[Obsidian Sync] {date}{files}',
	syncInterval: 30
}

export class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl('h2', { text: 'GitHub Sync Settings' });

		new Setting(containerEl)
			.setName('GitHub Repository URL')
			.setDesc('URL do seu repositório GitHub (ex: https://github.com/user/repo.git ou git@github.com:user/repo.git)')
			.addText(text => text
				.setPlaceholder('https://github.com/user/repo.git')
				.setValue(this.plugin.settings.githubRepoUrl)
				.onChange(async (value) => {
					this.plugin.settings.githubRepoUrl = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('GitHub Branch')
			.setDesc('Branch padrão para sincronização')
			.addText(text => text
				.setPlaceholder('main')
				.setValue(this.plugin.settings.githubBranch)
				.onChange(async (value) => {
					this.plugin.settings.githubBranch = value || 'main';
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('GitHub User Name')
			.setDesc('Nome do usuário GitHub para commits')
			.addText(text => text
				.setPlaceholder('Your Name')
				.setValue(this.plugin.settings.githubUserName)
				.onChange(async (value) => {
					this.plugin.settings.githubUserName = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('GitHub User Email')
			.setDesc('Email do usuário GitHub para commits')
			.addText(text => text
				.setPlaceholder('user@example.com')
				.setValue(this.plugin.settings.githubUserEmail)
				.onChange(async (value) => {
					this.plugin.settings.githubUserEmail = value;
					await this.plugin.saveSettings();
				}));

		containerEl.createEl('h3', { text: 'Autenticação' });

		new Setting(containerEl)
			.setName('Usar SSH Key')
			.setDesc('Usar SSH key para autenticação em vez de token pessoal')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.useSSH)
				.onChange(async (value) => {
					this.plugin.settings.useSSH = value;
					await this.plugin.saveSettings();
					this.display(); // Recarregar para mostrar/esconder campos
				}));

		if (this.plugin.settings.useSSH) {
			new Setting(containerEl)
				.setName('SSH Key Path')
				.setDesc('Caminho para sua SSH key privada (ex: ~/.ssh/id_rsa ou C:\\Users\\YourUser\\.ssh\\id_rsa)')
				.addText(text => text
					.setPlaceholder('~/.ssh/id_rsa')
					.setValue(this.plugin.settings.sshKeyPath)
					.onChange(async (value) => {
						this.plugin.settings.sshKeyPath = value;
						await this.plugin.saveSettings();
					}));

			new Setting(containerEl)
				.setName('SSH Key Passphrase (opcional)')
				.setDesc('Senha da SSH key se ela for protegida por passphrase')
				.addText(text => text
					.setPlaceholder('Deixe em branco se não houver passphrase')
					.setValue(this.plugin.settings.sshKeyPassphrase)
					.onChange(async (value) => {
						this.plugin.settings.sshKeyPassphrase = value;
						await this.plugin.saveSettings();
					}));
		} else {
			new Setting(containerEl)
				.setName('GitHub Personal Access Token')
				.setDesc('Token de acesso pessoal para autenticação HTTPS')
				.addText(text => text
					.setPlaceholder('ghp_xxxxx')
					.setValue(this.plugin.settings.githubToken)
					.onChange(async (value) => {
						this.plugin.settings.githubToken = value;
						await this.plugin.saveSettings();
					}));
		}

		containerEl.createEl('h3', { text: 'Sync Options' });

		new Setting(containerEl)
			.setName('Auto-sync on Vault Open')
			.setDesc('Sincronizar automaticamente ao abrir o Obsidian')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoSyncOnOpen)
				.onChange(async (value) => {
					this.plugin.settings.autoSyncOnOpen = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Auto-sync on File Save')
			.setDesc('Sincronizar automaticamente ao salvar um arquivo')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoSyncOnSave)
				.onChange(async (value) => {
					this.plugin.settings.autoSyncOnSave = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Commit Message Template')
			.setDesc('Template para mensagem de commit. Use {date} para data/hora e {files} para lista de arquivos alterados')
			.addTextArea(text => text
				.setPlaceholder('[Obsidian Sync] {date}{files}')
				.setValue(this.plugin.settings.commitMessageTemplate)
				.onChange(async (value) => {
					this.plugin.settings.commitMessageTemplate = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Auto-sync Interval')
			.setDesc('Intervalo em minutos para sincronização automática em background (0 para desativar)')
			.addSlider(slider => slider
				.setLimits(0, 120, 5)
				.setValue(this.plugin.settings.syncInterval)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.syncInterval = value;
					await this.plugin.saveSettings();
				}));
	}
}
