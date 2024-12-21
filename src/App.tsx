import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import hljs from 'highlight.js';
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
    padding: '20px 0',
    scrollSnapType: 'x mandatory',
    scrollBehavior: 'smooth',
    '&::-webkit-scrollbar': {
      display: 'none',
    },
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
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    cursor: 'pointer',
    '&:hover': {
      transform: 'scale(1.02)',
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

  const recognitionRef = useRef<any>(null);
  const lastTranscriptRef = useRef('');
  const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const simulationIntervalRef = useRef<number | null>(null);

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
    if ('webkitSpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;

      // Update UI to show requesting permissions
      setAiSessions(prev => prev.map(session =>
        session.id === sessionId ? {
          ...session,
          response: session.response || '🎤 Checking microphone availability...',
          isListening: false
        } : session
      ));

      // First check if any audio devices are available
      navigator.mediaDevices.enumerateDevices()
        .then(devices => {
          const hasAudioDevice = devices.some(device => device.kind === 'audioinput');
          if (!hasAudioDevice) {
            throw new Error('NO_MICROPHONE');
          }
          return navigator.mediaDevices.getUserMedia({ audio: true });
        })
        .catch(() => {
          console.log('Microphone not available, entering simulation mode');
          simulateRecording(sessionId);
          setAiSessions(prev => prev.map(session =>
            session.id === sessionId ? {
              ...session,
              isListening: true,
              response: session.response || '🎤 Simulation mode: Recording...',
              transcript: session.transcript || '' // Preserve existing transcript
            } : session
          ));
          throw new Error('SIMULATION_MODE');
        })
        .then(() => {
          recognition.onstart = () => {
            setIsRecording(true);
            setAiSessions(prev => prev.map(session =>
              session.id === sessionId ? {
                ...session,
                isListening: true,
                response: session.response || '🎤 Recording in progress... (Click Stop to pause)',
                transcript: session.transcript || '' // Preserve existing transcript if resuming
              } : session
            ));
          };

          recognition.onresult = (event: any) => {
            const currentSession = aiSessions.find(s => s.id === sessionId);
            if (!currentSession?.isListening) return; // Don't process if stopped

            const existingTranscript = currentSession?.transcript || '';
            let newTranscript = Array.from(event.results)
              .map((result: any) => result[0])
              .map((result: any) => result.transcript)
              .join('');

            // Clear any existing processing timeout
            if (processingTimeoutRef.current) {
              clearTimeout(processingTimeoutRef.current);
            }

            // Always append new transcript to existing one to maintain conversation continuity
            const fullTranscript = existingTranscript + ' ' + newTranscript;

            // Update UI with current transcript and recording state
            setAiSessions(prev => prev.map(session =>
              session.id === sessionId ? {
                ...session,
                transcript: fullTranscript.trim(),
                question: session.question || '', // Preserve existing question
                response: session.response || (isRecording
                  ? '🎤 Recording in progress... (Click Stop to pause)'
                  : '⏸️ Paused (Click Start to resume)'),
                isListening: true
              } : session
            ));

            // Wait for a 2-second pause before processing
            processingTimeoutRef.current = setTimeout(async () => {
              const updatedSession = aiSessions.find(s => s.id === sessionId);
              if (updatedSession?.isListening &&
                  fullTranscript.trim().length > 10 &&
                  fullTranscript !== lastTranscriptRef.current) {
                lastTranscriptRef.current = fullTranscript;
                setAiSessions(prev => prev.map(session =>
                  session.id === sessionId ? {
                    ...session,
                    response: '💭 Processing your input...',
                    isListening: true,
                    question: session.question || '', // Preserve existing question
                    transcript: fullTranscript.trim() // Keep transcript for continuity
                  } : session
                ));
                const response = await generateAIResponse(fullTranscript);
                setAiSessions(prev => prev.map(session =>
                  session.id === sessionId ? {
                    ...session,
                    question: fullTranscript,
                    response,
                    transcript: fullTranscript.trim(), // Keep transcript for reference
                    isListening: true // Maintain recording state
                  } : session
                ));
              }
            }, 2000); // 2-second debounce
          };

          recognition.onerror = (event: any) => {
            setIsRecording(false);
            console.error('Speech recognition error:', event.error);
            let errorMessage = 'An error occurred. ';

            switch(event.error) {
              case 'network':
                errorMessage += 'Network error. Please check your internet connection.';
                break;
              case 'not-allowed':
                errorMessage += 'Microphone access denied. Please allow microphone access in your browser settings.';
                break;
              case 'no-speech':
                // Don't show error for no speech, just keep listening
                return;
              default:
                errorMessage += `Error: ${event.error}. Please try again.`;
            }

            setAiSessions(prev => prev.map(session =>
              session.id === sessionId ? {
                ...session,
                isListening: false,
                response: '❌ ' + errorMessage
              } : session
            ));
          };

          recognition.onend = () => {
            setIsRecording(false);
            const currentSession = aiSessions.find(s => s.id === sessionId);
            if (currentSession && !currentSession.response.includes('error')) {
              setAiSessions(prev => prev.map(session =>
                session.id === sessionId ? {
                  ...session,
                  isListening: false,
                  response: session.response || '⏸️ Session paused. Click Start to resume recording.',
                  transcript: session.transcript || '' // Preserve transcript when paused
                } : session
              ));
            }
          };

          recognition.start();
          recognitionRef.current = recognition;
        })
        .catch(error => {
          setIsRecording(false);
          console.error('Microphone setup error:', error);
          const errorMessage = error.message || 'Error: Unable to access microphone. Please check your microphone settings and try again.';
          setAiSessions(prev => prev.map(session =>
            session.id === sessionId ? {
              ...session,
              response: '❌ ' + errorMessage,
              isListening: false
            } : session
          ));
        });
    } else {
      console.error('Speech recognition not supported');
      setAiSessions(prev => prev.map(session =>
        session.id === sessionId ? {
          ...session,
          response: 'Error: Speech recognition is not supported in this browser. Please try using Chrome.',
          isListening: false
        } : session
      ));
    }
  }, [aiSessions]);

  const stopListening = useCallback((sessionId: string) => {
    // Clear simulation interval if active
    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
      simulationIntervalRef.current = null;
    }
    // Stop real recording if active
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
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
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }

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
    console.log('State updated - activeTab:', activeTab);
    console.log('State updated - aiSessions:', aiSessions);
    return () => {
      if (recognitionRef.current) {
        stopListening(aiSessions[0]?.id);
      }
    };
  }, [stopListening, aiSessions, activeTab]);

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

      <div style={styles.horizontalScroll}>
        {(activeTab === 'current' ? aiSessions : historySessions).map((session, index) => (
          <div key={session.id} style={styles.aiCard}>
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
