import { AppContext, SettingsContext } from 'example-view';
import { MarkdownView, Notice } from 'obsidian';
import * as React from 'react';
import { ChatMessage } from 'types';

const STARTING_CHAT_TURN: ChatMessage = { role: 'CHATBOT', message: `Hi! What do you need help with?` };

export const ReactView = () => {
    const settings = React.useContext(SettingsContext);
    const app = React.useContext(AppContext);

    const [messages, setMessages] = React.useState<Array<ChatMessage>>([
        STARTING_CHAT_TURN
    ])
    const [userMessage, setUserMessage] = React.useState<string>("");

    async function sendMessage() {
        // validation
        if (userMessage.trim().length === 0) {
            new Notice("Your message to Coral is empty!", 2000)
            return;
        }

        // execution
        setMessages(msgs => [
            ...msgs,
            { role: "USER", message: userMessage }
        ])
        setUserMessage("");

        // TODO: Get the value of the current document from the active editor view

        // console.log(currentDoc);
        const augumented_history = messages;
        // if (currentDoc.trim() !== '') {
        //     augumented_history.unshift({ role: 'CHATBOT', message: `The user is talking about the following document:\n${currentDoc}`})
        // }

        const requestBody = JSON.stringify({
            message: userMessage,
            stream: true,
            chat_history: augumented_history,
            citation_quality: "fast",
            temperature: 0.8,
        })
        console.log(augumented_history);

        const response = await fetch(`https://api.cohere.ai/v1/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `BEARER ${settings?.ApiKey ?? ''}`
            },
            body: requestBody
        });

        if (response.body === null) {
            setMessages(msgs => [
                ...msgs, 
                { role: "CHATBOT", message: "Sorry.. I errored out while trying to think of a response."}
            ])
            return;
        }

        const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
        let streamEnded = false;
        let streamingMessage = '';
        setMessages(msgs => [...msgs, { role: "CHATBOT", message: ""}])
        while (!streamEnded) {
            const {value, done} = await reader.read();
            if (done) {
                streamEnded = true;
                break;
            }
            
            for (const eventText of value.split('\n')) {
                if (eventText.trim() === '') { continue; }
                // console.log(`Event`, eventText);
                try {
                    const event = JSON.parse(eventText);
                    switch (event.event_type) {
                        case "text-generation": {
                            streamingMessage += event.text;
                            setMessages(msgs => [
                                ...msgs.slice(0, -1),
                                { role: "CHATBOT", message: streamingMessage }
                            ])
                            break;
                        }
                    }
                }
                catch (e) { /* empty */ }
            }
        }

        /* 
            EVENT TYPES

            1. TEXT GENERATION
            {"is_finished":false,"event_type":"text-generation","text":"Hello"}

            2. STREAM END
            {"is_finished":true,"event_type":"stream-end","response":{"response_id":"16bc9070-07c9-4b1b-941b-86b6e7390d7c","text":"Hello! How can I make your day better?","generation_id":"c2fb9baa-8cdb-44bb-90cc-c018d0bef154","token_count":{"prompt_tokens":77,"response_tokens":10,"total_tokens":87,"billed_tokens":72}},"finish_reason":"COMPLETE"}
        */        
        /* 
            SHOULD BE SOMETHING LIKE 
            {
                "response_id": "3636b5dc-07af-4c8b-875f-c62f53095726",
                "text": "Hello! How can I assist you today?",
                "generation_id": "a671b2a5-24ed-47c0-ad1f-c52e258f4c03",
                "token_count": {
                    "prompt_tokens": 76,
                    "response_tokens": 9,
                    "total_tokens": 85,
                    "billed_tokens": 70
                },
                "meta": {
                    "api_version": {
                        "version": "1"
                    }
                }
            }
        */
    }

    function resetChat() {
        setMessages([STARTING_CHAT_TURN])
    }

    return (
        <div className="chat-container">
            <div className="chat-message-container">
                <h2>Chat with Coral</h2>
                <div className='messages'>
                    {messages.map((m) => (
                        <div className='message' key={m.message}>
                            <span>{m.role}</span>
                            <span>{m.message}</span>
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
                    <button className='add-to-chat' onClick={sendMessage}>Send</button>
                    <button className='reset-chat' onClick={resetChat}>🗑️</button>
                </div>
            </div>
        </div>
    )
};