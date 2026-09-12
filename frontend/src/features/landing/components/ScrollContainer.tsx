import type { ReactNode } from 'react';

export interface ScrollContainerProps {
  children: ReactNode;
}

export function ScrollContainer({ children }: ScrollContainerProps) {
  return (
    <div className="scroll-container">
      {children}
    </div>
  );
}
