import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Shield, ShieldAlert, Lock, Unlock, History, Camera, UserX, Loader2, CheckCircle2, Settings, Save, BellRing, X, ChevronRight, Mail } from 'lucide-react';
import Keypad from './components/Keypad';
import { AppState, IntruderLog, SecurityStatus, AppSettings } from './types';
import { analyzeIntruderImage } from './services/geminiService';

// Local Storage Keys
const PIN_STORAGE_KEY = 'vault_guard_pin';
const LOGS_STORAGE_KEY = 'vault_guard_logs';
const SETTINGS_STORAGE_KEY = 'vault_guard_settings';

const DEFAULT_SETTINGS: AppSettings = {
  alertEmail: '',
  triggerThreshold: 1,
  enableCapture: true
};

const App: React.FC = () => {
  // --- State ---
  const [appState, setAppState] = useState<AppState>(AppState.SETUP);
  const [inputPin, setInputPin] = useState<string>('');
  const [storedPin, setStoredPin] = useState<string | null>(null);
  const [logs, setLogs] = useState<IntruderLog[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  
  const [securityStatus, setSecurityStatus] = useState<SecurityStatus>(SecurityStatus.IDLE);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  
  // Transient State
  const [sessionFailedAttempts, setSessionFailedAttempts] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  
  // --- Refs ---
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // --- Initialization ---
  useEffect(() => {
    const savedPin = localStorage.getItem(PIN_STORAGE_KEY);
    const savedLogs = localStorage.getItem(LOGS_STORAGE_KEY);
    const savedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);

    if (savedLogs) {
      try {
        setLogs(JSON.parse(savedLogs));
      } catch (e) {
        console.error("Failed to parse logs", e);
      }
    }

    if (savedSettings) {
      try {
        setSettings(JSON.parse(savedSettings));
      } catch (e) {
        console.error("Failed to parse settings", e);
      }
    }

    if (savedPin) {
      setStoredPin(savedPin);
      setAppState(AppState.LOCKED);
    } else {
      setAppState(AppState.SETUP);
    }
  }, []);

  // Save settings on change
  useEffect(() => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  // --- Camera Logic ---
  const startCamera = useCallback(async () => {
    try {
      if (streamRef.current) return; // Already running

      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, 
        audio: false 
      });
      
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
      }
    } catch (err) {
      console.error("Camera permission denied or error:", err);
      setCameraActive(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      setCameraActive(false);
    }
  }, []);

  // Start camera when entering LOCKED state
  useEffect(() => {
    if (appState === AppState.LOCKED) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera(); // Cleanup
  }, [appState, startCamera, stopCamera]);

  const captureIntruder = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !cameraActive) return null;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (context) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', 0.7);
    }
    return null;
  }, [cameraActive]);

  // --- Alerting System ---
  const sendSecurityAlert = (imageData: string, attemptCount: number) => {
    if (!settings.alertEmail) return;

    // Simulation of sending an email
    console.log(`[ALERT SYSTEM] Sending email to ${settings.alertEmail}`);
    console.log(`[ALERT SYSTEM] Subject: Intruder Alert! ${attemptCount} failed attempts detected.`);
    console.log(`[ALERT SYSTEM] Attachment: [Base64 Image Data]`);
    
    setAlertMessage(`Alert sent to ${settings.alertEmail}`);
    setTimeout(() => setAlertMessage(null), 3000);
  };

  // --- Keypad Logic ---
  const handleKeyPress = (key: string) => {
    if (inputPin.length < 4) {
      setInputPin(prev => prev + key);
    }
  };

  const handleDelete = () => {
    setInputPin(prev => prev.slice(0, -1));
  };

  // --- Security Core ---
  const handlePinSubmit = async () => {
    setSecurityStatus(SecurityStatus.CHECKING);
    
    // Artificial delay for realism
    await new Promise(resolve => setTimeout(resolve, 600));

    if (appState === AppState.SETUP) {
      if (inputPin.length === 4) {
        localStorage.setItem(PIN_STORAGE_KEY, inputPin);
        setStoredPin(inputPin);
        setAppState(AppState.LOCKED);
        setInputPin('');
        setSecurityStatus(SecurityStatus.IDLE);
        alert("Passcode set successfully! System is now armed.");
      } else {
        setSecurityStatus(SecurityStatus.IDLE);
      }
      return;
    }

    if (appState === AppState.LOCKED) {
      if (inputPin === storedPin) {
        // SUCCESS
        setSecurityStatus(SecurityStatus.GRANTED);
        setSessionFailedAttempts(0); // Reset attempts on success
        setTimeout(() => {
            setAppState(AppState.UNLOCKED);
            setInputPin('');
            setSecurityStatus(SecurityStatus.IDLE);
        }, 500);
      } else {
        // FAILED ATTEMPT
        setSecurityStatus(SecurityStatus.BREACH_DETECTED);
        const currentAttempts = sessionFailedAttempts + 1;
        setSessionFailedAttempts(currentAttempts);

        // Check Logic based on Settings
        if (settings.enableCapture && currentAttempts >= settings.triggerThreshold) {
            const imageData = captureIntruder();
            
            if (imageData) {
                const newLog: IntruderLog = {
                    id: Date.now().toString(),
                    timestamp: Date.now(),
                    imageData,
                    attemptNumber: currentAttempts,
                };
                
                const updatedLogs = [newLog, ...logs];
                setLogs(updatedLogs);
                localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(updatedLogs));
                
                // Trigger Alert
                sendSecurityAlert(imageData, currentAttempts);
            }
        }

        setTimeout(() => {
          setInputPin('');
          setSecurityStatus(SecurityStatus.IDLE);
        }, 1000);
      }
    }
  };

  // Auto-submit when 4 digits entered
  useEffect(() => {
    if (inputPin.length === 4) {
      handlePinSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputPin]);

  // --- Gemini Analysis ---
  const handleAnalyze = async (log: IntruderLog) => {
    setAnalyzingId(log.id);
    const analysis = await analyzeIntruderImage(log.imageData);
    
    const updatedLogs = logs.map(l => 
      l.id === log.id ? { ...l, aiAnalysis: analysis } : l
    );
    
    setLogs(updatedLogs);
    localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(updatedLogs));
    setAnalyzingId(null);
  };

  // --- Render Methods ---

  const renderDots = () => (
    <div className="flex justify-center gap-4 mb-8">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className={`w-4 h-4 rounded-full transition-all duration-300 ${
            i < inputPin.length 
              ? (securityStatus === SecurityStatus.BREACH_DETECTED ? 'bg-red-500 scale-125' : 
                 securityStatus === SecurityStatus.GRANTED ? 'bg-green-500 scale-125' : 'bg-white')
              : 'bg-white/20'
          }`}
        />
      ))}
    </div>
  );

  // --- SETUP VIEW ---
  if (appState === AppState.SETUP) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-center">
        <Shield className="w-20 h-20 text-blue-500 mb-6" />
        <h1 className="text-3xl font-bold mb-2">Setup VaultGuard</h1>
        <p className="text-slate-400 mb-8">Create a 4-digit passcode to secure your vault.</p>
        {renderDots()}
        <Keypad onKeyPress={handleKeyPress} onDelete={handleDelete} />
      </div>
    );
  }

  // --- LOCKED VIEW ---
  if (appState === AppState.LOCKED) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 relative overflow-hidden">
        {/* Hidden Video Element for Capture */}
        <video ref={videoRef} autoPlay playsInline muted className="hidden" />
        <canvas ref={canvasRef} className="hidden" />

        {/* Alert Toast */}
        {alertMessage && (
             <div className="absolute top-8 left-0 right-0 flex justify-center z-50 animate-fade-in-down">
                 <div className="bg-red-500/90 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-2 backdrop-blur-sm">
                     <BellRing size={18} className="animate-pulse" />
                     <span className="text-sm font-medium">{alertMessage}</span>
                 </div>
             </div>
        )}

        <div className="z-10 w-full max-w-md flex flex-col items-center">
           <div className={`mb-8 p-4 rounded-full bg-slate-800/50 backdrop-blur ring-1 ring-white/10 transition-all duration-500 ${securityStatus === SecurityStatus.BREACH_DETECTED ? 'animate-bounce bg-red-500/20 ring-red-500' : ''}`}>
            {securityStatus === SecurityStatus.BREACH_DETECTED ? (
                <UserX className="w-12 h-12 text-red-500" />
            ) : securityStatus === SecurityStatus.GRANTED ? (
                <Unlock className="w-12 h-12 text-green-500" />
            ) : (
                <Lock className="w-12 h-12 text-blue-400" />
            )}
           </div>

          <h2 className="text-xl font-medium mb-2">
            {securityStatus === SecurityStatus.BREACH_DETECTED ? "ACCESS DENIED" : "Enter Passcode"}
          </h2>
          <p className="text-sm text-slate-500 mb-8 h-5">
            {securityStatus === SecurityStatus.BREACH_DETECTED && `Attempt ${sessionFailedAttempts} failed.`}
            {securityStatus === SecurityStatus.CHECKING && "Verifying..."}
          </p>

          {renderDots()}
          <Keypad 
            onKeyPress={handleKeyPress} 
            onDelete={handleDelete} 
            disabled={securityStatus !== SecurityStatus.IDLE}
          />
          
          <div className="mt-12 flex flex-col items-center gap-2">
             <p className="text-xs text-slate-600 uppercase tracking-widest">Protected by Gemini AI</p>
             {settings.enableCapture && (
                 <div className="flex items-center gap-1 text-[10px] text-slate-700">
                    <Camera size={10} />
                    <span>Monitoring Active</span>
                 </div>
             )}
          </div>
        </div>
      </div>
    );
  }

  // --- UNLOCKED (VAULT) VIEW ---
  return (
    <div className="min-h-screen bg-slate-950 text-white relative">
      <header className="bg-slate-900/50 backdrop-blur-lg border-b border-white/10 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Shield className="text-blue-500" />
            <span className="font-bold text-lg">VaultGuard</span>
          </div>
          <div className="flex items-center gap-2">
             <button 
                onClick={() => setShowSettings(true)}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors text-slate-400 hover:text-white"
             >
                <Settings size={20} />
             </button>
             <button 
                onClick={() => setAppState(AppState.LOCKED)}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
             >
                <Lock size={20} />
             </button>
          </div>
        </div>
      </header>

      {/* SETTINGS MODAL */}
      {showSettings && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-white/10 w-full max-w-md rounded-2xl overflow-hidden shadow-2xl">
                  <div className="p-6 border-b border-white/10 flex justify-between items-center">
                      <h3 className="text-xl font-bold flex items-center gap-2">
                          <Settings size={20} className="text-blue-400" />
                          Security Settings
                      </h3>
                      <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-white">
                          <X size={24} />
                      </button>
                  </div>
                  <div className="p-6 space-y-6">
                      
                      {/* Threshold Setting */}
                      <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-300 flex justify-between">
                              <span>Attempts Before Capture</span>
                              <span className="text-blue-400 font-bold">{settings.triggerThreshold}</span>
                          </label>
                          <input 
                             type="range" 
                             min="1" 
                             max="5" 
                             step="1"
                             value={settings.triggerThreshold}
                             onChange={(e) => setSettings({...settings, triggerThreshold: parseInt(e.target.value)})}
                             className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                          />
                          <p className="text-xs text-slate-500">
                              Intruder photo will be taken after {settings.triggerThreshold} incorrect attempt{settings.triggerThreshold > 1 ? 's' : ''}.
                          </p>
                      </div>

                      {/* Alert Email */}
                      <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                              <Mail size={16} />
                              Alert Email Address
                          </label>
                          <input 
                              type="email" 
                              value={settings.alertEmail}
                              onChange={(e) => setSettings({...settings, alertEmail: e.target.value})}
                              placeholder="admin@example.com"
                              className="w-full bg-slate-800 border border-white/10 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                          />
                          <p className="text-xs text-slate-500">
                              Security alerts and photos will be sent to this email immediately upon breach.
                          </p>
                      </div>

                      {/* Toggle Capture */}
                      <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-xl border border-white/5">
                          <div className="space-y-1">
                              <div className="font-medium text-white">Enable Intruder Selfie</div>
                              <div className="text-xs text-slate-400">Use camera to identify intruders</div>
                          </div>
                          <button 
                              onClick={() => setSettings({...settings, enableCapture: !settings.enableCapture})}
                              className={`w-12 h-6 rounded-full relative transition-colors duration-300 ${settings.enableCapture ? 'bg-green-500' : 'bg-slate-600'}`}
                          >
                              <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform duration-300 ${settings.enableCapture ? 'left-7' : 'left-1'}`} />
                          </button>
                      </div>

                  </div>
                  <div className="p-4 bg-slate-900/80 border-t border-white/10">
                      <button 
                        onClick={() => setShowSettings(false)}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
                      >
                          <Save size={18} />
                          Save Configuration
                      </button>
                  </div>
              </div>
          </div>
      )}

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        
        {/* Stats Section */}
        <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-900 border border-white/10 p-4 rounded-xl">
                <div className="text-slate-400 text-sm mb-1">Total Attempts</div>
                <div className="text-2xl font-bold">{logs.length}</div>
            </div>
            <div className="bg-slate-900 border border-white/10 p-4 rounded-xl">
                <div className="text-slate-400 text-sm mb-1">Last Breach</div>
                <div className="text-xl font-medium">
                    {logs.length > 0 ? new Date(logs[0].timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'N/A'}
                </div>
            </div>
        </div>

        {/* Intruder Gallery */}
        <div>
          <div className="flex justify-between items-end mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <History className="text-orange-500" size={20} />
                Intruder Logs
              </h3>
              <span className="text-xs text-slate-500 bg-slate-900 px-2 py-1 rounded border border-white/5">
                  Encrypted Storage
              </span>
          </div>
          
          {logs.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-white/10 rounded-xl bg-slate-900/50">
              <CheckCircle2 className="w-12 h-12 mx-auto text-green-500/50 mb-2" />
              <p className="text-slate-400">No failed attempts recorded. Your vault is secure.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {logs.map((log) => (
                <div key={log.id} className="bg-slate-900 border border-white/10 rounded-xl overflow-hidden flex flex-col sm:flex-row">
                  <div className="sm:w-32 sm:h-32 w-full h-48 bg-black relative shrink-0">
                    <img 
                      src={log.imageData} 
                      alt="Intruder" 
                      className="w-full h-full object-cover opacity-80 hover:opacity-100 transition-opacity"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 text-xs font-mono">
                        {new Date(log.timestamp).toLocaleDateString()}
                    </div>
                  </div>
                  
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium text-red-400 flex items-center gap-2">
                            <ShieldAlert size={16} />
                            Unauthorized Access
                        </h4>
                        <span className="text-xs text-slate-500">{new Date(log.timestamp).toLocaleString()}</span>
                      </div>
                      
                      <div className="flex items-center gap-2 mb-2">
                         <span className="text-xs bg-slate-800 text-slate-300 px-2 py-1 rounded">
                            Attempt #{log.attemptNumber}
                         </span>
                         {settings.alertEmail && (
                             <span className="text-xs bg-blue-900/30 text-blue-400 px-2 py-1 rounded flex items-center gap-1">
                                 <BellRing size={10} /> Alert Sent
                             </span>
                         )}
                      </div>

                      {log.aiAnalysis ? (
                        <div className="bg-slate-800/50 rounded p-3 text-sm text-slate-300 mt-2 border-l-2 border-purple-500">
                            <p className="text-xs text-purple-400 font-bold mb-1 flex items-center gap-1">GEMINI ANALYSIS</p>
                            {log.aiAnalysis}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500 italic mt-2">
                            Pending detailed analysis...
                        </p>
                      )}
                    </div>

                    {!log.aiAnalysis && (
                        <button 
                            onClick={() => handleAnalyze(log)}
                            disabled={analyzingId === log.id}
                            className="mt-4 flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white text-sm py-2 px-4 rounded-lg transition-colors w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {analyzingId === log.id ? (
                                <><Loader2 className="animate-spin" size={16} /> Analyzing...</>
                            ) : (
                                <><Camera size={16} /> Analyze Suspect</>
                            )}
                        </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Dummy Vault Content */}
        <div>
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Secured Documents</h3>
                <ChevronRight className="text-slate-600" size={20} />
            </div>
            <div className="grid grid-cols-2 gap-4">
                 {[1, 2, 3, 4].map(i => (
                     <div key={i} className="aspect-[4/3] bg-slate-800 rounded-lg flex items-center justify-center border border-white/5 hover:border-blue-500/50 transition-colors cursor-pointer group">
                         <div className="text-center">
                             <div className="w-12 h-12 bg-slate-700 rounded-full mx-auto mb-2 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                                 <Lock className="w-5 h-5 text-slate-400 group-hover:text-blue-400" />
                             </div>
                             <span className="text-xs text-slate-500">Encrypted_File_00{i}.dat</span>
                         </div>
                     </div>
                 ))}
            </div>
        </div>

      </main>
    </div>
  );
};

export default App;