import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import hljs from 'highlight.js';
import { AudioBridge } from './audio/audioBridge';
import 'highlight.js/styles/github-dark.css';

interface AISession {
  id: string;
  question: string;
  response: string;
  isListening: boolean;
  transcript: string;
  lastSimulationStep: number;
}

const API_KEY = 'AIzaSyDfbugjoSRGIb40hn4JoxT8kLL39tIzCzM';
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

const styles = {
  container: {
    minHeight: '100vh',
    padding: '40px 20px',
    backgroundColor: '#020617',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    backgroundImage: 'radial-gradient(circle at 50% 50%, #0f172a 0%, #020617 100%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '60px',
    position: 'relative',
  },
  header: {
    textAlign: 'center',
    color: '#fff',
    '& h1': {
      fontSize: '2.5rem',
      marginBottom: '1rem',
    },
    '& p': {
      fontSize: '1.2rem',
      opacity: 0.8,
    },
  },
  horizontalScroll: {
    width: '100%',
    maxWidth: '100vw',
    overflowX: 'auto',
    display: 'flex',
    gap: '30px',
    padding: '20px 40px',  // Increased horizontal padding for better visibility
    scrollSnapType: 'x mandatory',
    scrollBehavior: 'smooth',
    position: 'relative',  // Added for proper scroll container positioning
    '&::-webkit-scrollbar': {
      display: 'none',
    },
    msOverflowStyle: 'none',  // Hide scrollbar in IE/Edge
    scrollbarWidth: 'none',   // Hide scrollbar in Firefox
  },
  aiCard: {
    minWidth: '350px',
    maxWidth: '350px',
    height: 'fit-content',
    minHeight: '200px',
    padding: '20px',
    background: 'linear-gradient(to bottom, #1F2937, #111827)',
    borderRadius: '24px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    backdropFilter: 'blur(16px)',
    color: '#fff',
    scrollSnapAlign: 'center',
    position: 'sticky',
    top: '20px',
    transformOrigin: 'center top',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    cursor: 'pointer',
    '&:hover': {
      transform: 'scale(1.02)',
    },
    '&.scrolled': {
      transform: 'scale(0.95)',
      opacity: 0.8,
    },
  },
  button: {
    padding: '10px 20px',
    borderRadius: '12px',
    border: 'none',
    background: 'linear-gradient(to right, #3B82F6, #2563EB)',
    color: '#fff',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    '&:hover': {
      transform: 'scale(1.05)',
      background: 'linear-gradient(to right, #2563EB, #1D4ED8)',
    },
    '&:disabled': {
      opacity: 0.5,
      cursor: 'not-allowed',
      transform: 'none',
    },
  },
  addButton: {
    position: 'fixed',
    top: '20px',
    right: '20px',
    width: '60px',
    height: '60px',
    borderRadius: '50%',
    background: 'linear-gradient(to right bottom, #3B82F6, #2563EB)',
    color: '#fff',
    fontSize: '2rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    border: 'none',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    transition: 'all 0.2s ease',
    '&:hover': {
      transform: 'scale(1.1)',
      background: 'linear-gradient(to right bottom, #2563EB, #1D4ED8)',
    },
  },
  codeBlock: {
    background: '#1a1a1a',
    borderRadius: '8px',
    padding: '1rem',
    margin: '1rem 0',
    overflowX: 'auto',
    fontSize: '0.9rem',
    lineHeight: '1.5',
    '& code': {
      fontFamily: 'monospace',
    },
  },
} as const;

const App: React.FC = () => {
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
  const [isRecording, setIsRecording] = useState<boolean>(false);

  const audioBridgeRef = useRef<AudioBridge | null>(null);
  const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const simulationIntervalRef = useRef<number | null>(null);

  // Initialize AudioBridge
  useEffect(() => {
    audioBridgeRef.current = new AudioBridge();

    // Set up transcript handling
    audioBridgeRef.current.onTranscript((transcript, isFinal) => {
      if (currentSessionId) {
        setAiSessions(prev => prev.map(session =>
          session.id === currentSessionId
            ? { ...session, transcript }
            : session
        ));

        if (isFinal && processingTimeoutRef.current === null) {
          processingTimeoutRef.current = setTimeout(async () => {
            const response = await generateAIResponse(transcript);
            setAiSessions(prev => prev.map(session =>
              session.id === currentSessionId
                ? { ...session, response }
                : session
            ));
            processingTimeoutRef.current = null;
          }, 2000);
        }
      }
    });

    // Set up error handling
    audioBridgeRef.current.onError((error) => {
      console.error('Audio capture error:', error);
      setIsRecording(false);
      setAiSessions(prev => prev.map(session =>
        session.id === currentSessionId
          ? { ...session, isListening: false }
          : session
      ));
    });

    return () => {
      audioBridgeRef.current?.stop();
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current);
        processingTimeoutRef.current = null;
      }
    };
  }, [currentSessionId]);

  useEffect(() => {
    console.log('Sessions updated:', aiSessions);
  }, [aiSessions]);

  const simulateRecording = (sessionId: string) => {
    let simulationStep = 0;
    const mockPhrases = [
      "Tell me about your experience with React and web development.",
      "How do you handle state management in complex applications?",
      "Can you describe a challenging project you worked on?",
      "What's your approach to debugging and testing?",
      "How do you stay updated with new technologies?"
    ];

    console.log('Starting simulation for session:', sessionId);

    // Initialize or resume session with proper content
    setAiSessions(prev => {
      const currentSession = prev.find(s => s.id === sessionId);
      const updatedSessions = prev.map(session =>
        session.id === sessionId ? {
          ...session,
          isListening: true,
          response: '🎤 Recording started - Simulating interview questions...',
          transcript: currentSession?.transcript || '', // Preserve existing transcript
          question: currentSession?.question || '', // Preserve existing question
          lastSimulationStep: currentSession?.lastSimulationStep || 0 // Track simulation progress
        } : session
      );
      console.log('Session initialized/resumed:', updatedSessions);
      localStorage.setItem('aiSessions', JSON.stringify(updatedSessions)); // Persist state
      return updatedSessions;
    });

    // Clear any existing interval before starting new one
    if (simulationIntervalRef.current !== null) {
      console.log('Clearing existing simulation interval');
      window.clearInterval(simulationIntervalRef.current);
      simulationIntervalRef.current = null;
    }

    // Simulate periodic transcript updates with visual feedback
    simulationIntervalRef.current = window.setInterval(async () => {
      try {
        const currentSession = aiSessions.find(s => s.id === sessionId);
        console.log('Current session state:', currentSession);

        if (!currentSession?.isListening) {
          console.log('Session paused, clearing interval');
          if (simulationIntervalRef.current !== null) {
            window.clearInterval(simulationIntervalRef.current);
            simulationIntervalRef.current = null;
          }
          setAiSessions(prev => {
            const updatedSessions = prev.map(s =>
              s.id === sessionId ? {
                ...s,
                response: '⏸️ Session paused - Click Start Listening to continue the interview'
              } : s
            );
            localStorage.setItem('aiSessions', JSON.stringify(updatedSessions));
            return updatedSessions;
          });
          return;
        }

        // Resume from last simulation step with proper state tracking
        simulationStep = currentSession.lastSimulationStep || 0;
        const mockTranscript = mockPhrases[simulationStep % mockPhrases.length];
        console.log('Generated mock transcript:', mockTranscript);

        // Update UI to show processing state
        setAiSessions(prev => prev.map(s =>
          s.id === sessionId ? {
            ...s,
            response: '💭 Processing interview response...'
          } : s
        ));

        // Preserve existing conversation and append new content
        const fullTranscript = currentSession.transcript
          ? `${currentSession.transcript}\n${mockTranscript}`
          : mockTranscript;

        // Generate AI response while maintaining context
        const response = await generateAIResponse(
          currentSession.question
            ? `${currentSession.question} ${mockTranscript}`
            : mockTranscript
        );
        console.log('Generated AI response:', response);

        setAiSessions(prev => {
          const updatedSessions = prev.map(session =>
            session.id === sessionId ? {
              ...session,
              transcript: fullTranscript,
              question: currentSession.question || mockTranscript,
              response: response || '🤔 Thinking...',
              lastSimulationStep: (simulationStep + 1) % mockPhrases.length // Update progress
            } : session
          );
          localStorage.setItem('aiSessions', JSON.stringify(updatedSessions));
          console.log('Updated sessions:', updatedSessions);
          return updatedSessions;
        });

        simulationStep = (simulationStep + 1) % mockPhrases.length;
      } catch (error) {
        console.error('Simulation error:', error);
        if (simulationIntervalRef.current !== null) {
          window.clearInterval(simulationIntervalRef.current);
          simulationIntervalRef.current = null;
        }
        setAiSessions(prev => prev.map(session =>
          session.id === sessionId ? {
            ...session,
            isListening: false,
            response: '❌ Simulation error occurred - Please try again'
          } : session
        ));
      }
    }, 2000); // Shorter interval for more responsive testing
  };

  const generateAIResponse = async (text: string): Promise<string> => {
    try {
      const result = await model.generateContent(text);
      const response = result.response;
      return response.text();
    } catch (error) {
      console.error('Error generating AI response:', error);
      return 'Error generating response. Please try again.';
    }
  };

  const startListening = useCallback((sessionId: string) => {
    // Update UI state
    setAiSessions(prev => prev.map(session =>
      session.id === sessionId ? {
        ...session,
        isListening: true,
        response: '🎤 Starting audio capture...'
      } : session
    ));
    setIsRecording(true);
    setCurrentSessionId(sessionId);

    // Request system audio capture using getDisplayMedia
    navigator.mediaDevices.getDisplayMedia({
      video: true,  // Required for screen sharing
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 44100,
      }
    })
    .then(async (stream) => {
      try {
        await audioBridgeRef.current?.connectStream(stream);
        setAiSessions(prev => prev.map(session =>
          session.id === sessionId ? {
            ...session,
            response: '🎤 Recording in progress... (Click Stop to pause)'
          } : session
        ));
      } catch (error) {
        console.error('Failed to connect audio stream:', error);
        setIsRecording(false);
        setAiSessions(prev => prev.map(session =>
          session.id === sessionId ? {
            ...session,
            isListening: false,
            response: '❌ Failed to connect audio stream. Please try again.'
          } : session
        ));
      }
    })
    .catch((error) => {
      console.error('Failed to capture system audio:', error);
      setIsRecording(false);
      setAiSessions(prev => prev.map(session =>
        session.id === sessionId ? {
          ...session,
          isListening: false,
          response: '❌ Failed to capture system audio. Please ensure you enable system audio sharing when prompted.'
        } : session
      ));
    });

    // Cleanup function
    return () => {
      audioBridgeRef.current?.stop();
    };
  }, [setIsRecording, setAiSessions, setCurrentSessionId]);

  const stopListening = useCallback((sessionId: string) => {
    // Clear simulation interval if active
    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
      simulationIntervalRef.current = null;
    }
    // Stop real recording if active
    audioBridgeRef.current?.stop();
    // Update UI state while preserving session data
    setAiSessions(prev => prev.map(session =>
      session.id === sessionId ? {
        ...session,
        isListening: false,
        response: session.response === '🎤 Recording...' ?
          '⏸️ Session paused - Click Start Listening to resume' :
          session.response,
        transcript: session.transcript || ''  // Preserve existing transcript
      } : session
    ));
    // Persist updated state to localStorage
    localStorage.setItem('aiSessions', JSON.stringify(aiSessions));
  }, [aiSessions]);

  const toggleListening = useCallback((sessionId: string) => {
    const session = aiSessions.find(s => s.id === sessionId);
    if (session?.isListening) {
      // Stop listening but preserve session state
      setIsRecording(false);
      setCurrentSessionId(null);
      stopListening(sessionId);
      // Update session state to indicate paused but not ended
      setAiSessions(prev => {
        const updatedSessions = prev.map(s =>
          s.id === sessionId ? {
            ...s,
            isListening: false,
            response: '⏸️ Session paused - Click Start Listening to resume'
          } : s
        );
        localStorage.setItem('aiSessions', JSON.stringify(updatedSessions));
        return updatedSessions;
      });
    } else {
      // Resume or start new recording
      setIsRecording(true);
      setCurrentSessionId(sessionId);
      startListening(sessionId);
    }
  }, [aiSessions, startListening, stopListening]);

  const deleteSession = (index: number, isHistory: boolean = false) => {
    if (isHistory) {
      setHistorySessions(prev => {
        const updatedSessions = prev.filter((_, i) => i !== index);
        localStorage.setItem('historySessions', JSON.stringify(updatedSessions));
        return updatedSessions;
      });
    } else {
      setAiSessions(prev => {
        const updatedSessions = prev.filter((_, i) => i !== index);
        localStorage.setItem('aiSessions', JSON.stringify(updatedSessions));
        return updatedSessions;
      });
    }
  };

  const stopSession = (sessionId: string) => {
    setAiSessions(prev => {
      const session = prev.find(s => s.id === sessionId);
      if (!session) return prev;

      // Stop any ongoing recording/simulation
      if (simulationIntervalRef.current) {
        window.clearInterval(simulationIntervalRef.current);
        simulationIntervalRef.current = null;
      }

      // Stop any ongoing speech recognition
      audioBridgeRef.current?.stop();

      // Move session to history with completion message
      const updatedSession = {
        ...session,
        isListening: false,
        response: '✅ Session completed and saved to history'
      };

      // Update history in localStorage
      const updatedHistory = [...historySessions, updatedSession];
      localStorage.setItem('historySessions', JSON.stringify(updatedHistory));
      setHistorySessions(updatedHistory);

      // Remove from current sessions and update localStorage
      const updatedSessions = prev.filter(s => s.id !== sessionId);
      localStorage.setItem('aiSessions', JSON.stringify(updatedSessions));

      // Reset current session ID
      setCurrentSessionId(null);

      return updatedSessions;
    });
  };

  const moveToHistory = (index: number) => {
    setAiSessions(prev => {
      const sessionToMove = prev[index];
      const updatedSessions = prev.filter((_, i) => i !== index);
      localStorage.setItem('aiSessions', JSON.stringify(updatedSessions));
      setHistorySessions(prevHistory => {
        const updatedHistory = [...prevHistory, sessionToMove];
        localStorage.setItem('historySessions', JSON.stringify(updatedHistory));
        return updatedHistory;
      });
      return updatedSessions;
    });
  };

  useEffect(() => {
    const handleScroll = () => {
      const container = document.querySelector('[data-scroll-container]');
      const cards = document.querySelectorAll('[data-card]');

      // Handle vertical scroll transformations
      cards.forEach((card) => {
        const rect = card.getBoundingClientRect();
        const scrolled = rect.top < 0;
        card.classList.toggle('scrolled', scrolled);
      });

      // Handle horizontal scroll transformations
      if (container) {
        cards.forEach((card) => {
          const rect = card.getBoundingClientRect();
          const centerOffset = (window.innerWidth - rect.width) / 2;
          const distanceFromCenter = Math.abs(rect.left - centerOffset);
          const scale = Math.max(0.85, 1 - (distanceFromCenter / window.innerWidth) * 0.3);
          const opacity = Math.max(0.6, 1 - (distanceFromCenter / window.innerWidth) * 0.5);
          (card as HTMLElement).style.transform = `scale(${scale})`;
          (card as HTMLElement).style.opacity = opacity.toString();
        });
      }
    };

    window.addEventListener('scroll', handleScroll);
    const container = document.querySelector('[data-scroll-container]');
    container?.addEventListener('scroll', handleScroll);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      container?.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const addNewSession = async () => {
    console.log('Adding new session...');
    const newSession: AISession = {
      id: Math.random().toString(36).substr(2, 9),
      question: '',
      response: '🎙️ Click "Start Listening" to begin recording your interview questions.',
      isListening: false,
      transcript: '',
      lastSimulationStep: 0
    };
    console.log('New session created:', newSession);
    setAiSessions(prev => {
      const updatedSessions = [...prev, newSession];
      console.log('Updated sessions:', updatedSessions);
      localStorage.setItem('aiSessions', JSON.stringify(updatedSessions));
      return updatedSessions;
    });
    setActiveTab('current'); // Ensure we're on the current tab
  };

  const formatCodeBlock = (text: string): React.ReactNode => {
    if (text.includes('```')) {
      const codeContent = text.split('```')[1].trim();
      try {
        const highlighted = hljs.highlightAuto(codeContent);
        return (
          <pre style={styles.codeBlock}>
            <code
              dangerouslySetInnerHTML={{ __html: highlighted.value }}
              style={{
                display: 'block',
                padding: '1rem',
                lineHeight: '1.5',
                tabSize: 4
              }}
            />
          </pre>
        );
      } catch (error) {
        return <pre style={styles.codeBlock}><code>{codeContent}</code></pre>;
      }
    }
    return text;
  };

  return (
    <div style={styles.container}>
      <button
        onClick={addNewSession}
        style={styles.addButton}
        devin-id="0"
      >
        +
      </button>

      <div style={styles.header}>
        <h1>Interview AI Helper</h1>
        <p>Your real-time interview assistant</p>
      </div>

      <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', alignItems: 'center' }}>
        {currentSessionId && (
          <button
            onClick={() => stopSession(currentSessionId)}
            style={styles.button}
          >
            Stop Session
          </button>
        )}
        <button
          onClick={() => setActiveTab('current')}
          style={{
            ...styles.button,
            background: activeTab === 'current' ? 'linear-gradient(to right, #3B82F6, #2563EB)' : '#374151',
          }}
        >
          Current Sessions
        </button>
        <button
          onClick={() => setActiveTab('history')}
          style={{
            ...styles.button,
            background: activeTab === 'history' ? 'linear-gradient(to right, #3B82F6, #2563EB)' : '#374151',
          }}
        >
          History
        </button>
      </div>

      <div style={styles.horizontalScroll} data-scroll-container>
        {(activeTab === 'current' ? aiSessions : historySessions).map((session, index) => (
          <div key={session.id} style={styles.aiCard} data-card>
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '10px' }}>Session {index + 1}</h3>
              {activeTab === 'current' && (
                <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', justifyContent: 'space-between' }}>
                  <button
                    onClick={() => toggleListening(session.id)}
                    style={styles.button}
                  >
                    {session.isListening ? 'Stop Listening' : 'Start Listening'}
                  </button>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    <button
                      onClick={() => deleteSession(index)}
                      style={{
                        ...styles.button,
                        padding: '5px 10px',
                        background: 'linear-gradient(to right, #EF4444, #DC2626)',
                      }}
                    >
                      ✕
                    </button>
                    <button
                      onClick={() => moveToHistory(index)}
                      style={{
                        ...styles.button,
                        padding: '5px 10px',
                        background: 'linear-gradient(to right, #8B5CF6, #7C3AED)',
                      }}
                    >
                      📚
                    </button>
                  </div>
                </div>
              )}
              {activeTab === 'history' && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '15px' }}>
                  <button
                    onClick={() => deleteSession(index, true)}
                    style={{
                      ...styles.button,
                      padding: '5px 10px',
                      background: 'linear-gradient(to right, #EF4444, #DC2626)',
                    }}
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
            {session.transcript && (
              <div style={{ marginBottom: '15px' }}>
                <strong>Transcript:</strong>
                <p style={{ marginTop: '5px', opacity: 0.8 }}>{session.transcript}</p>
              </div>
            )}
            <div>
              <strong>Response:</strong>
              <div style={{ marginTop: '5px', whiteSpace: 'pre-wrap' }}>
                {typeof session.response === 'string'
                  ? formatCodeBlock(session.response)
                  : session.response}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default App;
