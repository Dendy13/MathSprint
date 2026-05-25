import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { getRoomInfo, startGame, leaveRoom } from '../api/game.js';
import './WaitingRoomPage.css';

export default function WaitingRoomPage() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [room, setRoom] = useState(null);
  const [error, setError] = useState(null);
  const [starting, setStarting] = useState(false);
  const [rolePrompt, setRolePrompt] = useState(false);
  const [hasAttemptedJoin, setHasAttemptedJoin] = useState(false);

  // Polling room status
  useEffect(() => {
    let timeoutId;
    let isMounted = true;

    let hasAttemptedJoin = false;

    const pollRoom = async () => {
      try {
        const data = await getRoomInfo(roomId);
        if (!isMounted) return;

        // Auto-join logic for non-host players who aren't in the room yet
        const isPlayer = data.players && data.players[user?.uid];
        const isSpectator = data.spectators && data.spectators[user?.uid];
        
        if (user && data.host_uid !== user.uid && !isPlayer && !isSpectator && !hasAttemptedJoin) {
          if (user.account_type === 'teacher') {
            setRolePrompt(true);
            setRoom(data);
            return;
          }
          
          setHasAttemptedJoin(true);
          try {
            const { joinRoom } = await import('../api/game.js');
            const joinedData = await joinRoom(roomId, 'player');
            if (isMounted) setRoom(joinedData);
          } catch (joinErr) {
            if (isMounted) setError(joinErr.response?.data?.detail || joinErr.message || 'Gagal masuk ke room ini.');
            return;
          }
        } else {
          setRoom(data);
        }

        if (data.status === 'playing') {
          // Game has started! Navigate to GamePage
          navigate(`/game?mode=multi&roomId=${roomId}`);
          return;
        }

        // Auto start if matchmaking and full
        if (data.is_matchmaking && Object.keys(data.players || {}).length >= data.max_players && data.host_uid === user?.uid) {
           try {
             const { startGame } = await import('../api/game.js');
             await startGame(roomId);
           } catch (e) {
             // Ignore, let next poll handle or show error elsewhere
           }
        }

        // Poll again in 2 seconds
        timeoutId = setTimeout(pollRoom, 2000);
      } catch (err) {
        if (!isMounted) return;
        if (err.response?.status === 404) {
          setError('Room tidak ditemukan atau sudah dibubarkan.');
        } else {
          setError('Gagal memuat info room.');
          timeoutId = setTimeout(pollRoom, 3000);
        }
      }
    };

    pollRoom();

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [roomId, navigate, user, hasAttemptedJoin]);

  const handleJoinWithRole = async (role) => {
    setRolePrompt(false);
    setHasAttemptedJoin(true);
    try {
      const { joinRoom } = await import('../api/game.js');
      const joinedData = await joinRoom(roomId, role);
      setRoom(joinedData);
    } catch (joinErr) {
      setError(joinErr.response?.data?.detail || joinErr.message || 'Gagal masuk ke room ini.');
    }
  };

  const handleStart = async () => {
    if (!room || room.player_count < 2) return;
    setStarting(true);
    try {
      await startGame(roomId);
      // The polling will pick up the 'playing' status and navigate, 
      // but we can also navigate immediately to be faster
      navigate(`/game?mode=multi&roomId=${roomId}`);
    } catch (err) {
      alert(err.response?.data?.detail || err.message || 'Gagal memulai game');
      setStarting(false);
    }
  };

  const handleLeave = async () => {
    try {
      await leaveRoom(roomId);
      navigate('/room');
    } catch (err) {
      navigate('/room');
    }
  };

  if (error) {
    return (
      <div className="page text-center">
        <h2>❌ Ops!</h2>
        <p className="text-muted">{error}</p>
        <button className="btn btn-primary mt-4" onClick={() => navigate('/room')}>Kembali</button>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="page text-center" style={{ paddingTop: '20vh' }}>
        <span className="spinner" style={{ width: 40, height: 40, borderWidth: 4 }} />
        <p className="text-muted mt-4">Memuat Lobi...</p>
      </div>
    );
  }

  const isHost = user?.uid === room.host_uid;
  const canStart = isHost && room.player_count >= 2;

  // Get players array from the dictionary
  const playersList = room.players ? Object.values(room.players) : [];
  
  // Render slots
  const slots = [];
  for (let i = 0; i < room.max_players; i++) {
    const isFilled = i < playersList.length;
    const player = isFilled ? playersList[i] : null;
    const isHostPlayer = player?.uid === room.host_uid;
    
    slots.push(
      <div key={i} className={`player-card ${isHostPlayer ? 'host' : ''}`}>
        {isFilled ? (
          <>
            <div className="player-avatar">👤</div>
            <div className="player-info">
              <div className="player-name">
                {player.display_name}
                {isHostPlayer && <span className="host-badge">HOST</span>}
              </div>
              <div className="text-muted" style={{ fontSize: '0.85rem' }}>Siap Bertanding</div>
            </div>
          </>
        ) : (
          <div className="empty-slot" style={{ width: '100%' }}>
            <span className="spinner" style={{ width: 20, height: 20 }} />
            <span>Menunggu lawan bergabung...</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="waiting-room-page animate-fade-in">
      <h1>Lobi Tunggu</h1>
      
      {room.is_matchmaking ? (
        <div style={{ marginBottom: 32, marginTop: 16 }}>
          <h2 className="text-accent animate-pulse">Mencari Lawan...</h2>
        </div>
      ) : (
        <>
          <p className="text-muted">Berikan kode ini kepada temanmu</p>
          <div className="room-code-display">
            <h2>KODE ROOM</h2>
            <div className="code-box" onClick={() => {
              navigator.clipboard.writeText(room.room_id);
              alert('Kode disalin!');
            }}>
              {room.room_id}
            </div>
          </div>
        </>
      )}

      <div className="players-list">
        {slots}
      </div>

      <div className="room-actions" style={{ display: 'flex', gap: 16, marginTop: 32 }}>
        <button className="btn btn-outline" onClick={handleLeave} style={{ flex: 1 }}>
          Keluar
        </button>
        {isHost ? (
          <button 
            className="btn btn-primary" 
            style={{ flex: 2 }} 
            disabled={!canStart || starting}
            onClick={handleStart}
          >
            {starting ? <span className="spinner" /> : (canStart ? '🚀 MULAI GAME' : 'Tunggu Lawan...')}
          </button>
        ) : (
          <button className="btn btn-primary" style={{ flex: 2 }} disabled>
            Menunggu Host Mulai...
          </button>
        )}
      </div>

      {rolePrompt && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ textAlign: 'center' }}>
            <h2 className="modal-title">Bergabung ke Room</h2>
            <p className="text-muted" style={{ marginBottom: 24 }}>Anda masuk sebagai Guru. Pilih peran Anda di room ini:</p>
            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
              <button className="btn btn-primary" onClick={() => handleJoinWithRole('player')}>
                <i className="fa-solid fa-gamepad" style={{ marginBottom: 8, fontSize: '1.5rem', display: 'block' }}></i>
                Ikut Bermain
              </button>
              <button className="btn btn-secondary" onClick={() => handleJoinWithRole('spectator')} style={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)' }}>
                <i className="fa-solid fa-eye" style={{ marginBottom: 8, fontSize: '1.5rem', display: 'block' }}></i>
                Hanya Memantau
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
