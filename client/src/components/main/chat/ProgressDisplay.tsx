import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useProgressTracking } from '@/hooks/useProgressTracking';
import SequentialCodeDisplay from './SequentialCodeDisplay';
import { Loader2 } from 'lucide-react';

export const ProgressDisplay: React.FC = () => {
  const { processes, codeFiles } = useProgressTracking();
  
  // FILTER OUT environment stage - we don't want to show it to users
  const visibleProcesses = processes.filter(p => p.stage !== 'environment');
  
  // Get the current active process (highest priority)
  const activeProcess = visibleProcesses.find(p => p.pct < 100) || visibleProcesses[0];
  
  return (
    <div className="w-full space-y-4">
      {/* Simple spinner with status message */}
      <AnimatePresence mode="wait">
        {activeProcess && (
          <motion.div
            key={activeProcess.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="flex items-center space-x-3 text-gray-300"
          >
            {/* Spinner */}
            <Loader2 className="h-4 w-4 animate-spin text-cyan-500" />
            
            {/* Status message without emojis */}
            <div className="flex-1">
              <p className="text-sm">
                {activeProcess.message
                  .replace(/[^\x00-\x7F]/g, '') // Remove all non-ASCII (emojis)
                  .replace(/:\s*/g, '') // Remove colons
                  .trim()}
              </p>
              {activeProcess.details && (
                <p className="text-xs text-gray-500 mt-1">
                  Processing {activeProcess.details.current} of {activeProcess.details.total}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Code Files Display */}
      {codeFiles && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-4"
        >
          <SequentialCodeDisplay files={codeFiles.files} />
        </motion.div>
      )}
    </div>
  );
};