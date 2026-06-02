import React, { useState, useEffect } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { Eye, EyeOff, Save, ShieldAlert, KeyRound, Play, RefreshCw } from 'lucide-react';

export const Settings: React.FC = () => {
  const { status, triggerRefreshStatus } = useWebSocket();
  const [apiKey, setApiKey] = useState('');
  const [clientCode, setClientCode] = useState('');
  const [password, setPassword] = useState('');
  const [totpSecret, setTotpSecret] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showTotpSecret, setShowTotpSecret] = useState(false);
  const [hasTotpSecret, setHasTotpSecret] = useState(false);
  const [manualTotp, setManualTotp] = useState('');

  const [loadingSave, setLoadingSave] = useState(false);
  const [loadingTest, setLoadingTest] = useState(false);
  
  const [saveStatus, setSaveStatus] = useState<{ success?: boolean; message?: string } | null>(null);
  const [testResult, setTestResult] = useState<{ success?: boolean; message?: string } | null>(null);

  // Fetch current settings on load (masked)
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/settings');
        const data = await res.json();
        if (data) {
          setApiKey(data.apiKey || '');
          setClientCode(data.clientCode || '');
          setHasTotpSecret(data.hasTotpSecret || false);
        }
      } catch (err) {
        console.error('Failed to load settings', err);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingSave(true);
    setSaveStatus(null);

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, clientCode, password, totpSecret })
      });
      const data = await res.json();
      
      if (data.status) {
        setSaveStatus({ success: true, message: 'Settings saved and persisted to backend .env!' });
        triggerRefreshStatus();
        setHasTotpSecret(data.data?.hasTotpSecret || false);
        // Clear secret inputs since they are persisted securely
        setPassword('');
        setTotpSecret('');
      } else {
        setSaveStatus({ success: false, message: data.error || 'Failed to save settings' });
      }
    } catch (err: any) {
      setSaveStatus({ success: false, message: err.message || 'Connection error' });
    } finally {
      setLoadingSave(false);
    }
  };

  const handleLoginTest = async () => {
    setLoadingTest(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ totp: manualTotp })
      });
      const data = await res.json();

      if (data.status === true) {
        setTestResult({ success: true, message: 'Authentication handshake successful! WebSocket session connected.' });
        setManualTotp(''); // Clear after successful login
        triggerRefreshStatus();
      } else {
        setTestResult({ success: false, message: data.error || 'Authentication handshake rejected by SmartAPI.' });
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'Handshake failed.' });
    } finally {
      setLoadingTest(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="glass-panel p-6 rounded-2xl relative overflow-hidden">
        <div className="absolute right-0 bottom-0 translate-x-1/4 translate-y-1/4 w-96 h-96 bg-brandBlue/5 rounded-full blur-3xl -z-10" />
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-brandBlue/10 flex items-center justify-center text-brandBlue">
            <KeyRound size={24} />
          </div>
          <div>
            <h3 className="text-textBright font-semibold text-lg">SmartAPI Authentication Configuration</h3>
            <p className="text-xs text-textMuted mt-1">Configure credentials to establish session handshakes with Angel One OpenAPI. Credentials are securely isolated in backend environment variables.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Column */}
        <div className="lg:col-span-2 glass-panel p-6 rounded-2xl space-y-6">
          <h4 className="text-sm font-semibold text-textBright uppercase tracking-wider">Credential Fields</h4>
          
          <form onSubmit={handleSave} className="space-y-4">
            {/* API Key */}
            <div className="space-y-1.5">
              <label className="text-xs text-textMuted uppercase font-semibold">SmartAPI Key (API Key)</label>
              <input
                type="text"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter API Key from developer portal (e.g. AIza...)"
                className="w-full bg-darkBg border border-borderGray rounded-lg px-4 py-2.5 text-sm text-textBright focus:outline-none focus:border-brandBlue font-mono"
                required
              />
            </div>

            {/* Client Code */}
            <div className="space-y-1.5">
              <label className="text-xs text-textMuted uppercase font-semibold">Client Code (Client ID)</label>
              <input
                type="text"
                value={clientCode}
                onChange={(e) => setClientCode(e.target.value)}
                placeholder="Enter Angel One Client ID (e.g. S123456)"
                className="w-full bg-darkBg border border-borderGray rounded-lg px-4 py-2.5 text-sm text-textBright focus:outline-none focus:border-brandBlue font-mono"
                required
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-xs text-textMuted uppercase font-semibold">Trading MPIN / Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={status?.smartApiStatus === 'Connected' ? '•••••••• (Securely Saved)' : 'Enter 4-digit MPIN or Account Password'}
                  className="w-full bg-darkBg border border-borderGray rounded-lg pl-4 pr-12 py-2.5 text-sm text-textBright focus:outline-none focus:border-brandBlue font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-textMuted hover:text-textBright"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* TOTP Secret */}
            <div className="space-y-1.5">
              <label className="text-xs text-textMuted uppercase font-semibold">TOTP Secret (Base32) [Optional]</label>
              <div className="relative">
                <input
                  type={showTotpSecret ? 'text' : 'password'}
                  value={totpSecret}
                  onChange={(e) => setTotpSecret(e.target.value)}
                  placeholder={status?.smartApiStatus === 'Connected' ? '•••••••• (Securely Saved)' : 'Enter TOTP Token Secret (e.g. I63H...)'}
                  className="w-full bg-darkBg border border-borderGray rounded-lg pl-4 pr-12 py-2.5 text-sm text-textBright focus:outline-none focus:border-brandBlue font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowTotpSecret(!showTotpSecret)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-textMuted hover:text-textBright"
                >
                  {showTotpSecret ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Dynamic manual TOTP input if no TOTP secret is configured */}
            {!hasTotpSecret && (
              <div className="space-y-1.5 bg-brandOrange/5 border border-brandOrange/25 p-4 rounded-xl">
                <label className="text-[10px] text-brandOrange uppercase font-bold tracking-wider">Dynamic MFA TOTP Verification Code</label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="Enter current 6-digit code (e.g. 123456)"
                  value={manualTotp}
                  onChange={(e) => setManualTotp(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-darkBg border border-borderGray rounded-lg px-4 py-2 text-sm text-textBright focus:outline-none focus:border-brandBlue font-mono text-center tracking-widest text-base font-bold"
                />
                <p className="text-[10px] text-textMuted mt-1 leading-relaxed">Since <code className="bg-darkBg px-1 py-0.5 rounded text-brandOrange text-[9px]">SMART_TOTP_SECRET</code> is not saved in the environment, please enter the temporary code generated on your mobile authenticator app before clicking handshake.</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4 pt-4">
              <button
                type="submit"
                disabled={loadingSave}
                className="flex items-center gap-2 bg-brandBlue hover:bg-brandBlue/90 disabled:bg-brandBlue/50 text-white font-medium text-sm px-6 py-2.5 rounded-lg transition-trading shadow-lg shadow-brandBlue/20"
              >
                {loadingSave ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />}
                <span>Save Credentials</span>
              </button>

              <button
                type="button"
                onClick={handleLoginTest}
                disabled={loadingTest}
                className="flex items-center gap-2 border border-brandGreen hover:bg-brandGreen/10 disabled:bg-transparent text-brandGreen font-medium text-sm px-6 py-2.5 rounded-lg transition-trading"
              >
                {loadingTest ? <RefreshCw className="animate-spin" size={16} /> : <Play size={16} />}
                <span>Trigger Login Handshake</span>
              </button>
            </div>
          </form>

          {/* Toast Feeds */}
          {saveStatus && (
            <div className={`p-4 rounded-xl border text-sm ${saveStatus.success ? 'bg-brandGreen/5 border-brandGreen/20 text-brandGreen' : 'bg-brandRed/5 border-brandRed/20 text-brandRed'}`}>
              {saveStatus.message}
            </div>
          )}

          {testResult && (
            <div className={`p-4 rounded-xl border text-sm ${testResult.success ? 'bg-brandGreen/5 border-brandGreen/20 text-brandGreen' : 'bg-brandRed/5 border-brandRed/20 text-brandRed'}`}>
              {testResult.message}
            </div>
          )}
        </div>

        {/* Security Warning Column */}
        <div className="space-y-6">
          {/* Security Alert Card */}
          <div className="glass-panel p-6 rounded-2xl border-l-4 border-brandOrange flex flex-col gap-4">
            <div className="flex items-center gap-2 text-brandOrange">
              <ShieldAlert size={20} />
              <h4 className="font-semibold text-sm uppercase tracking-wide">Security Protocols</h4>
            </div>
            <div className="space-y-3 text-xs text-textMuted leading-relaxed">
              <p>
                <strong className="text-textBright">Strict Isolation:</strong> The settings form posts values directly to the Node.js backend. Secrets are written directly to the server's local <code className="bg-darkBg px-1 py-0.5 rounded font-mono text-[10px] text-brandOrange">.env</code> file.
              </p>
              <p>
                <strong className="text-textBright">Masked Payloads:</strong> Standard GET APIs that return status or configuration mask the API Key, Client ID, and hide secrets entirely so they are never leaked to browser networks or logs.
              </p>
              <p>
                <strong className="text-textBright">Automatic TOTP Sync:</strong> The backend uses the saved TOTP Secret to generate hot 6-digit MFA codes dynamically using standard RFC 6238 protocols at the time of session generation.
              </p>
            </div>
          </div>

          {/* Current Connection Summary Card */}
          <div className="glass-panel p-6 rounded-2xl space-y-4">
            <h4 className="text-sm font-semibold text-textBright uppercase tracking-wider">Active Credentials</h4>
            <div className="space-y-3 font-mono text-xs">
              <div className="flex justify-between py-1 border-b border-borderGray/50">
                <span className="text-textMuted">API Key:</span>
                <span className="text-textBright">{status?.smartApiStatus === 'Connected' ? 'VALID & PERSISTED' : 'NOT CONFIGURED'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-borderGray/50">
                <span className="text-textMuted">Client Code:</span>
                <span className="text-textBright">{status?.profile?.clientcode || 'NOT CONFIGURED'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-borderGray/50">
                <span className="text-textMuted">Token Status:</span>
                <span className={`font-semibold ${status?.smartApiStatus === 'Connected' ? 'text-brandGreen' : 'text-brandRed'}`}>
                  {status?.smartApiStatus === 'Connected' ? 'ACTIVE JWT' : 'EXPIRED / NONE'}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-textMuted">Feed Token:</span>
                <span className="text-textBright">{status?.smartApiStatus === 'Connected' ? 'ACTIVE STREAM TOKEN' : 'EXPIRED / NONE'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
