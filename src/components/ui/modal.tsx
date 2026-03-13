import React from 'react';

interface ModalProps {
  children: React.ReactNode;
  onClose: () => void;
}

export const Modal: React.FC<ModalProps> = ({ children, onClose }) => {
  const handleOutsideClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50"
      onClick={handleOutsideClick}
      onKeyDown={handleKeyDown}
      tabIndex={-1} // Make div focusable for keydown events
    >
      <div className="bg-white dark:bg-gray-800 p-4 rounded shadow-lg w-fit max-w-[90vw] overflow-y-auto max-h-[80vh]">
        {children}
      </div>
    </div>
  );
};
