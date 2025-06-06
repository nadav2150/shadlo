import { X } from "lucide-react";
import { cn } from "~/lib/utils";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

export function Modal({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  className,
  maxWidth = 'lg'
}: ModalProps) {
  if (!isOpen) return null;

  const maxWidthClasses = {
    'sm': 'max-w-sm',
    'md': 'max-w-md',
    'lg': 'max-w-lg',
    'xl': 'max-w-xl',
    '2xl': 'max-w-2xl'
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div 
        className={cn(
          "relative bg-[#1E2228] rounded-xl border border-[#2A2F3A] w-full",
          maxWidthClasses[maxWidth],
          "shadow-2xl shadow-black/50",
          className
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#2A2F3A] sticky top-0 bg-[#1E2228] rounded-t-xl z-10">
          <h2 className="text-xl font-semibold text-white">{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-[#2A2F3A] rounded-lg transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5 text-gray-400 hover:text-gray-300" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[calc(100vh-8rem)] overflow-y-auto custom-scrollbar">
          {children}
        </div>
      </div>
    </div>
  );
} 