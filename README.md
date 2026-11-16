# Prabhat Personal AI Agent – Multilingual Voice AI Assistant

A real-time, multilingual voice AI assistant that helps users manage their Google Calendar through natural voice conversations. Users can book, reschedule, cancel appointments, check availability, and view events without manually navigating the calendar.

This project was developed as part of **Google Bootcamps** and explores the use of conversational AI, real-time speech processing, and agentic tool execution.

## Key Features

- **Multilingual Voice Interaction:** Supports Hindi, Bhojpuri, Tamil, Marathi, Telugu, and English, including mixed-language conversations.
- **Real-Time Conversations:** Uses the Google Gemini Live API to understand speech and generate conversational responses.
- **Google Calendar Automation:** Allows users to view events, check availability, book appointments, reschedule meetings, and cancel events.
- **Agentic Function Calling:** Uses AI-powered tools to perform calendar operations based on user requests.
- **Real-Time Audio Processing:** Uses WebSockets, Web Audio API, AudioWorklet, PCM audio processing, and Voice Activity Detection (VAD).
- **Secure Authentication:** Integrates Firebase Authentication and Google OAuth 2.0 for user authentication and calendar access.
- **User Confirmation:** Includes confirmation workflows for sensitive actions such as rescheduling and cancelling appointments.
- **Google Meet Integration:** Supports Google Meet link generation where enabled.

## Technology Stack

| Category | Technologies |
|---|---|
| Frontend | React 19, TypeScript, Tailwind CSS v4, Vite |
| Backend | Node.js, Express.js, TypeScript |
| AI Model | Google Gemini Live API |
| Real-Time Communication | WebSockets |
| Audio Processing | Web Audio API, AudioWorklet, PCM, VAD |
| Authentication | Firebase Authentication, Google OAuth 2.0 |
| Calendar Integration | Google Calendar API v3 |
| UI Components | Lucide React, Motion |

## System Architecture

The application follows a modular frontend and backend architecture.

1. **Frontend:** React provides the voice interaction interface, calendar panel, booking forms, language selection, and confirmation dialogs.
2. **Audio Processing:** The browser captures microphone input and processes audio using Web Audio API and AudioWorklet.
3. **Backend:** Node.js and Express manage communication between the frontend, Gemini Live API, and Google Calendar.
4. **AI Processing:** Gemini Live API understands user requests, maintains conversational interaction, and determines when calendar tools should be called.
5. **Tool Execution:** Backend functions handle calendar operations through Google Calendar API.
6. **Response:** The assistant provides conversational feedback to the user.

## Agent Tools

The AI assistant uses the following tools to perform calendar operations:

| Tool | Description |
|---|---|
| `get_current_datetime` | Retrieves the current date and time |
| `list_events` | Retrieves calendar events |
| `check_availability` | Checks available time slots |
| `book_appointment` | Creates a calendar event |
| `reschedule_appointment` | Updates an existing event |
| `cancel_appointment` | Deletes a calendar event |

## Audio Processing Pipeline

The application uses a real-time audio pipeline for voice interaction:

- Captures microphone input through the browser.
- Processes and resamples input audio to 16 kHz PCM.
- Uses Voice Activity Detection (VAD) based on audio energy.
- Transfers audio data through WebSockets.
- Receives AI-generated audio responses at 24 kHz.
- Supports interruption handling (barge-in) during conversations.

## Project Structure

```text
project/
├── server.ts
├── server/
│   ├── liveBridge.ts
│   ├── calendarApi.ts
│   └── geminiClient.ts
│
├── src/
│   ├── App.tsx
│   ├── components/
│   └── lib/
│       ├── audioEngine.ts
│       └── firebaseAuth.ts
│
└── README.md
```

## Security and User Control

- Uses Firebase Authentication and Google OAuth 2.0.
- Requests only the required Google Calendar permissions.
- Keeps OAuth access tokens in memory rather than local storage.
- Requires user confirmation for rescheduling and cancellation actions.

## Project Objective

The main objective is to explore how real-time conversational AI and multilingual speech interfaces can make everyday digital services easier to access.

By combining speech understanding, agentic function calling, and API integration, this project demonstrates how users can interact with digital applications naturally through voice rather than relying only on traditional graphical interfaces.

## Future Scope

- Expand support for additional Indian languages and regional dialects.
- Improve speech recognition in noisy environments.
- Extend the assistant to support additional productivity services.
- Improve conversational accuracy and context handling.

---

**Project:** Prabhat Personal AI Agent – Multilingual Voice AI Assistant  
**Development:** Google Bootcamps Project  
**Focus Areas:** Multilingual AI | Generative AI | Voice AI | Agentic AI | Real-Time Systems | API Integration
