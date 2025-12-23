'use client';

import { useState, useCallback } from 'react';
import { useSync } from '@/lib/sync';
import styles from './SyncSettings.module.css';

// SVG Icon Components
const SyncIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
  </svg>
);

const AlertIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 8v4m0 4h.01" />
  </svg>
);

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
    <path d="M22 4L12 14.01l-3-3" />
  </svg>
);

const EyeIcon = () => <span style={{ fontSize: '16px' }}>👁️</span>;

const EyeOffIcon = () => <span style={{ fontSize: '16px' }}>🙈</span>;

const CopyIcon = () => <span style={{ fontSize: '16px' }}>📋</span>;

const CopiedIcon = () => <span style={{ fontSize: '16px', color: '#22c55e' }}>✅</span>;

const RefreshIcon = () => <span style={{ fontSize: '18px' }}>🔄</span>;

const PlusIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14m-7-7h14" />
  </svg>
);

const DownloadIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4m4-5l5 5 5-5m-5 5V3" />
  </svg>
);

const ShieldIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const UsersIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 00-3-3.87m-4-12a4 4 0 010 7.75" />
  </svg>
);

const DevicesIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <path d="M8 21h8m-4-4v4" />
  </svg>
);

export default function SyncSettings() {
  const {
    status,
    generateAccount,
    importAccount,
    disconnect,
    sync,
    isSyncing,
    error,
  } = useSync({ syncOnMount: true });

  const [importCode, setImportCode] = useState('');
  const [importPassphrase, setImportPassphrase] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [showCredentials, setShowCredentials] = useState(false);
  const [copied, setCopied] = useState<'code' | 'passphrase' | null>(null);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [newCredentials, setNewCredentials] = useState<{ code: string; passphrase: string } | null>(null);

  const handleGenerateAccount = useCallback(() => {
    const { code, passphrase } = generateAccount();
    setNewCredentials({ code, passphrase });
    setShowCredentials(true);
    sync();
  }, [generateAccount, sync]);

  const handleImportAccount = useCallback(async () => {
    if (!importCode.trim()) {
      setImportError('Please enter your sync code');
      return;
    }
    if (!importPassphrase.trim()) {
      setImportError('Please enter your passphrase');
      return;
    }

    setImportError(null);
    const result = await importAccount(importCode.trim(), importPassphrase.trim());

    if (result.success) {
      setImportCode('');
      setImportPassphrase('');
      setSyncSuccess(true);
      setTimeout(() => setSyncSuccess(false), 3000);
    } else {
      setImportError(result.error || 'Failed to import account');
    }
  }, [importCode, importPassphrase, importAccount]);

  const handleSync = useCallback(async () => {
    const result = await sync();
    if (result.success) {
      setSyncSuccess(true);
      setTimeout(() => setSyncSuccess(false), 3000);
    }
  }, [sync]);

  const handleCopy = useCallback((type: 'code' | 'passphrase', value: string) => {
    navigator.clipboard.writeText(value);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  }, []);

  // Auto-format sync code: FLYX-XXXXXX-XXXXXX
  const handleCodeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.toUpperCase();
    
    // Replace spaces with dashes
    value = value.replace(/\s+/g, '-');
    
    // Remove any characters that aren't alphanumeric or dashes
    value = value.replace(/[^A-Z0-9-]/g, '');
    
    // Auto-insert dashes at correct positions (after FLYX, after 6 chars, after 6 more)
    // Format: FLYX-XXXXXX-XXXXXX
    const parts = value.replace(/-/g, '').split('');
    let formatted = '';
    
    for (let i = 0; i < parts.length && i < 16; i++) {
      if (i === 4 || i === 10) {
        formatted += '-';
      }
      formatted += parts[i];
    }
    
    setImportCode(formatted);
  }, []);

  // Auto-format passphrase: word-word-word-word
  const handlePassphraseChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.toLowerCase();
    
    // Replace spaces with dashes
    value = value.replace(/\s+/g, '-');
    
    // Remove any characters that aren't letters or dashes
    value = value.replace(/[^a-z-]/g, '');
    
    // Clean up multiple consecutive dashes
    value = value.replace(/-+/g, '-');
    
    setImportPassphrase(value);
  }, []);

  const handleDisconnect = useCallback(() => {
    if (confirm('Disconnect sync? Your local data will be kept but won\'t sync to other devices.')) {
      disconnect();
      setNewCredentials(null);
    }
  }, [disconnect]);

  const formatLastSync = (timestamp: number | null) => {
    if (!timestamp) return 'Never';
    const diff = Date.now() - timestamp;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  const displayCode = newCredentials?.code || status.syncCode;
  const displayPassphrase = newCredentials?.passphrase || status.passphrase;

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.iconWrapper}>
          <SyncIcon />
        </div>
        <div className={styles.headerText}>
          <h2 className={styles.title}>Cross-Device Sync</h2>
          <p className={styles.subtitle}>Keep your watchlist and progress in sync everywhere</p>
        </div>
      </div>

      {/* Status Bar */}
      <div className={`${styles.statusBar} ${status.isLinked ? styles.connected : ''}`}>
        <div className={styles.statusIndicator}>
          <span className={styles.statusDot} />
          <span className={styles.statusLabel}>{status.isLinked ? 'Connected' : 'Not connected'}</span>
        </div>
        {status.isLinked && (
          <span className={styles.lastSync}>Synced {formatLastSync(status.lastSyncedAt)}</span>
        )}
      </div>

      {/* Alerts */}
      {(error || importError) && (
        <div className={styles.alert} data-type="error">
          <AlertIcon />
          <span>{error || importError}</span>
        </div>
      )}

      {syncSuccess && (
        <div className={styles.alert} data-type="success">
          <CheckIcon />
          <span>Synced successfully!</span>
        </div>
      )}

      {status.isLinked ? (
        /* Connected State */
        <div className={styles.connectedView}>
          {/* Credentials Card */}
          <div className={styles.credentialsCard}>
            <div className={styles.credentialHeader}>
              <span className={styles.credentialLabel}>Your Sync Credentials</span>
              <button
                className={styles.visibilityToggle}
                onClick={() => setShowCredentials(!showCredentials)}
                aria-label={showCredentials ? 'Hide credentials' : 'Show credentials'}
              >
                {showCredentials ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>

            <div className={styles.credentialRow}>
              <div className={styles.credentialField}>
                <span className={styles.fieldLabel}>Sync Code</span>
                <div className={styles.fieldValue}>
                  <code>{showCredentials ? displayCode : '••••-••••••-••••••'}</code>
                  <button
                    className={styles.copyButton}
                    onClick={() => displayCode && handleCopy('code', displayCode)}
                    disabled={!displayCode}
                  >
                    {copied === 'code' ? <CopiedIcon /> : <CopyIcon />}
                  </button>
                </div>
              </div>

              <div className={styles.credentialField}>
                <span className={styles.fieldLabel}>Passphrase</span>
                <div className={styles.fieldValue}>
                  <code>{showCredentials ? displayPassphrase : '••••••••••••'}</code>
                  <button
                    className={styles.copyButton}
                    onClick={() => displayPassphrase && handleCopy('passphrase', displayPassphrase)}
                    disabled={!displayPassphrase}
                  >
                    {copied === 'passphrase' ? <CopiedIcon /> : <CopyIcon />}
                  </button>
                </div>
              </div>
            </div>

            <p className={styles.credentialHint}>
              Save these credentials to sync on another device
            </p>
          </div>

          {/* Actions */}
          <div className={styles.actions}>
            <button className={styles.syncButton} onClick={handleSync} disabled={isSyncing}>
              {isSyncing ? (
                <>
                  <span className={styles.spinner}><RefreshIcon /></span>
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshIcon />
                  Sync Now
                </>
              )}
            </button>
            <button className={styles.disconnectButton} onClick={handleDisconnect}>
              Disconnect
            </button>
          </div>
        </div>
      ) : (
        /* Setup State */
        <div className={styles.setupView}>
          {/* New Account */}
          <div className={styles.setupCard}>
            <div className={styles.setupIcon} data-variant="new">
              <PlusIcon />
            </div>
            <h3 className={styles.setupTitle}>Start Fresh</h3>
            <p className={styles.setupDesc}>Create a new sync account to start syncing your data</p>
            <button className={styles.primaryButton} onClick={handleGenerateAccount}>
              Create Sync Account
            </button>
          </div>

          <div className={styles.divider}>
            <span>or</span>
          </div>

          {/* Import Account */}
          <div className={styles.setupCard}>
            <div className={styles.setupIcon} data-variant="import">
              <DownloadIcon />
            </div>
            <h3 className={styles.setupTitle}>Restore Account</h3>
            <p className={styles.setupDesc}>Enter your existing credentials to restore your data</p>
            
            <div className={styles.importForm}>
              <input
                type="text"
                className={styles.input}
                placeholder="Sync Code (FLYX-XXXXXX-XXXXXX)"
                value={importCode}
                onChange={handleCodeChange}
              />
              <input
                type="text"
                className={styles.input}
                placeholder="Passphrase (word-word-word-word)"
                value={importPassphrase}
                onChange={handlePassphraseChange}
              />
              <button
                className={styles.secondaryButton}
                onClick={handleImportAccount}
                disabled={isSyncing || !importCode || !importPassphrase}
              >
                {isSyncing ? 'Importing...' : 'Import Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info Footer */}
      <div className={styles.infoFooter}>
        <div className={styles.infoGrid}>
          <div className={styles.infoItem}>
            <ShieldIcon />
            <span>End-to-end encrypted</span>
          </div>
          <div className={styles.infoItem}>
            <UsersIcon />
            <span>No account required</span>
          </div>
          <div className={styles.infoItem}>
            <DevicesIcon />
            <span>Sync across all devices</span>
          </div>
        </div>
      </div>
    </div>
  );
}
