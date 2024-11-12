import React, { useState, useEffect, useRef } from 'react';
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';
import './styles.css';
import { AISession } from './types';
import { generateAIResponse, setupSpeechRecognition, checkMicrophoneAvailability } from './services/aiService';
import Session from './components/Session';
import History from './components/History';

const App: React.FC = () => {
  // State management
  const [aiSessions, setAiSessions] = useState<AISession[]>(() => {
    const savedSessions = localStorage.getItem('aiSessions');
    return savedSessions ? JSON.parse(savedSessions) : [];
  });

  const [historySessions, setHistorySessions] = useState<AISession[]>(() => {
    const savedHistory = localStorage.getItem('historySessions');
    return savedHistory ? JSON.parse(savedHistory) : [];
  });

  const [activeTab, setActiveTab] = useState<'current' | 'history'>('current');
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [activeSessionIndex, setActiveSessionIndex] = useState<number | null>(null);

  // Refs
  const recognitionRef = useRef<any>(null);
  const simulationIntervalRef = useRef<number | null>(null);

  // Effects
  useEffect(() => {
    localStorage.setItem('aiSessions', JSON.stringify(aiSessions));
  }, [aiSessions]);

  useEffect(() => {
    localStorage.setItem('historySessions', JSON.stringify(historySessions));
  }, [historySessions]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        stopListening(currentSessionId);
      }
    };
  }, [currentSessionId]);

  // Session management
  const addNewSession = async () => {
    const newSession: AISession = {
      id: Math.random().toString(36).substr(2, 9),
      question: '',
      response: '🎙️ Click "Start Listening" to begin recording your interview questions.',
      isListening: false,
      transcript: '',
      lastSimulationStep: 0
    };
    setAiSessions(prev => [...prev, newSession]);
    setActiveTab('current');
    setActiveSessionIndex(null);
  };

  const deleteSession = (index: number, isHistory: boolean = false) => {
    if (isHistory) {
      setHistorySessions(prev => prev.filter((_, i) => i !== index));
    } else {
      setAiSessions(prev => prev.filter((_, i) => i !== index));
    }
  };

  const moveToHistory = (index: number) => {
    setAiSessions(prev => {
      const sessionToMove = prev[index];
      setHistorySessions(prevHistory => [...prevHistory, sessionToMove]);
      return prev.filter((_, i) => i !== index);
    });
  };

  const stopListening = (sessionId: string | null) => {
    if (!sessionId) return;

    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }

    if (simulationIntervalRef.current !== null) {
      window.clearInterval(simulationIntervalRef.current);
      simulationIntervalRef.current = null;
    }

    setAiSessions(prev =>
      prev.map(session =>
        session.id === sessionId
          ? { ...session, isListening: false }
          : session
      )
    );
    setCurrentSessionId(null);
  };

  const toggleListening = async (sessionId: string) => {
    if (currentSessionId === sessionId) {
      stopListening(sessionId);
      return;
    }

    if (currentSessionId) {
      stopListening(currentSessionId);
    }

    const hasMicrophone = await checkMicrophoneAvailability();
    if (!hasMicrophone) {
      console.warn('No microphone detected, some features may be limited');
    }
    setCurrentSessionId(sessionId);

    const recognition = setupSpeechRecognition(
      // onStart
      () => {
        setAiSessions(prev =>
          prev.map(session =>
            session.id === sessionId
              ? { ...session, isListening: true }
              : session
          )
        );
      },
      // onResult
      async (transcript: string) => {
        const currentSession = aiSessions.find(s => s.id === sessionId);
        if (!currentSession) return;

        const response = await generateAIResponse(transcript);

        setAiSessions(prev =>
          prev.map(session =>
            session.id === sessionId
              ? {
                  ...session,
                  transcript,
                  question: transcript,
                  response
                }
              : session
          )
        );
      },
      // onError
      (error: string) => {
        console.error('Speech recognition error:', error);
        stopListening(sessionId);
      },
      // onEnd
      () => {
        if (currentSessionId === sessionId) {
          stopListening(sessionId);
        }
      }
    );

    if (recognition) {
      recognitionRef.current = recognition;
      recognition.start();
    }
  };

  const formatCodeBlock = (text: string): React.ReactNode => {
    if (text.includes('```')) {
      const codeContent = text.split('```')[1].trim();
      try {
        const highlighted = hljs.highlightAuto(codeContent);
        return (
          <pre className="code-block">
            <code
              dangerouslySetInnerHTML={{ __html: highlighted.value }}
            />
          </pre>
        );
      } catch (error) {
        return <pre className="code-block"><code>{codeContent}</code></pre>;
      }
    }
    return text;
  };

  return (
    <div className="container">
      <button
        className="add-button"
        onClick={addNewSession}
      >
        +
      </button>

      <div className="header">
        <h1>Interview AI Helper</h1>
        <p>Your real-time interview assistant</p>
      </div>

      <div className="tab-container">
        {currentSessionId && (
          <button
            className="button stop-button"
            onClick={() => stopListening(currentSessionId)}
          >
            Stop Session
          </button>
        )}
        <button
          className={`button ${activeTab === 'current' ? 'active' : ''}`}
          onClick={() => setActiveTab('current')}
        >
          Current Session
        </button>
        <button
          className={`button ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          History
        </button>
      </div>

      <div className="horizontal-scroll">
        {activeTab === 'current' && (
          <div className="sessions-container">
            {aiSessions.map((session, index) => (
              <Session
                key={session.id}
                session={session}
                index={index}
                isActive={index === activeSessionIndex}
                isCurrentSession={session.id === currentSessionId}
                onDelete={() => moveToHistory(index)}
                onMoveToHistory={() => moveToHistory(index)}
                onToggleListening={() => toggleListening(session.id)}
                onSetActiveIndex={setActiveSessionIndex}
                formatCodeBlock={formatCodeBlock}
              />
            ))}
          </div>
        )}
        {activeTab === 'history' && (
          <div className="sessions-container">
            {historySessions.map((session, index) => (
              <History
                key={session.id}
                session={session}
                index={index}
                isActive={index === activeSessionIndex}
                onDelete={() => deleteSession(index, true)}
                onSetActiveIndex={setActiveSessionIndex}
                formatCodeBlock={formatCodeBlock}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
