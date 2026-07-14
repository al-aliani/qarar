import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

// Replace with actual URL and Anon key
const supabase = createClient('https://xyzcompany.supabase.co', 'public-anon-key');

export default function LiveCollab({ studyId }) {
  const [onlineUsers, setOnlineUsers] = useState(0);

  useEffect(() => {
    // Supabase Realtime Presence channel
    const room = supabase.channel(`study-${studyId}`, {
      config: { presence: { key: 'user' } },
    });

    room
      .on('presence', { event: 'sync' }, () => {
        const state = room.presenceState();
        setOnlineUsers(Object.keys(state).length);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await room.track({ online_at: new Date().toISOString() });
        }
      });

    return () => {
      supabase.removeChannel(room);
    };
  }, [studyId]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', background: '#f8fafc', borderRadius: '20px', border: '1px solid #e2e8f0', width: 'fit-content' }}>
      <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: onlineUsers > 0 ? '#10b981' : '#cbd5e1' }}></div>
      <span style={{ fontSize: '0.875rem', color: '#475569', fontWeight: '500' }}>
        {onlineUsers} متصل الآن
      </span>
    </div>
  );
}
