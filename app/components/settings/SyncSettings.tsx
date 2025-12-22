'use client';

import { useState, useCallback } from 'react';
import { useSync } from '@/lib/sync';
import styles from './SyncSettings.module.css';

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
          <span className={styles.headerEmoji}>🔄</span>
        </div>
        <div className={styles.headerText}>
          <h2 className={styles.title}>Cross-Device Sync</h2>
          <p className={styles.subtitle}>Keep your watchlist and progress in sync everywhere</p>
        </div>
      </div>

      {/* Status Bar */}
      <div className={`${styles.statusBar} ${status.isLinked ? styles.connected : ''}`}>
        <div className={styles.statusIndicator}>
          <span className={styles.statusEmoji}>{status.isLinked ? '🟢' : '⚪'}</span>
          <span className={styles.statusLabel}>{status.isLinked ? 'Connected' : 'Not connected'}</span>
        </div>
        {status.isLinked && (
          <span className={styles.lastSync}>Synced {formatLastSync(status.lastSyncedAt)}</span>
        )}
      </div>

      {/* Alerts */}
      {(error || importError) && (
        <div className={styles.alert} data-type="error">
          <span>⚠️</span>
          <span>{error || importError}</span>
        </div>
      )}

      {syncSuccess && (
        <div className={styles.alert} data-type="success">
          <span>✅</span>
          <span>Synced successfully!</span>
        </div>
      )}

      {status.isLinked ? (
        /* Connected State */
        <div className={styles.connectedView}>
          {/* Credentials Card */}
          <div className={styles.credentialsCard}>
            <div className={styles.credentialHeader}>
              <span className={styles.credentialLabel}>🔑 Your Sync Credentials</span>
              <button
                className={styles.visibilityToggle}
                onClick={() => setShowCredentials(!showCredentials)}
                aria-label={showCredentials ? 'Hide credentials' : 'Show credentials'}
              >
                {showCredentials ? '🙈' : '👁️'}
              </button>
            </div>

            <div className={styles.credentialRow}>
              <div className={styles.credentialField}>
                <span className={styles.fieldLabel}>📋 Sync Code</span>
                <div className={styles.fieldValue}>
                  <code>{showCredentials ? displayCode : '••••-••••-••••'}</code>
                  <button
                    className={styles.copyButton}
                    onClick={() => displayCode && handleCopy('code', displayCode)}
                    disabled={!displayCode}
                  >
                    {copied === 'code' ? '✅' : '📋'}
                  </button>
                </div>
              </div>

              <div className={styles.credentialField}>
                <span className={styles.fieldLabel}>🔐 Passphrase</span>
                <div className={styles.fieldValue}>
                  <code>{showCredentials ? displayPassphrase : '••••••••••••'}</code>
                  <button
                    className={styles.copyButton}
                    onClick={() => displayPassphrase && handleCopy('passphrase', displayPassphrase)}
                    disabled={!displayPassphrase}
                  >
                    {copied === 'passphrase' ? '✅' : '📋'}
                  </button>
                </div>
              </div>
            </div>

            <p className={styles.credentialHint}>
              💡 Save these credentials to sync on another device
            </p>
          </div>

          {/* Actions */}
          <div className={styles.actions}>
            <button className={styles.syncButton} onClick={handleSync} disabled={isSyncing}>
              {isSyncing ? '⏳ Syncing...' : '🔄 Sync Now'}
            </button>
            <button className={styles.disconnectButton} onClick={handleDisconnect}>
              🔌 Disconnect
            </button>
          </div>
        </div>
      ) : (
        /* Setup State */
        <div className={styles.setupView}>
          {/* New Account */}
          <div className={styles.setupCard}>
            <div className={styles.setupIcon} data-variant="new">
              <span>✨</span>
            </div>
            <h3 className={styles.setupTitle}>Start Fresh</h3>
            <p className={styles.setupDesc}>Create a new sync account to start syncing your data</p>
            <button className={styles.primaryButton} onClick={handleGenerateAccount}>
              ➕ Create Sync Account
            </button>
          </div>

          <div className={styles.divider}>
            <span>or</span>
          </div>

          {/* Import Account */}
          <div className={styles.setupCard}>
            <div className={styles.setupIcon} data-variant="import">
              <span>📥</span>
            </div>
            <h3 className={styles.setupTitle}>Restore Account</h3>
            <p className={styles.setupDesc}>Enter your existing credentials to restore your data</p>
            
            <div className={styles.importForm}>
              <input
                type="text"
                className={styles.input}
                placeholder="Sync Code (FLYX-XXXX-XXXX)"
                value={importCode}
                onChange={(e) => setImportCode(e.target.value.toUpperCase())}
              />
              <input
                type="text"
                className={styles.input}
                placeholder="Passphrase"
                value={importPassphrase}
                onChange={(e) => setImportPassphrase(e.target.value.toLowerCase())}
              />
              <button
                className={styles.secondaryButton}
                onClick={handleImportAccount}
                disabled={isSyncing || !importCode || !importPassphrase}
              >
                {isSyncing ? '⏳ Importing...' : '📥 Import Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info Footer */}
      <div className={styles.infoFooter}>
        <div className={styles.infoGrid}>
          <div className={styles.infoItem}>
            <span>🔒</span>
            <span>End-to-end encrypted</span>
          </div>
          <div className={styles.infoItem}>
            <span>👤</span>
            <span>No account required</span>
          </div>
          <div className={styles.infoItem}>
            <span>📱</span>
            <span>Sync across all devices</span>
          </div>
        </div>
      </div>
    </div>
  );
}
