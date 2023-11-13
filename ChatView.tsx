import { AppContext, SettingsContext } from './chat-view-wrapper';
import { MarkdownView, Notice } from 'obsidian';
import * as React from 'react';
import { ChatMessage, ConnectorSettings } from './types';
import { CohereClient, CohereError, CohereTimeoutError } from 'cohere-ai';
import Markdown from 'react-markdown';

const STARTING_CHAT_TURN: ChatMessage = { role: 'CHATBOT', message: `Hey I am **Coral**! What do you need help with?`, success: true, in_history: false };

export const ChatViewComponent = () => {
    const settings = React.useContext(SettingsContext);
    const app = React.useContext(AppContext);

    const co = React.useMemo(() => {
        return new CohereClient({
            token: settings?.ApiKey || '',
        });
    }, [settings?.ApiKey])

    const [messages, setMessages] = React.useState<Array<ChatMessage>>([STARTING_CHAT_TURN,])
    const [userMessage, setUserMessage] = React.useState<string>("");
    const [connectors, setConnectors] = React.useState<ConnectorSettings>({ web_search: false });
    const [isStreaming, setIsStreaming] = React.useState<boolean>(false);

    async function sendMessage() {
        if (isStreaming)
            return;

        const message: string = userMessage;
        setIsStreaming(true);

        // validation
        if (userMessage.trim().length === 0) {
            new Notice("Your message to Coral is empty!", 2000)
            return;
        }
        if (app === undefined) {
            new Notice("Unable to get `app` from obsidian.", 2000);
            return
        }

        let fullData = 'The user is asking questions about the following files';
        let i = 1;

        let usedDocs: string[] = [];
        for (const markdownLeaf of app.workspace.getLeavesOfType("markdown")) {
            // should select it?
            if (!(markdownLeaf.view.currentMode?.isVisible === true)) {
                continue;
            }

            // @ts-ignore
            const fileName: string = markdownLeaf.view.file?.basename || 'File';
            // @ts-ignore
            const data: string = markdownLeaf.view.data || '';
            if (data && typeof(data) === "string") {
                fullData += `\n----- FILE ${i}: ${fileName} --------\n${data}`;
            }
            usedDocs.push(fileName);
            console.log(markdownLeaf);
            i += 1;
        }
        // execution

        // when web search is off, add local documents to the history
        if (!connectors.web_search) {
            setMessages(msgs => [
                ...msgs,
                { role: "USER", message: userMessage, success: true, in_history: true }
            ])
        }
        setUserMessage("");

        // TODO: Get the value of the current document from the active editor view

        // console.log(currentDoc);
        const augumented_history: Array<ChatMessage> = [
            ...(messages.filter((x) => x.in_history)),
            { role: "CHATBOT", message: fullData, in_history: true }
        ];

        let localConnectors: Array<any> = [];
        if (connectors.web_search) {
            localConnectors.push({ id: 'web-search' })
        }

        if (usedDocs.length > 0) {
            let docCtx = usedDocs.reduce((p, c) => `${p}${c},`, '');
            new Notice(`Using context: ${docCtx.substring(0, docCtx.length-1)}`)
        }

        try {
            const response = await fetch(`https://api.cohere.ai/v1/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `BEARER ${settings?.ApiKey}`
                },
                body: JSON.stringify({
                    chat_history: augumented_history,
                    message: message,
                    temperature: 0.8,
                    stream: true,
                    connectors: localConnectors
                })
            });
            if (response.body === null) {
                setMessages(msgs => [...msgs, { role: "CHATBOT", message: "Unable to contact Cohere", success: false, in_history: false }])
                return;
            }
            
            setMessages(msgs => [...msgs, { role: "CHATBOT", message: "", in_history: false }])
            const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
            let streamEnded = false;
            let streamingMessage = '';
            while (!streamEnded) {
                const {value, done} = await reader.read();
                if (done) {
                    streamEnded = true;
                    break;
                }
                
                for (const eventText of value.split('\n')) {
                    if (eventText.trim() === '') { continue; }
                    try {
                        const event = JSON.parse(eventText);
                        switch (event.event_type) {
                            case "text-generation": {
                                streamingMessage += event.text;
                                setMessages(msgs => [
                                    ...msgs.slice(0, -1),
                                    { role: "CHATBOT", message: streamingMessage, in_history: true }
                                ])
                                break;
                            }
                        }
                    }
                    catch (e) { /* empty */ }
                }
            }

        } catch (err) {
            if (settings?.ApiKey.trim() === '') {
                err = 'API key is empty.'
            }
            setMessages(msgs => [
                ...msgs,
                { role: "CHATBOT", message: `I was unable to respond to you.\n\n${err}`, success: false, in_history: false }
            ])
        } finally {
            setIsStreaming(false);
        }
    }

    function resetChat() {
        new Notice('Cleared chat history', 2000);
        setMessages([STARTING_CHAT_TURN])
    }

    return (
        <div className="chat-container">
            <h2>Chat with Coral</h2>
            <div className='settings'>
                <div className='setting-web-search'>
                    <label htmlFor='use-web-search'>Search the Web</label>
                    <input checked={connectors.web_search} onChange={(e) => {
                        setConnectors(c => ({...c, web_search: e.target.checked}))
                    }} id='use-web-search' type="checkbox" />
                </div>
            </div>
            <div className="chat-message-container">
                <div className='messages'>
                    {messages.map((m, i) => (
                        <div className='message' data-role={m.role} data-success={m.success === undefined ? 'unknown': m.success} key={`${m.message}-${i}`}>
                            <span>{m.role}</span>
                            <div>
                                <Markdown>
                                    {m.message}
                                </Markdown>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            <div className='input-container'>
                <textarea value={userMessage} 
                    onChange={(e) => {
                        setUserMessage(e.target.value);
                    }}
                    onKeyDown={(e) => {
                        if (e.shiftKey && e.key === "Enter") {
                            sendMessage();
                            e.preventDefault();
                        }
                    }}
                    style={{ minHeight: '100px' }} placeholder='Summarize this page..' 
                />
                <div className='submit-container'>
                    <button disabled={isStreaming} className='add-to-chat' onClick={sendMessage}>
                        {isStreaming ? '...': 'Send'}
                    </button>
                    <button disabled={isStreaming} className='reset-chat' onClick={resetChat}>🗑️</button>
                </div>
            </div>
        </div>
    )
};