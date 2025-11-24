import React, { useState, useCallback } from 'react';
import GameCanvas from './components/GameCanvas';

import { GameState, CarStats } from './types';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [carStats, setCarStats] = useState<CarStats>({ speed: 0, maxSpeed: 280, gear: 1, damage: 0, nitro: 100 });
  const [lastEvent, setLastEvent] = useState<'start' | 'crash' | 'speeding' | 'idle' | 'nitro' | null>(null);

  const handleStatsUpdate = useCallback((newStats: CarStats) => {
    // Detect Nitro usage for event trigger
    setCarStats(prev => {
        if (prev.nitro > newStats.nitro && newStats.nitro > 0 && prev.speed > 50) {
            // Only trigger nitro event occasionally to avoid spam
            if (Math.random() > 0.95) setLastEvent('nitro');
        }
        return newStats;
    });
  }, []);

  const handleCrash = useCallback(() => {
    setLastEvent('crash');
    setTimeout(() => setLastEvent(null), 1000);
  }, []);

  const startGame = () => {
    setGameState(GameState.RACING);
    setLastEvent('start');
  };

  return (
    <div className="relative w-full h-full overflow-hidden select-none text-white font-['Orbitron']">
      <GameCanvas 
        gameState={gameState} 
        onStatsUpdate={handleStatsUpdate}
        onCrash={handleCrash}
      />

     
      {/* Main Menu */}
      {gameState === GameState.MENU && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-50 backdrop-blur-md">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-30"></div>
          
          <h1 className="text-6xl md:text-9xl font-black text-transparent bg-clip-text bg-gradient-to-br from-cyan-400 via-blue-500 to-purple-600 mb-4 italic tracking-tighter skew-x-[-10deg] drop-shadow-[0_0_20px_rgba(34,211,238,0.5)]">
            NEON VELOCITY
          </h1>
          <p className="text-cyan-200 mb-16 text-2xl font-bold tracking-[1em] uppercase">Underground</p>
          
          <button 
            onClick={startGame}
            className="group relative px-16 py-6 bg-transparent overflow-hidden skew-x-[-20deg] border-2 border-cyan-500 hover:border-white transition-all duration-300 shadow-[0_0_30px_rgba(6,182,212,0.3)] hover:shadow-[0_0_50px_rgba(6,182,212,0.6)]"
          >
            <div className="absolute inset-0 w-full h-full bg-cyan-600/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
            <span className="relative text-cyan-400 group-hover:text-white font-black text-3xl uppercase tracking-wider skew-x-[20deg] inline-block">
              Gareggia
            </span>
          </button>
          
          <div className="mt-12 flex gap-8 text-slate-400 text-sm font-mono border-t border-gray-800 pt-8">
            <div className="text-center"><span className="text-cyan-500 font-bold block text-lg">WASD</span>GUIDA</div>
            <div className="text-center"><span className="text-purple-500 font-bold block text-lg">SHIFT</span>NITRO</div>
          </div>
        </div>
      )}

      {/* RACING HUD */}
      {gameState === GameState.RACING && (
        <div className="absolute inset-0 pointer-events-none">
           
           {/* Nitro Bar - Left Side */}
           <div className="absolute bottom-10 left-10 flex flex-col items-start gap-2">
              <span className="text-purple-400 font-black italic text-xl tracking-widest drop-shadow-[0_0_5px_rgba(168,85,247,0.8)]">NOS</span>
              <div className="w-64 h-6 bg-gray-900 border border-gray-700 skew-x-[-20deg] relative overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-purple-900 via-purple-600 to-fuchsia-400 transition-all duration-100 ease-out"
                    style={{ width: `${carStats.nitro}%` }}
                  ></div>
                  {/* Stripes overlay */}
                  <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,transparent_90%,rgba(0,0,0,0.5)_90%,rgba(0,0,0,0.5)_100%)] bg-[length:20px_100%]"></div>
              </div>
           </div>

           {/* Speedometer - Right Side */}
           <div className="absolute bottom-10 right-10 flex items-end">
               <div className="relative">
                    <span className="text-8xl font-black italic tracking-tighter text-white drop-shadow-[0_0_15px_rgba(6,182,212,0.6)]">
                        {Math.floor(carStats.speed)}
                    </span>
                    <span className="text-xl text-cyan-400 font-bold ml-2">KM/H</span>
                    
                    <div className="flex gap-1 mt-2 justify-end">
                        {[1,2,3,4,5,6].map(g => (
                            <div key={g} className={`h-2 w-8 skew-x-[-20deg] ${g <= carStats.gear ? 'bg-cyan-500 shadow-[0_0_10px_cyan]' : 'bg-gray-800'}`}></div>
                        ))}
                    </div>
               </div>
           </div>

           {/* Vignette & Grain Overlay */}
           <div className="absolute inset-0 bg-[radial-gradient(circle,transparent_50%,rgba(0,0,0,0.6)_100%)] z-10"></div>
        </div>
      )}
    </div>
  );
};

export default App;
