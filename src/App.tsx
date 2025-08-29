import React, { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { motion } from "framer-motion";

/**********************
 * Constants & Config *
 **********************/
const TIERS = ["Common", "Rare", "Epic", "Legend"] as const;
const ROLES = ["BAT", "BOWL", "AR", "WK"] as const;

const PACKS = {
  Bronze: { price: 200, odds: { Common: 70, Rare: 25, Epic: 4.5, Legend: 0.5 } },
  Silver: { price: 600, odds: { Common: 40, Rare: 45, Epic: 13, Legend: 2 } },
  Gold: { price: 1200, odds: { Common: 20, Rare: 50, Epic: 25, Legend: 5 } },
} as const;

/**********************
 * Helper Functions   *
 **********************/
function pickTier(odds: Record<string, number>) {
  const roll = Math.random() * 100;
  let cum = 0;
  for (const t of TIERS) {
    cum += odds[t] ?? 0;
    if (roll <= cum) return t;
  }
  return "Common";
}

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**********************
 * Mock Players        *
 **********************/
const TEAMS = ["Mumbai Mavericks","Chennai Kings","Delhi Dynamos","Bangalore Blaze","Kolkata Knights","Punjab Panthers","Hyderabad Hawks","Rajasthan Royals"];
const NAMES = ["R. Sharma","V. Kohli","S. Gill","K. Rahul","S. Iyer","H. Pandya","R. Jadeja","S. Samson","J. Bumrah","M. Shami","Y. Chahal","B. Kumar","S. Yadav","I. Kishan","P. Shaw","D. Padikkal","S. Raina","A. Rahane","K. Williamson","D. Warner","B. Stokes","G. Maxwell","M. Marsh","T. Head","T. Boult","R. Khan","M. Starc","S. Afridi","N. Pooran","Q. de Kock","J. Root","K. Mayers","F. du Plessis","A. Finch","R. Pant","S. Dhawan","K. Pollard","A. Russell","D. Miller","L. Rahul","U. Malik","P. Krishna","R. Ashwin","W. Hasaranga","S. Narine","M. Nabi","H. Rauf","M. Siraj","S. Thakur","A. Khan","R. Gaikwad","S. Jaiswal","T. Varma","S. Sudharsan","A. Patel","K. Yadav","R. Bishnoi","A. Khan","K. Ahmed","M. Agarwal"];

const makePlayers = () => {
  const list: Player[] = [];
  let id = 1;
  for (const name of NAMES) {
    const role = ROLES[randInt(0, ROLES.length - 1)];
    const team = TEAMS[randInt(0, TEAMS.length - 1)];
    const rating = randInt(60, 98);
    const tier = rating >= 94 ? "Legend" : rating >= 86 ? "Epic" : rating >= 75 ? "Rare" : "Common";
    const stats = { batting: randInt(50, 99), bowling: randInt(50, 99), fielding: randInt(50, 99), pace: randInt(50, 99) };
    list.push({ id: String(id++), name, role, team, rating, tier, stats });
  }
  return list;
};

/**********************
 * Types & State       *
 **********************/
type Tier = typeof TIERS[number];
type Player = { id:string; name:string; role:typeof ROLES[number]; team:string; rating:number; tier:Tier; stats:{batting:number; bowling:number; fielding:number; pace:number;} };
type OwnedCard = Player & { stars:number; count:number };
type PackResult = { items:{card:Player; isDupe:boolean; upgraded:boolean; convertedCoins:number;}[]; anyEpicOrLegend:boolean; coinsDelta:number;};

type State = { coins:number; inventory:Record<string,OwnedCard>; mute:boolean; };
const initialState: State = { coins:5000, inventory:{}, mute:false };
const STORAGE_KEY = "cricket-packs-state-v2";

function loadState(): State { try { const raw = localStorage.getItem(STORAGE_KEY); if(raw) return JSON.parse(raw);} catch{} return initialState;}
function saveState(state: State) { try{ localStorage.setItem(STORAGE_KEY,JSON.stringify(state)); } catch{} }

type Action = { type:"TOGGLE_MUTE" } | { type:"APPLY_PACK_RESULT"; payload:PackResult } | { type:"RESET" } | { type:"ADD_COINS"; payload:number };

function reducer(state:State, action:Action):State{
  switch(action.type){
    case "TOGGLE_MUTE": return { ...state, mute:!state.mute };
    case "ADD_COINS": return { ...state, coins: Math.max(0,state.coins+action.payload) };
    case "APPLY_PACK_RESULT":{
      const s = {...state, inventory:{...state.inventory}};
      s.coins += action.payload.coinsDelta;
      for(const it of action.payload.items){
        const p = it.card;
        const existing = s.inventory[p.id];
        if(!existing) s.inventory[p.id] = { ...p, stars:1, count:1 };
        else {
          if(existing.stars<5) s.inventory[p.id] = { ...existing, stars: existing.stars+1, count: existing.count+1 };
          else s.inventory[p.id] = { ...existing, count: existing.count+1 };
        }
      }
      return s;
    }
    case "RESET": return initialState;
    default: return state;
  }
}

const AppContext = React.createContext<{state:State; dispatch:React.Dispatch<Action>}|null>(null);

function AppProvider({children}:{children:React.ReactNode}){
  const [state, dispatch] = useReducer(reducer, undefined as any, loadState);
  useEffect(()=>saveState(state), [state]);
  return <AppContext.Provider value={{state, dispatch}}>{children}</AppContext.Provider>;
}

function useApp(){ const ctx = React.useContext(AppContext); if(!ctx) throw new Error("useApp must be used within AppProvider"); return ctx; }

/**********************
 * Sound Effects       *
 **********************/
function useSFX(muted: boolean) {
  const audioCtxRef = useRef<AudioContext | null>(null);

  const getAudioCtx = () => {
    if (!audioCtxRef.current) {
      const AudioContextClass: any = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return null;
      audioCtxRef.current = new AudioContextClass();
    }
    return audioCtxRef.current;
  };

  function beep(type: OscillatorType, duration = 0.12, freq = 440, gain = 0.06) {
    if (muted) return;
    const ctx = getAudioCtx();
    if (!ctx) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = gain;
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + duration);
  }

  useEffect(() => {
    return () => {
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  return {
    sfxOpen: () => beep("sawtooth", 0.2, 220, 0.08),
    sfxFlip: () => beep("square", 0.1, 520, 0.05),
    sfxRare: () => beep("triangle", 0.3, 880, 0.1),
    sfxClick: () => beep("sine", 0.08, 660, 0.04),
  };
}

/**********************
 * UI Components       *
 **********************/
function TierBadge({ tier }: { tier: Tier }) {
  return <span style={{ padding: "2px 6px", borderRadius:"8px", border:"1px solid white", fontSize:"12px" }}>{tier}</span>;
}
/*const TIER_GLOWS: Record<string, string> = {
  Common: "shadow-[0_0_20px_rgba(192,192,192,0.3)]",          // Silver glow
  Rare: "shadow-[0_0_50px_rgba(30,58,138,0.6)]",              // Dark blue glow
  Epic: "shadow-[0_0_60px_rgba(255,215,0,0.55)]",             // Gold glow
  Legend: "shadow-[0_0_100px_rgba(255,140,0,0.85)]",          // Orange glow
};**/

function Avatar({ name }: { name: string }) {
  const initials = useMemo(()=>name.split(/\s|\./).filter(Boolean).map(s=>s[0]).slice(0,2).join("").toUpperCase(), [name]);
  return <div style={{ width:80, height:80, borderRadius:16, background:"gray", display:"grid", placeItems:"center", fontWeight:"bold", color:"white" }}>{initials}</div>;
}

function PlayerCard({ player, highlight = false }: { player: Player; highlight?: boolean }) {
  const background = player.tier === "Common"
    ? "linear-gradient(135deg, #c0c0c0, #808080)"        // Silver gradient
    : player.tier === "Rare"
      ? "linear-gradient(135deg, #1e3a8a, #3b82f6)"      // Bluish gradient
      : highlight
        ? "linear-gradient(135deg, #ffd700, #ff8c00)"    // Epic/Legend glow
        : "linear-gradient(135deg, #555555, #333333)";   // fallback

  const boxShadow = player.tier === "Common"
    ? "0 0 10px rgba(192,192,192,0.5)"                 // Silver glow
    : player.tier === "Rare"
      ? "0 0 40px rgba(30,58,138,0.7)"                 // Dark blue glow
      : highlight
        ? "0 0 60px rgba(255,215,0,0.8)"               // Gold glow
        : "0 0 4px black";                              // fallback

  const style: React.CSSProperties = {
    borderRadius: 16,
    padding: 12,
    background,
    color: "white",
    width: 180,
    height: 260,
    flex: "0 0 auto",
    position: "relative",
    boxShadow,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
  };

  return (
    <div style={style}>
      <div style={{display:"flex", justifyContent:"space-between"}}>
        <TierBadge tier={player.tier}/>
        <div style={{textAlign:"right"}}>
          <div style={{fontWeight:"bold"}}>{player.rating}</div>
          <div style={{fontSize:10}}>{player.role}</div>
        </div>
      </div>
      <Avatar name={player.name}/>
      <div>
        <div>{player.name}</div>
        <div style={{fontSize:12, color:"#ccc"}}>{player.team}</div>
      </div>
    </div>
  );
}

/**********************
 * Pack Opener Hooks   *
 **********************/
function generatePackItems(pool: Player[], odds: Record<string, number>, count=5) {
  const res: Player[] = [];
  for(let i=0;i<count;i++){
    const tier = pickTier(odds);
    const candidates = pool.filter(p=>p.tier===tier);
    const pick = candidates[randInt(0,candidates.length-1)];
    res.push(pick);
  }
  return res;
}

/**********************
 * Main App Component  *
 **********************/
export default function App() {
  return (
    <AppProvider>
      <Main />
    </AppProvider>
  );
}

function Main(){
  const { state, dispatch } = useApp();
  const sfx = useSFX(state.mute);
  const [players] = useState(makePlayers());
  const [opening, setOpening] = useState(false);
  const [packResult,setPackResult] = useState<PackResult|null>(null);
  const [showCollection,setShowCollection] = useState(false);
  const [triggerConfetti,setTriggerConfetti] = useState(false);
  const [showSummary,setShowSummary] = useState(false);

  const [collectionFilter,setCollectionFilter] = useState<{tier?:Tier; role?:typeof ROLES[number]}>({});

  const openPack = (packType:keyof typeof PACKS) => {
    if(opening) return;
    const pack = PACKS[packType];
    if(state.coins<pack.price) return alert("Not enough coins!");
    sfx.sfxOpen();
    setOpening(true);

    const items = generatePackItems(players, pack.odds);
    let anyEpicOrLegend=false;
    let coinsDelta = -pack.price;
    const resultItems = items.map(card=>{
      const owned = state.inventory[card.id];
      let isDupe=false, upgraded=false, convertedCoins=0;
      if(owned){
        isDupe=true;
        if(owned.stars<5) upgraded=true;
        else { convertedCoins = Math.floor(card.rating*5); coinsDelta += convertedCoins; }
      }
      if(card.tier==="Epic" || card.tier==="Legend") anyEpicOrLegend=true;
      return { card, isDupe, upgraded, convertedCoins };
    });

    setPackResult({ items: resultItems, anyEpicOrLegend, coinsDelta });
    setTimeout(()=>{
      dispatch({ type:"APPLY_PACK_RESULT", payload:{ items: resultItems, anyEpicOrLegend, coinsDelta } });
      if(anyEpicOrLegend) setTriggerConfetti(true);
      setOpening(false);
      setShowSummary(true);
    },1500);
  };

  const filteredCollection = Object.values(state.inventory).filter(c=>{
    if(collectionFilter.tier && c.tier!==collectionFilter.tier) return false;
    if(collectionFilter.role && c.role!==collectionFilter.role) return false;
    return true;
  });

  return (
    <div style={{
  minHeight: "100vh",
  background: "linear-gradient(180deg, #2b0d3c, #1b1b3a, #000)", // cinematic dark gradient
  color: "white",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  padding: 16
}}>
  <h1 style={{ fontSize: 32, fontWeight: "bold", marginBottom: 16 }}>Cricket Pack Opener</h1>

  <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
    {Object.keys(PACKS).map(k=>{
      const pack = PACKS[k as keyof typeof PACKS];
      return (
        <button key={k} onClick={()=>openPack(k as keyof typeof PACKS)} style={{
          padding:"8px 16px",
          borderRadius: 12,
          background: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
          border: "none",
          color: "white",
          cursor: "pointer",
          fontWeight:"bold"
        }}>
          {k} ({pack.price} 💰)
          <span title={`Odds: ${JSON.stringify(pack.odds)}`} style={{marginLeft:4, cursor:"help"}}>❓</span>
        </button>
      )
    })}
    <button onClick={()=>dispatch({type:"ADD_COINS", payload:5000})} style={{
      padding:"8px 16px", borderRadius:12, background:"linear-gradient(135deg, #ff8c00, #ff5e62)", border:"none", color:"white", fontWeight:"bold"
    }}>Restore Coins</button>
    <button onClick={()=>setShowCollection(!showCollection)} style={{
      padding:"8px 16px", borderRadius:12, background:"linear-gradient(135deg, #7b2ff7, #f107a3)", border:"none", color:"white", fontWeight:"bold"
    }}>{showCollection?"Hide Collection":"My Collection"}</button>
  </div>

  <div style={{
    marginTop:16,
    display:"flex",
    overflowX:"auto",
    gap:16,
    paddingTop:60 // extra top padding to avoid glow cutoff
  }}>
    {packResult && packResult.items.map((it,idx)=>(
      <motion.div key={idx} initial={{y:-50,opacity:0}} animate={{y:0,opacity:1}} transition={{delay:idx*0.15, type:"spring", stiffness:120}}>
        <PlayerCard player={it.card} highlight={it.card.tier!=="Common"} />
      </motion.div>
    ))}
  </div>


      {/* Summary Modal */}
      {showSummary && packResult && (
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:"#222",padding:24,borderRadius:16,minWidth:300}}>
            <h2>Pack Opened!</h2>
            <p>Coins change: {packResult.coinsDelta}</p>
            <p>Epic/Legend cards: {packResult.anyEpicOrLegend ? "Yes" : "No"}</p>
            <button onClick={()=>setShowSummary(false)} style={{marginTop:8}}>Close</button>
          </div>
        </div>
      )}

      {/* Collection Modal */}
      {showCollection && (
        <div style={{marginTop:24, width:"100%", maxWidth:800, background:"#222", padding:16, borderRadius:16}}>
          <h3>My Collection</h3>
          <div style={{display:"flex", gap:8, marginBottom:8}}>
            <select onChange={e=>setCollectionFilter(f=>({...f,tier:e.target.value as Tier||undefined}))}>
              <option value="">All Tiers</option>
              {TIERS.map(t=><option key={t} value={t}>{t}</option>)}
            </select>
            <select onChange={e=>setCollectionFilter(f=>({...f,role:e.target.value as typeof ROLES[number]||undefined}))}>
              <option value="">All Roles</option>
              {ROLES.map(r=><option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div style={{display:"flex", flexWrap:"wrap", gap:12}}>
            {filteredCollection.map(c=><PlayerCard key={c.id} player={c} highlight={c.tier!=="Common"} />)}
            {filteredCollection.length===0 && <div>No cards match filters</div>}
          </div>
        </div>
      )}

      <div style={{marginTop:16}}>Coins: {state.coins}</div>
    </div>
  )
}

