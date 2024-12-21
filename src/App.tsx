import React, { useState, useEffect, useRef, useCallback } from 'react';
import hljs from 'highlight.js';
import { AudioBridge } from './audio/audioBridge';
import { generateResponse } from './services/aiService';
import 'highlight.js/styles/github-dark.css';

interface AISession {
  id: string;
  question: string;
  response: string;
  isListening: boolean;
  transcript: string;
  inputType: 'microphone' | 'system';
}

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
    padding: '20px 40px',
    scrollSnapType: 'x mandatory',
    scrollBehavior: 'smooth',
    position: 'relative',
    '&::-webkit-scrollbar': {
      display: 'none',
    },
    msOverflowStyle: 'none',
    scrollbarWidth: 'none',
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
    return savedSessions ? JSON.parse(savedSessions).map((session: any) => ({
      ...session,
      inputType: session.inputType || 'microphone' // Add default for backward compatibility
    })) : [];
  });
  const [historySessions, setHistorySessions] = useState<AISession[]>(() => {
    const savedHistory = localStorage.getItem('historySessions');
    return savedHistory ? JSON.parse(savedHistory).map((session: any) => ({
      ...session,
      inputType: session.inputType || 'microphone' // Add default for backward compatibility
    })) : [];
  });
  const [activeTab, setActiveTab] = useState<'current' | 'history'>('current');
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [inputType, setInputType] = useState<'microphone' | 'system'>('microphone');
  const [error, setError] = useState<string | null>(null);

  const audioBridgeRef = useRef<AudioBridge | null>(null);
  const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    audioBridgeRef.current = new AudioBridge();

    audioBridgeRef.current.onTranscript((transcript: string, isFinal: boolean) => {
      if (currentSessionId) {
        setAiSessions(prev => prev.map(session =>
          session.id === currentSessionId
            ? { ...session, transcript }
            : session
        ));

        if (isFinal && processingTimeoutRef.current === null) {
          processingTimeoutRef.current = setTimeout(async () => {
            try {
              const response = await generateResponse(transcript);
              setAiSessions(prev => prev.map(session =>
                session.id === currentSessionId
                  ? { ...session, response }
                  : session
              ));
            } catch (error) {
              console.error('Failed to generate AI response:', error);
              setAiSessions(prev => prev.map(session =>
                session.id === currentSessionId
                  ? { ...session, response: 'Failed to generate response. Please try again.' }
                  : session
              ));
            }
            processingTimeoutRef.current = null;
          }, 2000);
        }
      }
    });

    audioBridgeRef.current.onError((error: Error) => {
      console.error('Audio capture error:', error);
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

  const startListening = useCallback((sessionId: string) => {
    setAiSessions(prev => {
      const session = prev.find(s => s.id === sessionId);
      if (!session) return prev;

      const updatedSessions = prev.map(s =>
        s.id === sessionId ? {
          ...s,
          isListening: true,
          response: '🎙️ Starting audio capture...'
        } : s
      );

      if (session.inputType === 'microphone') {
        audioBridgeRef.current?.connectMicrophone().catch(error => {
          console.error('Failed to start microphone:', error);
          setError('Failed to access microphone. Please ensure microphone permissions are granted.');
          setAiSessions(prev => prev.map(s =>
            s.id === sessionId ? {
              ...s,
              isListening: false,
              response: '❌ Failed to access microphone. Please ensure microphone permissions are granted.'
            } : s
          ));
        });
      } else {
        // Request screen sharing with audio
        navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 44100
          }
        }).then(stream => {
          const audioTrack = stream.getAudioTracks()[0];
          if (!audioTrack) {
            throw new Error('No audio track found. Please ensure you enabled system audio sharing.');
          }
          const audioStream = new MediaStream([audioTrack]);
          audioBridgeRef.current?.connectStream(audioStream);
          // Clean up video track since we don't need it
          stream.getVideoTracks().forEach(track => track.stop());
        }).catch(error => {
          console.error('Failed to capture system audio:', error);
          setError('Failed to capture system audio. Please ensure you enable system audio sharing when prompted.');
          setAiSessions(prev => prev.map(s =>
            s.id === sessionId ? {
              ...s,
              isListening: false,
              response: '❌ Failed to capture system audio. Please try again and make sure to enable system audio sharing.'
            } : s
          ));
        });
      }

      return updatedSessions;
    });
    setCurrentSessionId(sessionId);
    setError(null);
  }, []);

  const stopListening = useCallback((sessionId: string) => {
    audioBridgeRef.current?.stop();
    setAiSessions(prev => prev.map(session =>
      session.id === sessionId ? {
        ...session,
        isListening: false,
        response: session.response === '🎤 Recording...' ?
          '⏸️ Session paused - Click Start Listening to resume' :
          session.response,
        transcript: session.transcript || ''
      } : session
    ));
    localStorage.setItem('aiSessions', JSON.stringify(aiSessions));
  }, []);

  const toggleListening = useCallback((sessionId: string) => {
    setAiSessions(prev => {
      const session = prev.find(s => s.id === sessionId);
      if (!session?.isListening) {
        startListening(sessionId);
      } else {
        setCurrentSessionId(null);
        stopListening(sessionId);
      }
      return prev;
    });
  }, [startListening, stopListening]);

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

      audioBridgeRef.current?.stop();

      const updatedSession = {
        ...session,
        isListening: false,
        response: '✅ Session completed and saved to history'
      };

      const updatedHistory = [...historySessions, updatedSession];
      localStorage.setItem('historySessions', JSON.stringify(updatedHistory));
      setHistorySessions(updatedHistory);

      const updatedSessions = prev.filter(s => s.id !== sessionId);
      localStorage.setItem('aiSessions', JSON.stringify(updatedSessions));

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

      cards.forEach((card) => {
        const rect = card.getBoundingClientRect();
        const scrolled = rect.top < 0;
        card.classList.toggle('scrolled', scrolled);
      });

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

  const addNewSession = () => {
    const newSession: AISession = {
      id: Math.random().toString(36).substr(2, 9),
      question: '',
      response: '🎙️ Click "Start Listening" to begin recording your interview questions.',
      isListening: false,
      transcript: '',
      inputType: inputType // Use selected input type
    };
    setAiSessions(prev => {
      const updatedSessions = [...prev, newSession];
      localStorage.setItem('aiSessions', JSON.stringify(updatedSessions));
      return updatedSessions;
    });
    setActiveTab('current');
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
        {error && (
          <div style={{ color: '#EF4444', marginTop: '10px', padding: '10px', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: '4px' }}>
            {error}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', alignItems: 'center', justifyContent: 'center' }}>
        <button
          onClick={() => setInputType('microphone')}
          style={{
            ...styles.button,
            background: inputType === 'microphone' ? 'linear-gradient(to right, #3B82F6, #2563EB)' : '#374151',
          }}
        >
          🎤 Microphone Input
        </button>
        <button
          onClick={() => setInputType('system')}
          style={{
            ...styles.button,
            background: inputType === 'system' ? 'linear-gradient(to right, #3B82F6, #2563EB)' : '#374151',
            opacity: 0.5, // Disabled for now
            cursor: 'not-allowed',
          }}
          disabled={true}
        >
          🔊 System Audio (Coming Soon)
        </button>
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
