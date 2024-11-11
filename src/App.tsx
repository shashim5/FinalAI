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
    fontSize: '2.25rem',
    fontWeight: '700',
    textShadow: '0 2px 4px rgba(0, 0, 0, 0.5)',
    marginBottom: '20px',
  },
  transcriptArea: {
    width: '100%',
    maxWidth: '800px',
    padding: '32px',
    background: 'linear-gradient(to bottom, #1F2937, #111827)',
    borderRadius: '24px',
    color: '#fff',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(12px)',
    fontSize: '1.2rem',
    lineHeight: 1.7,
    position: 'relative',
    zIndex: 2,
  },
  horizontalScroll: {
    width: '100%',
    maxWidth: '100vw',
    overflowX: 'auto',
    display: 'flex',
    gap: '30px',
    padding: '40px',
    paddingBottom: '60px', // Extra padding to prevent cut-off
    scrollSnapType: 'x mandatory',
    position: 'relative',
    scrollBehavior: 'smooth',
    msOverflowStyle: 'none',
    scrollbarWidth: 'none',
    '&::-webkit-scrollbar': {
      display: 'none'
    }
  },
  aiCard: {
    minWidth: '350px',
    maxWidth: '350px',
    height: 'fit-content',
    minHeight: '200px',
    padding: '20px',
    background: 'linear-gradient(to bottom, #1F2937, #111827)',
    borderRadius: '24px',
    color: '#fff',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(12px)',
    fontSize: '1.2rem',
    lineHeight: 1.7,
    position: 'relative',
    scrollSnapAlign: 'center',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    cursor: 'pointer',
    overflow: 'visible',
    flex: '0 0 auto',
    zIndex: 1,
    marginBottom: '20px', // Prevent bottom cut-off
  },
  cardButton: {
    position: 'absolute',
    top: '10px',
    background: 'rgba(0, 0, 0, 0.8)',
    border: '2px solid rgba(255, 255, 255, 0.3)',
    cursor: 'pointer',
    width: '36px',
    height: '36px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '20px',
    color: '#fff',
    transition: 'all 0.2s ease-in-out',
    zIndex: 9999,
    borderRadius: '50%',
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)',
    '&:hover': {
      transform: 'scale(1.1)',
      boxShadow: '0 6px 12px rgba(0, 0, 0, 0.4)',
    }
  },
  deleteButton: {
    right: '10px',
    backgroundColor: 'rgba(255, 0, 0, 0.2)',
    '&:hover': {
      backgroundColor: 'rgba(255, 0, 0, 0.4)',
      color: '#fff',
    },
  },
  historyButton: {
    right: '55px',
    backgroundColor: 'rgba(0, 0, 255, 0.2)',
    '&:hover': {
      backgroundColor: 'rgba(0, 0, 255, 0.4)',
      color: '#fff',
    },
  },
  button: {
    padding: '14px 32px',
    background: 'linear-gradient(to bottom, #6366F1, #4338CA)',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    fontSize: '1.1rem',
    fontWeight: '600',
    boxShadow: '0 8px 16px -2px rgba(79, 70, 229, 0.4)',
    transition: 'transform 0.2s, box-shadow 0.2s',
    width: '100%', // Make buttons full width in cards
  },
  addButton: {
    position: 'fixed',
    top: '20px',
    right: '20px',
    width: '60px',
    height: '60px',
    borderRadius: '50%',
    background: 'linear-gradient(to bottom, #6366F1, #4338CA)',
    color: '#fff',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'transform 0.3s ease',
    zIndex: 1000,
    boxShadow: '0 8px 16px -2px rgba(79, 70, 229, 0.4)',
  },
  addButtonHover: {
    transform: 'scale(1.1)',
    background: 'linear-gradient(to bottom, #4F46E5, #3730A3)',
  }
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
  const [isHovered, setIsHovered] = useState(false);
  const [activeTab, setActiveTab] = useState<'current' | 'history'>('current');
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [activeSessionIndex, setActiveSessionIndex] = useState<number | null>(null);
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
      setHistorySessions(prev => prev.filter((_, i) => i !== index));
    } else {
      setAiSessions(prev => prev.filter((_, i) => i !== index));
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
      setHistorySessions(prevHistory => [...prevHistory, sessionToMove]);
      return prev.filter((_, i) => i !== index);
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
  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

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
      return [...prev, newSession];
    });
    setActiveTab('current'); // Ensure we're on the current tab
    setActiveSessionIndex(null); // Reset active session index
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
        return <pre className="code-block"><code>{codeContent}</code></pre>;
      }
    }
    return text;
  };

  return (
    <div style={styles.container as React.CSSProperties}>
      <button
        onClick={addNewSession}
        style={{
          ...styles.addButton,
          ...(isHovered ? styles.addButtonHover : {})
        } as React.CSSProperties}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        devin-id="0"
      >
        +
      </button>

      <div style={styles.header as React.CSSProperties}>
        <h1>Interview AI Helper</h1>
        <p>Your real-time interview assistant</p>
      </div>

      <div style={{
        display: 'flex',
        gap: '20px',
        marginBottom: '20px',
        alignItems: 'center'
      } as React.CSSProperties}>
        {currentSessionId && (
          <button
            onClick={() => stopSession(currentSessionId)}
            style={{
              ...styles.button,
              backgroundColor: '#dc3545',
              marginRight: '20px'
            } as React.CSSProperties}
          >
            Stop Session
          </button>
        )}
        <button
          onClick={() => setActiveTab('current')}
          style={{
            ...styles.button,
            opacity: activeTab === 'current' ? 1 : 0.7
          } as React.CSSProperties}
        >
          Current Session
        </button>
        <button
          onClick={() => setActiveTab('history')}
          style={{
            ...styles.button,
            opacity: activeTab === 'history' ? 1 : 0.7
          } as React.CSSProperties}
        >
          History
        </button>
      </div>
      <div
        className="horizontal-scroll-container scroll-fade-edges"
        style={{
          ...styles.horizontalScroll,
          position: 'relative'
        } as React.CSSProperties}
      >
        {activeTab === 'current' && (
          <div style={{ display: 'flex', gap: '20px', padding: '20px', overflowX: 'auto' }}>
            {aiSessions.map((session, index) => (
              <div
                key={session.id}
                style={{
                  ...styles.aiCard,
                  border: session.id === currentSessionId ? '2px solid #4CAF50' : undefined,
                  boxShadow: session.id === currentSessionId ? '0 0 10px rgba(76, 175, 80, 0.3)' : undefined,
                  opacity: session.isListening ? 1 : 0.8,
                  display: 'flex',
                  flexDirection: 'column',
                  minWidth: '300px',
                  maxWidth: '400px'
                } as React.CSSProperties}
              >
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '10px' }}>
                  <button
                    style={{
                      ...styles.cardButton,
                      ...styles.deleteButton
                    } as React.CSSProperties}
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSession(index);
                    }}
                    title="Delete session"
                  >
                    ✕
                  </button>
                  <button
                    style={{
                      ...styles.cardButton,
                      ...styles.historyButton
                    } as React.CSSProperties}
                    onClick={(e) => {
                      e.stopPropagation();
                      moveToHistory(index);
                    }}
                    title="Move to history"
                  >
                    📚
                  </button>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleListening(session.id);
                  }}
                  style={{
                    ...styles.button,
                    margin: '10px',
                    backgroundColor: session.id === currentSessionId ? '#4CAF50' : undefined,
                    transition: 'background-color 0.3s ease'
                  } as React.CSSProperties}
                >
                  {session.id === currentSessionId ? 'Stop Listening' : 'Start Listening'}
                </button>
                <div
                  onClick={() => setActiveSessionIndex(activeSessionIndex === index ? null : index)}
                  style={{ padding: '10px' }}
                >
                  <h3>Session {index + 1}</h3>
                  {session.id === currentSessionId && <p style={{ color: '#4CAF50' }}>🎤 Recording...</p>}
                  {activeSessionIndex === index ? (
                    <>
                      <h4>Question:</h4>
                      <p>{session.question || session.transcript}</p>
                      <h4>Response:</h4>
                      <div>{formatCodeBlock(session.response)}</div>
                    </>
                  ) : (
                    <p>Click to view content</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {activeTab === 'history' && (
          historySessions.map((session, index) => (
            <div
              key={session.id}
              style={styles.aiCard as React.CSSProperties}
            >
              <button
                style={{
                  ...styles.cardButton,
                  ...styles.deleteButton
                } as React.CSSProperties}
                onClick={(e) => {
                  e.stopPropagation();
                  deleteSession(index, true);
                }}
                title="Delete session"
              >
                ✕
              </button>
              <div onClick={() => setActiveSessionIndex(activeSessionIndex === index ? null : index)}>
                <h3>History Session {index + 1}</h3>
                {activeSessionIndex === index ? (
                  <>
                    <h4>Question:</h4>
                    <p>{session.question}</p>
                    <h4>Response:</h4>
                    <div>{formatCodeBlock(session.response)}</div>
                  </>
                ) : (
                  <p>Click to view content</p>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default App;
