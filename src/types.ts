export interface AISession {
  id: string;
  question: string;
  response: string;
  isListening: boolean;
  transcript: string;
  lastSimulationStep: number;
}

export interface SessionProps {
  session: AISession;
  index: number;
  isActive: boolean;
  isCurrentSession: boolean;
  onToggleListening: (id: string) => void;
  onDelete: (index: number) => void;
  onMoveToHistory: (index: number) => void;
  onSetActiveIndex: (index: number | null) => void;
  formatCodeBlock: (text: string) => React.ReactNode;
}

export interface HistoryProps {
  session: AISession;
  index: number;
  isActive: boolean;
  onDelete: (index: number) => void;
  onSetActiveIndex: (index: number | null) => void;
  formatCodeBlock: (text: string) => React.ReactNode;
}
