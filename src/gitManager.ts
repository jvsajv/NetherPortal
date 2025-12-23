import simpleGit, { SimpleGit } from 'simple-git';
import { Notice } from 'obsidian';
import * as fs from 'fs';
import * as path from 'path';

export interface GitSyncConfig {
    repoPath: string;
    remoteUrl?: string;
    branch: string;
    userName: string;
    userEmail: string;
    token?: string;
    sshKeyPath?: string;
    sshKeyPassphrase?: string;
    useSSH?: boolean;
}

export class GitManager {
    private git: SimpleGit;
    private config: GitSyncConfig;
    private isInitialized: boolean = false;

    constructor(config: GitSyncConfig) {
        this.config = config;
        // Configurar opções de SSH se necessário
        const gitOptions = this.config.useSSH && this.config.sshKeyPath 
            ? { 
                config: [
                    `core.sshCommand=ssh -i "${this.config.sshKeyPath}" -o StrictHostKeyChecking=no`
                ]
            }
            : {};
        
        this.git = simpleGit(config.repoPath, gitOptions);
    }

    /**
     * Valida se a SSH key existe e é acessível
     */
    private validateSSHKey(): boolean {
        if (!this.config.sshKeyPath) {
            return false;
        }

        try {
            // Expandir ~ para home directory
            const keyPath = this.config.sshKeyPath.startsWith('~')
                ? path.join(process.env.HOME || process.env.USERPROFILE || '', 
                    this.config.sshKeyPath.slice(1))
                : this.config.sshKeyPath;

            if (!fs.existsSync(keyPath)) {
                console.error(`SSH key não encontrada: ${keyPath}`);
                return false;
            }

            // Verificar permissões (arquivo deve existir e ser legível)
            fs.accessSync(keyPath, fs.constants.R_OK);
            return true;
        } catch (error) {
            console.error(`Erro ao validar SSH key: ${error}`);
            return false;
        }
    }

    /**
     * Configura a autenticação (SSH ou Token)
     */
    private async setupAuthentication(): Promise<boolean> {
        try {
            if (!this.config.remoteUrl) {
                console.warn('URL do repositório remoto não configurada');
                return false;
            }

            // Verificar se o remote já existe
            let originExists = false;
            try {
                const remotes = await this.git.getRemotes(true);
                originExists = remotes.some(r => r.name === 'origin');
            } catch (error) {
                // Se não conseguir listar remotes, assumir que não existe
                originExists = false;
            }

            let remoteUrl = this.config.remoteUrl;

            if (this.config.useSSH) {
                if (!this.validateSSHKey()) {
                    console.warn('SSH key inválida, tentando usar token ou HTTPS');
                    if (this.config.token) {
                        // Fallback para HTTPS com token
                        remoteUrl = this.config.remoteUrl.replace(
                            'git@github.com:',
                            'https://github.com/'
                        ).replace('.git', '') + '.git';
                        remoteUrl = remoteUrl.replace(
                            'https://github.com/',
                            `https://x-access-token:${this.config.token}@github.com/`
                        );
                    } else {
                        return false;
                    }
                } else {
                    console.log('SSH key configurada com sucesso');
                    // Garantir que a URL está no formato SSH
                    if (!remoteUrl.startsWith('git@')) {
                        // Converter HTTPS para SSH se necessário
                        remoteUrl = remoteUrl.replace('https://github.com/', 'git@github.com:');
                    }
                }
            } else if (this.config.token) {
                // Se usar token, configurar URL com autenticação
                if (remoteUrl.includes('github.com')) {
                    remoteUrl = remoteUrl.replace(
                        'https://github.com/',
                        `https://x-access-token:${this.config.token}@github.com/`
                    );
                }
            }

            // Configurar ou atualizar o remote
            try {
                if (originExists) {
                    // Atualizar URL do remote existente
                    await this.git.removeRemote('origin');
                }
                await this.git.addRemote('origin', remoteUrl);
                console.log('Remote origin configurado:', remoteUrl.replace(/x-access-token:[^@]+@/, 'x-access-token:***@'));
            } catch (error: any) {
                // Se o remote já existe com URL diferente, tentar atualizar
                if (error.message && (error.message.includes('already exists') || error.message.includes('remote origin already exists'))) {
                    await this.git.removeRemote('origin');
                    await this.git.addRemote('origin', remoteUrl);
                } else {
                    throw error;
                }
            }

            return true;
        } catch (error) {
            console.error('Erro ao configurar autenticação:', error);
            return false;
        }
    }

    /**
     * Inicializa a configuração do Git se necessário
     */
    async initialize(): Promise<boolean> {
        try {
            let isGitRepo = false;
            
            // Verifica se já é um repositório Git
            try {
                await this.git.revparse(['--git-dir']);
                isGitRepo = true;
                console.log('Repositório Git já existe');
            } catch (error: any) {
                // Não é um repositório Git, vamos inicializar
                const errorMsg = error.message || String(error);
                if (errorMsg.includes('not a git repository') || errorMsg.includes('Not a git repository')) {
                    console.log('Inicializando novo repositório Git...');
                    try {
                        await this.git.init();
                        console.log('Repositório Git inicializado com sucesso');
                        isGitRepo = true;
                    } catch (initError: any) {
                        const initErrorMsg = initError.message || String(initError);
                        console.error('Erro ao inicializar repositório Git:', initErrorMsg);
                        new Notice(`❌ Erro ao inicializar repositório Git: ${initErrorMsg}`);
                        return false;
                    }
                } else {
                    throw error;
                }
            }

            if (!isGitRepo) {
                new Notice('❌ Não foi possível verificar ou inicializar o repositório Git');
                return false;
            }

            // Validar URL do repositório
            if (this.config.remoteUrl) {
                const url = this.config.remoteUrl.trim();
                // Verificar se a URL está completa (deve terminar com .git ou ter pelo menos user/repo)
                if (url.endsWith('/') || (!url.includes('/') && url.split('/').length < 3)) {
                    new Notice('❌ URL do repositório parece incompleta. Verifique se inclui o nome do repositório (ex: https://github.com/user/repo.git)');
                    console.error('URL do repositório incompleta:', url);
                    return false;
                }
            }

            // Configurar usuário Git
            try {
                await this.git.addConfig('user.name', this.config.userName);
                await this.git.addConfig('user.email', this.config.userEmail);
                console.log('Configuração de usuário Git definida');
            } catch (configError: any) {
                console.warn('Aviso ao configurar usuário Git:', configError.message || String(configError));
                // Não é crítico, continuar
            }
            
            // Configurar autenticação (SSH ou Token)
            const authSuccess = await this.setupAuthentication();
            if (!authSuccess) {
                const authErrorMsg = this.config.useSSH 
                    ? 'Erro ao configurar SSH. Verifique a chave SSH nas configurações.'
                    : 'Erro ao configurar autenticação. Verifique o token nas configurações.';
                new Notice(`❌ ${authErrorMsg}`);
                console.error('Erro na autenticação:', authErrorMsg);
                return false;
            }

            // Verificar se a branch existe localmente, se não, criar e fazer checkout
            try {
                const branches = await this.git.branchLocal();
                if (!branches.all.includes(this.config.branch)) {
                    console.log(`Criando branch local: ${this.config.branch}`);
                    await this.git.checkoutLocalBranch(this.config.branch);
                } else {
                    await this.git.checkout(this.config.branch);
                }
            } catch (branchError: any) {
                console.warn('Aviso ao verificar branch:', branchError.message || String(branchError));
                // Não é crítico, continuar
            }
            
            this.isInitialized = true;
            console.log('Git inicializado com sucesso');
            return true;
        } catch (error: any) {
            const errorMsg = error.message || String(error);
            console.error('Erro ao inicializar Git:', errorMsg);
            new Notice(`❌ Erro ao inicializar Git: ${errorMsg}`);
            return false;
        }
    }

    /**
     * Faz pull dos últimos commits do repositório remoto
     */
    async pull(): Promise<boolean> {
        try {
            if (!this.isInitialized) {
                const initialized = await this.initialize();
                if (!initialized) {
                    new Notice('❌ Erro ao inicializar Git antes do pull');
                    return false;
                }
            }

            // Verificar se há merge em andamento
            const status = await this.git.status();
            if (status.current !== this.config.branch) {
                // Verificar se estamos em um merge
                try {
                    const mergeHead = await this.git.raw(['rev-parse', '--verify', 'MERGE_HEAD']);
                    if (mergeHead) {
                        new Notice('⚠️ Há um merge em andamento. Use o comando "Abortar merge" ou resolva os conflitos primeiro.');
                        return false;
                    }
                } catch {
                    // Não há merge em andamento, continuar
                }
            }

            // Verificar se o remote existe
            try {
                const remotes = await this.git.getRemotes(true);
                const originExists = remotes.some(r => r.name === 'origin');
                
                if (!originExists && this.config.remoteUrl) {
                    // Configurar remote se não existir
                    await this.setupAuthentication();
                }
            } catch (error) {
                console.error('Erro ao verificar remotes:', error);
            }

            // Verificar se a branch remota existe
            try {
                await this.git.fetch('origin', this.config.branch);
            } catch (error: any) {
                const errorMsg = error.message || String(error);
                if (errorMsg.includes('couldn\'t find remote ref') || errorMsg.includes('doesn\'t exist')) {
                    new Notice(`❌ Branch remota "${this.config.branch}" não encontrada no repositório remoto`);
                    return false;
                }
                // Se for outro erro de fetch, continuar tentando pull
                console.warn('Aviso ao fazer fetch:', error);
            }

            // Fazer pull
            const result = await this.git.pull('origin', this.config.branch, ['--no-rebase']);
            console.log('Pull realizado com sucesso:', result);
            
            // Verificar se há conflitos após o pull
            const statusAfterPull = await this.git.status();
            if (statusAfterPull.conflicted && statusAfterPull.conflicted.length > 0) {
                new Notice(`⚠️ Pull concluído, mas há ${statusAfterPull.conflicted.length} arquivo(s) com conflitos. Use o comando "Resolver conflitos" para resolver.`);
                return true; // Pull foi bem-sucedido, mas há conflitos
            }
            
            return true;
        } catch (error: any) {
            const errorMsg = error.message || String(error);
            console.error('Erro ao fazer pull:', error);
            
            // Mensagens de erro mais específicas
            if (errorMsg.includes('authentication') || errorMsg.includes('Authentication failed')) {
                new Notice('❌ Erro de autenticação. Verifique seu token ou SSH key nas configurações.');
            } else if (errorMsg.includes('not found') || errorMsg.includes('doesn\'t exist')) {
                new Notice('❌ Repositório remoto não encontrado. Verifique a URL nas configurações.');
            } else if (errorMsg.includes('merge') || errorMsg.includes('conflict')) {
                new Notice('❌ Conflitos detectados durante o pull. Use o comando "Resolver conflitos" para resolver.');
            } else {
                new Notice(`❌ Erro ao fazer pull: ${errorMsg}`);
            }
            
            return false;
        }
    }

    /**
     * Faz commit e push de todas as alterações
     */
    async commitAndPush(message: string, files?: string[]): Promise<boolean> {
        try {
            if (!this.isInitialized) {
                await this.initialize();
            }

            // Verificar se há alterações
            const status = await this.git.status();
            
            if (status.files.length === 0) {
                console.log('Nenhuma alteração para commit');
                return true;
            }

            // Se não foram passados arquivos, obter do status
            const changedFiles = files || status.files.map(f => f.path);

            // Adicionar todas as alterações
            await this.git.add('.');

            // Substituir {files} na mensagem se necessário
            let finalMessage = message;
            if (finalMessage.includes('{files}')) {
                const filesToShow = changedFiles.slice(0, 10);
                const filesList = filesToShow.map(f => `  - ${f}`).join('\n');
                const moreFiles = changedFiles.length > 10 ? `\n  ... e mais ${changedFiles.length - 10} arquivo(s)` : '';
                const filesText = `\nArquivos alterados:\n${filesList}${moreFiles}`;
                finalMessage = finalMessage.replace('{files}', filesText);
            }

            // Fazer commit
            await this.git.commit(finalMessage.trim());

            // Fazer push
            await this.git.push('origin', this.config.branch);

            console.log('Commit e push realizados com sucesso');
            return true;
        } catch (error) {
            console.error('Erro ao fazer commit e push:', error);
            return false;
        }
    }

    /**
     * Obtém o status do repositório
     */
    async getStatus() {
        try {
            return await this.git.status();
        } catch (error) {
            console.error('Erro ao obter status:', error);
            return null;
        }
    }

    /**
     * Obtém o histórico de commits
     */
    async getLog(maxCount: number = 10) {
        try {
            return await this.git.log({ maxCount });
        } catch (error) {
            console.error('Erro ao obter log:', error);
            return null;
        }
    }

    /**
     * Sincroniza bidirecional: pull depois push
     */
    async fullSync(commitMessage: string, files?: string[]): Promise<boolean> {
        try {
            // Primeiro faz pull para trazer as alterações remotas
            const pullSuccess = await this.pull();
            if (!pullSuccess) {
                new Notice('❌ Erro ao fazer pull do repositório remoto');
                return false;
            }

            // Obter arquivos alterados antes do commit se não foram passados
            let changedFiles = files;
            if (!changedFiles) {
                try {
                    const status = await this.git.status();
                    changedFiles = status.files.map(f => f.path);
                } catch (error) {
                    console.warn('Não foi possível obter lista de arquivos alterados:', error);
                }
            }

            // Depois faz commit e push das alterações locais
            const pushSuccess = await this.commitAndPush(commitMessage, changedFiles);
            if (!pushSuccess) {
                new Notice('❌ Erro ao fazer commit e push');
                return false;
            }

            new Notice('✅ Sincronização com GitHub completa!');
            return true;
        } catch (error) {
            console.error('Erro durante sincronização completa:', error);
            new Notice('❌ Erro durante sincronização com GitHub');
            return false;
        }
    }

    /**
     * Detecta se há conflitos de merge em andamento
     */
    async hasConflicts(): Promise<boolean> {
        try {
            const status = await this.git.status();
            return status.conflicted && status.conflicted.length > 0;
        } catch (error) {
            console.error('Erro ao verificar conflitos:', error);
            return false;
        }
    }

    /**
     * Obtém lista de arquivos com conflito
     */
    async getConflictedFiles(): Promise<string[]> {
        try {
            const status = await this.git.status();
            return status.conflicted || [];
        } catch (error) {
            console.error('Erro ao obter arquivos com conflito:', error);
            return [];
        }
    }

    /**
     * Resolve conflitos automaticamente (estratégia: manter versão atual)
     */
    async resolveConflicts(strategy: 'ours' | 'theirs' = 'ours'): Promise<boolean> {
        try {
            const conflictedFiles = await this.getConflictedFiles();
            
            if (conflictedFiles.length === 0) {
                console.log('Nenhum conflito para resolver');
                return true;
            }

            console.log(`Resolvendo ${conflictedFiles.length} conflitos usando estratégia: ${strategy}`);

            for (const file of conflictedFiles) {
                if (strategy === 'ours') {
                    // Manter nossa versão (local)
                    await this.git.checkout(['--ours', file]);
                } else {
                    // Manter versão deles (remota)
                    await this.git.checkout(['--theirs', file]);
                }
                // Adicionar arquivo resolvido
                await this.git.add(file);
            }

            // Completar o merge
            await this.git.commit(['--no-edit']);
            console.log('Conflitos resolvidos com sucesso');
            return true;
        } catch (error) {
            console.error('Erro ao resolver conflitos:', error);
            return false;
        }
    }

    /**
     * Abort merge em caso de conflito
     */
    async abortMerge(): Promise<boolean> {
        try {
            await this.git.merge(['--abort']);
            console.log('Merge abortado');
            return true;
        } catch (error) {
            console.error('Erro ao abortar merge:', error);
            return false;
        }
    }

    /**
     * Valida a configuração do Git
     */
    async validateConfiguration(): Promise<{ valid: boolean; errors: string[] }> {
        const errors: string[] = [];

        // Validar URL do repositório
        if (!this.config.remoteUrl) {
            errors.push('URL do repositório remoto não configurada');
        }

        // Validar branch
        if (!this.config.branch) {
            errors.push('Branch não configurada');
        }

        // Validar nome de usuário
        if (!this.config.userName) {
            errors.push('Nome do usuário Git não configurado');
        }

        // Validar email
        if (!this.config.userEmail) {
            errors.push('Email do usuário Git não configurado');
        }

        // Validar autenticação
        if (this.config.useSSH) {
            if (!this.validateSSHKey()) {
                errors.push('SSH key não encontrada ou inválida');
            }
        } else if (!this.config.token) {
            errors.push('Token de acesso pessoal não configurado (necessário para HTTPS)');
        }

        // Tentar conectar ao repositório remoto
        if (this.config.remoteUrl) {
            try {
                await this.git.listRemote(['--heads', this.config.remoteUrl]);
            } catch (error) {
                errors.push(`Erro ao conectar ao repositório remoto: ${error}`);
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Obtém informações de sincronização
     */
    async getSyncInfo(): Promise<{
        currentBranch: string;
        aheadBy: number;
        behindBy: number;
        lastCommitDate: Date | null;
    } | null> {
        try {
            const status = await this.git.status();
            const log = await this.git.log({ maxCount: 1 });
            
            return {
                currentBranch: status.current || 'unknown',
                aheadBy: status.ahead || 0,
                behindBy: status.behind || 0,
                lastCommitDate: log.latest?.date ? new Date(log.latest.date) : null
            };
        } catch (error) {
            console.error('Erro ao obter informações de sincronização:', error);
            return null;
        }
    }
}