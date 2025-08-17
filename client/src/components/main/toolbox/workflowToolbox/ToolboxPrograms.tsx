import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, ExternalLink, Shield, CheckCircle } from 'lucide-react';

export const ToolboxPrograms = () => {
    const [copiedId, setCopiedId] = useState<string | null>(null);
    
    const programs = [
        {
            name: 'SPL Token',
            id: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
            icon: 'T',
            color: 'blue',
            description: 'Fungible and Non-Fungible Token Interface',
            version: 'v1.0.0',
            verified: true
        },
        {
            name: 'SPL Associated Token',
            id: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
            icon: 'A',
            color: 'blue',
            description: 'Create and manage associated token accounts',
            version: 'v1.0.0',
            verified: true
        },
        {
            name: 'Metaplex Token Metadata',
            id: 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s',
            icon: 'M',
            color: 'purple',
            description: 'Create and manage token metadata',
            version: 'v1.4.0',
            verified: true
        },
        {
            name: 'System Program',
            id: '11111111111111111111111111111111',
            icon: 'S',
            color: 'green',
            description: 'Create accounts, transfer SOL, etc.',
            version: 'v1.0.0',
            verified: true
        }
    ];

    const getGradientClasses = (color: string) => {
        switch (color) {
            case 'blue':
                return 'from-blue-500 to-cyan-500';
            case 'purple':
                return 'from-purple-500 to-pink-500';
            case 'green':
                return 'from-emerald-500 to-teal-500';
            default:
                return 'from-blue-500 to-cyan-500';
        }
    };

    const copyToClipboard = async (text: string, programId: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedId(programId);
            setTimeout(() => setCopiedId(null), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    return (
        <div className="space-y-4">
            {programs.map((program, index) => (
                <motion.div
                    key={program.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.1 }}
                    whileHover={{ scale: 1.02 }}
                    className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-white/10 p-4 transition-all duration-300 hover:shadow-2xl hover:shadow-blue-500/20 cursor-pointer"
                >
                    {/* Animated gradient background on hover */}
                    <div className={`absolute inset-0 bg-gradient-to-r ${getGradientClasses(program.color)}/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                    
                    {/* Content */}
                    <div className="relative z-10">
                        <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center space-x-3">
                                <div className={`h-8 w-8 rounded-lg bg-gradient-to-r ${getGradientClasses(program.color)} flex items-center justify-center text-sm font-bold text-white shadow-lg shadow-${program.color}-500/25`}>
                                    {program.icon}
                                </div>
                                <div>
                                    <div className="flex items-center space-x-2">
                                        <h3 className="text-sm font-semibold text-white">{program.name}</h3>
                                        {program.verified && (
                                            <div className="flex items-center space-x-1">
                                                <Shield className="h-3 w-3 text-emerald-400" />
                                                <span className="text-xs text-emerald-400">Verified</span>
                                            </div>
                                        )}
                                    </div>
                                    <span className="text-xs text-slate-400 font-mono">{program.version}</span>
                                </div>
                            </div>
                            
                            {/* Action buttons */}
                            <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                <motion.button
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => copyToClipboard(program.id, program.id)}
                                    className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                                    title="Copy Program ID"
                                >
                                    {copiedId === program.id ? (
                                        <CheckCircle className="h-4 w-4 text-emerald-400" />
                                    ) : (
                                        <Copy className="h-4 w-4" />
                                    )}
                                </motion.button>
                                <motion.button
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => window.open(`https://explorer.solana.com/address/${program.id}?cluster=devnet`, '_blank')}
                                    className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                                    title="View on Solana Explorer"
                                >
                                    <ExternalLink className="h-4 w-4" />
                                </motion.button>
                            </div>
                        </div>
                        
                        <p className="text-xs text-slate-300 mb-3 leading-relaxed">{program.description}</p>
                        
                        {/* Program ID with click to copy */}
                        <motion.div 
                            whileHover={{ scale: 1.01 }}
                            onClick={() => copyToClipboard(program.id, program.id)}
                            className="bg-black/20 rounded-lg p-2 border border-white/5 hover:border-white/10 transition-colors cursor-pointer"
                        >
                            <div className="flex items-center justify-between">
                                <p className="text-xs text-slate-400 font-mono truncate pr-2">{program.id}</p>
                                <motion.div
                                    animate={copiedId === program.id ? { scale: [1, 1.2, 1] } : {}}
                                    transition={{ duration: 0.2 }}
                                >
                                    {copiedId === program.id ? (
                                        <CheckCircle className="h-3 w-3 text-emerald-400 flex-shrink-0" />
                                    ) : (
                                        <Copy className="h-3 w-3 text-slate-500 flex-shrink-0" />
                                    )}
                                </motion.div>
                            </div>
                        </motion.div>
                    </div>
                </motion.div>
            ))}
        </div>
    );
};