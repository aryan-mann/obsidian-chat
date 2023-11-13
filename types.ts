export interface CoralSettings {
	ApiKey: string;
}

export type ChatMessage = {
	role: 'CHATBOT' | 'USER';
	message: string;
	success?: boolean;
	in_history: boolean;
}

export type ConnectorSettings = {
	web_search: boolean;
}