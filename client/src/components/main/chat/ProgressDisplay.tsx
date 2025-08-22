import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Progress } from '@/components/ui/progress';
import { useProgressTracking } from '@/hooks/useProgressTracking';
import SequentialCodeDisplay from './SequentialCodeDisplay';

export const ProgressDisplay: React.FC = () => {
  const { processes, codeFiles } = useProgressTracking();
  
  // FILTER OUT environment stage - we don't want to show it to users
  const visibleProcesses = processes.filter(p => p.stage !== 'environment');
  
  // Calculate overall progress from visible processes only
  const visibleOverallProgress = React.useMemo(() => {
    if (visibleProcesses.length === 0) return 0;
    const totalProgress = visibleProcesses.reduce((sum, p) => sum + p.pct, 0);
    return Math.round(totalProgress / visibleProcesses.length);
  }, [visibleProcesses]);
  
  const formatTime = (seconds?: number) => {
    if (!seconds || seconds <= 0) return '';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  const getStageIcon = (stage: string) => {
    switch(stage) {
      case 'environment': return '🐳';
      case 'code-gen': return '⚙️';
      case 'build': return '🔨';
      case 'deploy': return '🚀';
      default: return '📋';
    }
  };
  
  return (
    <div className="w-full space-y-4">
      {/* Overall Progress - only show if we have visible processes */}
      {visibleProcesses.length > 0 && (
        <div className="bg-gray-900/50 rounded-lg p-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-medium text-gray-300">
              Deployment Progress
            </h3>
            <span className="text-xs font-mono text-gray-500">
              {visibleOverallProgress}%
            </span>
          </div>
          <Progress value={visibleOverallProgress} className="h-2" />
        </div>
      )}
      
      {/* Active Processes - use filtered list */}
      <AnimatePresence>
        {visibleProcesses.map(process => (
          <motion.div
            key={process.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-gray-900/30 rounded-lg p-3 border-l-4 border-cyan-500/50"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span>{getStageIcon(process.stage)}</span>
                <span className="text-xs font-medium text-gray-300">
                  {process.process.replace(/-/g, ' ').replace(/^\w/, c => c.toUpperCase())}
                </span>
                <span className="text-xs text-gray-500 ml-2">
                  ({process.stage})
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                {process.estimatedTimeRemaining && (
                  <span>~{formatTime(process.estimatedTimeRemaining)} left</span>
                )}
                <span className="font-mono">{process.pct}%</span>
              </div>
            </div>
            
            <Progress value={process.pct} className="h-1 mb-2" />
            
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">{process.message}</span>
              {process.details && (
                <span className="text-xs font-mono text-gray-500">
                  {process.details.current}/{process.details.total}
                </span>
              )}
            </div>
          </motion.div>
        ))}
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