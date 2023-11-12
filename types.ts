export interface CoralSettings {
	ApiKey: string;
}

export type ChatMessage = {
	role: 'CHATBOT' | 'USER';
	message: string;
}