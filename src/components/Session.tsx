import React from 'react';
import { SessionProps } from '../types';

const Session: React.FC<SessionProps> = ({
  session,
  index,
  isActive,
  isCurrentSession,
  onToggleListening,
  onDelete,
  onMoveToHistory,
  onSetActiveIndex,
  formatCodeBlock
}) => {
  return (
    <div
      key={session.id}
      className="ai-card"
      style={{
        border: isCurrentSession ? '2px solid #4CAF50' : undefined,
        boxShadow: isCurrentSession ? '0 0 10px rgba(76, 175, 80, 0.3)' : undefined,
        opacity: session.isListening ? 1 : 0.8,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '10px' }}>
        <button
          className="card-button delete-button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(index);
          }}
          title="Delete session"
        >
          ✕
        </button>
        <button
          className="card-button history-button"
          onClick={(e) => {
            e.stopPropagation();
            onMoveToHistory(index);
          }}
          title="Move to history"
        >
          📚
        </button>
      </div>
      <button
        className="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleListening(session.id);
        }}
        style={{
          margin: '10px',
          backgroundColor: isCurrentSession ? '#4CAF50' : undefined,
          transition: 'background-color 0.3s ease'
        }}
      >
        {isCurrentSession ? 'Stop Listening' : 'Start Listening'}
      </button>
      <div
        onClick={() => onSetActiveIndex(isActive ? null : index)}
        style={{ padding: '10px' }}
      >
        <h3>Session {index + 1}</h3>
        {isCurrentSession && <p style={{ color: '#4CAF50' }}>🎤 Recording...</p>}
        {isActive ? (
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
  );
};

export default Session;
