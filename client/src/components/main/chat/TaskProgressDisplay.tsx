import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

interface TaskProgressDisplayProps {
  tasks: Record<string, {
    name: string;
    status: 'running' | 'completed' | 'error';
    pct: number;
    stage: string;
    message?: string;
    thoughts?: string[];
  }>;
}

export const TaskProgressDisplay: React.FC<TaskProgressDisplayProps> = ({ tasks }) => {
  const taskEntries = Object.entries(tasks);
  
  if (taskEntries.length === 0) return null;

  return (
    <div className="task-progress-container space-y-3 p-4 bg-gray-50 dark:bg-gray-800/30 rounded-lg border border-gray-200 dark:border-gray-700">
      <AnimatePresence mode="popLayout">
        {taskEntries.map(([taskId, task]) => (
          <motion.div
            key={taskId}
            initial={{ opacity: 0, height: 0, y: -10 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="task-item flex items-center gap-3 p-3 bg-white dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700"
          >
            <div className="task-icon flex-shrink-0">
              {task.status === 'running' && (
                <Loader2 size={16} className="animate-spin text-blue-500" />
              )}
              {task.status === 'completed' && (
                <CheckCircle size={16} className="text-green-500" />
              )}
              {task.status === 'error' && (
                <XCircle size={16} className="text-red-500" />
              )}
            </div>
            
            <div className="task-details flex-1 min-w-0">
              <div className="task-name text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                {task.name}
              </div>
              {task.message && (
                <div className="task-message text-xs text-gray-600 dark:text-gray-400 mt-1 truncate">
                  {task.message}
                </div>
              )}
              
              {/* AI Thoughts Section */}
              {task.thoughts && task.thoughts.length > 0 && (
                <div className="ai-thoughts mt-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-md border-l-2 border-blue-400">
                  <div className="thoughts-header text-xs font-medium text-blue-700 dark:text-blue-300 mb-2 flex items-center gap-1">
                    <div className="w-1 h-1 bg-blue-500 rounded-full animate-pulse"></div>
                    AI Analysis
                  </div>
                  <div className="thoughts-list space-y-1">
                    {task.thoughts.map((thought, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1, duration: 0.3 }}
                        className="thought-item text-xs text-blue-600 dark:text-blue-300 flex items-start gap-2"
                      >
                        <span className="text-blue-400 dark:text-blue-400 text-xs">•</span>
                        <span className="leading-relaxed">{thought}</span>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
              
              {task.status === 'running' && (
                <div className="task-progress mt-2">
                  <div className="progress-bar bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                    <motion.div
                      className="progress-fill bg-blue-500 h-full rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${task.pct}%` }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                    />
                  </div>
                </div>
              )}
            </div>
            
            <div className="task-percentage text-xs text-gray-500 dark:text-gray-400 font-mono flex-shrink-0 w-12 text-right">
              {task.pct}%
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};