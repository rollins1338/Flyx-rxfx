'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './FeedbackModal.module.css';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type FeedbackType = 'bug' | 'feature' | 'general' | 'content';

const feedbackTypes: { value: FeedbackType; label: string; icon: string }[] = [
  { value: 'bug', label: 'Bug Report', icon: '🐛' },
  { value: 'feature', label: 'Feature Request', icon: '✨' },
  { value: 'content', label: 'Content Issue', icon: '🎬' },
  { value: 'general', label: 'General Feedback', icon: '💬' },
];

export default function FeedbackModal({ isOpen, onClose }: FeedbackModalProps) {
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('general');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus textarea when modal opens
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!message.trim()) {
      setError('Please enter your feedback message');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: feedbackType,
          message: message.trim(),
          email: email.trim() || undefined,
          url: window.location.href,
          userAgent: navigator.userAgent,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit feedback');
      }

      setSubmitted(true);
      setTimeout(() => {
        onClose();
        // Reset form after closing
        setTimeout(() => {
          setSubmitted(false);
          setMessage('');
          setEmail('');
          setFeedbackType('general');
        }, 300);
      }, 2000);
    } catch {
      setError('Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className={styles.backdrop}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleBackdropClick}
        >
          <motion.div
            ref={modalRef}
            className={styles.modal}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedback-title"
          >
            {/* Close Button */}
            <button
              className={styles.closeButton}
              onClick={onClose}
              aria-label="Close feedback modal"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {submitted ? (
              <motion.div
                className={styles.successState}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <div className={styles.successIcon}>✓</div>
                <h2>Thank You!</h2>
                <p>Your feedback has been submitted successfully.</p>
              </motion.div>
            ) : (
              <>
                <div className={styles.header}>
                  <h2 id="feedback-title">Submit Feedback</h2>
                  <p>Help us improve FlyX by sharing your thoughts</p>
                </div>

                <form onSubmit={handleSubmit} className={styles.form}>
                  {/* Feedback Type Selection */}
                  <div className={styles.typeSelector}>
                    {feedbackTypes.map((type) => (
                      <button
                        key={type.value}
                        type="button"
                        className={`${styles.typeButton} ${feedbackType === type.value ? styles.active : ''}`}
                        onClick={() => setFeedbackType(type.value)}
                      >
                        <span className={styles.typeIcon}>{type.icon}</span>
                        <span className={styles.typeLabel}>{type.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Message */}
                  <div className={styles.field}>
                    <label htmlFor="feedback-message">Your Feedback *</label>
                    <textarea
                      ref={textareaRef}
                      id="feedback-message"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder={
                        feedbackType === 'bug'
                          ? 'Describe the bug you encountered...'
                          : feedbackType === 'feature'
                          ? 'Describe the feature you would like...'
                          : feedbackType === 'content'
                          ? 'Describe the content issue...'
                          : 'Share your thoughts with us...'
                      }
                      rows={5}
                      maxLength={2000}
                    />
                    <span className={styles.charCount}>{message.length}/2000</span>
                  </div>

                  {/* Email (Optional) */}
                  <div className={styles.field}>
                    <label htmlFor="feedback-email">Email (optional)</label>
                    <input
                      type="email"
                      id="feedback-email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                    />
                    <span className={styles.hint}>We&apos;ll only use this to follow up on your feedback</span>
                  </div>

                  {/* Error Message */}
                  {error && <div className={styles.error}>{error}</div>}

                  {/* Submit Button */}
                  <button
                    type="submit"
                    className={styles.submitButton}
                    disabled={isSubmitting || !message.trim()}
                  >
                    {isSubmitting ? (
                      <>
                        <span className={styles.spinner} />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Submit Feedback
                      </>
                    )}
                  </button>
                </form>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
