'use client';

import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Navigation } from '@/components/layout/Navigation';
import { Footer } from '@/components/layout/Footer';
import { PageTransition } from '@/components/layout/PageTransition';
import { useAnalytics } from '@/components/analytics/AnalyticsProvider';

export default function AboutPageClient() {
  const { trackPageView } = useAnalytics();

  useEffect(() => {
    trackPageView('/about');
  }, [trackPageView]);

  return (
    <PageTransition>
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
        <Navigation />
        
        {/* Hero Section */}
        <section className="pt-24 pb-16 px-6">
          <div className="container mx-auto max-w-4xl">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="text-center mb-16"
            >
              <h1 className="text-5xl md:text-7xl font-black text-white mb-6">
                <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
                  Rethinking
                </span>
                <br />
                <span className="text-white/90">Digital Access</span>
              </h1>
              <p className="text-xl md:text-2xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
                In an era where digital ownership is increasingly questioned, we explore the philosophical boundaries of access, preservation, and cultural heritage.
              </p>
            </motion.div>
          </div>
        </section>

        {/* Main Content */}
        <main className="px-6 pb-20">
          <div className="container mx-auto max-w-4xl">
            
            {/* The Philosophy Section */}
            <motion.section
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="mb-20"
            >
              <div className="bg-gradient-to-r from-purple-900/20 to-pink-900/20 backdrop-blur-md rounded-2xl p-8 md:p-12 border border-white/10">
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-8 flex items-center gap-4">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-purple-400">
                    <path d="M9 12l2 2 4-4"/>
                    <path d="M21 12c-1 0-3-1-3-3s2-3 3-3 3 1 3 3-2 3-3 3"/>
                    <path d="M3 12c1 0 3-1 3-3s-2-3-3-3-3 1-3 3 2 3 3 3"/>
                  </svg>
                  The Digital Ownership Paradox
                </h2>
                
                <div className="prose prose-lg prose-invert max-w-none">
                  <p className="text-gray-300 text-lg leading-relaxed mb-6">
                    When you "purchase" digital content today, what exactly do you own? The answer is increasingly complex. You're granted a revocable license to access content that can disappear from your library without notice, be modified post-purchase, or become inaccessible when services shut down.
                  </p>
                  
                  <p className="text-gray-300 text-lg leading-relaxed mb-6">
                    This raises profound questions about the nature of ownership in the digital age. If purchasing doesn't grant true ownership—if your "bought" movies can vanish, your "purchased" games can be remotely disabled, and your digital library exists at the whim of corporate decisions—then what does ownership even mean?
                  </p>

                  <blockquote className="border-l-4 border-purple-500 pl-6 my-8 bg-black/30 p-6 rounded-r-lg">
                    <p className="text-xl text-purple-300 italic mb-4">
                      "The question isn't whether digital piracy is theft—it's whether digital 'purchasing' is actually ownership."
                    </p>
                    <footer className="text-gray-400">— Digital Rights Philosophy</footer>
                  </blockquote>
                </div>
              </div>
            </motion.section>

            {/* Cultural Preservation */}
            <motion.section
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="mb-20"
            >
              <div className="bg-gradient-to-r from-cyan-900/20 to-blue-900/20 backdrop-blur-md rounded-2xl p-8 md:p-12 border border-white/10">
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-8 flex items-center gap-4">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-cyan-400">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14,2 14,8 20,8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                    <polyline points="10,9 9,9 8,9"/>
                  </svg>
                  Cultural Preservation & Access
                </h2>
                
                <div className="prose prose-lg prose-invert max-w-none">
                  <p className="text-gray-300 text-lg leading-relaxed mb-6">
                    Countless films, shows, and cultural artifacts have been lost to time—not through natural decay, but through corporate decisions, licensing disputes, and artificial scarcity. When content is removed from official platforms, sometimes the only preservation exists in unofficial archives.
                  </p>
                  
                  <p className="text-gray-300 text-lg leading-relaxed mb-6">
                    Libraries have long served as guardians of human knowledge and culture. In the digital realm, who serves this role? When corporations control access to our cultural heritage, what happens when profit motives conflict with preservation?
                  </p>

                  <div className="grid md:grid-cols-2 gap-6 my-8">
                    <div className="bg-black/30 p-6 rounded-lg">
                      <h4 className="text-cyan-300 font-semibold mb-3">The Preservation Argument</h4>
                      <p className="text-gray-400 text-sm">
                        Digital preservation ensures cultural works remain accessible to future generations, regardless of corporate decisions or licensing changes.
                      </p>
                    </div>
                    <div className="bg-black/30 p-6 rounded-lg">
                      <h4 className="text-cyan-300 font-semibold mb-3">The Access Argument</h4>
                      <p className="text-gray-400 text-sm">
                        Geographic restrictions and economic barriers shouldn't determine who can access human culture and knowledge.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.section>

            {/* The Technology Philosophy */}
            <motion.section
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="mb-20"
            >
              <div className="bg-gradient-to-r from-green-900/20 to-emerald-900/20 backdrop-blur-md rounded-2xl p-8 md:p-12 border border-white/10">
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-8 flex items-center gap-4">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-400">
                    <circle cx="12" cy="12" r="3"/>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                  </svg>
                  Technology as Liberation
                </h2>
                
                <div className="prose prose-lg prose-invert max-w-none">
                  <p className="text-gray-300 text-lg leading-relaxed mb-6">
                    The internet was built on principles of open access and information freedom. Early pioneers envisioned a world where knowledge and culture could flow freely, unencumbered by artificial barriers. This vision conflicts sharply with today's walled gardens and subscription silos.
                  </p>
                  
                  <p className="text-gray-300 text-lg leading-relaxed mb-6">
                    Technology has the power to democratize access to information and culture. The same tools that enable global communication can ensure that geographic location, economic status, or corporate decisions don't determine what culture you can access.
                  </p>

                  <div className="bg-black/30 p-6 rounded-lg my-8">
                    <h4 className="text-green-300 font-semibold mb-4">Our Technical Philosophy</h4>
                    <ul className="space-y-3 text-gray-300">
                      <li className="flex items-start gap-3">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-400 mt-0.5 flex-shrink-0">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        <span>Universal access to cultural content regardless of geographic restrictions</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-400 mt-0.5 flex-shrink-0">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        <span>Preservation of digital culture for future generations</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-400 mt-0.5 flex-shrink-0">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        <span>Technology that serves users, not corporate gatekeepers</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-400 mt-0.5 flex-shrink-0">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        <span>Open protocols and decentralized systems over walled gardens</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </motion.section>

            {/* Legal Disclaimer */}
            <motion.section
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="mb-20"
            >
              <div className="bg-gradient-to-r from-red-900/20 to-orange-900/20 backdrop-blur-md rounded-2xl p-8 md:p-12 border border-red-500/20">
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-8 flex items-center gap-4">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    <path d="M9 12l2 2 4-4"/>
                  </svg>
                  Legal Framework & Compliance
                </h2>
                
                <div className="prose prose-lg prose-invert max-w-none">
                  <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-6 mb-8">
                    <h4 className="text-red-300 font-semibold mb-4 flex items-center gap-2">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                        <line x1="12" y1="9" x2="12" y2="13"/>
                        <line x1="12" y1="17" x2="12.01" y2="17"/>
                      </svg>
                      Important Legal Notice
                    </h4>
                    <p className="text-red-200 text-sm leading-relaxed">
                      This platform operates as a content discovery and information service. We do not host, store, or distribute copyrighted content. All content links and information are sourced from publicly available APIs and databases.
                    </p>
                  </div>

                  <h3 className="text-2xl font-bold text-white mb-6">Terms of Service & Legal Compliance</h3>
                  
                  <div className="space-y-6 text-gray-300">
                    <div>
                      <h4 className="text-lg font-semibold text-white mb-3">Content Sourcing</h4>
                      <p className="text-sm leading-relaxed">
                        All content information is sourced from The Movie Database (TMDB) and other publicly available APIs. We provide metadata, descriptions, and discovery tools only. Users are responsible for ensuring their access to content complies with local laws and regulations.
                      </p>
                    </div>

                    <div>
                      <h4 className="text-lg font-semibold text-white mb-3">Copyright Compliance</h4>
                      <p className="text-sm leading-relaxed">
                        We respect intellectual property rights and comply with the Digital Millennium Copyright Act (DMCA). If you believe your copyrighted work has been infringed, please contact us with proper documentation for immediate review and action.
                      </p>
                    </div>

                    <div>
                      <h4 className="text-lg font-semibold text-white mb-3">User Responsibility</h4>
                      <p className="text-sm leading-relaxed">
                        Users are solely responsible for their actions and compliance with applicable laws in their jurisdiction. This platform does not encourage, endorse, or facilitate copyright infringement or illegal activities.
                      </p>
                    </div>

                    <div>
                      <h4 className="text-lg font-semibold text-white mb-3">Geographic Restrictions</h4>
                      <p className="text-sm leading-relaxed">
                        Content availability and legal frameworks vary by jurisdiction. Users must comply with their local laws regarding content access and consumption. We do not provide legal advice regarding content access rights.
                      </p>
                    </div>

                    <div>
                      <h4 className="text-lg font-semibold text-white mb-3">Data Collection & Privacy</h4>
                      <p className="text-sm leading-relaxed">
                        We collect minimal analytics data to improve user experience. No personal information is stored or shared with third parties. All data collection complies with GDPR, CCPA, and other applicable privacy regulations.
                      </p>
                    </div>

                    <div>
                      <h4 className="text-lg font-semibold text-white mb-3">Contact Information</h4>
                      <p className="text-sm leading-relaxed">
                        For legal inquiries, DMCA notices, or compliance questions, please contact our legal team at legal@flyx.stream. We respond to all legitimate legal requests within 48 hours.
                      </p>
                    </div>
                  </div>

                  <div className="mt-8 p-4 bg-black/30 rounded-lg border border-gray-600">
                    <p className="text-xs text-gray-400 leading-relaxed">
                      Last updated: {new Date().toLocaleDateString()}. This legal framework is subject to change. Users are advised to review these terms regularly and consult with legal counsel regarding their specific circumstances and local laws.
                    </p>
                  </div>
                </div>
              </div>
            </motion.section>

          </div>
        </main>

        <Footer />
      </div>
    </PageTransition>
  );
}