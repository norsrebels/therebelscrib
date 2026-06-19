export function HowlingWolfLoader({
  message,
}: {
  message?: string;
}) {
  void message; // Ignored visually, kept for compatibility
  return (
    <>
      <style>{`
        @keyframes hw-ball-x {
          0%, 100% { transform: translateX(0px); animation-timing-function: ease-in-out; }
          50% { transform: translateX(360px); animation-timing-function: ease-in-out; }
        }
        @keyframes hw-ball-y {
          0% { transform: translateY(0px); animation-timing-function: cubic-bezier(0.2, 0.8, 0.4, 1); }
          25% { transform: translateY(-190px); animation-timing-function: cubic-bezier(0.6, 0, 0.8, 0.2); }
          50% { transform: translateY(0px); animation-timing-function: cubic-bezier(0.2, 0.8, 0.4, 1); }
          75% { transform: translateY(-190px); animation-timing-function: cubic-bezier(0.6, 0, 0.8, 0.2); }
          100% { transform: translateY(0px); }
        }
        @keyframes hw-ball-squash {
          0% { transform: scaleX(1.45) scaleY(0.58); }
          5% { transform: scale(1); }
          45% { transform: scale(1); }
          50% { transform: scaleX(1.45) scaleY(0.58); }
          55% { transform: scale(1); }
          95% { transform: scale(1); }
          100% { transform: scaleX(1.45) scaleY(0.58); }
        }
        @keyframes hw-ball-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(720deg); }
        }
        @keyframes hw-shadow-scale {
          0%, 100% { transform: scaleX(1.5) scaleY(1); opacity: 0.8; }
          25% { transform: scaleX(0.4) scaleY(0.4); opacity: 0.15; }
          50% { transform: scaleX(1.5) scaleY(1); opacity: 0.8; }
          75% { transform: scaleX(0.4) scaleY(0.4); opacity: 0.15; }
        }
        @keyframes hw-net-sway {
          0% { transform: skewX(0deg); }
          3% { transform: skewX(6deg); }
          8% { transform: skewX(-3deg); }
          12% { transform: skewX(0deg); }
          
          50% { transform: skewX(0deg); }
          53% { transform: skewX(-6deg); }
          58% { transform: skewX(3deg); }
          62% { transform: skewX(0deg); }
          
          100% { transform: skewX(0deg); }
        }
        @keyframes hw-ring {
          0% { transform: scale(0.1); opacity: 1; border-width: 3px; }
          15% { transform: scale(1.8); opacity: 0; border-width: 1px; }
          100% { transform: scale(1.8); opacity: 0; }
        }
        @keyframes hw-burst {
          0% { transform: scale(0.3); opacity: 1; }
          12% { transform: scale(1.4); opacity: 0; }
          100% { transform: scale(1.4); opacity: 0; }
        }
      `}</style>
      <div className="fixed inset-0 z-[200] bg-[#09090f] overflow-hidden flex items-center justify-center pointer-events-none">
        <div className="relative w-[600px] h-[300px]">
          
          {/* Floor Line */}
          <div className="absolute bottom-[50px] left-[-100vw] right-[-100vw] h-[2px] bg-[#C0C0C0] opacity-80"></div>

          {/* Net */}
          <div 
            className="absolute bottom-[50px] left-[260px] w-[80px] h-[160px]" 
            style={{ transformOrigin: 'center bottom', animation: 'hw-net-sway 2.4s ease-in-out infinite' }}
          >
            {/* Posts */}
            <div className="absolute bottom-0 left-0 w-[4px] h-[160px] bg-[#C0C0C0]"></div>
            <div className="absolute bottom-0 right-0 w-[4px] h-[160px] bg-[#C0C0C0]"></div>
            
            {/* Tapes */}
            <div className="absolute top-[20px] left-0 right-0 h-[10px] bg-[#C0C0C0]"></div>
            <div className="absolute top-[130px] left-0 right-0 h-[4px] bg-[#C0C0C0]"></div>
            
            {/* Mesh Grid */}
            <div 
              className="absolute top-[30px] left-[4px] right-[4px] h-[100px] bg-transparent opacity-60" 
              style={{ 
                backgroundImage: 'linear-gradient(to right, #C0C0C0 1px, transparent 1px), linear-gradient(to bottom, #C0C0C0 1px, transparent 1px)', 
                backgroundSize: '8px 8px' 
              }}
            ></div>
            
            {/* Antennas */}
            <div 
              className="absolute bottom-[140px] left-[10px] w-[3px] h-[50px]"
              style={{ backgroundImage: 'repeating-linear-gradient(to top, #C0C0C0, #C0C0C0 6px, #09090f 6px, #09090f 12px)' }}
            ></div>
            <div 
              className="absolute bottom-[140px] right-[10px] w-[3px] h-[50px]"
              style={{ backgroundImage: 'repeating-linear-gradient(to top, #C0C0C0, #C0C0C0 6px, #09090f 6px, #09090f 12px)' }}
            ></div>
          </div>

          {/* Left Shockwaves */}
          <div className="absolute bottom-[50px] left-[120px] w-0 h-0 flex items-center justify-center">
            <div className="absolute w-[60px] h-[15px] rounded-[50%] border-[#C0C0C0] border-solid" style={{ animation: 'hw-ring 2.4s ease-out infinite' }}></div>
            <div className="absolute w-[60px] h-[15px] rounded-[50%] border-[#C0C0C0] border-solid" style={{ animation: 'hw-ring 2.4s ease-out infinite 0.15s' }}></div>
            <div className="absolute w-[80px] h-[80px] flex items-center justify-center" style={{ animation: 'hw-burst 2.4s ease-out infinite' }}>
              <div className="absolute w-[2px] h-[30px]" style={{ transform: 'rotate(45deg) translateY(-25px)', backgroundImage: 'repeating-linear-gradient(to bottom, #C0C0C0, #C0C0C0 4px, transparent 4px, transparent 8px)' }}></div>
              <div className="absolute w-[2px] h-[30px]" style={{ transform: 'rotate(135deg) translateY(-25px)', backgroundImage: 'repeating-linear-gradient(to bottom, #C0C0C0, #C0C0C0 4px, transparent 4px, transparent 8px)' }}></div>
              <div className="absolute w-[2px] h-[30px]" style={{ transform: 'rotate(225deg) translateY(-25px)', backgroundImage: 'repeating-linear-gradient(to bottom, #C0C0C0, #C0C0C0 4px, transparent 4px, transparent 8px)' }}></div>
              <div className="absolute w-[2px] h-[30px]" style={{ transform: 'rotate(315deg) translateY(-25px)', backgroundImage: 'repeating-linear-gradient(to bottom, #C0C0C0, #C0C0C0 4px, transparent 4px, transparent 8px)' }}></div>
            </div>
          </div>

          {/* Right Shockwaves */}
          <div className="absolute bottom-[50px] left-[480px] w-0 h-0 flex items-center justify-center">
            <div className="absolute w-[60px] h-[15px] rounded-[50%] border-[#C0C0C0] border-solid" style={{ animation: 'hw-ring 2.4s ease-out infinite 1.2s' }}></div>
            <div className="absolute w-[60px] h-[15px] rounded-[50%] border-[#C0C0C0] border-solid" style={{ animation: 'hw-ring 2.4s ease-out infinite 1.35s' }}></div>
            <div className="absolute w-[80px] h-[80px] flex items-center justify-center" style={{ animation: 'hw-burst 2.4s ease-out infinite 1.2s' }}>
              <div className="absolute w-[2px] h-[30px]" style={{ transform: 'rotate(45deg) translateY(-25px)', backgroundImage: 'repeating-linear-gradient(to bottom, #C0C0C0, #C0C0C0 4px, transparent 4px, transparent 8px)' }}></div>
              <div className="absolute w-[2px] h-[30px]" style={{ transform: 'rotate(135deg) translateY(-25px)', backgroundImage: 'repeating-linear-gradient(to bottom, #C0C0C0, #C0C0C0 4px, transparent 4px, transparent 8px)' }}></div>
              <div className="absolute w-[2px] h-[30px]" style={{ transform: 'rotate(225deg) translateY(-25px)', backgroundImage: 'repeating-linear-gradient(to bottom, #C0C0C0, #C0C0C0 4px, transparent 4px, transparent 8px)' }}></div>
              <div className="absolute w-[2px] h-[30px]" style={{ transform: 'rotate(315deg) translateY(-25px)', backgroundImage: 'repeating-linear-gradient(to bottom, #C0C0C0, #C0C0C0 4px, transparent 4px, transparent 8px)' }}></div>
            </div>
          </div>

          {/* Ball and Shadow Group */}
          <div className="absolute bottom-[50px] left-[100px] w-[40px] h-[40px]" style={{ animation: 'hw-ball-x 2.4s ease-in-out infinite' }}>
            
            {/* Shadow */}
            <div 
              className="absolute bottom-[-6px] left-[-15px] right-[-15px] h-[12px] rounded-[50%] opacity-80"
              style={{ 
                background: 'radial-gradient(ellipse at center, #C0C0C0 0%, transparent 70%)', 
                animation: 'hw-shadow-scale 2.4s ease-in-out infinite' 
              }}
            ></div>
            
            {/* Ball Vertical Movement */}
            <div className="absolute bottom-0 left-0 w-[40px] h-[40px]" style={{ animation: 'hw-ball-y 2.4s infinite' }}>
              
              {/* Ball Squash on Impact */}
              <div className="w-full h-full" style={{ transformOrigin: 'center bottom', animation: 'hw-ball-squash 2.4s infinite' }}>
                
                {/* Ball Spin & Visuals */}
                <div className="w-full h-full rounded-full border-[2px] border-[#C0C0C0] bg-[#1c1c28] relative overflow-hidden flex items-center justify-center" style={{ animation: 'hw-ball-spin 2.4s linear infinite' }}>
                  <svg viewBox="0 0 40 40" className="absolute inset-0 w-full h-full opacity-90">
                    <path d="M 20 -5 C 5 15, 5 25, 20 45" fill="none" stroke="#C0C0C0" strokeWidth="1.5" />
                    <path d="M 20 -5 C 35 15, 35 25, 20 45" fill="none" stroke="#C0C0C0" strokeWidth="1.5" />
                    <path d="M -5 20 C 15 5, 25 5, 45 20" fill="none" stroke="#C0C0C0" strokeWidth="1.5" />
                    <path d="M -5 20 C 15 35, 25 35, 45 20" fill="none" stroke="#C0C0C0" strokeWidth="1.5" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
