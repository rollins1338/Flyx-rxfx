'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import './about.css';

const sections = [
  { id: 'abstract', title: 'Abstract' },
  { id: 'introduction', title: 'Introduction' },
  { id: 'reception', title: 'Public Reception' },
  { id: 'literature', title: 'Literature Review' },
  { id: 'methodology', title: 'Methodology' },
  { id: 'architecture', title: 'System Architecture' },
  { id: 'heist', title: 'Security Research' },
  { id: 'implementation', title: 'Implementation' },
  { id: 'features', title: 'Feature Evolution' },
  { id: 'results', title: 'Results & Analysis' },
  { id: 'discussion', title: 'Discussion' },
  { id: 'future', title: 'Future Work' },
  { id: 'conclusion', title: 'Conclusion' },
  { id: 'legal', title: 'Legal Framework' },
  { id: 'references', title: 'References' },
];

export default function AboutPage() {
  const [activeSection, setActiveSection] = useState('abstract');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      setProgress((scrollTop / docHeight) * 100);

      for (const section of sections) {
        const el = document.getElementById(section.id);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 150 && rect.bottom > 150) {
            setActiveSection(section.id);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="about-page">
      <div className="progress-bar" style={{ width: `${progress}%` }} />

      <header className="about-header">
        <div className="journal-badge">Journal of Questionable Software Engineering • Vol. 1, Issue 2 • December 2025</div>
        <div className="last-updated">Last updated: December 19, 2025</div>
        <h1>Flyx: A Case Study in Privacy-Respecting Streaming Architecture and Web Security Research</h1>
        <p className="subtitle">
          An academic exploration of building user-respecting streaming infrastructure, documenting 
          modern web security patterns, obfuscation techniques, and the technical feasibility of 
          privacy-first design in media applications—featuring extensive documentation of reverse 
          engineering methodologies and the ongoing evolution of extraction pipelines.
        </p>
        <div className="author">
          <span className="avatar">V</span>
          <div>
            <strong>Vynx</strong>
            <span>Independent Researcher & Professional Insomniac</span>
          </div>
        </div>
        <div className="paper-meta">
          <span>Received: June 2025</span>
          <span>Revised: December 2025</span>
          <span>Accepted: December 2025</span>
          <span>Reading Time: ~25 minutes</span>
        </div>
      </header>

      <div className="about-layout">
        <nav className="about-nav">
          <div className="nav-inner">
            <div className="nav-header">
              <span className="nav-title">Table of Contents</span>
              <span className="nav-progress">{Math.round(progress)}%</span>
            </div>
            {sections.map((s, i) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className={activeSection === s.id ? 'active' : ''}
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                <span className="nav-num">{String(i + 1).padStart(2, '0')}</span>
                {s.title}
              </a>
            ))}
          </div>
        </nav>

        <main className="about-content">

          {/* Abstract */}
          <section id="abstract">
            <h2>Abstract</h2>
            <div className="abstract-box">
              <p>
                This paper presents Flyx, a research project and technology demonstration exploring 
                privacy-respecting streaming architecture. Developed over seven months, the project 
                investigates whether modern web applications can deliver media content without 
                invasive tracking, malicious advertising, or exploitative user interfaces. The 
                findings demonstrate that privacy-first design is technically and economically 
                viable in streaming applications.
              </p>
              <p>
                Through systematic analysis of third-party streaming providers, we document various 
                security patterns, obfuscation techniques, and authentication mechanisms. This 
                research contributes to the broader understanding of web security while demonstrating 
                that user-respecting alternatives are achievable.
              </p>
              <p>
                <strong>Update (December 2025):</strong> The platform has undergone significant 
                evolution. Legacy providers have been deprecated in favor of more reliable sources: 
                Vidsrc and Videasy now form the backbone of our extraction pipeline. AnimeKai 
                integration provides dedicated anime streaming with sub/dub toggle. The public 
                response has validated the core hypothesis—users prefer privacy-respecting alternatives 
                when they exist and work properly.
              </p>
              <p>
                <strong>December 2025 Feature Drop:</strong> Chromecast &amp; AirPlay casting, full TV 
                remote navigation, 29-language subtitle support with sync adjustment, pinch-to-zoom on 
                mobile, continue watching with progress tracking, auto-play next episode, and region 
                filtering.
              </p>
              <p>
                <strong>Latest Research (December 2025):</strong> 111movies security architecture has 
                been fully documented. AES-256-CBC encryption with custom alphabet substitution—analyzed 
                without browser automation. See our <Link href="/reverse-engineering">technical documentation</Link> 
                for the complete breakdown.
              </p>
              <p>
                <strong>Live TV Research (December 2025):</strong> DLHD live TV streams analyzed through 
                our Cloudflare proxy. Reverse engineering their obfuscated JavaScript player revealed 
                Bearer token authentication patterns. See the <Link href="/reverse-engineering#dlhd">full 
                technical breakdown</Link>.
              </p>
              <p>
                <strong>Flixer WASM Cracking (December 21, 2025):</strong> After a 12-hour overnight 
                reverse engineering session, we cracked Flixer&apos;s Rust-compiled WebAssembly encryption. 
                Using Ghidra for binary analysis and memory forensics, we discovered their browser 
                fingerprinting scheme and HMAC authentication. The solution: bundle their WASM binary 
                into our Cloudflare Worker with mocked browser APIs. See the <Link href="/reverse-engineering#flixer">
                complete technical breakdown</Link>.
              </p>
              <p>
                <strong>Keywords:</strong> Streaming Architecture, Reverse Engineering, Privacy-First Design, 
                Obfuscation Analysis, Web Security Research, AES-256-CBC, AES-128, AES-256-CTR, WASM, 
                WebAssembly, Rust, Ghidra, Bearer Token Authentication, Chromecast, AirPlay, TV Navigation, 
                OpenSubtitles, Browser Fingerprinting
              </p>
            </div>
          </section>

          {/* Introduction */}
          <section id="introduction">
            <h2>1. Introduction</h2>
            
            <h3>1.1 The State of Free Streaming (A Horror Story)</h3>
            <p className="lead">
              The year is 2025. Humanity has achieved remarkable technological feats. We have sent 
              robots to Mars. We have developed artificial intelligence that can write poetry and 
              generate images of cats wearing business suits. And yet, if you want to watch a movie 
              for free on the internet, you must first navigate an obstacle course of pop-up 
              advertisements, fake download buttons, cryptocurrency miners, and user interfaces that 
              appear to have been designed by a committee of people who have never actually used a 
              computer.
            </p>
            <p>
              This is not hyperbole. This is Tuesday.
            </p>
            <p>
              The pirate streaming ecosystem represents one of the most hostile environments on the 
              modern web. Users seeking free access to movies and television are routinely subjected 
              to an arsenal of exploitative practices that would make a used car salesman blush. 
              Pop-up advertisements spawn endlessly, like some sort of digital hydra. Fake &quot;close&quot; 
              buttons trigger additional advertisements, because apparently the first seventeen were 
              not enough. Cryptocurrency miners run silently in the background, turning your laptop 
              into a space heater while generating approximately $0.003 worth of Monero for someone 
              in a country you cannot pronounce.
            </p>
            <p>
              Browser fingerprinting tracks you across the web with the persistence of an ex who 
              &quot;just wants to talk.&quot; Malware distribution disguises itself as video players, 
              codec updates, and occasionally as messages from Nigerian princes who have inexplicably 
              developed an interest in streaming technology. Dark patterns trick users into clicking 
              things they did not intend to click, visiting places they did not intend to visit, and 
              questioning life choices they thought they had already resolved in therapy.
            </p>

            <h3>1.2 The Implicit Assumption</h3>
            <p>
              Underlying this entire ecosystem is an assumption so pervasive that most people have 
              stopped questioning it: free content requires exploitation. If you are not paying with 
              money, you must pay with your security, your privacy, your CPU cycles, and your sanity. 
              This is presented as an immutable law of the universe, like gravity or the tendency of 
              software projects to exceed their estimated completion dates by a factor of three.
            </p>
            <p>
              We reject this assumption.
            </p>
            <p>
              Not because we are naive idealists who believe in the inherent goodness of humanity (we 
              have spent too much time reading YouTube comments for that) but because we suspected it 
              was simply not true. The exploitation is not a necessary evil. It is a choice. A 
              profitable choice, certainly, but a choice nonetheless.
            </p>

            <h3>1.3 Research Questions</h3>
            <p>
              This project began with fundamental questions about streaming architecture: Can a 
              streaming platform be built that respects user privacy? What are the technical 
              requirements for privacy-first media delivery? How do existing providers protect 
              their systems, and what can we learn from analyzing these protections?
            </p>
            <blockquote>
              &quot;The best way to prove something is possible is to do it. The second best way is to 
              write a really long document about doing it and hope people believe you.&quot;
              <cite>- Research Philosophy</cite>
            </blockquote>
            <p>
              We chose the first option, then wrote the document anyway for academic completeness.
            </p>

            <h3>1.4 Scope and Contributions</h3>
            <p>
              This research makes the following contributions:
            </p>
            <ul>
              <li>
                <strong>Proof of Concept:</strong> A functional streaming platform demonstrating 
                privacy-respecting architecture without advertisements, tracking, or exploitative patterns.
              </li>
              <li>
                <strong>Security Research Documentation:</strong> Comprehensive analysis of obfuscation 
                and security measures employed by streaming providers, contributing to the broader 
                understanding of web security patterns. <Link href="/reverse-engineering" className="inline-link">
                Read the full technical breakdown →</Link>
              </li>
              <li>
                <strong>Architectural Reference:</strong> A blueprint for building privacy-respecting 
                streaming applications that other developers and researchers can reference.
              </li>
              <li>
                <strong>Feasibility Analysis:</strong> Evidence that privacy-first design is technically 
                and economically viable for streaming applications.
              </li>
              <li>
                <strong>Public Validation:</strong> User feedback demonstrating demand for privacy-respecting 
                alternatives in the streaming space.
              </li>
            </ul>
          </section>

          <section id="reception">
            <h2>2. Public Response and Validation</h2>
            
            <h3>2.1 Community Feedback</h3>
            <p className="lead">
              The project received significant attention after being shared publicly, validating 
              the core hypothesis that users prefer privacy-respecting alternatives.
            </p>
            <p>
              The response demonstrated strong demand for streaming solutions that prioritize user 
              experience over monetization. Users shared their experiences with existing streaming 
              options and expressed appreciation for a privacy-first approach.
            </p>

            <h3>2.2 Feature Development</h3>
            <p>
              User feedback drove rapid feature development. The most requested capabilities were 
              implemented based on community input:
            </p>
            <div className="feedback-highlights">
              <div className="feedback-item">
                <span className="feedback-icon">📺</span>
                <div>
                  <h4>Casting Support</h4>
                  <p>Chromecast and AirPlay support for TV viewing without additional hardware.</p>
                </div>
              </div>
              <div className="feedback-item">
                <span className="feedback-icon">📝</span>
                <div>
                  <h4>Subtitle Synchronization</h4>
                  <p>29 languages via OpenSubtitles with quality scoring and sync adjustment controls.</p>
                </div>
              </div>
              <div className="feedback-item">
                <span className="feedback-icon">🎮</span>
                <div>
                  <h4>TV Navigation</h4>
                  <p>Full spatial navigation for devices with D-pad controls (Fire TV, Android TV).</p>
                </div>
              </div>
              <div className="feedback-item">
                <span className="feedback-icon">🎌</span>
                <div>
                  <h4>Anime Integration</h4>
                  <p>AnimeKai integration with sub/dub toggle and preference memory.</p>
                </div>
              </div>
            </div>

            <h3>2.3 Research Impact</h3>
            <p>
              The security research aspects of the project have contributed to broader understanding 
              of web obfuscation techniques. Some providers have updated their protection mechanisms 
              in response, providing additional case studies for ongoing research.
            </p>

            <h3>2.4 Usage Metrics</h3>
            <div className="stats-grid">
              <div className="stat">
                <span className="stat-value">10K+</span>
                <span className="stat-label">Active users</span>
              </div>
              <div className="stat">
                <span className="stat-value">500K+</span>
                <span className="stat-label">Streams served</span>
              </div>
              <div className="stat">
                <span className="stat-value">0</span>
                <span className="stat-label">Ads shown</span>
              </div>
              <div className="stat">
                <span className="stat-value">0</span>
                <span className="stat-label">Users tracked</span>
              </div>
            </div>
          </section>

          {/* Literature Review */}
          <section id="literature">
            <h2>3. Literature Review</h2>
            
            <h3>2.1 The Exploitation Economy</h3>
            <p>
              Academic research into pirate streaming sites has documented what users have known for 
              years: these platforms are terrible. Rafique et al. (2016) found that over 50% of 
              visitors to major pirate streaming sites were served malware through advertisements. 
              This is not a bug; it is the business model. The advertising networks that work with 
              these sites have content policies best described as &quot;whatever pays.&quot;
            </p>
            <p>
              Konoth et al. (2018) documented the rise of in-browser cryptocurrency mining, a practice 
              that combines the excitement of watching your CPU usage spike to 100% with the financial 
              reward of generating approximately nothing for yourself while making someone else slightly 
              less poor. The authors noted that users often had no idea this was happening, which is 
              either a testament to the subtlety of the implementation or the general state of computer 
              literacy in the modern era.
            </p>
            <p>
              Laperdrix et al. (2020) provided a comprehensive survey of browser fingerprinting 
              techniques, demonstrating that even users who clear their cookies and use private 
              browsing can be tracked with alarming accuracy. The paper reads like a horror novel 
              for anyone who thought &quot;incognito mode&quot; actually meant something.
            </p>

            <h3>2.2 The Dark Patterns Epidemic</h3>
            <p>
              Gray et al. (2018) coined the term &quot;dark patterns&quot; to describe user interface 
              designs that trick users into doing things they did not intend. Pirate streaming sites 
              have elevated this to an art form. Fake close buttons, hidden redirects, misleading 
              download links, and countdown timers that reset when you are not looking. These are not 
              accidents. They are features.
            </p>
            <p>
              Mathur et al. (2019) conducted a large-scale analysis of dark patterns across 11,000 
              shopping websites and found them everywhere. We did not conduct a similar analysis of 
              pirate streaming sites because we value our mental health, but anecdotal evidence 
              suggests the situation is significantly worse. At least shopping sites occasionally 
              want you to buy something. Pirate streaming sites just want to watch the world burn.
            </p>

            <h3>2.3 The &quot;Necessary Evil&quot; Myth</h3>
            <p>
              Defenders of exploitative practices often argue that they are economically necessary. 
              &quot;Servers cost money,&quot; they say, as if this explains why clicking a play button 
              should open seventeen browser tabs and install a toolbar nobody asked for.
            </p>
            <p>
              This argument deserves scrutiny, primarily because it is wrong.
            </p>
            <p>
              Pirate streaming sites do not host content. They aggregate it. They are glorified link 
              directories with embedded players that point to streams hosted elsewhere. The actual 
              bandwidth costs are borne by third-party providers. The site operators need to pay for 
              domain registration, basic hosting, and perhaps a modest amount of server-side processing. 
              Modern serverless platforms offer free tiers that can handle substantial traffic without 
              cost.
            </p>
            <p>
              The exploitation is not necessary. It is simply more profitable than the alternative. 
              Site operators choose to deploy malware, mine cryptocurrency, and track users because 
              these practices generate revenue, not because the sites could not function without them.
            </p>

            <h3>2.4 Privacy-Respecting Alternatives in Other Domains</h3>
            <p>
              The broader web has seen growing interest in privacy-respecting alternatives to 
              surveillance-based services. DuckDuckGo has demonstrated that search can work without 
              tracking. Signal has proven that messaging can be secure without being unusable. 
              ProtonMail has shown that email can be private without requiring a PhD in cryptography 
              to set up.
            </p>
            <p>
              Yet the streaming space has seen limited progress in this direction. This is partly due 
              to technical complexity (streaming is harder than search) and partly due to legal ambiguity 
              surrounding content aggregation. But mostly, we suspect, it is because the people capable 
              of building something better were busy with legitimate projects, while the people running 
              pirate sites were too busy counting their malware revenue to care about user experience.
            </p>
          </section>


          {/* Methodology */}
          <section id="methodology">
            <h2>4. Methodology</h2>
            
            <h3>3.1 Research Design</h3>
            <p>
              This study employs what academics call &quot;constructive research methodology&quot; and 
              what normal people call &quot;building the thing and seeing if it works.&quot; The primary 
              research artifact (the Flyx streaming platform) serves as both the subject of investigation 
              and the vehicle for generating insights. It also serves as evidence that the author has 
              too much free time and questionable priorities.
            </p>
            <p>
              The research proceeded through four distinct phases, each characterized by its own unique 
              blend of optimism, despair, and caffeine dependency:
            </p>
            <div className="phases">
              <div className="phase">
                <span className="phase-num">01</span>
                <div>
                  <h4>Requirements Analysis</h4>
                  <p>Feature prioritization, technology evaluation, and the gradual realization that 
                  this project was going to be significantly more complicated than initially anticipated.</p>
                  <span className="phase-time">Weeks 1-3</span>
                </div>
              </div>
              <div className="phase">
                <span className="phase-num">02</span>
                <div>
                  <h4>Core Development</h4>
                  <p>Building the platform, reverse engineering stream providers, and developing an 
                  intimate familiarity with the JavaScript debugger that borders on unhealthy.</p>
                  <span className="phase-time">Weeks 4-16</span>
                </div>
              </div>
              <div className="phase">
                <span className="phase-num">03</span>
                <div>
                  <h4>Deployment & Optimization</h4>
                  <p>Going live, discovering that everything works differently in production, and 
                  fixing bugs that somehow did not exist five minutes ago.</p>
                  <span className="phase-time">Weeks 17-19</span>
                </div>
              </div>
              <div className="phase">
                <span className="phase-num">04</span>
                <div>
                  <h4>Provider Migration & Expansion</h4>
                  <p>Deprecating 2Embed and MoviesAPI in favor of Vidsrc and Videasy. Adding Live TV 
                  support, AnimeKai integration, and learning that provider APIs change without warning.</p>
                  <span className="phase-time">Weeks 20-28</span>
                </div>
              </div>
              <div className="phase">
                <span className="phase-num">05</span>
                <div>
                  <h4>Documentation & Ongoing Maintenance</h4>
                  <p>Writing this paper, keeping up with provider changes, and accepting that this 
                  project will never truly be &quot;done.&quot;</p>
                  <span className="phase-time">Weeks 29+</span>
                </div>
              </div>
            </div>

            <h3>3.2 Development Constraints</h3>
            <p>
              To ensure the validity of our findings regarding solo development feasibility (and also 
              because we did not have a choice) the following constraints were observed throughout the 
              project:
            </p>
            <div className="constraints">
              <div className="constraint">
                <span className="icon">👤</span>
                <h4>Single Developer</h4>
                <p>All code, design, and documentation produced by one individual. No contractors, 
                collaborators, or rubber ducks that provided unusually good advice.</p>
              </div>
              <div className="constraint">
                <span className="icon">💸</span>
                <h4>Zero Budget</h4>
                <p>Only free tiers of services utilized. If a service wanted a credit card, we found 
                an alternative or learned to live without it.</p>
              </div>
              <div className="constraint">
                <span className="icon">🌙</span>
                <h4>Part-Time Effort</h4>
                <p>Development conducted during evenings and weekends, averaging 15-20 hours per week 
                over five months. Sleep was occasionally sacrificed.</p>
              </div>
              <div className="constraint">
                <span className="icon">📚</span>
                <h4>Public Resources Only</h4>
                <p>All learning materials publicly available. No proprietary training, insider 
                knowledge, or deals with supernatural entities.</p>
              </div>
            </div>

            <h3>3.3 Ethical Considerations</h3>
            <p>
              Before proceeding, we established a set of non-negotiable ethical principles. The platform 
              would have:
            </p>
            <ul>
              <li>Zero advertisements of any kind, not even &quot;tasteful&quot; ones</li>
              <li>Zero tracking cookies or cross-site identifiers</li>
              <li>Zero cryptocurrency mining, even the &quot;opt-in&quot; kind that nobody opts into</li>
              <li>Zero pop-ups, pop-unders, or pop-sideways</li>
              <li>Zero fake buttons, misleading links, or dark patterns</li>
              <li>Zero collection of personally identifiable information</li>
              <li>Zero selling of user data to third parties, fourth parties, or any other parties</li>
            </ul>
            <p>
              If we could not build the platform without violating these principles, we would not build 
              it at all. Fortunately, as this paper demonstrates, we could.
            </p>
          </section>

          {/* Architecture */}
          <section id="architecture">
            <h2>5. System Architecture</h2>
            
            <h3>4.1 Architectural Philosophy</h3>
            <p>
              The Flyx architecture is guided by a simple principle: minimize complexity, maximize 
              reliability, and never, under any circumstances, require the developer to wake up at 
              3 AM because a server crashed. This led us to embrace serverless computing with the 
              enthusiasm of someone who has been personally victimized by server maintenance.
            </p>
            <p>
              The system follows what we call the &quot;Not My Problem&quot; architectural pattern, 
              wherein as many operational concerns as possible are delegated to managed services that 
              are someone else&apos;s problem. Scaling? Vercel&apos;s problem. Database availability? 
              Neon&apos;s problem. SSL certificates? Also someone else&apos;s problem. Our problem is 
              writing code that works, which is frankly enough problems for one person.
            </p>

            <h3>4.2 Technology Stack</h3>
            <p>
              Each technology in the stack was selected through rigorous evaluation against our primary 
              criteria: &quot;Will this make my life easier or harder?&quot; Technologies that made 
              life harder were rejected, regardless of how impressive they looked on a resume.
            </p>
            <div className="tech-stack">
              <div className="tech-item">
                <strong>Next.js 16</strong>
                <p>Upgraded from 14 to 16 during development. The backbone of the application with 
                server-side rendering for SEO, API routes for the proxy layer, and Turbopack for 
                faster builds. The App Router is now second nature.</p>
              </div>
              <div className="tech-item">
                <strong>TypeScript</strong>
                <p>Type safety was non-negotiable for a project of this complexity. TypeScript caught 
                countless bugs at compile time that would have otherwise manifested as mysterious 
                production errors at the worst possible moment.</p>
              </div>
              <div className="tech-item">
                <strong>Vercel</strong>
                <p>Hosting, edge functions, and a global CDN, all on a free tier generous enough to 
                handle our traffic without requiring us to sell organs. The deployment experience is 
                so smooth it feels like cheating.</p>
              </div>
              <div className="tech-item">
                <strong>Neon PostgreSQL</strong>
                <p>Serverless PostgreSQL that scales to zero when not in use, which is perfect for a 
                project with unpredictable traffic patterns and a budget of exactly zero dollars.</p>
              </div>
              <div className="tech-item">
                <strong>HLS.js + mpegts.js</strong>
                <p>HLS.js for standard VOD streaming, mpegts.js added for Live TV support. Together 
                they handle everything from movies to live broadcasts without breaking a sweat.</p>
              </div>
              <div className="tech-item">
                <strong>Vidsrc + Videasy</strong>
                <p>Our primary stream providers after migrating away from 2Embed and MoviesAPI. More 
                reliable, faster extraction, and (slightly) less hostile obfuscation.</p>
              </div>
              <div className="tech-item">
                <strong>AnimeKai</strong>
                <p>Dedicated anime streaming integration. Because anime fans deserve better than the 
                ad-infested hellscapes that pass for anime streaming sites.</p>
              </div>
            </div>

            <h3>4.3 The Proxy Layer</h3>
            <p>
              The proxy layer is where the magic happens, and by &quot;magic&quot; we mean &quot;a 
              significant amount of header manipulation and referrer spoofing that makes streams 
              actually play.&quot;
            </p>
            <p>
              Stream providers implement various restrictions to prevent their content from being 
              embedded on unauthorized domains. They check Referer headers, Origin headers, and 
              occasionally perform rituals that we do not fully understand but have learned to 
              accommodate. The proxy layer intercepts all stream requests and rewrites headers to 
              match what the providers expect, presenting a unified interface to the client while 
              handling the complexity behind the scenes.
            </p>
          </section>

          {/* The Heist */}
          <section id="heist">
            <h2>6. Security Research: Analyzing Stream Provider Protection</h2>
            
            <h3>5.1 Research Motivation</h3>
            <p className="lead">
              This project serves as a practical study in web security, obfuscation analysis, and 
              privacy-respecting architecture. The streaming providers we analyzed employ sophisticated 
              protection mechanisms that provide valuable case studies in modern web security patterns.
              Understanding these systems contributes to broader knowledge in the security research community.
            </p>
            <p>
              Our goal was to document and analyze these protection mechanisms while building a 
              demonstration platform that prioritizes user privacy and experience.
            </p>
            <blockquote>
              &quot;Understanding how systems protect themselves—even systems operating in legal gray 
              areas—provides valuable insights for security researchers and developers building 
              legitimate applications.&quot;
              <cite>- Research Notes, Week 7</cite>
            </blockquote>

            <h3>5.2 Technical Challenges</h3>
            <p>
              Modern streaming providers employ multiple layers of protection. Analyzing these systems 
              reveals sophisticated security patterns that are instructive for anyone working in web 
              security or application development.
            </p>

            <div className="challenge">
              <h4>🔐 Challenge 1: The Code Spaghetti Monster</h4>
              <p>
                Open DevTools on any pirate streaming site and look at their JavaScript. It is not 
                code. It is a war crime against readability. Variable names like <code>_0x4a3f</code> 
                and <code>_0xb7c2</code>. Strings split into arrays of character codes, reassembled 
                through twelve layers of function calls that reference other arrays by computed indices. 
                Control flow that looks like someone threw spaghetti at a wall and called it architecture.
              </p>
              <p>
                And the crown jewel: <code>eval()</code> statements that generate MORE obfuscated code 
                at runtime. You cannot even read what you are trying to crack because it does not exist 
                until the page executes.
              </p>
              <p className="solution">
                <strong>Our Approach:</strong> We built a custom deobfuscation pipeline. Intercept every 
                <code>eval()</code> call and log what it produces. Trace string operations backwards 
                through the call stack. Write AST-based transformers that rename variables based on 
                usage patterns. Slowly, painfully, over many late nights, the gibberish becomes readable. 
                Then you find the one line that matters: where they construct the stream URL.
              </p>
            </div>

            <div className="challenge">
              <h4>⏱️ Challenge 2: The Ticking Clock</h4>
              <p>
                Found the stream URL? Congratulations. It expires in 90 seconds.
              </p>
              <p>
                Every request to the stream server needs a fresh token computed from the current 
                timestamp, the content ID, and a secret key buried somewhere in 50,000 lines of 
                obfuscated JavaScript. Copy-paste the URL? Dead on arrival. You need to understand 
                their entire authentication scheme and replicate it perfectly.
              </p>
              <p className="solution">
                <strong>Our Approach:</strong> Hours of stepping through minified code in the debugger, 
                watching variables change, mapping the flow of data from input to output. Eventually 
                you find it: they are using HMAC-SHA256 with a hardcoded key hidden in what appears to 
                be a fake jQuery plugin. Extract the key, reimplement the algorithm server-side, 
                generate valid tokens on demand. Their 90-second window becomes irrelevant.
              </p>
            </div>

            <div className="challenge">
              <h4>🤖 Challenge 3: The Bot Hunters</h4>
              <p>
                These sites HATE automation. They check if you are running headless Chrome by looking 
                for missing browser APIs. They analyze your mouse movements for human-like patterns. 
                They fingerprint your WebGL renderer, your canvas, your audio context. They measure 
                how long it takes you to click things and flag anything that seems too fast or too 
                consistent.
              </p>
              <p>
                Fail any check and you get a fake stream that plays for exactly 30 seconds before 
                cutting to black. Or worse, an IP ban that requires you to restart your router and 
                contemplate your life choices.
              </p>
              <p className="solution">
                <strong>Our Approach:</strong> We tried the obvious solutions first. Puppeteer with 
                stealth plugins. Fake mouse movements with Bézier curves. Randomized timing delays. 
                None of it worked consistently. Then we had a realization: their bot detection runs 
                client-side. If we never execute their JavaScript, we never trigger their checks. 
                Pure HTTP requests, carefully crafted headers, surgical extraction. No browser, no 
                detection, no problem.
              </p>
            </div>

            <div className="challenge">
              <h4>🪆 Challenge 4: The Russian Nesting Dolls</h4>
              <p>
                Click play on a pirate streaming site. The video loads in an iframe. That iframe 
                loads another iframe from a different domain. Which loads ANOTHER iframe from yet 
                another domain. The actual video player might be four layers deep, each layer hosted 
                on a different domain with different CORS policies, each performing its own validation 
                and token verification.
              </p>
              <p>
                It is like trying to break into a bank vault that is inside another bank vault that 
                is inside a third bank that is on fire.
              </p>
              <p className="solution">
                <strong>Our Approach:</strong> Map the entire chain. Follow each redirect, extract 
                each URL, understand what each layer validates. Build a system that traverses the 
                whole maze automatically, spoofing referrers at each hop, collecting tokens from 
                each layer, until you reach the actual stream buried at the bottom.
              </p>
            </div>

            <h3>5.3 Case Studies</h3>
            <p>
              Each provider presented unique technical challenges. Documenting these provides valuable 
              reference material for security researchers and developers.
            </p>

            <div className="war-story">
              <h4>Case Study: Vidsrc Architecture Analysis</h4>
              <p>
                After analyzing multiple providers, Vidsrc emerged as an interesting case study with 
                cleaner architecture and more predictable behavior. Their protection included 
                multiple layers of encoding, rotating keys, and timestamp-based token generation.
              </p>
              <p>
                Videasy presented a different approach to protection. Their token system used 
                predictable seeds derived from content metadata, demonstrating an alternative 
                security model.
              </p>
              <p>
                <strong>Key Finding:</strong> Building a unified extraction pipeline that handles 
                multiple provider architectures proved more maintainable than provider-specific 
                solutions. Extraction times improved from 5+ seconds to under 200 milliseconds.
              </p>
            </div>

            <div className="war-story">
              <h4>Case Study: 111movies AES-256 Implementation (December 2025)</h4>
              <p>
                111movies presented an interesting security architecture. A Next.js frontend with 
                heavily obfuscated JavaScript, API calls requiring specific authentication, and 
                a multi-layer encoding scheme.
              </p>
              <p>
                Analysis of their webpack bundles revealed string arrays with Base64-encoded values, 
                decoder functions with rotating indices, and control flow flattening. The key 
                discovery: <code>createCipheriv</code> indicating AES-256-CBC encryption.
              </p>
              <p>
                The encoding flow: encrypt → hex → XOR → UTF-8 → Base64 → alphabet substitution. 
                Five layers of obfuscation providing a comprehensive case study in layered security.
              </p>
              <p>
                <strong>Key Finding:</strong> The API required a specific <code>X-Requested-With: XMLHttpRequest</code> 
                header—a common but often overlooked security check.
              </p>
              <p>
                <Link href="/reverse-engineering#111movies" className="war-story-link">
                  → Full technical documentation
                </Link>
              </p>
            </div>

            <div className="war-story">
              <h4>Case Study: Bot Detection Analysis</h4>
              <p>
                Some providers implement sophisticated bot detection including canvas fingerprinting, 
                WebGL checks, and timing analysis. Understanding these mechanisms is valuable for 
                both security researchers and developers building legitimate automation tools.
              </p>
              <p>
                <strong>Key Finding:</strong> Client-side validation can often be bypassed by 
                understanding the underlying API requirements. Direct HTTP requests with proper 
                headers proved more reliable than browser automation approaches.
              </p>
            </div>

            <h3>5.4 Research Metrics</h3>
            <div className="stats-grid">
              <div className="stat">
                <span className="stat-value">15+</span>
                <span className="stat-label">Security patterns documented</span>
              </div>
              <div className="stat">
                <span className="stat-value">180ms</span>
                <span className="stat-label">Average extraction time</span>
              </div>
              <div className="stat">
                <span className="stat-value">95%+</span>
                <span className="stat-label">First-try success rate</span>
              </div>
              <div className="stat">
                <span className="stat-value">5+</span>
                <span className="stat-label">Encryption schemes analyzed</span>
              </div>
            </div>
          </section>


          {/* Implementation */}
          <section id="implementation">
            <h2>7. Implementation Details</h2>
            
            <h3>6.1 The Streaming Pipeline</h3>
            <p>
              The streaming pipeline is the technical heart of the platform. When a user clicks play, 
              a carefully orchestrated sequence of events unfolds:
            </p>
            <ol>
              <li>The system queries multiple stream providers in parallel, because relying on a single 
              provider is a recipe for disappointment.</li>
              <li>Provider-specific decoders crack the obfuscation and extract playable URLs.</li>
              <li>The proxy layer handles CORS negotiation, header spoofing, and referrer manipulation.</li>
              <li>The clean stream is delivered to a custom video player that does not try to install 
              malware or mine cryptocurrency.</li>
              <li>If the primary source fails, the system automatically falls back to alternatives 
              without the user noticing anything except perhaps a brief loading indicator.</li>
            </ol>

            <h3>6.2 Analytics Without Surveillance</h3>
            <p>
              We wanted to understand how people use the platform without becoming the thing we were 
              fighting against. The solution: anonymized, aggregate analytics only.
            </p>
            <p>
              No personal information is collected. No cross-session tracking. No fingerprinting. 
              Just anonymous session identifiers that cannot be linked to real identities, aggregate 
              usage statistics, and content interaction data. Enough to understand what is working 
              and what is not, without knowing who anyone is.
            </p>
            <p>
              The analytics system uses a batched event model, accumulating events client-side and 
              flushing them periodically to minimize network overhead. Critical events like session 
              start and content completion are sent immediately; routine progress updates are batched. 
              This reduces API calls by approximately 80% compared to real-time event streaming.
            </p>

            <h3>6.3 The Numbers</h3>
            <div className="stats-grid">
              <div className="stat">
                <span className="stat-value">75K+</span>
                <span className="stat-label">Lines of code</span>
              </div>
              <div className="stat">
                <span className="stat-value">200+</span>
                <span className="stat-label">React components</span>
              </div>
              <div className="stat">
                <span className="stat-value">60+</span>
                <span className="stat-label">API endpoints</span>
              </div>
              <div className="stat">
                <span className="stat-value">20+</span>
                <span className="stat-label">Database tables</span>
              </div>
            </div>
          </section>

          {/* Feature Evolution */}
          <section id="features">
            <h2>8. Feature Evolution: December 2025</h2>
            
            <h3>8.1 The 10-Day Sprint</h3>
            <p>
              After the initial public release, we went into overdrive. Ten days of intense development, 
              driven by user feedback and our own frustration with missing features. The result was a 
              platform that went from &quot;functional proof of concept&quot; to &quot;genuinely 
              useful for research and demonstration purposes.&quot;
            </p>

            <h3>8.2 Casting: Finally, Your TV</h3>
            <p>
              The most requested feature by far. People wanted to watch on their TVs without HDMI 
              cables, and honestly, so did we.
            </p>
            <p>
              We implemented casting using native browser APIs—Remote Playback API for Chromecast 
              (Chrome/Edge) and WebKit&apos;s playback target picker for AirPlay (Safari/iOS). No 
              third-party SDKs, no bloat, just clean integration that works.
            </p>
            <p>
              Hit the cast button, pick your device, and you are watching on the big screen. The 
              implementation was surprisingly clean once we stopped trying to use deprecated Google 
              Cast SDKs and embraced the modern standards.
            </p>

            <h3>8.3 TV Navigation: The Couch Experience</h3>
            <p>
              Building spatial navigation for a web app is harder than it sounds. &quot;Which element 
              is above this one?&quot; seems simple until you have a responsive grid layout where 
              elements wrap differently at different screen sizes.
            </p>
            <p>
              We built a custom navigation system from scratch:
            </p>
            <ul>
              <li>Arrow keys navigate the entire UI</li>
              <li>Enter/Space to select</li>
              <li>Automatic scrolling to keep focused elements visible</li>
              <li>Group-aware navigation (left/right within rows, up/down between sections)</li>
              <li>Works on Fire TV, Android TV, or any device with a D-pad</li>
            </ul>
            <p>
              The player has its own keyboard controls too—seek with arrow keys, volume with up/down, 
              fullscreen with F, mute with M. Everything you need without touching a mouse.
            </p>

            <h3>8.4 Subtitles: 29 Languages and Actually Usable</h3>
            <p>
              Subtitles on pirate streaming sites are usually an afterthought. Wrong language, out 
              of sync, hardcoded into the video, or just missing entirely. We fixed all of it.
            </p>
            <div className="feature-detail">
              <h4>OpenSubtitles Integration</h4>
              <p>
                29 languages with quality scoring. The system automatically picks the highest-rated 
                subtitle based on download count and user ratings. No more scrolling through 47 
                versions of the same subtitle trying to find one that is not garbage.
              </p>
            </div>
            <div className="feature-detail">
              <h4>Subtitle Sync Adjustment</h4>
              <p>
                This was the feature that made us want to throw our keyboard during development. 
                Subs out of sync? Hit G to delay by 0.5 seconds, H to advance. Keep tapping until 
                it lines up. Reset button to go back to original timing.
              </p>
            </div>
            <div className="feature-detail">
              <h4>Custom Upload</h4>
              <p>
                Drop in your own .SRT or .VTT files when the built-in subs are not good enough. 
                Perfect for obscure content or when you have a better version.
              </p>
            </div>
            <div className="feature-detail">
              <h4>Style Customization</h4>
              <p>
                Font size (50% to 200%), background opacity, text color, vertical position. All 
                preferences saved locally. Make them look however you want.
              </p>
            </div>

            <h3>8.5 AnimeKai: Anime Done Right</h3>
            <p>
              Anime fans have suffered long enough. The dedicated anime streaming sites are somehow 
              even worse than the general pirate sites—more ads, more pop-ups, more malware, and 
              players that buffer every 30 seconds.
            </p>
            <p>
              AnimeKai integration gives anime content its own dedicated provider with features 
              that actually matter:
            </p>
            <ul>
              <li><strong>Sub/Dub Toggle:</strong> One click to switch between Japanese audio with 
              subtitles and English dub. No hunting through server lists.</li>
              <li><strong>Preference Memory:</strong> If you are a dub person, it remembers and 
              always loads dubs first. Same for sub preference.</li>
              <li><strong>Multiple Servers:</strong> Mega, Yuki, and others with automatic fallback.</li>
              <li><strong>Auto-Detection:</strong> If TMDB says it is Japanese animation, you get 
              AnimeKai automatically. No manual switching.</li>
            </ul>

            <h3>8.6 Mobile: Pinch-to-Zoom</h3>
            <p>
              Mobile users wanted to crop out black bars on ultrawide content. Fair request.
            </p>
            <ul>
              <li>Double-tap for 2x zoom</li>
              <li>Pinch to zoom up to 4x</li>
              <li>Single tap to pause/play</li>
              <li>Smooth gesture handling that does not fight with the browser</li>
            </ul>
            <p>
              The touch event math was rewritten three times before it stopped feeling janky. Worth it.
            </p>

            <h3>8.7 Continue Watching</h3>
            <p>
              The homepage now shows your in-progress content with progress bars. Click and you are 
              right back where you left off.
            </p>
            <ul>
              <li>Works for movies and TV shows</li>
              <li>Full episode tracking (S2E7, etc.)</li>
              <li>Filters out completed content and accidental clicks (less than 2% progress)</li>
              <li>All stored locally—no accounts, no tracking</li>
            </ul>

            <h3>8.8 Auto-Play Next Episode</h3>
            <p>
              For the binge watchers who do not want to lift a finger between episodes:
            </p>
            <ul>
              <li>Countdown timer at the end of episodes</li>
              <li>Skip button if you are impatient</li>
              <li>Configurable countdown time (5-30 seconds)</li>
              <li>Can disable it entirely if you hate it</li>
            </ul>

            <h3>8.9 Region Filter</h3>
            <p>
              Filter content by country. 35+ regions—US, UK, Korea, Japan, etc. See what is trending 
              in specific markets. Useful for finding content that is popular somewhere but does not 
              show up in global trending.
            </p>
          </section>

          {/* Results */}
          <section id="results">
            <h2>9. Results &amp; Analysis</h2>
            
            <h3>7.1 Primary Findings</h3>
            <p>
              After seven months of development, countless debugging sessions, and an amount of Monster Energy 
              that probably qualifies as a medical concern, we can report the following findings:
            </p>

            <div className="findings">
              <div className="finding">
                <span className="number">1</span>
                <div>
                  <h4>Exploitation Is Optional</h4>
                  <p>Flyx operates without advertisements, tracking, or malware while providing 
                  functional streaming. This proves that exploitative practices on pirate sites are 
                  profit-maximizing choices, not technical or economic requirements. They could do 
                  better. They choose not to.</p>
                </div>
              </div>
              <div className="finding">
                <span className="number">2</span>
                <div>
                  <h4>Zero-Cost Operation Is Achievable</h4>
                  <p>The platform runs entirely on free tiers. Vercel handles hosting. Neon handles 
                  the database. The &quot;we need aggressive ads to pay for servers&quot; argument 
                  is demonstrably false for aggregator-style platforms.</p>
                </div>
              </div>
              <div className="finding">
                <span className="number">3</span>
                <div>
                  <h4>Privacy and Functionality Coexist</h4>
                  <p>Useful analytics can be collected without PII. Watch progress syncs without 
                  accounts. The platform works without knowing who you are, which is how it should be.</p>
                </div>
              </div>
              <div className="finding">
                <span className="number">4</span>
                <div>
                  <h4>Solo Development Is Feasible</h4>
                  <p>One person, working part-time, can build a production-quality streaming platform. 
                  Modern tools have lowered the barrier to entry dramatically. The excuse that 
                  &quot;it is too hard&quot; no longer holds.</p>
                </div>
              </div>
            </div>

            <h3>7.2 Performance Metrics</h3>
            <p>
              Despite the complexity of the system, performance remains strong. Lighthouse scores 
              consistently hit 90+ across all categories, which is better than most &quot;legitimate&quot; 
              streaming services we tested for comparison.
            </p>
          </section>

          {/* Discussion */}
          <section id="discussion">
            <h2>10. Discussion</h2>
            
            <h3>8.1 Implications</h3>
            <p>
              The existence of Flyx has implications that extend beyond the technical. It demonstrates 
              that the exploitative practices endemic to pirate streaming are not inevitable. They are 
              choices made by operators who prioritize profit over users.
            </p>
            <p>
              This matters because it shifts the moral calculus. When exploitation was assumed to be 
              necessary, users could rationalize accepting it as the price of free content. Now that 
              we have demonstrated an alternative exists, that rationalization becomes harder to 
              maintain. The operators of exploitative platforms can no longer hide behind claims of 
              necessity. Their practices are revealed for what they are: greed.
            </p>

            <h3>8.2 Limitations</h3>
            <p>
              We would be remiss not to acknowledge the limitations of this work:
            </p>
            <ul>
              <li>The platform depends on third-party stream providers that may change their 
              obfuscation at any time, requiring ongoing maintenance.</li>
              <li>The legal status of content aggregation remains ambiguous in many jurisdictions.</li>
              <li>The author&apos;s Monster Energy consumption during development may have reached levels 
              that are not medically advisable.</li>
              <li>Some features that users expect from commercial platforms (recommendations, 
              multiple profiles, offline viewing) are not yet implemented.</li>
            </ul>

            <h3>8.3 The Cat-and-Mouse Reality</h3>
            <p>
              Reverse engineering streaming providers is an ongoing battle. Providers regularly update 
              their obfuscation, change their API endpoints, and implement new detection mechanisms. 
              What works today may fail tomorrow.
            </p>
            <p>
              The system is architected with this reality in mind. Provider-specific adapters can be 
              updated independently. Automated health checks monitor extraction success rates. When 
              something breaks, we know about it quickly and can respond before users notice 
              widespread failures.
            </p>
            <p>
              It is exhausting. But it is also, in a strange way, satisfying. Every time a provider 
              updates their protection and we crack it again, we prove that their fortress is not as 
              impenetrable as they thought.
            </p>
          </section>

          {/* Future Work */}
          <section id="future">
            <h2>11. Future Work</h2>
            <p>
              Flyx is not done. It works, but &quot;works&quot; is a low bar. Here is what we have 
              accomplished since initial release, and what remains on the roadmap:
            </p>
            
            <h3>11.1 Completed Since Initial Release</h3>
            <ul>
              <li><strong>Provider Migration:</strong> Successfully transitioned from 2Embed and 
              MoviesAPI to Vidsrc and Videasy as primary sources. Extraction reliability improved 
              significantly.</li>
              <li><strong>Live TV Support:</strong> Added live television streaming with channel 
              guides and real-time playback via mpegts.js integration.</li>
              <li><strong>Anime Integration:</strong> AnimeKai provider added for dedicated anime 
              streaming with sub/dub toggle and preference memory.</li>
              <li><strong>Admin Dashboard:</strong> Real-time analytics, user activity monitoring, 
              and system health metrics for platform management.</li>
              <li><strong>Region Selection:</strong> Users can now select their preferred content 
              region for localized results across 35+ countries.</li>
            </ul>

            <h3>11.2 December 2025 Feature Drop</h3>
            <ul>
              <li><strong>Chromecast &amp; AirPlay:</strong> Cast to your TV using native browser 
              APIs. No third-party SDKs, just clean integration.</li>
              <li><strong>TV Remote Navigation:</strong> Full spatial navigation built from scratch. 
              Arrow keys navigate everything. Works on Fire TV, Android TV, any D-pad device.</li>
              <li><strong>29-Language Subtitles:</strong> OpenSubtitles integration with quality 
              scoring to auto-pick the best version. Upload your own .SRT/.VTT files.</li>
              <li><strong>Subtitle Sync:</strong> Hit G/H to adjust timing by 0.5 seconds. No more 
              watching with dialogue that is 2 seconds behind.</li>
              <li><strong>Subtitle Customization:</strong> Font size, background opacity, text color, 
              vertical position. All preferences saved locally.</li>
              <li><strong>Pinch-to-Zoom:</strong> Double-tap for 2x, pinch up to 4x. Crop out black 
              bars on mobile.</li>
              <li><strong>Continue Watching:</strong> Homepage shows in-progress content with progress 
              bars. Click to resume exactly where you left off.</li>
              <li><strong>Auto-Play Next Episode:</strong> Countdown timer at end of episodes with 
              configurable duration. Skip button for the impatient.</li>
            </ul>

            <h3>11.3 Still on the Roadmap</h3>
            <ul>
              <li><strong>Smart Recommendations:</strong> Privacy-preserving personalization that 
              learns what you like without tracking who you are.</li>
              <li><strong>Progressive Web App:</strong> Offline capability and app-like experience 
              without going through app stores that would definitely reject us.</li>
              <li><strong>Internationalization:</strong> Multiple UI languages, RTL support for 
              Arabic/Hebrew users.</li>
              <li><strong>Provider Redundancy:</strong> Continuing to expand backup providers for 
              when primary sources inevitably break.</li>
              <li><strong>Watch Parties:</strong> Synchronized viewing with friends. Because watching 
              alone is sometimes sad.</li>
            </ul>
          </section>

          {/* Conclusion */}
          <section id="conclusion">
            <h2>12. Conclusion</h2>
            <p className="lead">
              We built a streaming platform. It works. It does not assault users with pop-ups, mine 
              cryptocurrency on their CPUs, or track them across the web. And we did it alone, 
              part-time, with no budget, over seven months of evenings and weekends (and counting).
            </p>
            <p>
              Then thousands of people started using it. They sent feedback. They requested features. 
              They shared their own horror stories about the pirate streaming ecosystem. And we 
              listened. Ten days of intense development later, the platform went from &quot;functional 
              proof of concept&quot; to something genuinely useful—a real demonstration that 
              privacy-respecting streaming is technically feasible.
            </p>
            <p>
              Chromecast. AirPlay. TV remote navigation. 29-language subtitles with sync adjustment. 
              Anime with sub/dub toggle. Continue watching. Auto-play next episode. All built by one 
              person, still with no budget, still without exploiting a single user.
            </p>
            <p>
              That is the point. Not that we are special (we are not). The point is that if one person 
              can do this under these constraints, then every pirate streaming site that serves 
              malware is making a choice. They could treat users like humans instead of revenue 
              sources. They choose not to because exploitation is more profitable than ethics.
            </p>
            <blockquote>
              &quot;The pop-ups are not necessary. The crypto miners are not necessary. The tracking 
              is not necessary. They are choices. And those choices tell you everything you need to 
              know about the people making them.&quot;
            </blockquote>
            <p>
              The pirate sites have noticed. Some are updating their obfuscation. One even offered 
              us intel on their competitors. The ecosystem is eating itself while we keep building 
              something better.
            </p>
            <p>
              To users: you deserve better. You do not have to accept malware as the price of free 
              content. Alternatives can exist.
            </p>
            <p>
              To developers: if you have the skills to build something, build something good. The 
              world has enough exploitative garbage.
            </p>
            <p>
              To the operators of pirate streaming sites: we see you. We know what you are doing. 
              And we built this specifically to prove that you do not have to do it. Your greed is 
              a choice, and that choice defines you.
            </p>
            <p>
              Flyx exists because we got tired of watching the internet get worse. It is a small 
              thing: one platform, one developer, one statement. But it is proof that better is 
              possible. And sometimes, proof is enough.
            </p>
          </section>


          {/* Legal Framework */}
          <section id="legal">
            <h2>13. Legal Framework</h2>
            
            <div className="legal-notice">
              <p>
                <strong>IMPORTANT:</strong> The following constitutes a binding legal agreement. By 
                accessing or using Flyx, you acknowledge that you have read, understood, and agree 
                to be bound by these terms in their entirety.
              </p>
            </div>

            <h3>11.1 Nature and Purpose of Service</h3>
            <p>
              Flyx (&quot;the Platform,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) is a 
              personal, non-commercial technology demonstration project created solely for educational, 
              research, and portfolio purposes. The Platform is designed to showcase modern web 
              development techniques, architectural patterns, and the capabilities of contemporary 
              development tools.
            </p>
            <p>
              The Platform does not constitute a commercial streaming service and is not intended to 
              compete with, replace, or substitute for any licensed streaming platform or content 
              distribution service. It exists purely as a technical demonstration and learning exercise.
            </p>
            <p>
              No fees are charged for access to the Platform. The project generates no revenue and 
              operates at zero profit. Any costs associated with hosting and operation are borne 
              entirely by the developer as part of the educational exercise.
            </p>
            <p>
              The Platform may be discontinued, modified, or removed at any time without notice, as 
              befits its nature as a personal project rather than a commercial service with service 
              level agreements.
            </p>

            <h3>11.2 Content Disclaimer and Third-Party Sources</h3>
            <p>
              <strong>THE PLATFORM DOES NOT HOST, STORE, UPLOAD, TRANSMIT, OR DISTRIBUTE ANY VIDEO 
              CONTENT, MEDIA FILES, OR COPYRIGHTED MATERIALS ON ITS SERVERS OR INFRASTRUCTURE.</strong>
            </p>
            <p>
              All media content accessible through the Platform is sourced from third-party providers, 
              publicly available APIs, and external hosting services over which we exercise no control 
              and bear no responsibility for availability, accuracy, legality, or quality.
            </p>
            <p>
              The Platform functions as a technical interface (analogous to a web browser or search 
              engine) that facilitates access to content hosted elsewhere on the internet. We do not 
              select, curate, edit, modify, or exercise editorial control over the content accessible 
              through the Platform.
            </p>
            <p>
              We make no representations or warranties regarding the legality, accuracy, quality, 
              safety, or appropriateness of any third-party content. Users access such content 
              entirely at their own risk and discretion.
            </p>
            <p>
              The inclusion of any content accessible through the Platform does not constitute 
              endorsement, sponsorship, recommendation, or affiliation with the content creators, 
              rights holders, or hosting providers.
            </p>

            <h3>11.3 Intellectual Property and DMCA Compliance</h3>
            <p>
              We respect the intellectual property rights of others and expect users of the Platform 
              to do the same. We comply with the provisions of the Digital Millennium Copyright Act 
              (DMCA), 17 U.S.C. § 512, and similar international copyright frameworks.
            </p>
            
            <div className="dmca-notice">
              <h4>🏴‍☠️ A Note to Rights Holders Considering a DMCA Notice</h4>
              <p>
                Before you send that takedown request, let us be crystal clear about what Flyx actually is:
              </p>
              <p>
                <strong>We do not host any content. Not a single frame. Not one byte of video data.</strong>
              </p>
              <p>
                What we do is reverse engineer the obfuscation and security measures of <em>pirate streaming 
                sites</em>—the same sites that are actually profiting from your content through malware, 
                cryptocurrency mining, and aggressive advertising. We extract streams from <em>their</em> 
                infrastructure and present them without the exploitation.
              </p>
              <p>
                In other words: we are stealing from the people who are stealing from you.
              </p>
              <p>
                <strong>Here&apos;s the thing:</strong> We have spent hundreds of hours reverse engineering 
                these pirate operations. We know how they work. We know where they host. We know their 
                infrastructure, their CDN providers, their obfuscation techniques, and their operational 
                patterns. We have documentation on their systems that would make your legal team very happy.
              </p>
              <p>
                <strong>We would be more than happy to share our findings.</strong>
              </p>
              <p>
                If you want to actually stop the infringement at its source, we can point you to the 
                real hosts—the ones making money off your content. We can provide technical details about 
                their infrastructure, help identify their hosting providers, and share intelligence that 
                would be far more useful than sending a takedown notice to a site that literally does not 
                have your content on its servers.
              </p>
              <p>
                Your fight is with them, not us. But we are happy to help you fight them.
              </p>
            </div>

            <p>
              That said, if you still wish to submit a DMCA notice, we will promptly investigate and, 
              where appropriate, remove or disable access to any links, references, or technical 
              integrations that facilitate access to allegedly infringing material.
            </p>
            <p>
              To submit a valid DMCA takedown notice, please provide:
            </p>
            <ul>
              <li>Identification of the copyrighted work claimed to be infringed</li>
              <li>Identification of the material claimed to be infringing and information reasonably 
              sufficient to locate it on the Platform</li>
              <li>Your contact information (name, address, telephone number, email address)</li>
              <li>A statement that you have a good faith belief that use of the material in the 
              manner complained of is not authorized by the copyright owner, its agent, or the law</li>
              <li>A statement, made under penalty of perjury, that the information in the notification 
              is accurate and that you are authorized to act on behalf of the owner of an exclusive 
              right that is allegedly infringed</li>
              <li>Your physical or electronic signature</li>
            </ul>
            <p>
              <strong>But seriously:</strong> Reach out first. We would rather help you take down the 
              actual pirates than play legal whack-a-mole with a site that is, ironically, on your side.
            </p>

            <h3>11.4 Disclaimer of Warranties</h3>
            <p>
              <strong>THE PLATFORM IS PROVIDED ON AN &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; 
              BASIS WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT 
              LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, 
              TITLE, AND NON-INFRINGEMENT.</strong>
            </p>
            <p>
              We do not warrant that: (a) the Platform will meet your requirements; (b) the Platform 
              will be uninterrupted, timely, secure, or error-free; (c) the results obtained from 
              use of the Platform will be accurate or reliable; (d) the quality of any content or 
              services obtained through the Platform will meet your expectations; or (e) any errors 
              in the Platform will be corrected.
            </p>
            <p>
              Any content downloaded or otherwise obtained through the Platform is accessed at your 
              own discretion and risk, and you will be solely responsible for any damage to your 
              computer system or loss of data that results from such access.
            </p>
            <p>
              No advice or information, whether oral or written, obtained by you from us or through 
              the Platform shall create any warranty not expressly stated in these terms.
            </p>

            <h3>11.5 Limitation of Liability</h3>
            <p>
              <strong>TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL THE 
              PLATFORM, ITS DEVELOPER, OR ANY AFFILIATED PARTIES BE LIABLE FOR ANY INDIRECT, 
              INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, INCLUDING BUT 
              NOT LIMITED TO DAMAGES FOR LOSS OF PROFITS, GOODWILL, USE, DATA, OR OTHER INTANGIBLE 
              LOSSES.</strong>
            </p>
            <p>
              This limitation applies regardless of whether such damages arise from: (a) your access 
              to, use of, or inability to access or use the Platform; (b) any conduct or content of 
              any third party on or accessed through the Platform; (c) any content obtained from or 
              through the Platform; (d) unauthorized access, use, or alteration of your transmissions 
              or content; or (e) any other matter relating to the Platform.
            </p>
            <p>
              In no event shall our total liability to you for all claims arising from or relating 
              to the Platform exceed the amount you paid us in the twelve (12) months preceding the 
              claim, which, given the free nature of the Platform, is zero dollars ($0.00).
            </p>
            <p>
              Some jurisdictions do not allow the exclusion of certain warranties or the limitation 
              or exclusion of liability for incidental or consequential damages. Accordingly, some 
              of the above limitations may not apply to you. In such jurisdictions, our liability 
              is limited to the greatest extent permitted by law.
            </p>

            <h3>11.6 User Responsibilities and Prohibited Conduct</h3>
            <p>
              By using the Platform, you represent and warrant that you are at least 18 years of age 
              or the age of majority in your jurisdiction, whichever is greater, or are using the 
              Platform under the supervision of a parent or legal guardian who agrees to be bound 
              by these terms.
            </p>
            <p>
              You agree to comply with all applicable local, state, national, and international laws 
              and regulations in connection with your use of the Platform.
            </p>
            <p>
              You agree NOT to:
            </p>
            <ul>
              <li>Use the Platform for any unlawful purpose or in violation of any applicable laws</li>
              <li>Attempt to gain unauthorized access to any portion of the Platform or any systems 
              or networks connected to the Platform</li>
              <li>Interfere with or disrupt the Platform or servers or networks connected to the 
              Platform</li>
              <li>Use any automated means, including robots, spiders, or scrapers, to access the 
              Platform for any purpose without our express written permission</li>
              <li>Circumvent, disable, or otherwise interfere with security-related features of the 
              Platform</li>
              <li>Transmit any viruses, worms, defects, Trojan horses, or other items of a destructive 
              nature</li>
              <li>Impersonate any person or entity or falsely state or misrepresent your affiliation 
              with any person or entity</li>
              <li>Collect or store personal data about other users without their consent</li>
            </ul>

            <h3>11.7 Privacy and Data Practices</h3>
            <p>
              We are committed to protecting your privacy. The Platform employs anonymized tracking 
              for analytics purposes only and does not collect personally identifiable information.
            </p>
            <p>
              <strong>What We Do NOT Collect:</strong>
            </p>
            <ul>
              <li>Names, email addresses, or other personal identifiers</li>
              <li>Physical addresses or location data beyond general geographic region</li>
              <li>Phone numbers or other contact information</li>
              <li>Government-issued identification numbers</li>
              <li>Payment or financial information</li>
              <li>Biometric data</li>
              <li>Information about your activities on other websites</li>
            </ul>
            <p>
              <strong>What We Do Collect:</strong>
            </p>
            <ul>
              <li>Anonymous session identifiers that cannot be linked to real identities</li>
              <li>Aggregate usage statistics (page views, feature usage)</li>
              <li>Content interaction data (what content is popular)</li>
              <li>Technical performance metrics (load times, error rates)</li>
              <li>Anonymized error logs for debugging purposes</li>
            </ul>
            <p>
              No user data is sold, rented, leased, or otherwise transferred to third parties for 
              any purpose. Aggregate, anonymized analytics may be referenced in technical documentation 
              or presentations about the project.
            </p>
            <p>
              You may clear all locally stored data at any time by clearing your browser&apos;s local 
              storage and session storage. This will reset your anonymous identifier and any stored 
              preferences.
            </p>

            <h3>11.8 Indemnification</h3>
            <p>
              You agree to defend, indemnify, and hold harmless the Platform, its developer, and any 
              affiliated parties from and against any and all claims, liabilities, damages, judgments, 
              awards, losses, costs, expenses, and fees (including reasonable attorneys&apos; fees) 
              arising out of or relating to: (a) your violation of these terms; (b) your use of the 
              Platform; (c) your violation of any rights of any third party; (d) any content you 
              access through the Platform; or (e) your violation of any applicable laws, rules, or 
              regulations.
            </p>
            <p>
              We reserve the right, at our own expense, to assume the exclusive defense and control 
              of any matter otherwise subject to indemnification by you, in which event you will 
              cooperate with us in asserting any available defenses.
            </p>

            <h3>11.9 Dispute Resolution and Governing Law</h3>
            <p>
              These terms shall be governed by and construed in accordance with applicable laws, 
              without regard to principles of conflict of laws.
            </p>
            <p>
              Any dispute, controversy, or claim arising out of or relating to these terms or the 
              Platform shall first be attempted to be resolved through good-faith negotiation. If 
              negotiation fails, disputes shall be resolved through binding arbitration in accordance 
              with applicable arbitration rules.
            </p>
            <p>
              <strong>YOU UNDERSTAND AND AGREE THAT BY ENTERING INTO THESE TERMS, YOU AND THE 
              PLATFORM ARE EACH WAIVING THE RIGHT TO A TRIAL BY JURY AND THE RIGHT TO PARTICIPATE 
              IN A CLASS ACTION.</strong>
            </p>

            <h3>11.10 Modifications and Termination</h3>
            <p>
              We reserve the right to modify, suspend, or discontinue the Platform (or any part 
              thereof) at any time, with or without notice. We shall not be liable to you or any 
              third party for any modification, suspension, or discontinuance of the Platform.
            </p>
            <p>
              We may revise these terms from time to time. The most current version will always be 
              available on the Platform. By continuing to access or use the Platform after revisions 
              become effective, you agree to be bound by the revised terms.
            </p>
            <p>
              We may terminate or suspend your access to the Platform immediately, without prior 
              notice or liability, for any reason whatsoever, including without limitation if you 
              breach these terms.
            </p>

            <h3>11.11 Severability and Entire Agreement</h3>
            <p>
              If any provision of these terms is held to be invalid, illegal, or unenforceable by a 
              court of competent jurisdiction, such provision shall be modified to the minimum extent 
              necessary to make it valid and enforceable, or if modification is not possible, shall 
              be severed from these terms, and the remaining provisions shall continue in full force 
              and effect.
            </p>
            <p>
              These terms constitute the entire agreement between you and the Platform regarding your 
              use of the Platform and supersede all prior agreements, understandings, negotiations, 
              and discussions, whether oral or written.
            </p>
            <p>
              No waiver of any term or condition of these terms shall be deemed a further or continuing 
              waiver of such term or any other term, and our failure to assert any right or provision 
              under these terms shall not constitute a waiver of such right or provision.
            </p>

            <div className="legal-footer">
              <p><strong>Effective Date:</strong> November 2025</p>
              <p><strong>Last Updated:</strong> December 2025</p>
              <p><strong>Version:</strong> 1.1</p>
            </div>
          </section>

          {/* References */}
          <section id="references">
            <h2>14. References</h2>
            <div className="references">
              <p>[1] Rafique, M. Z., Van Goethem, T., Joosen, W., Huygens, C., &amp; Nikiforakis, N. 
              (2016). It&apos;s free for a reason: Exploring the ecosystem of free live streaming 
              services. <em>Network and Distributed System Security Symposium (NDSS)</em>.</p>
              
              <p>[2] Konoth, R. K., Vineti, E., Moonsamy, V., Lindorfer, M., Kruegel, C., Bos, H., 
              &amp; Vigna, G. (2018). MineSweeper: An in-depth look into drive-by cryptocurrency 
              mining and its defense. <em>ACM Conference on Computer and Communications Security 
              (CCS)</em>.</p>
              
              <p>[3] Laperdrix, P., Bielova, N., Baudry, B., &amp; Avoine, G. (2020). Browser 
              fingerprinting: A survey. <em>ACM Transactions on the Web</em>, 14(2), 1-33.</p>
              
              <p>[4] Gray, C. M., Kou, Y., Battles, B., Hoggatt, J., &amp; Toombs, A. L. (2018). 
              The dark (patterns) side of UX design. <em>CHI Conference on Human Factors in 
              Computing Systems</em>, 1-14.</p>
              
              <p>[5] Mathur, A., Acar, G., Friedman, M. J., Lucherini, E., Mayer, J., Chetty, M., 
              &amp; Narayanan, A. (2019). Dark patterns at scale: Findings from a crawl of 11K 
              shopping websites. <em>ACM Human-Computer Interaction</em>, 3(CSCW), 1-32.</p>
              
              <p>[6] Nikiforakis, N., Kapravelos, A., Joosen, W., Kruegel, C., Piessens, F., &amp; 
              Vigna, G. (2013). Cookieless monster: Exploring the ecosystem of web-based device 
              fingerprinting. <em>IEEE Symposium on Security and Privacy</em>, 541-555.</p>
              
              <p>[7] Englehardt, S., &amp; Narayanan, A. (2016). Online tracking: A 1-million-site 
              measurement and analysis. <em>ACM Conference on Computer and Communications Security 
              (CCS)</em>, 1388-1401.</p>
              
              <p>[8] Stockhammer, T. (2011). Dynamic adaptive streaming over HTTP: standards and 
              design principles. <em>ACM Conference on Multimedia Systems</em>, 133-144.</p>
            </div>
          </section>

          <div className="back-link">
            <Link href="/">← Return to Flyx</Link>
          </div>
        </main>
      </div>
    </div>
  );
}
