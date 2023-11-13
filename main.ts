import { App, ButtonComponent, Notice, Plugin, PluginSettingTab, Setting, TextComponent, WorkspaceLeaf } from 'obsidian';
import { ChatView, VIEW_TYPE_CHAT } from './chat-view-wrapper';
import { CoralSettings } from 'types';


const DEFAULT_SETTINGS: CoralSettings = {
	ApiKey: ''
}

export default class CoralPlugin extends Plugin {
	settings: CoralSettings;

	async onload() {
		await this.loadSettings();

		this.addRibbonIcon('messages-square', 'Open Coral', async () => {
			await this.openChatView();
		});

		this.registerView(
			VIEW_TYPE_CHAT,
			(leaf) => new ChatView(leaf, this.settings)
		);

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SettingsTab(this.app, this));
	}

	onunload() {

	}

	async openChatView() {
		const { workspace }  = this.app;
	
		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(VIEW_TYPE_CHAT);

		if (leaves.length > 0) {
			// A leaf with our view already exists, use that
			leaf = leaves[0];
		} else {
			// Our view could not be found in the workspace, create a new leaf
			// in the right sidebar for it
			leaf = workspace.getRightLeaf(false);
			await leaf.setViewState({ type: VIEW_TYPE_CHAT, active: true });
		}
	
		// "Reveal" the leaf in case it is in a collapsed sidebar
		workspace.revealLeaf(leaf);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class SettingsTab extends PluginSettingTab {
	plugin: CoralPlugin;

	constructor(app: App, plugin: CoralPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('API Key')
			.addButton(eb => {
				eb.setIcon("globe")
				eb.onClick(() => {
					window.open('https://dashboard.cohere.com/api-keys', '_blank')
				})
			})
			.addText(text => text
				.setPlaceholder('Enter your API Key')
				.setValue(this.plugin.settings.ApiKey)
				.onChange(async (value) => {
					this.plugin.settings.ApiKey = value;
					await this.plugin.saveSettings();
				}));
	}
}
