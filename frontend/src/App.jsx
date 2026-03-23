import { useState, useEffect, useCallback, useRef, useMemo, memo } from "react";

/*
 CrowdShield v3 — Advanced Real-Time Frontend
 ─────────────────────────────────────────────
 WebSocket topics (STOMP/SockJS):
   /topic/zones      → zones + stats on every count change
   /topic/live       → GPS users on every phone ping
   /topic/alerts     → alerts on create/ack
   /topic/incidents  → incidents on create/update
   /topic/stats      → aggregate stats every 8s
   /topic/evacuation → evacuation mode events

 REST fallback polling every 8s.
 New features: Evacuation mode, density history charts,
 sparklines, CSV export, search/filter, keyboard shortcuts,
 audit log, notification sounds, zone analytics.
*/

// In dev: CRA proxy (package.json "proxy") forwards /api/* → localhost:8080/api/*
// In prod: set REACT_APP_API_URL to your backend URL (e.g. https://yourapp.onrender.com/api)
const API    = process.env.REACT_APP_API_URL || "/api";
// In dev: setupProxy.js proxies /ws → localhost:8080/ws
// In prod: set REACT_APP_WS_URL to your backend (e.g. https://yourapp.onrender.com/ws)
const WS_URL = process.env.REACT_APP_WS_URL  || (window.location.origin + "/ws");
const HISTORY_MAX = 30; // data points per zone

/* ═══════════════════════════════════════════════════════
   THEMES
═══════════════════════════════════════════════════════ */
const mkTheme = (dark) => ({
  isDark: dark,
  bg:       dark ? "#0e0e0d" : "#f6f6f4",
  card:     dark ? "#1a1a18" : "#ffffff",
  surface:  dark ? "#131312" : "#f1f1ef",
  surface2: dark ? "#222220" : "#e8e8e4",
  border:   dark ? "#272725" : "#e4e4e0",
  border2:  dark ? "#363633" : "#d0d0ca",
  text:     dark ? "#eeeeea" : "#191917",
  sub:      dark ? "#8a8a84" : "#5c5c57",
  muted:    dark ? "#555552" : "#9e9e98",
  safe:     dark ? "#34c472" : "#1a7a4a",
  safeBg:   dark ? "#0a1e12" : "#ecf7f1",
  warn:     dark ? "#f0b429" : "#8a5c00",
  warnBg:   dark ? "#1c1200" : "#fdf6e3",
  crit:     dark ? "#f03e5e" : "#8a1a2a",
  critBg:   dark ? "#1e0a0e" : "#fdeef0",
  evac:     dark ? "#b06cff" : "#5510cc",
  evacBg:   dark ? "#130a24" : "#f0e8ff",
  info:     dark ? "#4d9fff" : "#1a4a8a",
  infoBg:   dark ? "#080f20" : "#eef3fd",
  accent:   dark ? "#4d9fff" : "#1a4a8a",
  user:     dark ? "#f0b429" : "#7a4a00",
  nav:      dark ? "#1a1a18" : "#ffffff",
  sh:       dark ? "0 1px 3px rgba(0,0,0,.4)" : "0 1px 4px rgba(0,0,0,.07)",
  sh2:      dark ? "0 4px 20px rgba(0,0,0,.5)" : "0 4px 20px rgba(0,0,0,.1)",
  mapFilter: dark ? "invert(1) hue-rotate(180deg) saturate(.55) brightness(.45) contrast(1.3)"
                  : "saturate(.8) brightness(1.03) sepia(.05)",
});

/* ═══════════════════════════════════════════════════════
   CSS BUILDER
═══════════════════════════════════════════════════════ */
const buildCSS = (T) => `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html{scroll-behavior:smooth;}
body{font-family:'Plus Jakarta Sans',sans-serif;font-size:14px;line-height:1.55;background:${T.bg};color:${T.text};min-height:100vh;transition:background .3s,color .3s;}
::-webkit-scrollbar{width:3px;height:3px;}::-webkit-scrollbar-track{background:transparent;}
::-webkit-scrollbar-thumb{background:${T.border2};border-radius:3px;}

@keyframes fu{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
@keyframes si{from{opacity:0;transform:translateX(8px)}to{opacity:1;transform:translateX(0)}}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.2}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes ping{0%{transform:scale(1);opacity:.8}70%{transform:scale(2.4);opacity:0}100%{opacity:0}}
@keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-4px)}40%,80%{transform:translateX(4px)}}
@keyframes glowPulse{0%,100%{box-shadow:0 0 0 0 currentColor}50%{box-shadow:0 0 12px 3px currentColor}}
@keyframes countUp{from{transform:scale(1.3);color:inherit}to{transform:scale(1)}}
.fu{animation:fu .3s cubic-bezier(.22,1,.36,1) both;}
.si{animation:si .26s cubic-bezier(.22,1,.36,1) both;}
.blink{animation:blink 2s ease-in-out infinite;}
.shake{animation:shake .4s ease-out;}
.flash-val{animation:countUp .4s ease-out;}

/* HEADER */
header{background:${T.nav};border-bottom:1px solid ${T.border};height:54px;padding:0 22px;
  display:flex;align-items:center;gap:16px;position:sticky;top:0;z-index:300;
  transition:background .3s,border-color .3s;}
.logo{display:flex;align-items:center;gap:9px;flex-shrink:0;text-decoration:none;}
.logo-mark{width:30px;height:30px;border-radius:7px;background:${T.text};color:${T.bg};
  display:flex;align-items:center;justify-content:center;font-size:14px;transition:background .3s,color .3s;}
.logo-name{font-weight:800;font-size:14.5px;letter-spacing:-.3px;color:${T.text};transition:color .3s;}
.logo-name span{font-weight:300;opacity:.45;}
.hdiv{width:1px;height:18px;background:${T.border};flex-shrink:0;}
.top-nav{display:flex;gap:1px;flex:1;overflow-x:auto;}
.tn{background:none;border:none;color:${T.muted};padding:5px 10px;border-radius:7px;cursor:pointer;
  font-size:11.5px;font-weight:600;font-family:inherit;display:flex;align-items:center;gap:5px;
  position:relative;white-space:nowrap;transition:all .13s;}
.tn:hover{color:${T.sub};background:${T.border};}
.tn.on{color:${T.text};background:${T.surface};}
.tn-badge{position:absolute;top:3px;right:3px;width:5px;height:5px;border-radius:50%;animation:blink 2s ease-in-out infinite;}
.htools{display:flex;align-items:center;gap:10px;flex-shrink:0;}
.clk{font-size:11px;color:${T.muted};font-family:'DM Mono',monospace;min-width:64px;}
.live-chip{display:flex;align-items:center;gap:5px;background:${T.safeBg};border:1px solid ${T.safe}33;
  border-radius:20px;padding:3px 9px;}
.live-dot{width:5px;height:5px;border-radius:50%;background:${T.safe};animation:blink 1.8s ease-in-out infinite;}
.live-lbl{font-size:10px;font-weight:700;color:${T.safe};letter-spacing:.5px;}
.ws-badge{font-size:9.5px;font-weight:700;letter-spacing:.5px;padding:3px 8px;border-radius:5px;
  font-family:'DM Mono',monospace;transition:all .3s;}
.ws-live{background:${T.safeBg};color:${T.safe};}
.ws-conn{background:${T.infoBg};color:${T.info};}
.ws-poll{background:${T.warnBg};color:${T.warn};}
.tog{width:38px;height:21px;border-radius:11px;border:1px solid ${T.border2};background:${T.surface};
  cursor:pointer;position:relative;transition:all .28s;}
.knob{position:absolute;top:2px;left:${T.isDark?"19px":"2px"};width:15px;height:15px;border-radius:8px;
  background:${T.text};transition:left .3s cubic-bezier(.34,1.56,.64,1);
  display:flex;align-items:center;justify-content:center;font-size:8.5px;}
/* EVACUATION banner */
.evac-banner{background:${T.evac};color:#fff;padding:9px 22px;display:flex;align-items:center;
  justify-content:space-between;gap:12px;font-size:13px;font-weight:700;letter-spacing:.3px;
  animation:glowPulse .9s ease-in-out infinite;position:sticky;top:54px;z-index:299;}

/* LAYOUT */
main{display:flex;min-height:calc(100vh - 54px);}
.snav{width:188px;flex-shrink:0;border-right:1px solid ${T.border};padding:16px 12px;
  display:flex;flex-direction:column;gap:1px;position:sticky;top:54px;
  height:calc(100vh - 54px);overflow-y:auto;background:${T.nav};transition:background .3s,border-color .3s;}
.snav-sec{font-size:9.5px;font-weight:800;color:${T.muted};letter-spacing:1.8px;
  text-transform:uppercase;padding:13px 8px 5px;}
.snav-sec:first-child{padding-top:4px;}
.snav-btn{display:flex;align-items:center;gap:8px;padding:7px 9px;border-radius:7px;
  color:${T.sub};font-size:12.5px;font-weight:500;cursor:pointer;border:none;background:none;
  width:100%;text-align:left;font-family:inherit;transition:all .13s;position:relative;}
.snav-btn:hover{background:${T.border};color:${T.text};}
.snav-btn.on{background:${T.surface};color:${T.text};font-weight:600;}
.snav-ico{font-size:13px;width:18px;text-align:center;flex-shrink:0;}
.snav-badge{margin-left:auto;border-radius:99px;padding:1px 6px;font-size:9px;font-weight:700;
  font-family:'DM Mono',monospace;}
.snav-status{padding:9px 10px;margin-top:auto;border-top:1px solid ${T.border};
  font-size:10px;color:${T.muted};font-family:'DM Mono',monospace;line-height:1.9;}

.content{flex:1;padding:28px 32px;min-width:0;overflow-x:hidden;}
.tab-pane{display:none;animation:fu .28s cubic-bezier(.22,1,.36,1) both;}
.tab-pane.on{display:block;}

/* PAGE HEADER */
.ph{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;}
.ph-left{}
.ph-title{font-size:22px;font-weight:800;letter-spacing:-.5px;color:${T.text};line-height:1.2;}
.ph-sub{font-size:11px;color:${T.muted};margin-top:3px;font-family:'DM Mono',monospace;}
.ph-actions{display:flex;align-items:center;gap:8px;flex-shrink:0;}

/* STAT GRID */
.sc-grid{display:grid;gap:1px;border:1px solid ${T.border};border-radius:13px;
  overflow:hidden;margin-bottom:24px;background:${T.border};}
.sc{background:${T.card};padding:18px 20px;transition:background .2s;cursor:default;}
.sc:hover{background:${T.surface};}
.sc-val{font-size:26px;font-weight:800;letter-spacing:-1.5px;font-family:'DM Mono',monospace;
  color:${T.text};line-height:1;transition:color .3s;}
.sc-lbl{font-size:9.5px;font-weight:700;color:${T.muted};margin-top:6px;
  text-transform:uppercase;letter-spacing:.9px;}
.sc-sub{font-size:10px;color:${T.muted};margin-top:2px;font-family:'DM Mono',monospace;}
.sc-trend{font-size:10px;font-family:'DM Mono',monospace;margin-top:4px;}

/* CARD */
.card{background:${T.card};border:1px solid ${T.border};border-radius:12px;
  transition:background .3s,border-color .3s,box-shadow .18s;}
.card:hover{box-shadow:${T.sh2};}
.cp{padding:17px 20px;}
.ch{display:flex;justify-content:space-between;align-items:center;
  padding:12px 20px;border-bottom:1px solid ${T.border};}
.ch-title{font-size:12.5px;font-weight:700;color:${T.text};}
.ch-sub{font-size:11px;color:${T.muted};}

/* DENSITY BAR */
.dbar{height:4px;background:${T.border};border-radius:2px;overflow:hidden;margin-top:7px;}
.dfill{height:100%;border-radius:2px;transition:width .6s cubic-bezier(.4,0,.2,1);}
.drow{display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;}
.dlbl{font-size:9.5px;font-weight:700;color:${T.muted};text-transform:uppercase;letter-spacing:.8px;}
.dval{font-size:10.5px;font-weight:700;font-family:'DM Mono',monospace;}

/* SPARKLINE */
.spark{display:flex;align-items:flex-end;gap:1.5px;height:22px;margin-top:5px;}
.spark-bar{min-width:2.5px;border-radius:1px;transition:height .4s ease;}

/* TABLE */
.tbl{width:100%;border-collapse:collapse;}
.tbl th{font-size:9.5px;font-weight:800;color:${T.muted};text-transform:uppercase;
  letter-spacing:1.1px;padding:0 16px 10px;text-align:left;border-bottom:1px solid ${T.border};}
.tbl td{padding:11px 16px;border-bottom:1px solid ${T.border};vertical-align:middle;}
.tbl tr:last-child td{border-bottom:none;}
.tbl tr:hover td{background:${T.surface};}
.tz-name{font-weight:700;color:${T.text};font-size:13px;}
.tz-meta{font-size:10.5px;color:${T.muted};margin-top:1px;}

/* LIST ROW */
.lr{display:flex;justify-content:space-between;align-items:center;gap:12px;
  padding:12px 20px;border-bottom:1px solid ${T.border};transition:background .12s;}
.lr:last-child{border-bottom:none;}
.lr:hover{background:${T.surface};}
.lr-title{font-size:13px;font-weight:700;color:${T.text};}
.lr-sub{font-size:11px;color:${T.muted};margin-top:1.5px;}
.lr-time{font-size:9.5px;color:${T.muted};font-family:'DM Mono',monospace;margin-top:2px;}

/* MAP */
.map-layout{display:grid;grid-template-columns:1fr 300px;gap:15px;}
.map-wrap{background:${T.card};border:1px solid ${T.border};border-radius:12px;
  position:relative;overflow:hidden;transition:border-color .3s;}
.map-legend{position:absolute;bottom:12px;right:12px;z-index:500;background:${T.card}ee;
  border:1px solid ${T.border};border-radius:9px;padding:9px 12px;
  box-shadow:${T.sh};backdrop-filter:blur(6px);}
.ml-title{font-size:9px;font-weight:800;color:${T.muted};letter-spacing:1.8px;
  text-transform:uppercase;margin-bottom:6px;}
.ml-row{display:flex;align-items:center;gap:6px;margin-bottom:3.5px;}
.ml-row:last-child{margin-bottom:0;}
.ml-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;}

/* GPS DATA */
.gps-data{background:${T.surface};border-radius:8px;padding:9px 11px;
  font-family:'DM Mono',monospace;font-size:10.5px;color:${T.muted};line-height:1.85;}
.gdr{display:flex;justify-content:space-between;}

/* CAMERA */
.cam-card{background:${T.card};border:1px solid ${T.border};border-radius:12px;
  overflow:hidden;transition:box-shadow .18s;}
.cam-card:hover{box-shadow:${T.sh2};}
.cam-prev{height:130px;background:${T.surface};position:relative;overflow:hidden;
  display:flex;align-items:center;justify-content:center;}
.cam-grid{position:absolute;inset:0;
  background-image:linear-gradient(${T.border} 1px,transparent 1px),
    linear-gradient(90deg,${T.border} 1px,transparent 1px);background-size:20px 20px;}
.cam-box{position:absolute;border:1.5px solid;border-radius:2px;}
.cam-foot{padding:12px 14px;}
.cam-count{position:absolute;bottom:0;left:0;right:0;padding:5px 11px;
  background:linear-gradient(transparent,rgba(0,0,0,.7));
  display:flex;justify-content:space-between;align-items:flex-end;}

/* HISTORY CHART */
.hchart{display:flex;align-items:flex-end;gap:2px;height:64px;}
.hc-col{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;min-width:0;}
.hc-bar{width:100%;border-radius:2px 2px 0 0;transition:height .5s ease,background .3s;}
.hc-lbl{font-size:7.5px;color:${T.muted};font-family:'DM Mono',monospace;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;}

/* BUTTONS */
.btn{border:none;cursor:pointer;font-family:inherit;font-weight:600;border-radius:7px;
  padding:7px 13px;font-size:12px;transition:all .12s;display:inline-flex;align-items:center;gap:5px;}
.btn:hover{filter:brightness(.93);}
.btn:active{transform:scale(.98);}
.btn-primary{background:${T.text};color:${T.bg};}
.btn-ghost{background:${T.surface};color:${T.text};border:1px solid ${T.border};}
.btn-danger{background:${T.critBg};color:${T.crit};border:1px solid ${T.crit}33;}
.btn-warn{background:${T.evacBg};color:${T.evac};border:1px solid ${T.evac}33;}
.btn-success{background:${T.safeBg};color:${T.safe};border:1px solid ${T.safe}33;}
.btn-info{background:${T.infoBg};color:${T.info};border:1px solid ${T.info}33;}
.btn-sm{padding:4px 9px;font-size:11px;border-radius:6px;}
.btn-xs{padding:3px 7px;font-size:10px;border-radius:5px;}
.btn-evac{background:${T.evac};color:#fff;box-shadow:0 0 14px ${T.evac}88;}
.btn-evac:hover{filter:brightness(1.1);}

/* SEARCH INPUT */
.search-wrap{position:relative;margin-bottom:14px;}
.search-ico{position:absolute;left:10px;top:50%;transform:translateY(-50%);
  font-size:13px;color:${T.muted};pointer-events:none;}
.search-inp{width:100%;background:${T.surface};border:1px solid ${T.border};border-radius:8px;
  padding:8px 11px 8px 32px;color:${T.text};font-size:12.5px;font-family:inherit;
  outline:none;transition:border-color .18s;}
.search-inp:focus{border-color:${T.accent};}
.search-inp::placeholder{color:${T.muted};}

/* FORM */
.finp{width:100%;background:${T.surface};border:1px solid ${T.border};border-radius:7px;
  padding:8px 10px;color:${T.text};font-size:12.5px;font-family:inherit;
  outline:none;transition:border-color .18s;}
.finp:focus{border-color:${T.accent};}
.flbl{display:block;font-size:9.5px;font-weight:700;color:${T.muted};
  text-transform:uppercase;letter-spacing:1.5px;margin-bottom:4px;}
.frow{margin-bottom:12px;}
.inline-inp{background:${T.surface};border:1px solid ${T.border};border-radius:5px;
  padding:4px 8px;color:${T.text};font-size:12px;font-family:'DM Mono',monospace;
  outline:none;width:70px;transition:border-color .15s;}
.inline-inp:focus{border-color:${T.accent};}

/* MODAL */
.overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);backdrop-filter:blur(8px);
  display:flex;align-items:center;justify-content:center;z-index:1000;padding:20px;}
.modal{background:${T.card};border:1px solid ${T.border};border-radius:14px;
  padding:22px;width:100%;max-width:455px;box-shadow:${T.sh2};position:relative;}
.modal-bar{position:absolute;top:0;left:0;right:0;height:2px;border-radius:14px 14px 0 0;
  background:linear-gradient(90deg,transparent,${T.accent},transparent);}
.modal-title{font-size:15px;font-weight:800;color:${T.text};letter-spacing:-.2px;margin-bottom:17px;}

/* PILLS */
.pill{display:inline-flex;align-items:center;gap:3.5px;border-radius:5px;
  padding:2.5px 8px;font-size:10.5px;font-weight:600;}
.pdot{width:4.5px;height:4.5px;border-radius:50%;}

/* TABS (within page) */
.ptabs{display:flex;gap:2px;margin-bottom:16px;border-bottom:1px solid ${T.border};padding-bottom:0;}
.ptab{background:none;border:none;border-bottom:2px solid transparent;padding:8px 13px 10px;
  font-size:12.5px;font-weight:600;color:${T.muted};cursor:pointer;font-family:inherit;
  margin-bottom:-1px;transition:all .14s;}
.ptab:hover{color:${T.sub};}
.ptab.on{color:${T.accent};border-bottom-color:${T.accent};}

/* AUDIT LOG */
.audit-row{display:flex;align-items:flex-start;gap:10px;padding:9px 0;
  border-bottom:1px solid ${T.border};}
.audit-row:last-child{border-bottom:none;}
.audit-ico{font-size:13px;margin-top:1px;flex-shrink:0;}
.audit-body{flex:1;min-width:0;}
.audit-msg{font-size:12px;color:${T.text};line-height:1.4;}
.audit-time{font-size:10px;color:${T.muted};font-family:'DM Mono',monospace;margin-top:2px;}

/* MISC */
.g2{display:grid;grid-template-columns:repeat(auto-fill,minmax(255px,1fr));gap:13px;}
.g3{display:grid;grid-template-columns:repeat(auto-fill,minmax(215px,1fr));gap:12px;}
.g2c{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
.g3c{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;}
.fb{display:flex;justify-content:space-between;align-items:center;}
.fg{display:flex;align-items:center;gap:8px;}
.col{display:flex;flex-direction:column;gap:9px;}
.mb16{margin-bottom:16px;}.mb20{margin-bottom:20px;}.mb24{margin-bottom:24px;}
.hint{background:${T.surface};border-radius:9px;padding:10px 14px;font-size:11.5px;
  color:${T.muted};line-height:1.6;margin-bottom:18px;}
.empty{text-align:center;padding:42px 20px;color:${T.muted};font-size:13px;}
.spinner{width:26px;height:26px;border:2px solid ${T.border};border-top:2px solid ${T.accent};
  border-radius:50%;animation:spin .65s linear infinite;}
.loading{display:flex;flex-direction:column;align-items:center;justify-content:center;
  height:60vh;gap:12px;color:${T.muted};font-size:11px;letter-spacing:2px;text-transform:uppercase;}
.section-gap{margin-bottom:20px;}
.tag{display:inline-flex;align-items:center;gap:3px;border-radius:4px;padding:2px 7px;
  font-size:10px;font-weight:700;font-family:'DM Mono',monospace;}
.divider{height:1px;background:${T.border};margin:16px 0;}

/* ── RISK GAUGE ── */
@keyframes riskPulse{0%,100%{opacity:1}50%{opacity:.6}}
.risk-severe{animation:riskPulse 1.4s ease-in-out infinite;}

/* ── AUTH ── */
.auth-tab{flex:1;padding:7px 0;border:none;border-radius:6px;cursor:pointer;font-family:inherit;font-weight:700;font-size:12px;transition:all .2s;background:transparent;color:var(--muted);}
.auth-tab.on{background:var(--card);box-shadow:var(--sh);color:var(--text);}
.auth-err{background:var(--critBg);color:var(--crit);border:1px solid var(--crit)33;border-radius:7px;padding:8px 11px;font-size:12px;margin-bottom:14px;}

/* LEAFLET */
.leaflet-container{background:${T.isDark?"#1a1a16":"#e8e4da"} !important;font-family:inherit !important;}
.leaflet-tile{filter:${T.mapFilter};}
.leaflet-control-attribution{background:${T.card}cc !important;color:${T.muted} !important;font-size:9px !important;}
.leaflet-control-zoom a{background:${T.card} !important;color:${T.accent} !important;border-color:${T.border} !important;font-weight:700;}
.leaflet-popup-content-wrapper{background:${T.card} !important;border:1px solid ${T.border} !important;border-radius:11px !important;color:${T.text} !important;box-shadow:${T.sh2} !important;}
.leaflet-popup-tip{background:${T.card} !important;}
.leaflet-popup-content{margin:13px 15px !important;min-width:190px;}
.leaflet-popup-close-button{color:${T.muted} !important;top:8px !important;right:9px !important;}
.pop-inp{width:100%;background:${T.surface};border:1px solid ${T.border};border-radius:7px;padding:7px 10px;
  color:${T.text};font-size:12px;font-family:inherit;outline:none;margin-bottom:6px;}
.pop-inp:focus{border-color:${T.accent};}
.pop-btn{border:none;border-radius:7px;padding:6px 11px;cursor:pointer;font-size:12px;
  font-weight:600;font-family:inherit;transition:all .12s;}
`;

/* ═══════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════ */
const scr = (src) => new Promise(r => {
  if (document.querySelector(`script[src="${src}"]`)) { r(); return; }
  const s = document.createElement("script"); s.src = src; s.onload = r; s.onerror = r;
  document.head.appendChild(s);
});

/* ── Auth helpers ─────────────────────────────────────────────────────────── */
const getToken  = () => localStorage.getItem("cs-token");
const getUser   = () => { try { return JSON.parse(localStorage.getItem("cs-user") || "null"); } catch { return null; } }
const saveAuth  = (token, user) => { localStorage.setItem("cs-token", token); localStorage.setItem("cs-user", JSON.stringify(user)); };
const clearAuth = () => { localStorage.removeItem("cs-token"); localStorage.removeItem("cs-user"); };
const isAdmin   = () => getUser()?.role === "ROLE_ADMIN";

async function api(path, opts = {}) {
  const token = getToken();
  const headers = { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  let r;
  try {
    r = await fetch(API + path, { headers, ...opts });
  } catch (networkErr) {
    throw new Error("Network error — backend unreachable");
  }
  if (r.status === 401) { clearAuth(); window.location.reload(); return; }
  if (!r.ok) {
    let msg = `HTTP ${r.status}`;
    try { const j = await r.json(); msg = j.message || j.error || msg; } catch (_) {}
    throw new Error(msg);
  }
  if (r.status === 204) return null;
  return r.json();
}

async function authApi(path, body) {
  let r;
  try {
    r = await fetch(API + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (networkErr) {
    throw new Error("Cannot reach backend — is it running on port 8080?");
  }
  if (!r.ok) {
    let msg = `HTTP ${r.status}`;
    try {
      const j = await r.json();
      msg = j.message || j.error || msg;
    } catch (_) {
      msg = (await r.text()) || msg;
    }
    throw new Error(msg);
  }
  return r.json();
}

const pct = (v, m) => m > 0 ? Math.min(Math.round(v / m * 100), 100) : 0;
const dcol = (p, T) => p >= 95 ? T.crit : p >= 75 ? T.warn : p >= 50 ? "#55aa55" : T.safe;
const fmtArea = m2 => m2 >= 1e6 ? `${(m2/1e6).toFixed(2)} km²` : m2 >= 1e4 ? `${(m2/1e4).toFixed(1)} ha` : `${Math.round(m2)} m²`;
const fmtTime = iso => iso ? new Date(iso).toLocaleString(undefined, { month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" }) : "";
const fmtTimeShort = iso => iso ? new Date(iso).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit", second:"2-digit" }) : "";

const STATUS = {
  SAFE:       { dot: "#34c472", lbl: "Safe",       fg: null, bg: null },
  WARNING:    { dot: "#f0b429", lbl: "Warning",    fg: null, bg: null },
  CRITICAL:   { dot: "#f03e5e", lbl: "Critical",   fg: null, bg: null },
  EVACUATING: { dot: "#b06cff", lbl: "Evacuating", fg: null, bg: null },
};
const SEV = {
  LOW:     { dot: "#4d9fff", lbl: "Low" },
  MEDIUM:  { dot: "#f0b429", lbl: "Medium" },
  HIGH:    { dot: "#f0b429", lbl: "High" },
  CRITICAL:{ dot: "#f03e5e", lbl: "Critical" },
};
const INC_I = { OVERCROWDING:"👥", MEDICAL:"🏥", FIRE:"🔥", STAMPEDE:"🚨", SECURITY:"🔒", OTHER:"⚠️" };

/* ═══════════════════════════════════════════════════════
   NOTIFICATION SOUND
═══════════════════════════════════════════════════════ */
function playAlert(freq = 880, type = "sine", duration = 0.25) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = type; osc.frequency.value = freq;
    gain.gain.setValueAtTime(.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + duration);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + duration);
  } catch(e) {}
}
function playEvacAlarm() {
  [880, 660, 880, 660].forEach((f, i) => setTimeout(() => playAlert(f, "sawtooth", .2), i * 220));
}

/* ═══════════════════════════════════════════════════════
   AUDIT LOG
═══════════════════════════════════════════════════════ */
const MAX_AUDIT = 60;
let auditStore = [];
function pushAudit(msg, icon = "📋") {
  auditStore = [{ msg, icon, ts: new Date().toISOString(), id: Date.now() }, ...auditStore].slice(0, MAX_AUDIT);
}

/* ═══════════════════════════════════════════════════════
   WEBSOCKET HOOK
═══════════════════════════════════════════════════════ */
function useWS({ onZones, onUsers, onAlerts, onIncidents, onStats, onEvac, setWsState }) {
  const ref = useRef(null);
  const prevAlertCount = useRef(0);
  useEffect(() => {
    let alive = true;
    (async () => {
      await scr("https://cdnjs.cloudflare.com/ajax/libs/sockjs-client/1.6.1/sockjs.min.js");
      await scr("https://cdnjs.cloudflare.com/ajax/libs/stomp.js/2.3.3/stomp.min.js");
      if (alive) connect();
    })();
    return () => { alive = false; try { ref.current?.disconnect(); } catch(e) {} };
  }, []);

  function connect() {
    setWsState("conn");
    try {
      const sock = new window.SockJS(WS_URL);
      const c = window.Stomp.over(sock);
      c.debug = null;
      c.connect({}, () => {
        setWsState("live");
        c.subscribe("/topic/zones",     m => { try { const d=JSON.parse(m.body); onZones(d.zones||[], d); } catch(e){} });
        c.subscribe("/topic/live",      m => { try { onUsers(JSON.parse(m.body).users||[]); } catch(e){} });
        c.subscribe("/topic/alerts",    m => { try {
          const d = JSON.parse(m.body);
          const newCount = (d.alerts||[]).length;
          if (newCount > prevAlertCount.current) playAlert(660, "triangle", .3);
          prevAlertCount.current = newCount;
          onAlerts(d.alerts||[]);
        } catch(e){} });
        c.subscribe("/topic/incidents", m => { try { onIncidents(JSON.parse(m.body).incidents||[]); } catch(e){} });
        c.subscribe("/topic/stats",     m => { try { onStats(JSON.parse(m.body)); } catch(e){} });
        c.subscribe("/topic/evacuation",m => { try { const d=JSON.parse(m.body); onEvac(d); } catch(e){} });
        ref.current = c;
      }, () => { setWsState("poll"); setTimeout(connect, 3500); });
    } catch(e) { setWsState("poll"); setTimeout(connect, 3500); }
  }
}

/* ═══════════════════════════════════════════════════════
   SMALL SHARED COMPONENTS
═══════════════════════════════════════════════════════ */
function Pill({ status, label, T }) {
  const col = { SAFE:T.safe, WARNING:T.warn, CRITICAL:T.crit, EVACUATING:T.evac,
                OPEN:T.warn, RESOLVED:T.safe, CLOSED:T.muted, IN_PROGRESS:T.info }[status] || T.muted;
  const bg  = { SAFE:T.safeBg, WARNING:T.warnBg, CRITICAL:T.critBg, EVACUATING:T.evacBg,
                OPEN:T.warnBg, RESOLVED:T.safeBg, CLOSED:T.surface, IN_PROGRESS:T.infoBg }[status] || T.surface;
  const lbl = label || STATUS[status]?.lbl || status;
  return <span className="pill" style={{background:bg,color:col}}><span className="pdot" style={{background:col}}/>{lbl}</span>;
}

function SevPill({ sev, T }) {
  const s = SEV[sev] || SEV.LOW;
  const col = { LOW:T.info, MEDIUM:T.warn, HIGH:T.warn, CRITICAL:T.crit }[sev] || T.muted;
  const bg  = { LOW:T.infoBg, MEDIUM:T.warnBg, HIGH:T.warnBg, CRITICAL:T.critBg }[sev] || T.surface;
  return <span className="pill" style={{background:bg,color:col}}><span className="pdot" style={{background:s.dot}}/>{s.lbl}</span>;
}

function DBar({ value, max, T, height = 4 }) {
  const p = pct(value, max);
  const c = dcol(p, T);
  return (
    <div>
      <div className="drow">
        <span className="dlbl">Density</span>
        <span className="dval" style={{color:c}}>{p}% <span style={{color:T.muted,fontWeight:400}}>({value}/{max})</span></span>
      </div>
      <div className="dbar" style={{height}}><div className="dfill" style={{width:`${p}%`,background:c}}/></div>
    </div>
  );
}

function Sparkline({ data, T, height = 22 }) {
  if (!data?.length) return null;
  const max = Math.max(...data, 1);
  return (
    <div className="spark">
      {data.map((v, i) => {
        const h = Math.max(2, Math.round(v / max * height));
        const age = data.length - 1 - i;
        const opacity = 0.35 + (0.65 * (i / Math.max(data.length - 1, 1)));
        return <div key={i} className="spark-bar" style={{height:h,background:dcol(pct(v,max*0.8),T),opacity,flex:1}}/>;
      })}
    </div>
  );
}

function HistoryChart({ history, T }) {
  if (!history?.length) return <div style={{height:64,display:"flex",alignItems:"center",justifyContent:"center",color:T.muted,fontSize:11}}>No data yet</div>;
  const maxVal = Math.max(...history.map(h => h.count), 1);
  return (
    <div className="hchart">
      {history.slice(-20).map((h, i) => {
        const hPct = h.capacity > 0 ? pct(h.count, h.capacity) : 0;
        const barH = Math.max(3, Math.round(hPct / 100 * 60));
        const color = dcol(hPct, T);
        const t = new Date(h.ts);
        const lbl = `${t.getHours()}:${String(t.getMinutes()).padStart(2,"0")}`;
        return (
          <div key={i} className="hc-col" title={`${hPct}% @ ${lbl}`}>
            <div style={{flex:1,display:"flex",alignItems:"flex-end",width:"100%"}}>
              <div className="hc-bar" style={{height:barH,background:color,width:"100%"}}/>
            </div>
            {i % 4 === 0 && <div className="hc-lbl">{lbl}</div>}
          </div>
        );
      })}
    </div>
  );
}


/* ═══════════════════════════════════════════════════════
   RISK GAUGE COMPONENT
═══════════════════════════════════════════════════════ */
function RiskGauge({ score, level, color, recommendation, small = false }) {
  if (score === undefined) return null;
  const radius = small ? 16 : 22;
  const circ   = 2 * Math.PI * radius;
  const fill   = (score / 100) * circ;
  const size   = small ? 44 : 60;
  return (
    <div style={{display:"flex",alignItems:"center",gap:small?6:9,flexShrink:0}}>
      <div style={{position:"relative",width:size,height:size,flexShrink:0}}>
        <svg width={size} height={size} style={{transform:"rotate(-90deg)"}}>
          <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="var(--border)" strokeWidth={small?3:4}/>
          <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={color||"#34c472"}
            strokeWidth={small?3:4} strokeDasharray={`${fill} ${circ}`}
            strokeLinecap="round" style={{transition:"stroke-dasharray .6s ease"}}/>
        </svg>
        <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",
          fontFamily:"'DM Mono',monospace",fontWeight:700,fontSize:small?9:12,color:color||"#34c472"}}>
          {score}
        </div>
      </div>
      {!small && (
        <div>
          <div style={{fontSize:10,fontWeight:700,color:color,letterSpacing:.5}}>{level}</div>
          <div style={{fontSize:9.5,color:"var(--muted)",marginTop:1.5,maxWidth:110,lineHeight:1.4}}>{recommendation}</div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   ZONE MAP
═══════════════════════════════════════════════════════ */
const ZoneMap = memo(function ZoneMap({
  zones, incidents, tracked, onSaveZone, onEditZoneGeo, onUpdateCount, showHeat, T
}) {
  const cRef = useRef(null), mapRef = useRef(null), drawnRef = useRef(null);
  const zLy = useRef({}), uLy = useRef({}), iLy = useRef({}), heatRef = useRef(null);
  const fittedRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [pend, setPend] = useState(null);

  // Load Leaflet + plugins once
  useEffect(() => {
    if (window.L?.Draw) { setReady(true); return; }
    const link = h => { const l=document.createElement("link");l.rel="stylesheet";l.href=h;document.head.appendChild(l); };
    link("https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css");
    link("https://cdnjs.cloudflare.com/ajax/libs/leaflet.draw/1.0.4/leaflet.draw.css");
    scr("https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js")
      .then(() => scr("https://cdnjs.cloudflare.com/ajax/libs/leaflet.draw/1.0.4/leaflet.draw.js"))
      .then(() => scr("https://cdnjs.cloudflare.com/ajax/libs/leaflet.heat/0.2.0/leaflet-heat.js"))
      .then(() => setReady(true));
  }, []);

  // Init map
  useEffect(() => {
    if (!ready || !cRef.current || mapRef.current) return;
    const L = window.L;
    const map = L.map(cRef.current, { center:[20.5937,78.9629], zoom:5 });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      { attribution:"© OSM", maxZoom:19 }).addTo(map);
    const drawn = new L.FeatureGroup().addTo(map);
    drawnRef.current = drawn;
    const dc = new L.Control.Draw({
      edit: { featureGroup: drawn },
      draw: {
        polygon:     { allowIntersection:false, shapeOptions:{color:T.accent,fillColor:T.accent,fillOpacity:.1,weight:2} },
        circle:      { shapeOptions:{color:T.accent,fillColor:T.accent,fillOpacity:.1,weight:2}, showRadius:true, metric:true },
        marker:false, polyline:false, rectangle:false, circlemarker:false,
      },
    });
    map.addControl(dc);
    map.on(L.Draw.Event.CREATED, e => {
      const ly = e.layer; let sd = {};
      if (e.layerType === "polygon") {
        const ll = ly.getLatLngs()[0], coords = ll.map(p=>[p.lat,p.lng]);
        coords.push(coords[0]);
        const cx = ll.reduce((a,p)=>({lat:a.lat+p.lat/ll.length,lng:a.lng+p.lng/ll.length}),{lat:0,lng:0});
        sd = { shapeType:"polygon", polygonCoords:coords, latitude:cx.lat, longitude:cx.lng };
      } else if (e.layerType === "circle") {
        const c = ly.getLatLng();
        sd = { shapeType:"circle", latitude:c.lat, longitude:c.lng, radiusMetres:ly.getRadius() };
      }
      drawn.addLayer(ly); setPend({ ly, sd });
    });
    map.on(L.Draw.Event.EDITED, e => {
      e.layers.eachLayer(ly => {
        const zid = ly.options.zoneId; if (!zid) return;
        let u = {};
        if (ly instanceof L.Circle)
          u = { shapeType:"circle", latitude:ly.getLatLng().lat, longitude:ly.getLatLng().lng, radiusMetres:ly.getRadius() };
        else if (ly instanceof L.Polygon) {
          const ll = ly.getLatLngs()[0], coords = ll.map(p=>[p.lat,p.lng]); coords.push(coords[0]);
          const cx = ll.reduce((a,p)=>({lat:a.lat+p.lat/ll.length,lng:a.lng+p.lng/ll.length}),{lat:0,lng:0});
          u = { shapeType:"polygon", polygonCoords:coords, latitude:cx.lat, longitude:cx.lng };
        }
        onEditZoneGeo(zid, u);
      });
    });
    mapRef.current = map;
  }, [ready]);

  // Heatmap
  useEffect(() => {
    if (!ready || !mapRef.current || !window.L?.heatLayer) return;
    if (heatRef.current) { mapRef.current.removeLayer(heatRef.current); heatRef.current = null; }
    if (!showHeat || !zones.length) return;
    const pts = zones.filter(z => z.latitude && z.longitude && z.capacity > 0)
      .map(z => [z.latitude, z.longitude, Math.min(pct(z.currentCount,z.capacity)/100*1.2, 1)]);
    if (!pts.length) return;
    heatRef.current = window.L.heatLayer(pts, { radius:60, blur:45, maxZoom:14,
      gradient:{ 0:T.safe, .5:T.warn, 1:T.crit } }).addTo(mapRef.current);
  }, [zones, showHeat, ready, T]);

  // Zone layers — update style without removing/re-adding if already exists
  useEffect(() => {
    if (!ready || !mapRef.current || !window.L) return;
    const L = window.L, map = mapRef.current;
    const live = new Set(zones.map(z => z.id));
    Object.keys(zLy.current).forEach(id => {
      if (!live.has(id)) { map.removeLayer(zLy.current[id]); delete zLy.current[id]; }
    });

    let newZoneAdded = false;
    zones.forEach(zone => {
      if (!zone.latitude && !zone.polygonCoords?.length) return;
      const st = STATUS[zone.status] || STATUS.SAFE;
      const col = st.dot;
      const p = pct(zone.currentCount, zone.capacity);
      const isCrit = zone.status === "CRITICAL";
      const isEvac = zone.status === "EVACUATING";
      const sty = {
        color: col, fillColor: col,
        fillOpacity: isCrit ? .18 : isEvac ? .15 : .08,
        weight: isCrit || isEvac ? 2.5 : 1.5,
        ...(isCrit ? {dashArray:"6 3"} : {}),
        ...(isEvac ? {dashArray:"3 3"} : {}),
      };

      const ar = zone.areaSquareMetres > 0 ? fmtArea(zone.areaSquareMetres) : "—";
      const popHtml = `<div style="font-family:'Plus Jakarta Sans',sans-serif;">
        <div style="font-weight:800;font-size:14px;color:${T.text};margin-bottom:2px">${zone.name}</div>
        <div style="font-size:11px;color:${T.muted};margin-bottom:9px">📍 ${zone.location||""} · ${ar}</div>
        <div style="display:flex;justify-content:space-between;margin-bottom:3px">
          <span style="font-size:11px;color:${T.muted}">Occupancy</span>
          <span style="font-size:12px;font-weight:700;font-family:'DM Mono',monospace;color:${col}">${zone.currentCount}/${zone.capacity} (${p}%)</span>
        </div>
        <div style="background:${T.border};border-radius:2px;height:5px;margin-bottom:11px">
          <div style="height:100%;width:${p}%;background:${col};border-radius:2px;transition:width .5s"></div>
        </div>
        <div style="display:flex;gap:5px;margin-bottom:9px">
          <input id="pi-${zone.id}" type="number" min="0" max="${zone.capacity}" value="${zone.currentCount}" class="pop-inp" style="flex:1;margin-bottom:0"/>
          <button class="pop-btn" id="pb-${zone.id}" style="background:${col}25;color:${col}">Update</button>
        </div>
        <div style="background:${st.bg||T.surface};color:${st.fg||col};border-radius:5px;padding:3px 9px;font-size:11px;font-weight:600;display:inline-flex;align-items:center;gap:4px">
          <span style="width:5px;height:5px;border-radius:50%;background:${col};display:inline-block"></span>${st.lbl}
        </div>
      </div>`;

      if (zLy.current[zone.id]) {
        // Update existing layer style and popup (no flicker)
        zLy.current[zone.id].setStyle(sty);
        zLy.current[zone.id].setPopupContent(popHtml);
      } else {
        let ly;
        if (zone.shapeType === "polygon" && zone.polygonCoords?.length > 2)
          ly = L.polygon(zone.polygonCoords.map(c => L.latLng(c[0],c[1])), {...sty, zoneId:zone.id});
        else
          ly = L.circle([zone.latitude, zone.longitude], {...sty, radius:zone.radiusMetres||200, zoneId:zone.id});
        ly.bindPopup(popHtml, { maxWidth:270 });
        ly.on("popupopen", () => {
          const btn = document.getElementById("pb-"+zone.id);
          if (btn) btn.onclick = () => {
            const inp = document.getElementById("pi-"+zone.id);
            if (inp) { onUpdateCount(zone.id, Number(inp.value)); map.closePopup(); }
          };
        });
        ly.addTo(map); zLy.current[zone.id] = ly;
        newZoneAdded = true;
      }
    });

    // Only fit bounds when zones first appear (not on every count update)
    if (newZoneAdded && !fittedRef.current && Object.keys(zLy.current).length) {
      try {
        map.fitBounds(L.featureGroup(Object.values(zLy.current)).getBounds().pad(.3), { maxZoom:16, animate:true });
        fittedRef.current = true;
      } catch(e) {}
    }
  }, [zones, ready, T, onUpdateCount, onEditZoneGeo]);

  // Incident pins
  useEffect(() => {
    if (!ready || !mapRef.current || !window.L) return;
    Object.values(iLy.current).forEach(m => mapRef.current.removeLayer(m)); iLy.current = {};
    incidents.filter(i => !["RESOLVED","CLOSED"].includes(i.status)).forEach(inc => {
      const z = zones.find(z => z.id === inc.zoneId); if (!z?.latitude) return;
      const sv = SEV[inc.severity] || SEV.LOW;
      const em = INC_I[inc.type] || "⚠️";
      const icon = window.L.divIcon({
        html:`<div style="font-size:20px;filter:drop-shadow(0 2px 5px rgba(0,0,0,.4));cursor:pointer">${em}</div>`,
        className:"", iconSize:[24,24], iconAnchor:[12,24]
      });
      const ph = `<div style="font-family:'Plus Jakarta Sans',sans-serif">
        <div style="font-size:22px;margin-bottom:5px">${em}</div>
        <div style="font-size:13px;font-weight:700;color:${T.text};margin-bottom:2px">${inc.title}</div>
        <div style="font-size:11px;color:${T.muted};margin-bottom:7px">${inc.zoneName||""}</div>
        <span style="background:${T.critBg};color:${T.crit};border-radius:5px;padding:2px 8px;font-size:11px;font-weight:600">${sv.lbl} severity</span>
      </div>`;
      iLy.current[inc.id] = window.L.marker([z.latitude+.0012, z.longitude+.0012], {icon, zIndexOffset:500})
        .addTo(mapRef.current).bindPopup(ph, {maxWidth:230});
    });
  }, [incidents, zones, ready, T]);

  // GPS users — smooth updates
  useEffect(() => {
    if (!ready || !mapRef.current || !window.L) return;
    const map = mapRef.current;
    const live = new Set(tracked.map(u => u.deviceId));
    Object.keys(uLy.current).forEach(id => {
      if (!live.has(id)) { map.removeLayer(uLy.current[id]); delete uLy.current[id]; }
    });
    tracked.forEach(u => {
      if (!u.latitude || !u.longitude) return;
      const inZ = !!u.currentZoneName;
      const dot = inZ ? T.safe : T.user;
      const icon = window.L.divIcon({
        html:`<div style="position:relative;width:13px;height:13px">
          <div style="position:absolute;inset:0;border-radius:50%;background:${dot};border:2px solid #fff;z-index:2"></div>
          <div style="position:absolute;inset:-5px;border-radius:50%;background:${dot}55;animation:ping 2.5s ease-out infinite;pointer-events:none"></div>
        </div>`,
        className:"", iconSize:[13,13], iconAnchor:[6.5,6.5]
      });
      const ph = `<div style="font-family:'Plus Jakarta Sans',sans-serif">
        <div style="font-size:13px;font-weight:700;color:${T.text};margin-bottom:2px">👤 ${u.displayName||"User-"+u.deviceId.substr(0,6)}</div>
        <div style="font-size:11px;color:${inZ?T.safe:T.muted};margin-bottom:5px">${inZ?"📍 "+u.currentZoneName:"Outside zones"}</div>
        <div style="font-family:'DM Mono',monospace;font-size:10px;color:${T.muted}">
          ${(u.latitude||0).toFixed(5)}°, ${(u.longitude||0).toFixed(5)}°
          ${u.accuracy?`<br/>±${Math.round(u.accuracy)} m`:""}
        </div>
      </div>`;
      if (uLy.current[u.deviceId]) {
        uLy.current[u.deviceId].setLatLng([u.latitude, u.longitude]);
        uLy.current[u.deviceId].setIcon(icon);
        uLy.current[u.deviceId].setPopupContent(ph);
      } else {
        uLy.current[u.deviceId] = window.L.marker([u.latitude,u.longitude],{icon,zIndexOffset:1000})
          .addTo(map).bindPopup(ph,{maxWidth:210});
      }
    });
  }, [tracked, ready, T]);

  return (
    <div style={{position:"relative",height:"100%",minHeight:460,borderRadius:12,overflow:"hidden",border:`1px solid ${T.border}`}}>
      <div ref={cRef} style={{width:"100%",height:"100%"}}/>
      {!ready && (
        <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:T.card,gap:11}}>
          <div className="spinner"/>
          <span style={{color:T.muted,fontSize:11,fontFamily:"'DM Mono',monospace",letterSpacing:2}}>LOADING MAP</span>
        </div>
      )}
      {ready && (
        <div style={{position:"absolute",top:10,left:48,zIndex:600,background:T.card+"ee",border:`1px solid ${T.border}`,borderRadius:7,padding:"5px 10px",fontSize:11,color:T.accent,fontFamily:"'DM Mono',monospace",boxShadow:T.sh,backdropFilter:"blur(6px)"}}>
          ✏ Draw zones with toolbar
        </div>
      )}
      <div className="map-legend">
        <div className="ml-title">Status</div>
        {Object.entries(STATUS).map(([k,v]) => (
          <div key={k} className="ml-row"><div className="ml-dot" style={{background:v.dot}}/><span style={{fontSize:10,fontWeight:600,color:T.sub}}>{v.lbl}</span></div>
        ))}
        <div style={{borderTop:`1px solid ${T.border}`,margin:"6px 0"}}/>
        <div className="ml-row"><div className="ml-dot" style={{background:T.user}}/><span style={{fontSize:10,fontWeight:600,color:T.sub}}>GPS User</span></div>
        <div className="ml-row"><span style={{fontSize:12}}>⚠️</span><span style={{fontSize:10,fontWeight:600,color:T.sub,marginLeft:1}}>Incident</span></div>
      </div>
      {pend && (
        <DrawDialog sd={pend.sd} T={T}
          onSave={(n,l,c) => { onSaveZone({...pend.sd,name:n,location:l,capacity:Number(c)}); setPend(null); }}
          onCancel={() => { drawnRef.current?.removeLayer(pend.ly); setPend(null); }}/>
      )}
    </div>
  );
});

function DrawDialog({ sd, onSave, onCancel, T }) {
  const [n,sN]=useState(""); const [l,sL]=useState(""); const [c,sC]=useState("500");
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);
  const onKey = e => { if (e.key === "Escape") onCancel(); if (e.key === "Enter" && n && c) onSave(n,l,c); };
  return (
    <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,.55)",backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:800,padding:20}} onKeyDown={onKey}>
      <div className="modal fu">
        <div className="modal-bar"/>
        <div className="modal-title">Create Zone</div>
        <div style={{background:T.surface,borderRadius:7,padding:"8px 11px",marginBottom:15,fontFamily:"'DM Mono',monospace",fontSize:11,color:T.accent}}>
          {sd.shapeType==="polygon"?"◆ Polygon":"○ Circle"}{sd.radiusMetres?` · r=${Math.round(sd.radiusMetres)}m`:""} · {(sd.latitude||0).toFixed(4)}°N {(sd.longitude||0).toFixed(4)}°E
        </div>
        {[["Zone name","text",n,sN,"e.g. Main Entrance",true],["Location label","text",l,sL,"e.g. Gate A"],["Max capacity","number",c,sC,"e.g. 500"]].map(([lb,tp,val,set,ph,foc])=>(
          <div className="frow" key={lb}><label className="flbl">{lb}</label>
            <input ref={foc?ref:null} className="finp" type={tp} value={val} placeholder={ph} onChange={e=>set(e.target.value)}/>
          </div>
        ))}
        <div style={{display:"flex",gap:7,marginTop:4}}>
          <button className="btn btn-primary" style={{flex:1,justifyContent:"center",opacity:n&&c?1:.45}}
            onClick={()=>{if(n&&c)onSave(n,l,c);}}>Create Zone</button>
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   MAIN APP
═══════════════════════════════════════════════════════ */
export default function App() {
  const [isDark, setDark] = useState(() => localStorage.getItem("cs-theme") === "dark");
  const T = useMemo(() => mkTheme(isDark), [isDark]);

  // ── Auth state ────────────────────────────────────────────────────────────
  const [authed,   setAuthed]   = useState(() => !!getToken());
  const [authUser, setAuthUser] = useState(() => getUser());
  const [authMode, setAuthMode] = useState("login");  // "login" | "register"
  const [authForm, setAuthForm] = useState({ fullName:"", email:"", password:"" });
  const [authErr,  setAuthErr]  = useState("");
  const [authLoad, setAuthLoad] = useState(false);

  const [tab,      setTab]      = useState("map");
  const [zones,    setZones]    = useState([]);
  const [incs,     setIncs]     = useState([]);
  const [alerts,   setAlerts]   = useState([]);
  const [stats,    setStats]    = useState({});
  const [tracked,  setTracked]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [wsState,  setWsState]  = useState("conn");
  const [heat,     setHeat]     = useState(false);
  const [modal,    setModal]    = useState(null);
  const [editZone, setEditZ]    = useState(null);
  const [sync,     setSync]     = useState(null);
  const [showLink, setShowLink] = useState(false);
  const [toast,    setToast]    = useState(null);
  const [evacActive, setEvac]   = useState(false);
  const [evacReason, setEvacR]  = useState("");
  const [audit,    setAudit]    = useState([]);
  const [incFilter,setIncF]     = useState("ALL");
  const [search,   setSearch]   = useState("");
  const [subTab,   setSubTab]   = useState("list");   // for incidents: list | analytics
  const [riskScores, setRiskScores] = useState({});     // { zoneId: {riskScore, riskLevel, ...} }
  const [zoneHistory, setZH]    = useState({});       // { zoneId: [{count,capacity,ts}] }
  const [newInc, setNI] = useState({ zoneId:"", title:"", description:"", type:"OVERCROWDING", severity:"MEDIUM" });

  // CSS injection + CSS vars
  useEffect(() => {
    let el = document.getElementById("cs-css");
    if (!el) { el=document.createElement("style"); el.id="cs-css"; document.head.appendChild(el); }
    el.textContent = buildCSS(T);
  }, [T]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = e => {
      if (e.key === "Escape") setModal(null);
      if (e.ctrlKey || e.metaKey) return;
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") return;
      const shortcuts = { m:"map", d:"dash", z:"zones", i:"inc", a:"alrt", g:"gps" };
      if (shortcuts[e.key]) setTab(shortcuts[e.key]);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ── Auth handlers ──────────────────────────────────────────────────────────
  const handleAuth = useCallback(async () => {
  try {
    setAuthErr(null);

    const res = await fetch(
      `http://localhost:8080/api/auth/${authMode}`, // login or register
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(authForm),
      }
    );

    // ✅ READ RESPONSE ONLY ONCE
    let data;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    if (!res.ok) {
      throw new Error(data?.message || "Login failed — check backend");
    }

    // ✅ success handling
    setAuthed(true);
    setAuthUser(data);

  } catch (e) {
    setAuthErr(e.message || "Login failed — check backend is running");
  }
}, [authMode, authForm]);

  const handleLogout = useCallback(() => {
    clearAuth(); setAuthed(false); setAuthUser(null);
  }, []);

  const showToast = useCallback((msg, type="safe") => {
    setToast({msg,type}); setTimeout(()=>setToast(null), 3200);
  }, []);

  const addAudit = useCallback((msg, icon="📋") => {
    pushAudit(msg, icon);
    setAudit(a => [{ msg, icon, ts: new Date().toISOString(), id: Date.now() }, ...a].slice(0, MAX_AUDIT));
  }, []);

  // Update zone density history
  const updateHistory = useCallback((newZones) => {
    const ts = new Date().toISOString();
    setZH(prev => {
      const next = { ...prev };
      newZones.forEach(z => {
        const cur = next[z.id] || [];
        next[z.id] = [...cur, { count:z.currentCount, capacity:z.capacity, ts }].slice(-HISTORY_MAX);
      });
      return next;
    });
  }, []);

  // WebSocket
  useWS({
    onZones: useCallback((zs, data) => {
      setZones(zs);
      if (data.evacuatingZones > 0) {
        if (!evacActive) playEvacAlarm();
        setEvac(true);
      } else setEvac(false);
      updateHistory(zs);
      setSync(new Date());
    }, [evacActive, updateHistory]),
    onUsers: useCallback(us => setTracked(us), []),
    onAlerts: useCallback(as => setAlerts(as), []),
    onIncidents: useCallback(is => setIncs(is), []),
    onStats: useCallback(s => { setStats(s); if (s.riskScores) setRiskScores(s.riskScores); }, []),
    onEvac: useCallback(d => {
      if (d.event === "EVACUATION_ACTIVE") {
        setEvac(true); playEvacAlarm();
        addAudit(`🚨 Evacuation activated: ${d.reason}`, "🚨");
        showToast("EVACUATION MODE ACTIVATED", "crit");
      } else if (d.event === "ALL_CLEAR") {
        setEvac(false);
        addAudit("✅ All clear — evacuation lifted", "✅");
        showToast("All clear — evacuation lifted", "safe");
      }
    }, [addAudit, showToast]),
    setWsState,
  });

  // REST polling (fallback + incidents/stats supplement)
  const load = useCallback(async () => {
    try {
      const [s,z,i,a,u,r] = await Promise.all([
        api("/dashboard/stats"),
        api("/zones"),
        api("/incidents"),
        api("/alerts/unacknowledged"),
        api("/track/active"),
        api("/risk/zones"),
      ]);
      setStats(s); setZones(z); setIncs(i); setAlerts(a); setTracked(u);
      if (r) setRiskScores(r);
      setEvac(z.some(z => z.status === "EVACUATING"));
      updateHistory(z);
      setSync(new Date());
    } catch(e) { console.warn("Poll error:", e.message); }
    finally { setLoading(false); }
  }, [updateHistory]);

  useEffect(() => { load(); const t = setInterval(load, 8000); return () => clearInterval(t); }, [load]);

  // Clock
  const [clock, setClock] = useState(new Date().toLocaleTimeString());
  useEffect(() => { const t = setInterval(() => setClock(new Date().toLocaleTimeString()), 1000); return ()=>clearInterval(t); }, []);

  /* ── ACTIONS ── */
  const saveZone = useCallback(async d => {
    try { await api("/zones",{method:"POST",body:JSON.stringify(d)}); addAudit(`Zone "${d.name}" created`, "◈"); showToast(`Zone "${d.name}" created`); }
    catch(e) { showToast(e.message,"crit"); }
  }, [addAudit, showToast]);

  const editZoneGeo = useCallback(async (id, g) => {
    const z = zones.find(z => z.id === id); if (!z) return;
    try { await api(`/zones/${id}`,{method:"PUT",body:JSON.stringify({...z,...g})}); }
    catch(e) { showToast(e.message,"crit"); }
  }, [zones, showToast]);

  const updateCount = useCallback(async (id, count) => {
    try { await api(`/zones/${id}/count`,{method:"PATCH",body:JSON.stringify({count})}); }
    catch(e) { showToast(e.message,"crit"); }
  }, [showToast]);

  const deleteZone = useCallback(async (id, name) => {
    if (!confirm(`Delete zone "${name}"?`)) return;
    try { await api(`/zones/${id}`,{method:"DELETE"}); addAudit(`Zone "${name}" deleted`,"🗑"); showToast("Zone deleted"); }
    catch(e) { showToast(e.message,"crit"); }
  }, [addAudit, showToast]);

  const saveEditZone = useCallback(async () => {
    try { await api(`/zones/${editZone.id}`,{method:"PUT",body:JSON.stringify(editZone)}); setModal(null); setEditZ(null); addAudit(`Zone "${editZone.name}" updated`,"✏️"); showToast("Zone saved"); }
    catch(e) { showToast(e.message,"crit"); }
  }, [editZone, addAudit, showToast]);

  const createInc = useCallback(async () => {
    // Resolve zoneName from zoneId before sending
    const zoneName = zones.find(z=>z.id===newInc.zoneId)?.name || "";
    const payload = {...newInc, zoneName};
    try { await api("/incidents",{method:"POST",body:JSON.stringify(payload)}); setModal(null); setNI({zoneId:"",title:"",description:"",type:"OVERCROWDING",severity:"MEDIUM"}); addAudit(`Incident "${newInc.title}" reported`,"⚑"); showToast("Incident reported"); }
    catch(e) { showToast(e.message,"crit"); }
  }, [newInc, zones, addAudit, showToast]);

  const resolveInc = useCallback(async inc => {
    try { await api(`/incidents/${inc.id}/resolve`,{method:"PATCH"}); addAudit(`Incident "${inc.title}" resolved`,"✅"); showToast("Incident resolved"); }
    catch(e) { showToast(e.message,"crit"); }
  }, [addAudit, showToast]);

  const ackAlert = useCallback(async id => {
    try { await api(`/alerts/${id}/acknowledge`,{method:"PATCH"}); }
    catch(e) {}
  }, []);

  const ackAll = useCallback(async () => {
    try { await api("/alerts/acknowledge-all",{method:"POST"}); addAudit("All alerts acknowledged","✅"); showToast("All alerts acknowledged"); }
    catch(e) {}
  }, [addAudit, showToast]);

  const activateEvac = useCallback(async () => {
    const reason = prompt("Evacuation reason:", "Emergency evacuation");
    if (!reason) return;
    try { await api("/evacuation/activate",{method:"POST",body:JSON.stringify({reason})}); }
    catch(e) { showToast(e.message,"crit"); }
  }, [showToast]);

  const clearEvac = useCallback(async () => {
    try { await api("/evacuation/clear",{method:"POST"}); }
    catch(e) { showToast(e.message,"crit"); }
  }, [showToast]);

  const exportCSV = useCallback((type) => {
    let csv = "", fn = "";
    if (type === "zones") {
      csv = ["Name,Location,Status,Count,Capacity,Density%,Area,Shape"].concat(
        zones.map(z => `"${z.name}","${z.location||""}",${z.status},${z.currentCount},${z.capacity},${pct(z.currentCount,z.capacity)},"${z.areaSquareMetres>0?fmtArea(z.areaSquareMetres):""}",${z.shapeType}`)
      ).join("\n"); fn = "zones.csv";
    } else if (type === "incidents") {
      csv = ["Title,Zone,Type,Severity,Status,Reported"].concat(
        incs.map(i => `"${i.title}","${i.zoneName||""}",${i.type},${i.severity},${i.status},"${fmtTime(i.reportedAt)}"`)
      ).join("\n"); fn = "incidents.csv";
    }
    const url = URL.createObjectURL(new Blob([csv], {type:"text/csv"}));
    const a = document.createElement("a"); a.href = url; a.download = fn; a.click();
    URL.revokeObjectURL(url);
    addAudit(`Exported ${type} CSV`, "📥");
    showToast(`${type} exported`);
  }, [zones, incs, addAudit, showToast]);

  const tUrl = `${window.location.protocol}//${window.location.hostname}:3000/track.html`;

  const openIncs = useMemo(() => incs.filter(i=>i.status==="OPEN"), [incs]);
  const overallDensity = Math.round(stats?.overallDensity || 0);
  const critCount = useMemo(() => zones.filter(z=>z.status==="CRITICAL").length, [zones]);

  const filteredIncs = useMemo(() => {
    let list = incs;
    if (incFilter !== "ALL") list = list.filter(i => i.status === incFilter || i.severity === incFilter);
    if (search) list = list.filter(i => i.title?.toLowerCase().includes(search.toLowerCase()) || i.zoneName?.toLowerCase().includes(search.toLowerCase()));
    return list;
  }, [incs, incFilter, search]);

  const filteredZones = useMemo(() => {
    if (!search) return zones;
    return zones.filter(z => z.name?.toLowerCase().includes(search.toLowerCase()) || z.location?.toLowerCase().includes(search.toLowerCase()));
  }, [zones, search]);

  const mapProps = useMemo(() => ({ zones, incidents:incs, tracked, onSaveZone:saveZone, onEditZoneGeo:editZoneGeo, onUpdateCount:updateCount, showHeat:heat, T }), [zones, incs, tracked, saveZone, editZoneGeo, updateCount, heat, T]);

  const critRiskCount = useMemo(() =>
    Object.values(riskScores).filter(r => r.riskScore >= 75).length, [riskScores]);

  const NAV = [
    { id:"map",   lbl:"Live Map",  ico:"🗺" },
    { id:"dash",  lbl:"Dashboard", ico:"▦" },
    { id:"risk",  lbl:"Risk",      ico:"⚡", badge:critRiskCount },
    { id:"cam",   lbl:"Cameras",   ico:"📷", badge:zones.length, bg:true },
    { id:"gps",   lbl:"Tracking",  ico:"📡", badge:tracked.length, bg:true },
    { id:"zones", lbl:"Zones",     ico:"◈" },
    { id:"inc",   lbl:"Incidents", ico:"⚑", badge:openIncs.length },
    { id:"alrt",  lbl:"Alerts",    ico:"◎", badge:alerts.length },
    { id:"log",   lbl:"Audit Log", ico:"🗒" },
  ];

  // ── Login / Register screen ────────────────────────────────────────────────
  if (!authed) {
    const isReg = authMode === "register";
    return (
      <div style={{background:T.bg,minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:20,fontFamily:"'Plus Jakarta Sans',sans-serif",color:T.text}}>
        <style>{buildCSS(T)}</style>
        <div style={{width:"100%",maxWidth:400}}>
          <div style={{textAlign:"center",marginBottom:32}}>
            <div style={{width:52,height:52,borderRadius:13,background:T.text,color:T.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,margin:"0 auto 14px"}}>🛡</div>
            <div style={{fontSize:26,fontWeight:800,letterSpacing:"-.5px"}}>CrowdShield</div>
            <div style={{fontSize:12,color:T.muted,marginTop:4}}>Real-time crowd safety platform</div>
          </div>
          <div className="card cp">
            <div className="modal-bar"/>
            <div style={{display:"flex",gap:4,marginBottom:20,background:T.surface,padding:4,borderRadius:8}}>
              {["login","register"].map(m=>(
                <button key={m} onClick={()=>{setAuthMode(m);setAuthErr("");}}
                  style={{flex:1,padding:"7px 0",border:"none",borderRadius:6,cursor:"pointer",
                    fontFamily:"inherit",fontWeight:700,fontSize:12,
                    background:authMode===m?T.card:"transparent",
                    color:authMode===m?T.text:T.muted,
                    boxShadow:authMode===m?T.sh:"none",transition:"all .2s"}}>
                  {m === "login" ? "Sign In" : "Register"}
                </button>
              ))}
            </div>
            {isReg && (
              <div className="frow">
                <label className="flbl">Full Name</label>
                <input className="finp" placeholder="Your name"
                  value={authForm.fullName} onChange={e=>setAuthForm({...authForm,fullName:e.target.value})}
                  onKeyDown={e=>e.key==="Enter"&&handleAuth()}/>
              </div>
            )}
            <div className="frow">
              <label className="flbl">Email</label>
              <input className="finp" type="email" placeholder="admin@crowdshield.com"
                value={authForm.email} onChange={e=>setAuthForm({...authForm,email:e.target.value})}
                onKeyDown={e=>e.key==="Enter"&&handleAuth()}/>
            </div>
            <div className="frow" style={{marginBottom:authErr?12:20}}>
              <label className="flbl">Password</label>
              <input className="finp" type="password" placeholder="••••••••"
                value={authForm.password} onChange={e=>setAuthForm({...authForm,password:e.target.value})}
                onKeyDown={e=>e.key==="Enter"&&handleAuth()}/>
            </div>
            {authErr && (
              <div style={{background:T.critBg,color:T.crit,border:`1px solid ${T.crit}33`,
                borderRadius:7,padding:"8px 11px",fontSize:12,marginBottom:14}}>{authErr}</div>
            )}
            <button className="btn btn-primary" style={{width:"100%",justifyContent:"center",opacity:authLoad?.6:1}}
              onClick={handleAuth} disabled={authLoad}>
              {authLoad ? "Please wait…" : isReg ? "Create Account" : "Sign In"}
            </button>
            <div style={{textAlign:"center",marginTop:14,fontSize:11,color:T.muted}}>
              Demo: admin@crowdshield.com / Admin@1234
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) return (
    <div style={{background:T.bg,minHeight:"100vh"}}>
      <div className="loading"><div className="spinner"/><span>Connecting to CrowdShield…</span></div>
    </div>
  );

  return (
    <div style={{minHeight:"100vh",background:T.bg,color:T.text,transition:"background .3s,color .3s"}}>

      {/* Toast */}
      {toast && (
        <div style={{position:"fixed",bottom:22,left:"50%",transform:"translateX(-50%)",zIndex:9999,
          background:toast.type==="crit"?T.critBg:toast.type==="warn"?T.warnBg:T.safeBg,
          color:toast.type==="crit"?T.crit:toast.type==="warn"?T.warn:T.safe,
          border:`1px solid ${toast.type==="crit"?T.crit:toast.type==="warn"?T.warn:T.safe}44`,
          borderRadius:9,padding:"10px 18px",fontWeight:600,fontSize:13,
          boxShadow:T.sh2,animation:"fu .25s both",whiteSpace:"nowrap"}}>
          {toast.msg}
        </div>
      )}

      {/* HEADER */}
      <header>
        <div className="logo">
          <div className="logo-mark">🛡</div>
          <div className="logo-name">Crowd<span>Shield</span></div>
        </div>
        <div className="hdiv"/>
        <nav className="top-nav">
          {NAV.map(n => (
            <button key={n.id} className={`tn${tab===n.id?" on":""}`} onClick={()=>setTab(n.id)}>
              {n.lbl}
              {n.badge>0 && <span className="tn-badge" style={{background:n.bg?T.safe:T.crit}}/>}
            </button>
          ))}
        </nav>
        <div className="htools">
          {isAdmin() && (evacActive
            ? <button className="btn btn-sm btn-success blink" onClick={clearEvac} style={{fontSize:11}}>✅ All Clear</button>
            : <button className="btn btn-sm btn-warn" onClick={activateEvac} style={{fontSize:11}}>🚨 Evacuate</button>
          )}
          <span className="clk">{clock}</span>
          <div className="live-chip"><div className="live-dot"/><span className="live-lbl">LIVE</span></div>
          <span className={`ws-badge ws-${wsState}`}>{wsState==="live"?"WS ●":wsState==="conn"?"WS …":"REST ↻"}</span>
          <button className="tog" onClick={()=>setDark(d=>{localStorage.setItem("cs-theme",d?"light":"dark");return !d;})}>
            <div className="knob">{isDark?"☾":"☀"}</div>
          </button>
          <div style={{display:"flex",alignItems:"center",gap:6,background:T.surface,border:`1px solid ${T.border}`,borderRadius:8,padding:"4px 10px 4px 8px"}}>
            <div style={{width:22,height:22,borderRadius:"50%",background:isAdmin()?T.accent:T.safe,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"#fff",fontWeight:700,flexShrink:0}}>
              {authUser?.fullName?.[0]?.toUpperCase()||"U"}
            </div>
            <div style={{minWidth:0}}>
              <div style={{fontSize:11,fontWeight:700,color:T.text,lineHeight:1.2,maxWidth:90,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{authUser?.fullName||authUser?.email}</div>
              <div style={{fontSize:9,color:isAdmin()?T.accent:T.safe,fontWeight:700,letterSpacing:.5}}>{isAdmin()?"ADMIN":"USER"}</div>
            </div>
            <button onClick={handleLogout} style={{background:"none",border:"none",cursor:"pointer",color:T.muted,fontSize:14,padding:"0 0 0 4px",lineHeight:1}} title="Sign out">⏻</button>
          </div>
        </div>
      </header>

      {/* Evacuation Banner */}
      {evacActive && (
        <div className="evac-banner">
          <span>🚨 EVACUATION IN PROGRESS — Guide people to exit points calmly</span>
          <button className="btn btn-sm" style={{background:"rgba(255,255,255,.2)",color:"#fff",border:"1px solid rgba(255,255,255,.3)"}} onClick={clearEvac}>✅ All Clear</button>
        </div>
      )}

      <main>
        {/* SIDEBAR */}
        <div className="snav">
          <div className="snav-sec">Monitor</div>
          {NAV.slice(0,4).map(n => (
            <button key={n.id} className={`snav-btn${tab===n.id?" on":""}`} onClick={()=>setTab(n.id)}>
              <span className="snav-ico">{n.ico}</span>{n.lbl}
              {n.badge>0 && <span className="snav-badge" style={{background:n.bg?T.safeBg:T.critBg,color:n.bg?T.safe:T.crit}}>{n.badge}</span>}
            </button>
          ))}
          <div className="snav-sec">Manage</div>
          {NAV.slice(4).map(n => (
            <button key={n.id} className={`snav-btn${tab===n.id?" on":""}`} onClick={()=>setTab(n.id)}>
              <span className="snav-ico">{n.ico}</span>{n.lbl}
              {n.badge>0 && <span className="snav-badge" style={{background:T.critBg,color:T.crit}}>{n.badge}</span>}
            </button>
          ))}
          <div className="snav-status">
            <div>Backend: :8080</div>
            <div>WS: {wsState==="live"?"✓ connected":wsState==="conn"?"connecting…":"polling"}</div>
            {sync && <div>Sync: {fmtTimeShort(sync)}</div>}
            <div>Zones: {zones.length} · Users: {tracked.length}</div>
            {evacActive && <div style={{color:T.evac,fontWeight:700,marginTop:4}}>⚠ EVAC ACTIVE</div>}
          </div>
        </div>

        <div className="content">

          {/* ╔══ LIVE MAP ══╗ */}
          <div className={`tab-pane${tab==="map"?" on":""}`}>
            <div className="ph">
              <div className="ph-left">
                <div className="ph-title">Live Map</div>
                <div className="ph-sub">{zones.length} zones · {tracked.length} GPS users · {sync?`synced ${fmtTimeShort(sync)}`:"syncing…"}</div>
              </div>
              <div className="ph-actions">
                <button className="btn btn-ghost btn-sm" onClick={()=>setHeat(h=>!h)} style={heat?{background:T.warnBg,color:T.warn,borderColor:T.warn}:{}}>🌡 {heat?"Heat On":"Heatmap"}</button>
                {authed && <button className="btn btn-danger btn-sm" onClick={()=>setModal("incident")}>⚑ Report</button>}
              </div>
            </div>
            <div className="sc-grid mb20" style={{gridTemplateColumns:"repeat(5,1fr)"}}>
              {[
                ["Zones",zones.length,T.accent],
                ["GPS Live",tracked.length,T.safe],
                ["Critical",critCount,T.crit],
                ["Incidents",openIncs.length,T.warn],
                ["Avg Density",overallDensity+"%",T.text],
              ].map(([lbl,val,col])=>(
                <div key={lbl} className="sc"><div className="sc-val" style={{color:col}}>{val}</div><div className="sc-lbl">{lbl}</div></div>
              ))}
            </div>
            <div className="map-layout">
              <div style={{height:"calc(100vh - 290px)",minHeight:450}}><ZoneMap {...mapProps}/></div>
              <div className="col" style={{maxHeight:"calc(100vh - 290px)",overflowY:"auto"}}>
                <div className="card">
                  <div className="ch"><span className="ch-title">Zones</span><span style={{fontSize:11,color:T.muted}}>{zones.length} total</span></div>
                  {zones.length===0
                    ? <div className="empty">Draw zones on the map</div>
                    : zones.map(z => (
                        <div key={z.id} className="lr">
                          <div style={{flex:1,minWidth:0}}>
                            <div className="lr-title">{z.name}</div>
                            <DBar value={z.currentCount} max={z.capacity} T={T} height={3}/>
                            <Sparkline data={(zoneHistory[z.id]||[]).map(h=>h.count)} T={T}/>
                          </div>
                          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:5}}>
                            <Pill status={z.status} T={T}/>
                            {riskScores[z.id] && <RiskGauge small score={riskScores[z.id].riskScore} level={riskScores[z.id].riskLevel} color={riskScores[z.id].riskColor}/>}
                          </div>
                        </div>
                      ))
                  }
                </div>
                {tracked.length>0 && (
                  <div className="card">
                    <div className="ch"><span className="ch-title">GPS Users</span><span style={{background:T.safeBg,color:T.safe,borderRadius:5,padding:"2px 8px",fontSize:11,fontWeight:600}}>{tracked.length} live</span></div>
                    {tracked.map(u => (
                      <div key={u.deviceId} className="lr">
                        <div><div className="lr-title">👤 {u.displayName||"User"}</div><div className="lr-sub">{u.currentZoneName||"Outside zones"}</div></div>
                        <div className="live-dot"/>
                      </div>
                    ))}
                  </div>
                )}
                {openIncs.length>0 && (
                  <div className="card">
                    <div className="ch"><span className="ch-title">Active Incidents</span></div>
                    {openIncs.map(i => (
                      <div key={i.id} className="lr">
                        <div><div className="lr-title">{INC_I[i.type]||"⚠️"} {i.title}</div><div className="lr-sub">{i.zoneName}</div></div>
                        <SevPill sev={i.severity} T={T}/>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ╔══ DASHBOARD ══╗ */}
          <div className={`tab-pane${tab==="dash"?" on":""}`}>
            <div className="ph">
              <div className="ph-left"><div className="ph-title">Dashboard</div><div className="ph-sub">Venue overview · {sync?fmtTimeShort(sync):"–"}</div></div>
              <div className="ph-actions">
                <button className="btn btn-ghost btn-sm" onClick={()=>exportCSV("zones")}>📥 Export Zones</button>
              </div>
            </div>
            <div className="sc-grid mb24" style={{gridTemplateColumns:"repeat(6,1fr)"}}>
              {[
                ["◈","Zones", stats?.totalZones??zones.length, T.accent,""],
                ["👥","People", (stats?.totalCurrentCount??0).toLocaleString(), T.text, `cap ${(stats?.totalCapacity??0).toLocaleString()}`],
                ["📡","GPS Live", tracked.length, T.safe,""],
                ["📊","Density", overallDensity+"%", T.text,""],
                ["🚨","Critical", stats?.criticalZones??0, T.crit,""],
                ["⚑","Incidents", stats?.openIncidents??0, T.warn,""],
              ].map(([ico,lbl,val,col,sub])=>(
                <div key={lbl} className="sc">
                  <div style={{fontSize:17,marginBottom:8,opacity:.55}}>{ico}</div>
                  <div className="sc-val" style={{color:col}}>{val}</div>
                  <div className="sc-lbl">{lbl}</div>
                  {sub && <div className="sc-sub">{sub}</div>}
                </div>
              ))}
            </div>
            <div className="g2c mb24">
              <div className="card">
                <div className="ch"><span className="ch-title">Zone Density</span><span className="ch-sub">% capacity</span></div>
                <div className="cp">
                  <div className="hchart">
                    {zones.map(z => {
                      const p = pct(z.currentCount, z.capacity);
                      return (
                        <div key={z.id} className="hc-col" title={`${z.name}: ${p}%`}>
                          <div style={{flex:1,display:"flex",alignItems:"flex-end",width:"100%"}}>
                            <div className="hc-bar" style={{height:Math.max(3,Math.round(p/100*56)),background:dcol(p,T),width:"100%"}}/>
                          </div>
                          <div className="hc-lbl">{z.name.split(" ")[0]}</div>
                        </div>
                      );
                    })}
                  </div>
                  {zones.length===0 && <div style={{textAlign:"center",color:T.muted,fontSize:11,padding:"20px 0"}}>No zones yet</div>}
                </div>
              </div>
              <div className="card">
                <div className="ch"><span className="ch-title">Recent Incidents</span><button className="btn btn-ghost btn-sm" onClick={()=>setTab("inc")}>All →</button></div>
                {incs.slice(0,5).map(i => (
                  <div key={i.id} className="lr">
                    <div style={{minWidth:0}}>
                      <div className="lr-title">{INC_I[i.type]||"⚠️"} {i.title}</div>
                      <div className="lr-sub">{i.zoneName} · {fmtTime(i.reportedAt)}</div>
                    </div>
                    <Pill status={i.status} T={T}/>
                  </div>
                ))}
                {incs.length===0 && <div className="empty">No incidents</div>}
              </div>
            </div>

            {/* Zone table with sparklines */}
            <div className="card">
              <div className="ch"><span className="ch-title">Zone Overview</span></div>
              <table className="tbl">
                <thead><tr><th>Zone</th><th>Status</th><th>Count</th><th>Density</th><th>Trend</th><th>Risk</th></tr></thead>
                <tbody>
                  {zones.map(z => {
                    const p = pct(z.currentCount, z.capacity);
                    const hist = (zoneHistory[z.id]||[]).map(h=>h.count);
                    return (
                      <tr key={z.id}>
                        <td><div className="tz-name">{z.name}</div><div className="tz-meta">📍 {z.location} {z.areaSquareMetres>0?`· ${fmtArea(z.areaSquareMetres)}`:""}</div></td>
                        <td><Pill status={z.status} T={T}/></td>
                        <td><span style={{fontFamily:"'DM Mono',monospace",fontSize:13}}>{z.currentCount}/{z.capacity}</span></td>
                        <td style={{minWidth:140}}>
                          <div style={{background:T.border,borderRadius:2,height:4,overflow:"hidden"}}><div style={{height:"100%",width:`${p}%`,background:dcol(p,T),borderRadius:2,transition:"width .6s"}}/></div>
                          <div style={{fontSize:10,color:T.muted,marginTop:3,fontFamily:"'DM Mono',monospace"}}>{p}%</div>
                        </td>
                        <td style={{minWidth:80}}><Sparkline data={hist} T={T}/></td>
                        <td>{riskScores[z.id] && <RiskGauge small score={riskScores[z.id].riskScore} level={riskScores[z.id].riskLevel} color={riskScores[z.id].riskColor}/>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {zones.length===0 && <div className="empty">No zones yet</div>}
            </div>
          </div>

          {/* ╔══ CAMERAS ══╗ */}
          <div className={`tab-pane${tab==="cam"?" on":""}`}>
            <div className="ph">
              <div className="ph-left"><div className="ph-title">Camera Feeds</div><div className="ph-sub">YOLOv8 auto-counting · each camera pushes count every 3s</div></div>
            </div>
            <div className="hint">📷 Start <code style={{background:T.border,padding:"1px 5px",borderRadius:4,fontFamily:"'DM Mono',monospace"}}>python camera_counter.py</code> in <code style={{background:T.border,padding:"1px 5px",borderRadius:4,fontFamily:"'DM Mono',monospace"}}>camera-counter/</code>. Each camera auto-pushes counts to its assigned zone — no manual input needed.</div>
            {zones.length===0
              ? <div className="card"><div className="empty" style={{padding:"50px 20px"}}><div style={{fontSize:34,marginBottom:10}}>📷</div><div style={{fontWeight:700,marginBottom:5}}>No zones</div><div>Draw zones first, then assign cameras in config.json</div></div></div>
              : <div className="g2">{zones.map((z,i)=>{
                  const p=pct(z.currentCount,z.capacity); const c=dcol(p,T);
                  const hist=(zoneHistory[z.id]||[]).map(h=>h.count);
                  return (
                    <div key={z.id} className="cam-card si" style={{animationDelay:`${i*40}ms`}}>
                      <div className="cam-prev">
                        <div className="cam-grid"/>
                        <div style={{position:"relative",zIndex:2,textAlign:"center",opacity:.4}}>
                          <div style={{fontSize:28}}>📷</div>
                          <div style={{fontSize:10,marginTop:3,fontFamily:"'DM Mono',monospace",color:T.muted}}>cam-{i+1}</div>
                        </div>
                        {[[.22,.18,.24,.5],[.4,.28,.22,.5],[.62,.15,.2,.5]].map(([lf,tp,w,h],j)=>(
                          <div key={j} className="cam-box" style={{width:`${w*100}%`,height:`${h*100}%`,left:`${lf*100}%`,top:`${tp*100}%`,borderColor:c}}/>
                        ))}
                        <div className="cam-count">
                          <span style={{color:"#fff",fontSize:13,fontFamily:"'DM Mono',monospace",fontWeight:700}}>👥 {z.currentCount}</span>
                          <span style={{color:T.safe,fontSize:9,fontFamily:"'DM Mono',monospace",fontWeight:700}}>LIVE</span>
                        </div>
                      </div>
                      <div className="cam-foot">
                        <div className="fb mb20" style={{marginBottom:9}}><div><div style={{fontSize:13,fontWeight:700}}>{z.name}</div><div style={{fontSize:11,color:T.muted}}>{z.location}</div></div><Pill status={z.status} T={T}/></div>
                        <DBar value={z.currentCount} max={z.capacity} T={T} height={5}/>
                        <Sparkline data={hist} T={T}/>
                        <div style={{marginTop:7,fontSize:11,color:T.safe,fontWeight:600}}>✓ Auto-counting</div>
                      </div>
                    </div>
                  );
                })}</div>
            }
          </div>

          {/* ╔══ GPS TRACKING ══╗ */}
          <div className={`tab-pane${tab==="gps"?" on":""}`}>
            <div className="ph">
              <div className="ph-left"><div className="ph-title">GPS Tracking</div><div className="ph-sub">{tracked.length} live users · WebSocket real-time</div></div>
            </div>
            <div className="card mb24">
              <div className="cp fb" style={{flexWrap:"wrap",gap:12}}>
                <div><div style={{fontWeight:700,fontSize:14,marginBottom:3}}>Share tracking link</div><div style={{fontSize:12.5,color:T.muted}}>Attendees open on phone → tap Start → appear live on map with auto zone detection</div></div>
                <button className="btn btn-primary" onClick={()=>setShowLink(s=>!s)}>{showLink?"Hide Link":"Show Link"}</button>
              </div>
              {showLink && (
                <div style={{padding:"0 20px 16px"}}>
                  <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:7,padding:"9px 13px",fontFamily:"'DM Mono',monospace",fontSize:12,color:T.accent,wordBreak:"break-all",marginBottom:7}}>{tUrl}</div>
                  <div style={{fontSize:11,color:T.muted}}>💡 Replace <code style={{background:T.border,padding:"1px 4px",borderRadius:3}}>localhost</code> with your IP address for phone access on the same WiFi.</div>
                </div>
              )}
            </div>
            {tracked.length===0
              ? <div className="card"><div className="empty" style={{padding:"55px 20px"}}><div style={{fontSize:34,marginBottom:10}}>📡</div><div style={{fontWeight:700,marginBottom:5}}>No GPS users yet</div><div>Share the link above with attendees</div></div></div>
              : <div className="g3">{tracked.map((u,i)=>(
                  <div key={u.deviceId} className="card cp si" style={{animationDelay:`${i*40}ms`}}>
                    <div className="fb" style={{marginBottom:10}}>
                      <div><div style={{fontSize:14,fontWeight:700}}>👤 {u.displayName||"User-"+u.deviceId.substr(0,6)}</div><div style={{fontSize:12,color:u.currentZoneName?T.safe:T.muted,marginTop:2}}>{u.currentZoneName?"📍 "+u.currentZoneName:"Outside zones"}</div></div>
                      <div className="live-chip"><div className="live-dot"/><span className="live-lbl">Live</span></div>
                    </div>
                    <div className="gps-data">
                      <div className="gdr"><span>LAT</span><span style={{color:T.text}}>{(u.latitude||0).toFixed(5)}°</span></div>
                      <div className="gdr"><span>LNG</span><span style={{color:T.text}}>{(u.longitude||0).toFixed(5)}°</span></div>
                      {u.accuracy && <div className="gdr"><span>ACC</span><span style={{color:u.accuracy<20?T.safe:u.accuracy<100?T.warn:T.crit}}>±{Math.round(u.accuracy)} m</span></div>}
                    </div>
                  </div>
                ))}
              </div>
            }
          </div>

          {/* ╔══ ZONES ══╗ */}
          <div className={`tab-pane${tab==="zones"?" on":""}`}>
            <div className="ph">
              <div className="ph-left"><div className="ph-title">Zones</div><div className="ph-sub">{zones.length} monitored areas</div></div>
              <div className="ph-actions">
                <button className="btn btn-ghost btn-sm" onClick={()=>exportCSV("zones")}>📥 CSV</button>
                {isAdmin() && <button className="btn btn-primary" onClick={()=>setTab("map")}>+ Draw on Map</button>}
              </div>
            </div>
            <div className="search-wrap"><span className="search-ico">🔍</span><input className="search-inp" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search zones…"/></div>
            <div className="hint">Draw on the Live Map with polygon or circle tools. Click a zone on the map to update count manually, or let cameras push automatically.</div>
            <div className="card">
              <table className="tbl">
                <thead><tr><th>Zone</th><th>Status</th><th>Occupancy</th><th>Density</th><th>Trend</th><th>Risk</th><th/></tr></thead>
                <tbody>
                  {filteredZones.map(z => {
                    const p = pct(z.currentCount, z.capacity);
                    const hist = (zoneHistory[z.id]||[]).map(h=>h.count);
                    return (
                      <tr key={z.id}>
                        <td><div className="tz-name">{z.name}</div><div className="tz-meta">📍 {z.location} {z.areaSquareMetres>0?`· ${fmtArea(z.areaSquareMetres)}`:""} · {z.shapeType}</div></td>
                        <td><Pill status={z.status} T={T}/></td>
                        <td>
                          <div style={{display:"flex",alignItems:"center",gap:7}}>
                            <input className="inline-inp" type="number" defaultValue={z.currentCount} min={0} max={z.capacity}
                              onBlur={e=>{const v=Number(e.target.value);if(v!==z.currentCount)updateCount(z.id,v);}}
                              onKeyDown={e=>{if(e.key==="Enter"){const v=Number(e.target.value);if(v!==z.currentCount)updateCount(z.id,v);e.target.blur();}}}/>
                            <span style={{fontSize:11,color:T.muted}}>/ {z.capacity}</span>
                          </div>
                        </td>
                        <td style={{minWidth:130}}>
                          <div style={{background:T.border,borderRadius:2,height:4,overflow:"hidden"}}><div style={{height:"100%",width:`${p}%`,background:dcol(p,T),borderRadius:2,transition:"width .6s"}}/></div>
                          <div style={{fontSize:10,color:T.muted,marginTop:3,fontFamily:"'DM Mono',monospace"}}>{p}%</div>
                        </td>
                        <td style={{minWidth:70}}><Sparkline data={hist} T={T}/></td>
                        <td>{riskScores[z.id] && <RiskGauge small score={riskScores[z.id].riskScore} level={riskScores[z.id].riskLevel} color={riskScores[z.id].riskColor}/>}</td>
                        <td>
                          <div className="fg">
                            {isAdmin() && <button className="btn btn-ghost btn-sm" onClick={()=>{setEditZ({...z});setModal("zone-edit");}}>Edit</button>}
                            {isAdmin() && <button className="btn btn-danger btn-sm" onClick={()=>deleteZone(z.id,z.name)}>Del</button>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredZones.length===0 && <div className="empty">{zones.length===0?"No zones yet":"No matching zones"}</div>}
            </div>
          </div>

          {/* ╔══ INCIDENTS ══╗ */}
          <div className={`tab-pane${tab==="inc"?" on":""}`}>
            <div className="ph">
              <div className="ph-left"><div className="ph-title">Incidents</div><div className="ph-sub">{openIncs.length} open · {incs.filter(i=>i.status==="RESOLVED").length} resolved</div></div>
              <div className="ph-actions">
                <button className="btn btn-ghost btn-sm" onClick={()=>exportCSV("incidents")}>📥 CSV</button>
                {authed && <button className="btn btn-danger" onClick={()=>setModal("incident")}>⚑ Report Incident</button>}
              </div>
            </div>
            <div style={{display:"flex",gap:10,marginBottom:14,flexWrap:"wrap"}}>
              <div className="search-wrap" style={{flex:1,marginBottom:0}}>
                <span className="search-ico">🔍</span>
                <input className="search-inp" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search incidents…"/>
              </div>
              {["ALL","OPEN","IN_PROGRESS","RESOLVED","CRITICAL","HIGH"].map(f=>(
                <button key={f} className="btn btn-sm" style={{background:incFilter===f?T.text:T.surface,color:incFilter===f?T.bg:T.sub,border:`1px solid ${T.border}`}} onClick={()=>setIncF(f)}>{f}</button>
              ))}
            </div>
            <div className="card">
              {filteredIncs.map(inc => (
                <div key={inc.id} className="lr">
                  <div style={{flex:1,minWidth:0}}>
                    <div className="fg" style={{flexWrap:"wrap",marginBottom:4,gap:7}}>
                      <span style={{fontSize:18}}>{INC_I[inc.type]||"⚠️"}</span>
                      <span className="lr-title">{inc.title}</span>
                      <SevPill sev={inc.severity} T={T}/>
                      <Pill status={inc.status} T={T}/>
                    </div>
                    <div className="lr-sub"><span style={{color:T.accent}}>◈ {inc.zoneName||"–"}</span>{inc.description?" — "+inc.description:""}</div>
                    <div className="lr-time">{fmtTime(inc.reportedAt)}{inc.resolvedAt?" → resolved "+fmtTime(inc.resolvedAt):""}</div>
                  </div>
                  {inc.status==="OPEN" && <button className="btn btn-success btn-sm" style={{whiteSpace:"nowrap"}} onClick={()=>resolveInc(inc)}>✓ Resolve</button>}
                </div>
              ))}
              {filteredIncs.length===0 && <div className="empty">{incs.length===0?"No incidents reported":"No matching incidents"}</div>}
            </div>
          </div>

          {/* ╔══ ALERTS ══╗ */}
          <div className={`tab-pane${tab==="alrt"?" on":""}`}>
            <div className="ph">
              <div className="ph-left"><div className="ph-title">Alerts</div><div className="ph-sub">{alerts.length} unacknowledged · auto-generated from density + incidents</div></div>
              <div className="ph-actions">
                {alerts.length>0 && <button className="btn btn-ghost" onClick={ackAll}>Ack All</button>}
              </div>
            </div>
            <div className="card">
              {alerts.map(a => {
                const isCrit = a.type?.includes("CRITICAL") || a.type==="EVACUATION_REQUIRED";
                const isEvacA = a.type==="EVACUATION_REQUIRED";
                return (
                  <div key={a.id} className="lr" style={isEvacA?{background:T.evacBg}:{}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div className="fg" style={{marginBottom:3}}>
                        <span style={{width:7,height:7,borderRadius:"50%",background:isEvacA?T.evac:isCrit?T.crit:T.warn,display:"inline-block",flexShrink:0}}/>
                        <span className="lr-title">{a.message}</span>
                      </div>
                      <div className="lr-time" style={{paddingLeft:15}}>{a.zoneName||"System"} · {a.type} · {fmtTime(a.createdAt)}</div>
                    </div>
                    <button className="btn btn-ghost btn-xs" onClick={()=>ackAlert(a.id)}>Ack</button>
                  </div>
                );
              })}
              {alerts.length===0 && (
                <div className="empty" style={{padding:"46px 20px"}}>
                  <div style={{fontSize:30,marginBottom:8}}>✅</div>
                  <div style={{fontWeight:700,marginBottom:3,fontSize:14}}>All clear</div>
                  <div style={{fontSize:12}}>No active alerts</div>
                </div>
              )}
            </div>
          </div>


          {/* ╔══ RISK ANALYSIS ══╗ */}
          <div className={`tab-pane${tab==="risk"?" on":""}`}>
            <div className="ph">
              <div className="ph-left">
                <div className="ph-title">Risk Analysis</div>
                <div className="ph-sub">Smart crowd density classification · scores update every 8s</div>
              </div>
              <div className="ph-actions">
                <button className="btn btn-ghost btn-sm" onClick={()=>exportCSV("zones")}>📥 Export</button>
              </div>
            </div>

            {/* Risk summary bar */}
            {(() => {
              const scores = zones.map(z => riskScores[z.id]?.riskScore||0);
              const counts = {CRITICAL:0,SEVERE:0,HIGH:0,MODERATE:0,LOW:0};
              zones.forEach(z => { const l = riskScores[z.id]?.riskLevel||"LOW"; counts[l]=(counts[l]||0)+1; });
              return (
                <div className="sc-grid mb24" style={{gridTemplateColumns:"repeat(5,1fr)"}}>
                  {[["CRITICAL","🚨",T.crit,T.critBg],["SEVERE","⚠️",T.crit,T.critBg],
                    ["HIGH","🔶","#f0832a","#1a0d00"],["MODERATE","🟡",T.warn,T.warnBg],
                    ["LOW","✅",T.safe,T.safeBg]].map(([lvl,ico,col,bg])=>(
                    <div key={lvl} className="sc" style={{borderTop:`3px solid ${col}`}}>
                      <div style={{fontSize:20,marginBottom:6}}>{ico}</div>
                      <div className="sc-val" style={{color:col}}>{counts[lvl]||0}</div>
                      <div className="sc-lbl">{lvl}</div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Per-zone risk cards */}
            <div className="g2">
              {zones.map(z => {
                const rs = riskScores[z.id];
                if (!rs) return (
                  <div key={z.id} className="card cp" style={{opacity:.5}}>
                    <div style={{fontWeight:700}}>{z.name}</div>
                    <div style={{fontSize:11,color:T.muted,marginTop:4}}>Calculating…</div>
                  </div>
                );
                const borderCol = rs.riskColor;
                const isCrit = rs.riskScore >= 75;
                return (
                  <div key={z.id} className="card" style={{borderTop:`3px solid ${borderCol}`,
                    boxShadow:isCrit?`0 0 18px ${borderCol}22`:T.sh}}>
                    <div className="cp">
                      {/* Header row */}
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
                        <div>
                          <div style={{fontSize:14,fontWeight:800,color:T.text}}>{z.name}</div>
                          <div style={{fontSize:11,color:T.muted,marginTop:2}}>📍 {z.location}</div>
                        </div>
                        <RiskGauge score={rs.riskScore} level={rs.riskLevel} color={rs.riskColor} recommendation={rs.recommendation}/>
                      </div>

                      {/* Density bar */}
                      <DBar value={z.currentCount} max={z.capacity} T={T} height={5}/>

                      {/* Signal breakdown */}
                      <div style={{marginTop:12,display:"flex",flexDirection:"column",gap:6}}>
                        <div style={{fontSize:9.5,fontWeight:800,color:T.muted,letterSpacing:1.5,textTransform:"uppercase",marginBottom:2}}>Signal Breakdown</div>
                        {[
                          ["Density",    rs.densitySignal,  40, T.crit],
                          ["Trend",      rs.trendSignal,    25, T.warn],
                          ["Time of day",rs.timeSignal,     15, T.info],
                          ["Incidents",  rs.incidentSignal, 20, "#f0832a"],
                        ].map(([lbl,val,max,col])=>(
                          <div key={lbl}>
                            <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                              <span style={{fontSize:10,color:T.sub}}>{lbl}</span>
                              <span style={{fontSize:10,fontFamily:"'DM Mono',monospace",color:T.text}}>{val}/{max}</span>
                            </div>
                            <div style={{height:3,background:T.border,borderRadius:2,overflow:"hidden"}}>
                              <div style={{height:"100%",width:`${(val/max)*100}%`,background:col,borderRadius:2,transition:"width .6s"}}/>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Recommendation */}
                      <div style={{marginTop:12,background:isCrit?`${borderCol}18`:T.surface,
                        border:`1px solid ${isCrit?borderCol+"44":T.border}`,
                        borderRadius:7,padding:"7px 10px",
                        fontSize:11.5,fontWeight:600,color:isCrit?borderCol:T.sub,
                        display:"flex",alignItems:"center",gap:6}}>
                        <span>{isCrit?"⚠":"💡"}</span>
                        <span>{rs.recommendation}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {zones.length===0 && (
              <div className="card"><div className="empty" style={{padding:"50px 20px"}}>
                <div style={{fontSize:34,marginBottom:10}}>⚡</div>
                <div style={{fontWeight:700,marginBottom:5}}>No zones to analyse</div>
                <div>Draw zones on the Live Map first</div>
              </div></div>
            )}
          </div>

          {/* ╔══ AUDIT LOG ══╗ */}
          <div className={`tab-pane${tab==="log"?" on":""}`}>
            <div className="ph">
              <div className="ph-left"><div className="ph-title">Audit Log</div><div className="ph-sub">{audit.length} events this session</div></div>
              <div className="ph-actions">
                <button className="btn btn-ghost btn-sm" onClick={()=>setAudit([])}>Clear</button>
              </div>
            </div>
            <div className="card">
              {audit.map(e => (
                <div key={e.id} className="audit-row">
                  <span className="audit-ico">{e.icon}</span>
                  <div className="audit-body"><div className="audit-msg">{e.msg}</div><div className="audit-time">{fmtTime(e.ts)}</div></div>
                </div>
              ))}
              {audit.length===0 && <div className="empty">No events yet — actions will appear here</div>}
            </div>
          </div>

        </div>{/* /content */}
      </main>

      {/* ── REPORT INCIDENT MODAL ── */}
      {modal==="incident" && (
        <div className="overlay" onClick={e=>e.target===e.currentTarget&&setModal(null)}>
          <div className="modal fu">
            <div className="modal-bar"/>
            <div className="modal-title">Report Incident</div>
            <div className="frow">
              <label className="flbl">Zone</label>
              <select className="finp" value={newInc.zoneId} onChange={e=>setNI({...newInc,zoneId:e.target.value})}>
                <option value="">Select zone…</option>
                {zones.map(z=><option key={z.id} value={z.id}>{z.name}</option>)}
              </select>
            </div>
            <div className="frow"><label className="flbl">Title</label><input className="finp" value={newInc.title} placeholder="Brief description" onChange={e=>setNI({...newInc,title:e.target.value})} onKeyDown={e=>e.key==="Enter"&&newInc.zoneId&&newInc.title&&createInc()}/></div>
            <div className="frow"><label className="flbl">Details (optional)</label><input className="finp" value={newInc.description} placeholder="More context" onChange={e=>setNI({...newInc,description:e.target.value})}/></div>
            <div className="g2c">
              <div className="frow"><label className="flbl">Type</label><select className="finp" value={newInc.type} onChange={e=>setNI({...newInc,type:e.target.value})}>{["OVERCROWDING","MEDICAL","FIRE","STAMPEDE","SECURITY","OTHER"].map(t=><option key={t}>{t}</option>)}</select></div>
              <div className="frow"><label className="flbl">Severity</label><select className="finp" value={newInc.severity} onChange={e=>setNI({...newInc,severity:e.target.value})}>{["LOW","MEDIUM","HIGH","CRITICAL"].map(s=><option key={s}>{s}</option>)}</select></div>
            </div>
            <div className="fg" style={{marginTop:3}}>
              <button className="btn btn-danger" style={{flex:1,justifyContent:"center",opacity:newInc.zoneId&&newInc.title?1:.45}} onClick={createInc}>Report Incident</button>
              <button className="btn btn-ghost" onClick={()=>setModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT ZONE MODAL ── */}
      {modal==="zone-edit" && editZone && (
        <div className="overlay" onClick={e=>e.target===e.currentTarget&&setModal(null)}>
          <div className="modal fu">
            <div className="modal-bar"/>
            <div className="modal-title">Edit Zone</div>
            {[["Name","name","text"],["Location","location","text"],["Max Capacity","capacity","number"]].map(([lb,key,tp])=>(
              <div className="frow" key={key}>
                <label className="flbl">{lb}</label>
                <input className="finp" type={tp} value={editZone[key]||""} onChange={e=>setEditZ({...editZone,[key]:tp==="number"?Number(e.target.value):e.target.value})}/>
              </div>
            ))}
            <div className="fg" style={{marginTop:3}}>
              <button className="btn btn-primary" style={{flex:1,justifyContent:"center"}} onClick={saveEditZone}>Save Changes</button>
              <button className="btn btn-ghost" onClick={()=>{setModal(null);setEditZ(null);}}>Cancel</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
