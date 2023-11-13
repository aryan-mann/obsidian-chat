import { StrictMode } from "react";
import { ItemView, WorkspaceLeaf } from "obsidian";
import { Root, createRoot } from "react-dom/client";
import { ChatViewComponent } from "./ChatView";
import { createContext } from "react";
import { App } from "obsidian";
import * as React from 'react';
import { CoralSettings } from "./types";

export const AppContext = createContext<App | undefined>(undefined);
export const SettingsContext = createContext<CoralSettings | undefined>(undefined);

export const VIEW_TYPE_CHAT = "example-view";

export class ChatView extends ItemView {
	root: Root | null = null;
	settings: CoralSettings | undefined;

	constructor(leaf: WorkspaceLeaf, settings: CoralSettings) {
		super(leaf);
		this.settings = settings;
	} 

	getViewType() {
		return VIEW_TYPE_CHAT;
	}

	getDisplayText() {
		return "Chat with Coral";
	}

	async onOpen() {
		this.root = createRoot(this.containerEl.children[1]);
		this.root.render(
			<StrictMode>
				<AppContext.Provider value={this.app}>
					<SettingsContext.Provider value={this.settings}>
						<ChatViewComponent />
					</SettingsContext.Provider>
				</AppContext.Provider>
			</StrictMode>
        );
          
	}

	async onClose() {
		this.root?.unmount();
	}
}