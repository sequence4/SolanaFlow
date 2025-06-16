"use client";

import { useEffect, useState } from "react";
import eventBus from "@/lib/eventBus";
import { motion, AnimatePresence } from "framer-motion";

export default function FileArrivalTicker() {
  const [queue, setQueue] = useState<string[]>([]);

  /* listen for arrivals --------------------------------------------------- */
  useEffect(() => {
    const handler = (filePath: string) => {
      setQueue(prev => [...prev, filePath]);
    };
    eventBus.on("file-arrival", handler);
    return () => eventBus.off("file-arrival", handler);
  }, []);

  /* after showing an item, remove it -------------------------------------- */
  useEffect(() => {
    if (!queue.length) return;
    const timer = setTimeout(() => setQueue(q => q.slice(1)), 600);
    return () => clearTimeout(timer);
  }, [queue]);

  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 -translate-x-1/2 z-50 font-mono text-xs text-sky-400">
      <AnimatePresence initial={false}>
        {queue.slice(0, 1).map((name, i) => (
          <motion.div
            key={name + i}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
            className="bg-black/70 px-3 py-1 rounded-md border border-sky-700"
          >
            {name}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
} 