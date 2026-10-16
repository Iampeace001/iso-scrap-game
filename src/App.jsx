import { useCallback, useEffect, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import { Float, OrthographicCamera } from '@react-three/drei'
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

function GroundVisuals({ warning, collapsed }) {
  const mesh = useRef()
  const helper = useRef(new THREE.Object3D())
  const color = useRef(new THREE.Color())
  useEffect(() => {
    if (!mesh.current) return
    for (let i = 0; i < SIDE * SIDE; i++) {
      const [x, , z] = posOf(i)
      const item = helper.current
      item.position.set(x, -.25, z)
      item.scale.setScalar(collapsed.has(i) ? 0 : 1)
      item.updateMatrix()
      mesh.current.setMatrixAt(i, item.matrix)
      color.current.setHex(warning === i ? 0xf4b942 : 0x111b38)
      mesh.current.setColorAt(i, color.current)
    }
    mesh.current.instanceMatrix.needsUpdate = true
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true
    mesh.current.computeBoundingSphere()
  }, [warning, collapsed])
  return <instancedMesh ref={mesh} args={[undefined, undefined, SIDE * SIDE]} frustumCulled={false}>
    <boxGeometry args={[STEP * .98, .5, STEP * .98]} />
    <meshStandardMaterial vertexColors emissive="#071c46" emissiveIntensity={.28} metalness={.25} roughness={.72} />
  </instancedMesh>
}

function GroundTile({ index, collapsed }) {
  const body = useRef()
  const [gone, setGone] = useState(false)
  useEffect(() => {
    if (!collapsed || !body.current) return
    const rigidBody = body.current
    rigidBody.setBodyType(0, true)
    rigidBody.setLinvel({ x: 0, y: -.1, z: 0 }, true)
    const timer = setTimeout(() => { if (rigidBody.translation().y < -12) setGone(true) }, 2200)
    return () => clearTimeout(timer)
  }, [collapsed])
  if (gone) return null
  const [x, , z] = posOf(index)
  return <RigidBody ref={body} type="fixed" colliders={false} position={[x, -0.25, z]}>
    <CuboidCollider args={[STEP * .49, .25, STEP * .49]} />
    {collapsed && <mesh><boxGeometry args={[STEP * .98, .5, STEP * .98]} /><meshStandardMaterial color="#111b38" emissive="#071c46" emissiveIntensity={.28} metalness={.25} roughness={.72} /></mesh>}
  </RigidBody>
}

function PitMarks({ collapsed }) {
  return [...collapsed].map(index => {
    const [x, , z] = posOf(index)
    return <group key={`pit-${index}`} position={[x, -.49, z]}>
      <mesh><boxGeometry args={[STEP * .92, .025, STEP * .92]} /><meshBasicMaterial color="#02040a" /></mesh>
      <group position={[0, .49, 0]}>
        <mesh position={[0, 0, -STEP * .46]}><boxGeometry args={[STEP * .92, .035, .055]} /><meshBasicMaterial color="#ff3d52" /></mesh>
        <mesh position={[0, 0, STEP * .46]}><boxGeometry args={[STEP * .92, .035, .055]} /><meshBasicMaterial color="#ff3d52" /></mesh>
        <mesh position={[-STEP * .46, 0, 0]}><boxGeometry args={[.055, .035, STEP * .92]} /><meshBasicMaterial color="#ff3d52" /></mesh>
        <mesh position={[STEP * .46, 0, 0]}><boxGeometry args={[.055, .035, STEP * .92]} /><meshBasicMaterial color="#ff3d52" /></mesh>
      </group>
    </group>
  })
}

function Runner({ resetKey, body }) {
  const keys = useRef(new Set())
  const figure = useRef()
  const leftLeg = useRef()
  const rightLeg = useRef()
  const gameState = useGameStore(s => s.gameState)
  const endGame = useGameStore(s => s.endGame)
  useEffect(() => {
    const down = e => { if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd', 'W', 'A', 'S', 'D'].includes(e.key)) { e.preventDefault(); keys.current.add(e.key.toLowerCase()) } }
    const up = e => keys.current.delete(e.key.toLowerCase())
    window.addEventListener('keydown', down); window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [])
  useEffect(() => { keys.current.clear(); if (body.current) { body.current.setTranslation({ x: 0, y: .5, z: 0 }, true); body.current.setLinvel({ x: 0, y: 0, z: 0 }, true); body.current.setAngvel({ x: 0, y: 0, z: 0 }, true) } }, [resetKey])
  useFrame((_, dt) => {
    if (!body.current || gameState !== 'playing') return
    const k = keys.current; let x = 0, z = 0
    if (k.has('w') || k.has('arrowup')) z -= 1
    if (k.has('s') || k.has('arrowdown')) z += 1
    if (k.has('a') || k.has('arrowleft')) x -= 1
    if (k.has('d') || k.has('arrowright')) x += 1
    if (x || z) { const l = Math.hypot(x, z); body.current.applyImpulse({ x: x / l * 0.24 * dt * 60, y: 0, z: z / l * 0.24 * dt * 60 }, true) }
    const v = body.current.linvel(); body.current.setLinvel({ x: THREE.MathUtils.clamp(v.x, -5.5, 5.5), y: v.y, z: THREE.MathUtils.clamp(v.z, -5.5, 5.5) }, true)
    const speed = Math.hypot(v.x, v.z)
    if (figure.current && speed > .15) figure.current.rotation.y = THREE.MathUtils.damp(figure.current.rotation.y, Math.atan2(v.x, v.z), 8, dt)
    const stride = speed > .25 ? Math.sin(performance.now() * .012) * Math.min(.65, speed * .12) : 0
    if (leftLeg.current) leftLeg.current.rotation.x = stride
    if (rightLeg.current) rightLeg.current.rotation.x = -stride
    if (body.current.translation().y < -5 || Math.abs(body.current.translation().x) > HALF + 1.8 || Math.abs(body.current.translation().z) > HALF + 1.8) endGame()
  })
  return <RigidBody ref={body} colliders={false} position={[0, .5, 0]} mass={1} linearDamping={3.2} angularDamping={4} enabledRotations={[false, false, false]}>
    <CuboidCollider args={[.3, .43, .3]} />
    <group ref={figure}>
      <mesh castShadow position={[0, .39, 0]}><capsuleGeometry args={[.25, .42, 3, 7]} /><meshStandardMaterial color="#20bfc4" roughness={.7} /></mesh>
      <mesh castShadow position={[0, .91, 0]}><sphereGeometry args={[.23, 10, 8]} /><meshStandardMaterial color="#e7aa83" roughness={.8} /></mesh>
      <mesh position={[0, 1.04, -.015]}><sphereGeometry args={[.235, 8, 5, 0, Math.PI * 2, 0, Math.PI * .52]} /><meshStandardMaterial color="#17253c" roughness={.85} /></mesh>
      <mesh position={[0, .43, .255]}><boxGeometry args={[.16, .16, .035]} /><meshBasicMaterial color="#56fff0" /></mesh>
      {[-1, 1].map(side => <group key={`arm-${side}`} position={[side * .29, .56, 0]} rotation={[0, 0, side * -.12]}><mesh castShadow position={[0, -.16, 0]}><capsuleGeometry args={[.085, .25, 2, 5]} /><meshStandardMaterial color="#dd9b77" roughness={.8} /></mesh></group>)}
      <group ref={leftLeg} position={[-.13, .15, 0]}><mesh castShadow position={[0, -.16, 0]}><capsuleGeometry args={[.095, .3, 2, 5]} /><meshStandardMaterial color="#303c59" roughness={.8} /></mesh><mesh position={[0, -.34, .055]}><boxGeometry args={[.17, .09, .27]} /><meshStandardMaterial color="#151b2b" /></mesh></group>
      <group ref={rightLeg} position={[.13, .15, 0]}><mesh castShadow position={[0, -.16, 0]}><capsuleGeometry args={[.095, .3, 2, 5]} /><meshStandardMaterial color="#303c59" roughness={.8} /></mesh><mesh position={[0, -.34, .055]}><boxGeometry args={[.17, .09, .27]} /><meshStandardMaterial color="#151b2b" /></mesh></group>
    </group>
  </RigidBody>
}

function Core({ tile, onCollect }) {
  const mesh = useRef()
  const [x, , z] = posOf(tile)
  useFrame((_, dt) => { if (mesh.current) mesh.current.rotation.y += dt * 1.4 })
  return <RigidBody type="fixed" colliders={false} position={[x, .62, z]}>
    <CuboidCollider args={[.38, .42, .38]} sensor onIntersectionEnter={onCollect} />
    <Float speed={2.2} floatIntensity={.18}>
      <mesh ref={mesh}>
        <octahedronGeometry args={[.3, 0]} /><meshStandardMaterial color="#ff58cf" emissive="#ff13aa" emissiveIntensity={3} metalness={.5} roughness={.2} />
      </mesh>
    </Float>
  </RigidBody>
}

function Hazard({ tile }) {
  const [x, , z] = posOf(tile)
  const push = e => { if (e.other.rigidBodyObject) e.other.rigidBodyObject.applyImpulse({ x: (Math.random() - .5) * 30, y: 8, z: (Math.random() - .5) * 30 }, true) }
  return <RigidBody type="fixed" colliders={false} position={[x, .1, z]}>
    <CuboidCollider args={[.36, .5, .36]} sensor onIntersectionEnter={push} />
    <mesh castShadow position={[0, .38, 0]}><coneGeometry args={[.35, .85, 4]} /><meshStandardMaterial color="#ff344e" emissive="#d00028" emissiveIntensity={1.4} metalness={.3} roughness={.35} /></mesh>
  </RigidBody>
}

function FollowCamera({ roverRef }) {
  const target = useRef(new THREE.Vector3())
  const desired = useRef(new THREE.Vector3())
  useFrame(({ camera }, dt) => {
    const rover = roverRef.current?.translation()
    const p = target.current.set(rover?.x || 0, 0, rover?.z || 0)
    desired.current.set(p.x + 22, p.y + 25, p.z + 22)
    camera.position.lerp(desired.current, 1 - Math.exp(-dt * 2))
    camera.lookAt(p)
  })
  return null
}

function World({ runKey }) {
  const roverRef = useRef()
  const gameState = useGameStore(s => s.gameState)
  const incrementScore = useGameStore(s => s.incrementScore)
  const [core, setCore] = useState(() => randomTile(new Set([112])))
  const [hazards] = useState(() => {
    const used = new Set([112, core])
    return Array.from({ length: 13 }, () => { const n = randomTile(used); used.add(n); return n })
  })
  const [warning, setWarning] = useState(null)
  const [collapsed, setCollapsed] = useState(() => new Set())
  const collect = useCallback(() => { incrementScore(); const blocked = new Set([112, ...hazards]); setCore(randomTile(blocked)) }, [incrementScore, hazards])
  useEffect(() => { setCore(randomTile(new Set([112, ...hazards]))); setCollapsed(new Set()); setWarning(null) }, [runKey, hazards])
  useEffect(() => {
    if (gameState !== 'playing') return
    let active = true
    let warningTimeout
    const cycle = () => {
      if (!active) return
      const available = [...safeIndices].filter(i => i !== 112 && i !== core && !hazards.includes(i) && !collapsed.has(i))
      if (!available.length) return
      const idx = available[Math.floor(Math.random() * available.length)]
      setWarning(idx)
      warningTimeout = setTimeout(() => {
        if (!active) return
        setWarning(null)
        setCollapsed(previous => new Set(previous).add(idx))
      }, 1000)
    }
    const id = setInterval(cycle, 3000)
    return () => { active = false; clearInterval(id); clearTimeout(warningTimeout); setWarning(null) }
  }, [core, hazards, collapsed, gameState])
  return <>
    <color attach="background" args={['#070b18']} /><fog attach="fog" args={['#070b18', 30, 65]} />
    <ambientLight intensity={.85} /><directionalLight position={[8, 18, 5]} intensity={1.8} />
    <FollowCamera roverRef={roverRef} />
    <GroundVisuals warning={warning} collapsed={collapsed} />
    <Physics gravity={[0, -16, 0]} paused={gameState !== 'playing'}>
      {[...Array(SIDE * SIDE)].map((_, i) => <GroundTile key={`${runKey}-${i}`} index={i} collapsed={collapsed.has(i)} />)}
      <PitMarks collapsed={collapsed} />
      <Runner resetKey={runKey} body={roverRef} />
      {core !== null && <Core key={`${runKey}-${core}`} tile={core} onCollect={collect} />}
      {hazards.map(i => <Hazard key={i} tile={i} />)}
    </Physics>
    <EffectComposer multisampling={0}><Bloom intensity={.75} luminanceThreshold={.28} luminanceSmoothing={.65} mipmapBlur /></EffectComposer>
  </>
}

function HUD({ onRestart }) {
  const { score, timeRemaining, highScore } = useGameStore()
  return <div className="hud">
    <div className="brand"><span className="brand-mark"><Zap size={19} fill="currentColor" /></span><div><b>ISO-SCRAP</b><small>NEON SALVAGE</small></div></div>
    <div className="hud-stats"><div className="stat"><span>SALVAGE</span><strong>{String(score).padStart(5, '0')}</strong></div><div className={`stat time ${timeRemaining <= 10 ? 'urgent' : ''}`}><span><Clock3 size={12} /> TIME</span><strong>00:{String(timeRemaining).padStart(2, '0')}</strong></div></div>
    <div className="hud-right"><div className="best">BEST <b>{String(highScore).padStart(5, '0')}</b></div><button className="icon-button" onClick={onRestart} aria-label="Restart run"><RotateCcw size={16} /></button></div>
    <div className="controls"><span>MOVE</span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd><span className="or">OR</span><kbd><ArrowUp size={13} /></kbd><kbd><ArrowLeft size={13} /></kbd><kbd><ArrowDown size={13} /></kbd><kbd><ArrowRight size={13} /></kbd><em>Yellow tile = falling soon | Red edge = pit | Pink = core</em></div>
  </div>
}

function Overlay({ state, onStart, score, highScore }) {
  if (state !== 'menu') return null
  return <div className="overlay"><div className="panel">
    <div className="eyebrow"><span /> {state === 'menu' ? 'SALVAGE SECTOR 07' : 'SIGNAL LOST'}</div>
    <h1>{state === 'menu' ? <>ISO<span>-</span><br />SCRAP</> : <>RUN<br /><span>ENDED</span></>}</h1>
    <p>{state === 'menu' ? 'Move the runner, grab pink cores, and step off any tile flashing yellow before it drops.' : `You recovered ${score.toLocaleString()} salvage points.`}</p>
    {state === 'gameover' && <div className="record">PERSONAL BEST <b>{highScore.toLocaleString()}</b></div>}
    <button className="start-button" onClick={onStart}>{state === 'menu' ? 'DROP INTO THE GRID' : 'RUN IT BACK'} <span>↗</span></button>
    <div className="panel-foot">WASD / ARROWS <span>·</span> COLLECT TO EXTEND YOUR RUN</div>
  </div></div>
}

function StartNgProfile({ player, signedIn, onSignIn }) {
  return <aside className="startng-profile" aria-label="start.ng player profile">
    {player?.face ? <img src={player.face} alt={`${player.name}'s character`} /> : <span className="profile-fallback">{player?.name?.slice(0, 1) || 'G'}</span>}
    <div className="profile-copy"><b>{player?.name || 'Guest'}</b><span>{signedIn && player?.account ? `@${player.account}` : 'Guest player'}</span></div>
    {!signedIn && <button onClick={onSignIn}>SIGN IN WITH START.NG</button>}
  </aside>
}

function Leaderboard({ entries, status, playerId, inline = false }) {
  if (!inline && !entries.length) return null
  return <aside className={`leaderboard ${inline ? 'leaderboard-inline' : ''}`}>
    <div className="leaderboard-title">SECTOR LEADERS <span>TOP 5</span></div>
    {entries.length ? entries.slice(0, 5).map((entry, index) => <div className={`leader-row ${entry.player_id === playerId ? 'is-you' : ''}`} key={`${entry.player_id}-${index}`}>
      <span className="leader-rank">{String(entry.rank || index + 1).padStart(2, '0')}</span><b>{entry.name || 'Player'}{entry.player_id === playerId ? ' - YOU' : ''}</b><strong>{Number(entry.stats?.score ?? entry.score ?? 0).toLocaleString()}</strong>
    </div>) : <p className="leaderboard-empty">{status === 'loading' ? 'Loading the start.ng board...' : status === 'empty' ? 'No runs saved yet. Be the first on the board.' : 'The board is unavailable right now. Try again next run.'}</p>}
  </aside>
}

function RunEndedPanel({ score, highScore, entries, boardStatus, playerId, signedIn, savedMessage, onRestart, onSignIn }) {
  return <div className="overlay overlay-ended">
    <div className="panel panel-ended">
      <div className="end-layout">
        <section className="end-summary">
          <div className="eyebrow"><span /> RUN COMPLETE</div>
          <h1>RUN<br /><span>ENDED</span></h1>
          <p>The grid got away. Your salvage run is over.</p>
          <div className="end-score"><span>FINAL SALVAGE</span><b>{score.toLocaleString()}</b></div>
          <div className="record">PERSONAL BEST <b>{highScore.toLocaleString()}</b></div>
          <div className="save-status">{savedMessage || (signedIn ? 'Run finished.' : 'Sign in with start.ng to save your run to the shared board.')}</div>
          {!signedIn && <button className="panel-sign-in" onClick={onSignIn}>SIGN IN WITH START.NG</button>}
        </section>
        <Leaderboard entries={entries} status={boardStatus} playerId={playerId} inline />
      </div>
      <button className="start-button" onClick={onRestart}>RUN IT BACK <span>-&gt;</span></button>
      <div className="panel-foot">WASD / ARROWS | COLLECT CORES TO EXTEND YOUR RUN</div>
    </div>
  </div>
}

export default function App() {
  const gameState = useGameStore(s => s.gameState)
  const startGame = useGameStore(s => s.startGame)
  const score = useGameStore(s => s.score)
  const highScore = useGameStore(s => s.highScore)
  const [runKey, setRunKey] = useState(0)
  const [player, setPlayer] = useState(null)
  const [signedIn, setSignedIn] = useState(false)
  const [entries, setEntries] = useState([])
  const [boardStatus, setBoardStatus] = useState('loading')
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
    setBoardStatus('loading')
    const reply = await askStartNg({ type: 'startng:leaderboard', limit: 5 }, 'startng:leaderboardData')
    if (reply?.ok && Array.isArray(reply.entries)) {
      setEntries(reply.entries)
      setBoardStatus(reply.entries.length ? 'ready' : 'empty')
    } else setBoardStatus('unavailable')
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
    setBoardStatus('loading')
    setSavedMessage(signedIn ? (score > 0 ? 'Saving your run...' : 'No salvage to submit this run.') : 'Sign in with start.ng to save your run to the shared board.')
    ;(async () => {
      if (signedIn && score > 0) {
        const result = await askStartNg({ type: 'startng:score', stats: { score } }, 'startng:scoreSaved')
        if (!cancelled && result?.ok) setSavedMessage(result.result?.improved ? `New start.ng best · #${result.result.rank}` : 'Run recorded on start.ng')
        else if (!cancelled) setSavedMessage(result?.error || 'Could not save this run. Sign in again and try next run.')
      }
      const board = await askStartNg({ type: 'startng:leaderboard', limit: 5 }, 'startng:leaderboardData')
      if (!cancelled && board?.ok && Array.isArray(board.entries)) {
        setEntries(board.entries)
        setBoardStatus(board.entries.length ? 'ready' : 'empty')
      } else if (!cancelled) setBoardStatus('unavailable')
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
    <Canvas dpr={[1, 1.2]} gl={{ antialias: true, powerPreference: 'high-performance' }}>
      <OrthographicCamera makeDefault position={[22, 25, 22]} zoom={27} near={.1} far={150} />
      <World runKey={runKey} />
    </Canvas>
    <StartNgProfile player={player} signedIn={signedIn} onSignIn={() => { location.href = signInUrl() }} />
    {gameState === 'playing' && <Leaderboard entries={entries} status={boardStatus} playerId={player?.id} />}
    {gameState === 'playing' && <HUD onRestart={launch} />}
    <Overlay state={gameState} onStart={launch} score={score} highScore={highScore} />
    {gameState === 'gameover' && <RunEndedPanel score={score} highScore={highScore} entries={entries} boardStatus={boardStatus} playerId={player?.id} signedIn={signedIn} savedMessage={savedMessage} onRestart={launch} onSignIn={() => { location.href = signInUrl() }} />}
    <div className="corner-note">INDEPENDENT ARCADE <span>•</span> NO SIGNAL REQUIRED</div>
  </main>
}
