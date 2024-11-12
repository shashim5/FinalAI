import React from 'react';
import { HistoryProps } from '../types';

const History: React.FC<HistoryProps> = ({
  session,
  index,
  isActive,
  onDelete,
  onSetActiveIndex,
  formatCodeBlock
}) => {
  return (
    <div
      key={session.id}
      className="ai-card"
    >
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
      <div
        onClick={() => onSetActiveIndex(isActive ? null : index)}
      >
        <h3>History Session {index + 1}</h3>
        {isActive ? (
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
  );
};

export default History;
