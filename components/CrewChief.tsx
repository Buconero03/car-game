import React, { useEffect, useState, useRef } from 'react';
import { CarStats, GameState } from '../types';
import { getCrewChiefCommentary } from '../services/geminiService';

interface CrewChiefProps {
  gameState: GameState;
  carStats: CarStats;
  lastEvent: 'start' | 'crash' | 'speeding' | 'idle' | 'nitro' | null;
}

const CrewChief: React.FC<CrewChiefProps> = ({ gameState, carStats, lastEvent }) => {
  const [message, setMessage] = useState<string>("Sistemi NOS online. In attesa...");
  const [isTalking, setIsTalking] = useState(false);
  const lastCallTime = useRef<number>(0);

  useEffect(() => {
    if (gameState !== GameState.RACING) return;

    const shouldComment = async () => {
        const now = Date.now();
        const cooldown = lastEvent === 'crash' || lastEvent === 'nitro' ? 4000 : 12000;
        
        if (now - lastCallTime.current < cooldown) return;

        let eventType: 'start' | 'crash' | 'speeding' | 'idle' | 'nitro' = 'idle';
        
        if (lastEvent) {
             eventType = lastEvent;
        } else if (carStats.speed > 200) {
             eventType = 'speeding';
        } else if (carStats.speed < 10 && now - lastCallTime.current > 20000) {
             eventType = 'idle';
        } else {
            return;
        }

        lastCallTime.current = now;
        setIsTalking(true);
        
        const text = await getCrewChiefCommentary(carStats, eventType);
        setMessage(text);
        
        setTimeout(() => setIsTalking(false), 5000);
    };

    shouldComment();

  }, [carStats.speed, lastEvent, gameState]);

  if (gameState === GameState.MENU) return null;

  return (
    <div className={`fixed top-4 right-4 max-w-xs transition-all duration-300 z-50 ${isTalking ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-10'}`}>
        <div className="bg-black/90 border-r-4 border-cyan-500 p-4 rounded-l-lg shadow-[0_0_30px_rgba(6,182,212,0.4)] transform skew-x-[-5deg]">
            <div className="flex items-center gap-3 mb-2 border-b border-gray-700 pb-2">
                <div className="relative">
                     <div className="w-3 h-3 rounded-full bg-cyan-500 animate-ping absolute top-0 left-0 opacity-75"></div>
                     <div className="w-3 h-3 rounded-full bg-cyan-500 relative"></div>
                </div>
                <h3 className="text-cyan-400 font-bold text-xs uppercase tracking-widest">CREW_CHIEF_AI</h3>
            </div>
            <p className="text-white font-mono text-sm italic leading-relaxed text-right">
                "{message}"
            </p>
        </div>
    </div>
  );
};

export default CrewChief;