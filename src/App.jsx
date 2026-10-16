import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import { Environment, Float, OrthographicCamera, Text } from '@react-three/drei'
import { Physics, RigidBody, CuboidCollider } from '@react-three/rapier'
import { useGameStore } from './store'
import { askStartNg, signInUrl } from './startng'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Clock3, RotateCcw, Zap } from 'lucide-react'
import * as THREE from 'three'

const SIDE = 15
const STEP = 1.15
const HALF = (SIDE - 1) * STEP / 2
const posOf = (i) => [((i % SIDE) * STEP) - HALF, 0, Math.floor(i / SIDE) * STEP - HALF]
const safeIndices = new Set(Array.from({ length: SIDE * SIDE }, (_, i) => i).filter(i => Math.abs(i % SIDE - 7) > 2 || Math.abs(Math.floor(i / SIDE) - 7) > 2))
const randomTile = (exclude = new Set()) => {
  const options = [...safeIndices].filter(i => !exclude.has(i))
  return options[Math.floor(Math.random() * options.length)]
}

function GroundTile({ index, warning, dropped }) {
  const body = useRef()
  const [gone, setGone] = useState(false)
  useEffect(() => { setGone(false); if (body.current) { body.current.setBodyType(dropped ? 0 : 1, true); if (dropped) body.current.setLinvel({ x: 0, y: -0.1, z: 0 }, true) } }, [dropped])
  useFrame((_, dt) => { if (dropped && body.current) { const p = body.current.translation(); if (p.y < -15) setGone(true) } })
  if (gone) return null
  const [x, , z] = posOf(index)
  return <RigidBody ref={body} type="fixed" colliders={false} position={[x, -0.25, z]}>
    <CuboidCollider args={[STEP * .49, .25, STEP * .49]} />
    <mesh receiveShadow castShadow>
      <boxGeometry args={[STEP * .98, .5, STEP * .98]} />
      <meshStandardMaterial color={warning ? '#f4b942' : '#111b38'} emissive={warning ? '#ffb52e' : '#071c46'} emissiveIntensity={warning ? 1.3 : .28} metalness={.35} roughness={.65} />
    </mesh>
    <mesh position={[0, .006, 0]}>
      <boxGeometry args={[STEP * .985, .505, STEP * .985]} />
      <meshBasicMaterial color={warning ? '#ffc14d' : '#2454a7'} wireframe transparent opacity={warning ? .9 : .32} />
    </mesh>
  </RigidBody>
}

function Rover({ resetKey, body }) {
  const keys = useRef(new Set())
  const gameState = useGameStore(s => s.gameState)
  const endGame = useGameStore(s => s.endGame)
  useEffect(() => {
    const down = e => { if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd', 'W', 'A', 'S', 'D'].includes(e.key)) { e.preventDefault(); keys.current.add(e.key.toLowerCase()) } }
    const up = e => keys.current.delete(e.key.toLowerCase())
    window.addEventListener('keydown', down); window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [])
  useEffect(() => { keys.current.clear(); if (body.current) { body.current.setTranslation({ x: 0, y: 1.1, z: 0 }, true); body.current.setLinvel({ x: 0, y: 0, z: 0 }, true); body.current.setAngvel({ x: 0, y: 0, z: 0 }, true) } }, [resetKey])
  useFrame((_, dt) => {
    if (!body.current || gameState !== 'playing') return
    const k = keys.current; let x = 0, z = 0
    if (k.has('w') || k.has('arrowup')) z -= 1
    if (k.has('s') || k.has('arrowdown')) z += 1
    if (k.has('a') || k.has('arrowleft')) x -= 1
    if (k.has('d') || k.has('arrowright')) x += 1
    if (x || z) { const l = Math.hypot(x, z); body.current.applyImpulse({ x: x / l * 0.14 * dt * 60, y: 0, z: z / l * 0.14 * dt * 60 }, true) }
    const v = body.current.linvel(); body.current.setLinvel({ x: THREE.MathUtils.clamp(v.x, -7, 7), y: v.y, z: THREE.MathUtils.clamp(v.z, -7, 7) }, true)
    if (body.current.translation().y < -5 || Math.abs(body.current.translation().x) > HALF + 1.8 || Math.abs(body.current.translation().z) > HALF + 1.8) endGame()
  })
  return <RigidBody ref={body} colliders="cuboid" position={[0, 1.1, 0]} mass={1.5} linearDamping={1.7} angularDamping={3} enabledRotations={[false, true, false]}>
    <group>
      <mesh castShadow><boxGeometry args={[.86, .4, 1.12]} /><meshStandardMaterial color="#343d50" metalness={.75} roughness={.32} /></mesh>
      <mesh castShadow position={[0, .27, -.08]}><boxGeometry args={[.56, .25, .55]} /><meshStandardMaterial color="#59657b" metalness={.6} roughness={.3} /></mesh>
      {[-1, 1].flatMap(x => [-1, 1].map(z => <group key={`${x}:${z}`} position={[x * .43, -.13, z * .43]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow><cylinderGeometry args={[.14, .14, .23, 8]} /><meshStandardMaterial color="#161a27" metalness={.7} roughness={.3} /></mesh>
        <mesh position={[0, -.16, 0]}><sphereGeometry args={[.09, 8, 6]} /><meshBasicMaterial color="#30f5ed" /></mesh>
        <pointLight position={[0, -.2, 0]} color="#16e6ff" intensity={.55} distance={1.4} />
      </group>))}
      <mesh position={[0, .08, .53]}><boxGeometry args={[.46, .12, .07]} /><meshBasicMaterial color="#43fcff" /></mesh>
    </group>
  </RigidBody>
}

function Core({ tile, onCollect }) {
  const mesh = useRef()
  const [x, , z] = posOf(tile)
  useFrame((_, dt) => { if (mesh.current) mesh.current.rotation.y += dt * 1.4 })
  return <RigidBody ref={ref} type="fixed" colliders={false} position={[x, .62, z]}>
    <CuboidCollider args={[.38, .42, .38]} sensor onIntersectionEnter={onCollect} />
    <Float speed={2.2} floatIntensity={.18}>
      <mesh ref={mesh}>
        <octahedronGeometry args={[.3, 0]} /><meshStandardMaterial color="#ff58cf" emissive="#ff13aa" emissiveIntensity={3} metalness={.5} roughness={.2} />
      </mesh>
      <pointLight color="#ff2cc9" intensity={1.2} distance={3.2} />
    </Float>
  </RigidBody>
}

function Hazard({ tile }) {
  const [x, , z] = posOf(tile)
  const push = e => { if (e.other.rigidBodyObject) e.other.rigidBodyObject.applyImpulse({ x: (Math.random() - .5) * 30, y: 8, z: (Math.random() - .5) * 30 }, true) }
  return <RigidBody type="fixed" colliders={false} position={[x, .1, z]}>
    <CuboidCollider args={[.36, .5, .36]} sensor onIntersectionEnter={push} />
    <mesh castShadow position={[0, .38, 0]}><coneGeometry args={[.35, .85, 4]} /><meshStandardMaterial color="#ff344e" emissive="#d00028" emissiveIntensity={1.4} metalness={.3} roughness={.35} /></mesh>
    <pointLight color="#ff1e48" intensity={.4} distance={2} />
  </RigidBody>
}

function FollowCamera({ roverRef }) {
  const target = useRef(new THREE.Vector3())
  useFrame(({ camera }, dt) => {
    const rover = roverRef.current?.translation()
    const p = target.current.set(rover?.x || 0, 0, rover?.z || 0)
    const desired = new THREE.Vector3(p.x + 22, p.y + 25, p.z + 22)
    camera.position.lerp(desired, 1 - Math.exp(-dt * 2))
    camera.lookAt(p)
  })
  return null
}

function World({ runKey }) {
  const roverRef = useRef()
  const incrementScore = useGameStore(s => s.incrementScore)
  const [core, setCore] = useState(() => randomTile(new Set([112])))
  const [hazards] = useState(() => {
    const used = new Set([112, core])
    return Array.from({ length: 13 }, () => { const n = randomTile(used); used.add(n); return n })
  })
  const [warning, setWarning] = useState(null)
  const [dropped, setDropped] = useState(null)
  const collect = useCallback(() => { incrementScore(); const blocked = new Set([112, ...hazards]); setCore(randomTile(blocked)) }, [incrementScore, hazards])
  useEffect(() => { setCore(randomTile(new Set([112, ...hazards]))) }, [runKey])
  useEffect(() => {
    let active = true
    const cycle = () => {
      if (!active) return
      const idx = randomTile(new Set([112, core, ...hazards]))
      setWarning(idx)
      setTimeout(() => { if (!active) return; setWarning(null); setDropped(idx); setTimeout(() => { if (active) setDropped(null) }, 1600) }, 1000)
    }
    const id = setInterval(cycle, 3000)
    return () => { active = false; clearInterval(id) }
  }, [core, hazards])
  return <>
    <color attach="background" args={['#070b18']} /><fog attach="fog" args={['#070b18', 30, 65]} />
    <ambientLight intensity={.65} /><directionalLight position={[8, 18, 5]} intensity={2.1} castShadow shadow-mapSize={[1024, 1024]} />
    <FollowCamera roverRef={roverRef} />
    <Physics gravity={[0, -16, 0]}>
      {[...Array(SIDE * SIDE)].map((_, i) => <GroundTile key={`${runKey}-${i}`} index={i} warning={warning === i} dropped={dropped === i} />)}
      <Rover resetKey={runKey} body={roverRef} />
      {core !== null && <Core key={`${runKey}-${core}`} tile={core} onCollect={collect} />}
      {hazards.map(i => <Hazard key={i} tile={i} />)}
    </Physics>
    <EffectComposer><Bloom intensity={1.35} luminanceThreshold={.2} luminanceSmoothing={.8} mipmapBlur /></EffectComposer>
  </>
}

function HUD({ onRestart }) {
  const { score, timeRemaining, highScore } = useGameStore()
  return <div className="hud">
    <div className="brand"><span className="brand-mark"><Zap size={19} fill="currentColor" /></span><div><b>ISO-SCRAP</b><small>NEON SALVAGE</small></div></div>
    <div className="hud-stats"><div className="stat"><span>SALVAGE</span><strong>{String(score).padStart(5, '0')}</strong></div><div className={`stat time ${timeRemaining <= 10 ? 'urgent' : ''}`}><span><Clock3 size={12} /> TIME</span><strong>00:{String(timeRemaining).padStart(2, '0')}</strong></div></div>
    <div className="hud-right"><div className="best">BEST <b>{String(highScore).padStart(5, '0')}</b></div><button className="icon-button" onClick={onRestart} aria-label="Restart run"><RotateCcw size={16} /></button></div>
    <div className="controls"><span>DRIVE</span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd><span className="or">OR</span><kbd><ArrowUp size={13} /></kbd><kbd><ArrowLeft size={13} /></kbd><kbd><ArrowDown size={13} /></kbd><kbd><ArrowRight size={13} /></kbd><em>Collect cores · dodge spikes · stay on the grid</em></div>
  </div>
}

function Overlay({ state, onStart, score, highScore }) {
  if (state === 'playing') return null
  return <div className="overlay"><div className="panel">
    <div className="eyebrow"><span /> {state === 'menu' ? 'SALVAGE SECTOR 07' : 'SIGNAL LOST'}</div>
    <h1>{state === 'menu' ? <>ISO<span>-</span><br />SCRAP</> : <>RUN<br /><span>ENDED</span></>}</h1>
    <p>{state === 'menu' ? 'The grid is unstable. The cores are yours for the taking.' : `You recovered ${score.toLocaleString()} salvage points.`}</p>
    {state === 'gameover' && <div className="record">PERSONAL BEST <b>{highScore.toLocaleString()}</b></div>}
    <button className="start-button" onClick={onStart}>{state === 'menu' ? 'DROP INTO THE GRID' : 'RUN IT BACK'} <span>↗</span></button>
    <div className="panel-foot">WASD / ARROWS <span>·</span> COLLECT TO EXTEND YOUR RUN</div>
  </div></div>
}

function StartNgProfile({ player, signedIn, onSignIn }) {
  return <aside className="startng-profile" aria-label="start.ng player profile">
    {player?.face ? <img src={player.face} alt={`${player.name}'s character`} /> : <span className="profile-fallback">{player?.name?.slice(0, 1) || 'G'}</span>}
    <div className="profile-copy"><b>{player?.name || 'Guest'}</b><span>{signedIn && player?.account ? `@${player.account}` : 'Guest player'}</span></div>
    {!signedIn && <button onClick={onSignIn}>SIGN IN</button>}
  </aside>
}

function Leaderboard({ entries }) {
  if (!entries.length) return null
  return <aside className="leaderboard"><div className="leaderboard-title">SECTOR LEADERS <span>TOP 5</span></div>
    {entries.slice(0, 5).map((entry, index) => <div className="leader-row" key={`${entry.player_id}-${index}`}>
      <span className="leader-rank">{String(entry.rank || index + 1).padStart(2, '0')}</span><b>{entry.name || 'Player'}</b><strong>{Number(entry.stats?.score ?? entry.score ?? 0).toLocaleString()}</strong>
    </div>)}
  </aside>
}

export default function App() {
  const gameState = useGameStore(s => s.gameState)
  const startGame = useGameStore(s => s.startGame)
  const endGame = useGameStore(s => s.endGame)
  const score = useGameStore(s => s.score)
  const highScore = useGameStore(s => s.highScore)
  const [runKey, setRunKey] = useState(0)
  const [player, setPlayer] = useState(null)
  const [signedIn, setSignedIn] = useState(false)
  const [entries, setEntries] = useState([])
  const [savedMessage, setSavedMessage] = useState('')
  const refreshStartNg = useCallback(async () => {
    const reply = await askStartNg({ type: 'startng:whoami' }, 'startng:user')
    if (reply) {
      setPlayer(reply.user ?? reply.guest ?? { name: 'Guest', face: null })
      setSignedIn(Boolean(reply.user))
    } else {
      setPlayer(current => current ?? { name: 'Guest', face: null })
      setSignedIn(false)
    }
  }, [])
  const refreshBoard = useCallback(async () => {
    const reply = await askStartNg({ type: 'startng:leaderboard', limit: 5 }, 'startng:leaderboardData')
    if (reply?.ok && Array.isArray(reply.entries)) setEntries(reply.entries)
  }, [])
  const launch = () => { setRunKey(k => k + 1); startGame() }
  useEffect(() => {
    refreshStartNg()
    refreshBoard()
    const refresh = () => { if (document.visibilityState !== 'hidden') { refreshStartNg(); refreshBoard() } }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => { window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh) }
  }, [refreshStartNg, refreshBoard])
  useEffect(() => {
    if (gameState !== 'gameover') { if (gameState === 'playing') setSavedMessage(''); return }
    let cancelled = false
    ;(async () => {
      if (signedIn && score > 0) {
        const result = await askStartNg({ type: 'startng:score', stats: { score } }, 'startng:scoreSaved')
        if (!cancelled && result?.ok) setSavedMessage(result.result?.improved ? `New start.ng best · #${result.result.rank}` : 'Run recorded on start.ng')
        else if (!cancelled && result?.error) setSavedMessage(result.error)
      }
      const board = await askStartNg({ type: 'startng:leaderboard', limit: 5 }, 'startng:leaderboardData')
      if (!cancelled && board?.ok && Array.isArray(board.entries)) setEntries(board.entries)
    })()
    return () => { cancelled = true }
  }, [gameState, signedIn, score, runKey])
  useEffect(() => {
    if (gameState !== 'playing') return
    const id = setInterval(() => useGameStore.getState().tickTimer(), 1000)
    return () => clearInterval(id)
  }, [gameState])
  useEffect(() => { const onBlur = () => {}; window.addEventListener('blur', onBlur); return () => window.removeEventListener('blur', onBlur) }, [])
  return <main className="game-shell">
    <Canvas shadows dpr={[1, 1.6]} gl={{ antialias: true, powerPreference: 'high-performance' }}>
      <OrthographicCamera makeDefault position={[22, 25, 22]} zoom={27} near={.1} far={150} />
      <World runKey={runKey} />
    </Canvas>
    <StartNgProfile player={player} signedIn={signedIn} onSignIn={() => { location.href = signInUrl() }} />
    <Leaderboard entries={entries} />
    {savedMessage && gameState === 'gameover' && <div className="save-message">{savedMessage}</div>}
    {gameState !== 'menu' && <HUD onRestart={launch} />}
    <Overlay state={gameState} onStart={launch} score={score} highScore={highScore} />
    <div className="corner-note">INDEPENDENT ARCADE <span>•</span> NO SIGNAL REQUIRED</div>
  </main>
}
