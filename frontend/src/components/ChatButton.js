import React from 'react';
import { MessageCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ChatButton({ onClick, count = 0, requestId, userRole, requestStatus, isOpen = false }) {
  return (
    <motion.button
      onClick={onClick}
      className="fixed bottom-6 right-6 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-full w-16 h-16 shadow-xl hover:shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-110 z-50"
      aria-label={isOpen ? "Close chat" : "Open chat"}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
    >
      <AnimatePresence mode="wait">
        {isOpen ? (
          <motion.div
            key="close"
            initial={{ rotate: -90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            exit={{ rotate: 90, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <X className="w-6 h-6" />
          </motion.div>
        ) : (
          <motion.div
            key="chat"
            initial={{ rotate: 90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            exit={{ rotate: -90, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <MessageCircle className="w-6 h-6" />
          </motion.div>
        )}
      </AnimatePresence>
      
      {count > 0 && (
        <motion.span 
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold shadow-lg"
        >
          {count > 9 ? '9+' : count}
        </motion.span>
      )}
      
      {/* Pulse animation for new messages */}
      {count > 0 && (
        <motion.div
          className="absolute inset-0 bg-blue-400 rounded-full"
          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}
    </motion.button>
  );
}


